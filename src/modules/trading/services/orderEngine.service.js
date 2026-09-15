const { query, getClient } = require('../../../shared/config/db');
const redisService = require('../../../shared/services/redis.service');
const { ERROR_CODES } = require('../../../shared/constants/responseCodes');

class OrderEngineService {
    /**
     * Fetch or auto-initialize a user's paper portfolio (Default: 1,000,000 PKR)
     */
    async getOrCreatePortfolio(userId) {
        let res = await query('SELECT * FROM paper_portfolios WHERE user_id = $1 LIMIT 1;', [userId]);
        if (res.rows.length === 0) {
            res = await query(
                `INSERT INTO paper_portfolios (user_id, cash_balance, initial_balance)
         VALUES ($1, 1000000.00, 1000000.00)
         RETURNING *;`,
                [userId]
            );
        }
        return res.rows[0];
    }

    /**
     * Helper to resolve the latest market price of a ticker
     */
    async _getLivePrice(ticker) {
        const liveRedis = await redisService.getStockPrice(ticker);
        if (liveRedis && liveRedis.current_price > 0) {
            return Number(liveRedis.current_price);
        }

        const dbRes = await query(
            `SELECT COALESCE(lmd.current_price, s.open_price, s.ldcp, 0.0) as price
       FROM symbols s
       LEFT JOIN live_market_depth lmd ON s.id = lmd.symbol_id
       WHERE s.ticker = $1 LIMIT 1;`,
            [ticker.toUpperCase()]
        );

        if (dbRes.rows.length === 0 || Number(dbRes.rows[0].price) <= 0) {
            throw new Error(`Unable to determine market price for ticker '${ticker}'.`);
        }
        return Number(dbRes.rows[0].price);
    }

