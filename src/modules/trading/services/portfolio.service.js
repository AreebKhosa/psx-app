const { query } = require('../../../shared/config/db');
const redisService = require('../../../shared/services/redis.service');
const orderEngineService = require('./orderEngine.service');

class PortfolioService {
    /**
     * Get full portfolio analytics, individual holdings P&L, and sector diversification
     */
    async getPortfolioDetails(userId) {
        const portfolio = await orderEngineService.getOrCreatePortfolio(userId);
        const cashBalance = Number(portfolio.cash_balance);

        // 1. Fetch user holdings with sector info
        const res = await query(
            `SELECT ph.*, s.ticker, s.name as company_name, s.sector_code, s.sector_name,
              COALESCE(lmd.current_price, s.ldcp, 0.0) as db_price
       FROM paper_holdings ph
       JOIN symbols s ON ph.symbol_id = s.id
       LEFT JOIN live_market_depth lmd ON s.id = lmd.symbol_id
       WHERE ph.portfolio_id = $1;`,
            [portfolio.id]
        );

        let totalStockValue = 0;
        let totalInvested = 0;
        const holdings = [];
        const sectorWeights = {};

        // 2. Compute live metrics for each holding
        for (const h of res.rows) {
            const liveRedis = await redisService.getStockPrice(h.ticker);
            const currentPrice = liveRedis && liveRedis.current_price > 0 ? Number(liveRedis.current_price) : Number(h.db_price);

            const qty = parseInt(h.quantity, 10);
            const invested = Number(h.total_invested);
            const currentValue = Number((qty * currentPrice).toFixed(2));
            const pnl = Number((currentValue - invested).toFixed(2));
            const pnlPct = invested > 0 ? Number(((pnl / invested) * 100).toFixed(2)) : 0.0;

            totalStockValue += currentValue;
            totalInvested += invested;

            // Group by sector
            const sector = h.sector_name || 'MISCELLANEOUS';
            sectorWeights[sector] = (sectorWeights[sector] || 0) + currentValue;

            holdings.push({
                holding_id: h.id,
                ticker: h.ticker,
                company_name: h.company_name,
                sector_name: sector,
                quantity: qty,
                avg_buy_price: Number(h.avg_buy_price),
                current_price: currentPrice,
                total_invested: invested,
                current_value: currentValue,
                unrealized_pnl: pnl,
                unrealized_pnl_pct: pnlPct,
            });
        }

        const totalPortfolioValue = Number((cashBalance + totalStockValue).toFixed(2));
        const totalPnl = Number((totalStockValue - totalInvested).toFixed(2));
        const totalPnlPct = totalInvested > 0 ? Number(((totalPnl / totalInvested) * 100).toFixed(2)) : 0.0;

        // 3. Format sector allocation percentages
        const sectorAllocation = [];
        if (cashBalance > 0 && totalPortfolioValue > 0) {
            sectorAllocation.push({
                sector: 'CASH',
                value: cashBalance,
                allocation_pct: Number(((cashBalance / totalPortfolioValue) * 100).toFixed(2)),
            });
        }

        for (const [sec, val] of Object.entries(sectorWeights)) {
            sectorAllocation.push({
                sector: sec,
                value: Number(val.toFixed(2)),
                allocation_pct: totalPortfolioValue > 0 ? Number(((val / totalPortfolioValue) * 100).toFixed(2)) : 0.0,
            });
        }

        return {
            summary: {
                total_portfolio_value: totalPortfolioValue,
                cash_balance: cashBalance,
                stock_holdings_value: Number(totalStockValue.toFixed(2)),
                total_invested: Number(totalInvested.toFixed(2)),
                total_pnl: totalPnl,
                total_pnl_pct: totalPnlPct,
                initial_balance: Number(portfolio.initial_balance),
            },
            sector_allocation: sectorAllocation,
            holdings: holdings.sort((a, b) => b.current_value - a.current_value),
        };
    }
}

module.exports = new PortfolioService();