    /**
     * Execute a Paper BUY Order
     */
    async executeBuyOrder({ userId, ticker, quantity, orderType = 'MARKET', targetPrice = null }) {
        const cleanTicker = ticker.toUpperCase();
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error('Quantity must be a positive integer.');

        const symbolRes = await query('SELECT id FROM symbols WHERE ticker = $1 LIMIT 1;', [cleanTicker]);
        if (symbolRes.rows.length === 0) throw new Error(`Stock ticker '${cleanTicker}' not found.`);
        const symbolId = symbolRes.rows[0].id;

        const currentPrice = await this._getLivePrice(cleanTicker);
        const executionPrice = orderType === 'LIMIT' && targetPrice ? Number(targetPrice) : currentPrice;
        const totalCost = Number((executionPrice * qty).toFixed(2));

        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Lock portfolio row for update to prevent race conditions
            const portRes = await client.query(
                'SELECT * FROM paper_portfolios WHERE user_id = $1 FOR UPDATE;',
                [userId]
            );
            const portfolio = portRes.rows[0];

            if (Number(portfolio.cash_balance) < totalCost) {
                const error = new Error('Insufficient funds to complete this purchase.');
                error.errorCode = ERROR_CODES.INSUFFICIENT_FUNDS;
                throw error;
            }

            // 2. Deduct cash balance
            const newBalance = Number((Number(portfolio.cash_balance) - totalCost).toFixed(2));
            await client.query(
                'UPDATE paper_portfolios SET cash_balance = $1, updated_at = NOW() WHERE id = $2;',
                [newBalance, portfolio.id]
            );

            // 3. Upsert Holding with Weighted Average Cost calculation
            const holdingRes = await client.query(
                'SELECT * FROM paper_holdings WHERE portfolio_id = $1 AND symbol_id = $2;',
                [portfolio.id, symbolId]
            );

            if (holdingRes.rows.length > 0) {
                const h = holdingRes.rows[0];
                const newQty = h.quantity + qty;
                const newInvested = Number(h.total_invested) + totalCost;
                const newAvgPrice = Number((newInvested / newQty).toFixed(2));

                await client.query(
                    `UPDATE paper_holdings 
           SET quantity = $1, avg_buy_price = $2, total_invested = $3, updated_at = NOW()
           WHERE id = $4;`,
                    [newQty, newAvgPrice, newInvested, h.id]
                );
            } else {
                await client.query(
                    `INSERT INTO paper_holdings (portfolio_id, symbol_id, quantity, avg_buy_price, total_invested)
           VALUES ($1, $2, $3, $4, $5);`,
                    [portfolio.id, symbolId, qty, executionPrice, totalCost]
                );
            }

            // 4. Log executed order
            const orderRes = await client.query(
                `INSERT INTO paper_orders (
          portfolio_id, symbol_id, order_side, order_type, target_price, 
          execution_price, quantity, total_amount, status
        ) VALUES ($1, $2, 'BUY', $3, $4, $5, $6, $7, 'FILLED')
        RETURNING *;`,
                [portfolio.id, symbolId, orderType, executionPrice, executionPrice, qty, totalCost]
            );

            await client.query('COMMIT');

            return {
                order: orderRes.rows[0],
                ticker: cleanTicker,
                remaining_cash: newBalance,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Execute a Paper SELL Order
     */
    async executeSellOrder({ userId, ticker, quantity, orderType = 'MARKET', targetPrice = null }) {
        const cleanTicker = ticker.toUpperCase();
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error('Quantity must be a positive integer.');

        const symbolRes = await query('SELECT id FROM symbols WHERE ticker = $1 LIMIT 1;', [cleanTicker]);
        if (symbolRes.rows.length === 0) throw new Error(`Stock ticker '${cleanTicker}' not found.`);
        const symbolId = symbolRes.rows[0].id;

        const currentPrice = await this._getLivePrice(cleanTicker);
        const executionPrice = orderType === 'LIMIT' && targetPrice ? Number(targetPrice) : currentPrice;
        const totalProceeds = Number((executionPrice * qty).toFixed(2));

        const client = await getClient();
        try {
            await client.query('BEGIN');

            const portRes = await client.query(
                'SELECT * FROM paper_portfolios WHERE user_id = $1 FOR UPDATE;',
                [userId]
            );
            const portfolio = portRes.rows[0];

            // 1. Validate user has enough shares
            const holdingRes = await client.query(
                'SELECT * FROM paper_holdings WHERE portfolio_id = $1 AND symbol_id = $2 FOR UPDATE;',
                [portfolio.id, symbolId]
            );

            if (holdingRes.rows.length === 0 || holdingRes.rows[0].quantity < qty) {
                const error = new Error('You do not own enough shares to fulfill this order.');
                error.errorCode = ERROR_CODES.INSUFFICIENT_SHARES;
                throw error;
            }

            const holding = holdingRes.rows[0];
            const remainingQty = holding.quantity - qty;

            // 2. Update or delete holding
            if (remainingQty === 0) {
                await client.query('DELETE FROM paper_holdings WHERE id = $1;', [holding.id]);
            } else {
                const remainingInvested = Number((remainingQty * Number(holding.avg_buy_price)).toFixed(2));
                await client.query(
                    'UPDATE paper_holdings SET quantity = $1, total_invested = $2, updated_at = NOW() WHERE id = $3;',
                    [remainingQty, remainingInvested, holding.id]
                );
            }

            // 3. Credit cash balance
            const newBalance = Number((Number(portfolio.cash_balance) + totalProceeds).toFixed(2));
            await client.query(
                'UPDATE paper_portfolios SET cash_balance = $1, updated_at = NOW() WHERE id = $2;',
                [newBalance, portfolio.id]
            );

            // 4. Log order
            const orderRes = await client.query(
                `INSERT INTO paper_orders (
          portfolio_id, symbol_id, order_side, order_type, target_price, 
          execution_price, quantity, total_amount, status
        ) VALUES ($1, $2, 'SELL', $3, $4, $5, $6, $7, 'FILLED')
        RETURNING *;`,
                [portfolio.id, symbolId, orderType, executionPrice, executionPrice, qty, totalProceeds]
            );

            await client.query('COMMIT');

            return {
                order: orderRes.rows[0],
                ticker: cleanTicker,
                new_cash_balance: newBalance,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get user order history
     */
    async getOrderHistory(userId, limit = 50, offset = 0) {
        const portfolio = await this.getOrCreatePortfolio(userId);
        const res = await query(
            `SELECT po.*, s.ticker, s.name as company_name 
       FROM paper_orders po
       JOIN symbols s ON po.symbol_id = s.id
       WHERE po.portfolio_id = $1
       ORDER BY po.created_at DESC
       LIMIT $2 OFFSET $3;`,
            [portfolio.id, limit, offset]
        );
        return res.rows;
    }
}

module.exports = new OrderEngineService();