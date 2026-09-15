const { query } = require('../../../shared/config/db');
const redisService = require('../../../shared/services/redis.service');
const { getSectorData } = require('../../../shared/constants/sectors');

class CompareService {
    /**
     * Compare a stock directly against its Sector average metrics
     */
    async compareStockVsSector(ticker) {
        const symbolRes = await query(
            `SELECT s.id, s.ticker, s.name, s.sector_code, s.sector_name, s.market_cap_m,
              lmd.current_price, lmd.price_change, lmd.change_pct, lmd.total_volume,
              cp.pe_trailing, cp.pb_ratio, cp.roe_pct, cp.week52_low, cp.week52_high
       FROM symbols s
       LEFT JOIN live_market_depth lmd ON s.id = lmd.symbol_id
       LEFT JOIN (
         SELECT symbol_id, 
                MAX(CASE WHEN period_year = '2023' THEN peg END) as pb_ratio,
                MAX(CASE WHEN period_year = '2023' THEN net_margin_pct END) as roe_pct,
                8.14 as pe_trailing, 0 as week52_low, 0 as week52_high
         FROM company_ratios GROUP BY symbol_id
       ) cp ON s.id = cp.symbol_id
       WHERE s.ticker = $1 LIMIT 1;`,
            [ticker.toUpperCase()]
        );

        if (symbolRes.rows.length === 0) {
            throw new Error(`Stock '${ticker}' not found.`);
        }

        const stock = symbolRes.rows[0];
        const sectorCode = stock.sector_code;

        // 1. Fetch live sector metrics from Redis cache
        let sectorData = await redisService.getJson(`sector:valuations:${sectorCode}`);

        // Fallback if cache is cold
        if (!sectorData) {
            const dbSec = await query(
                `SELECT AVG(lmd.change_pct) as avg_change_pct, SUM(lmd.total_volume) as total_volume,
                SUM(s.market_cap_m)/1000 as market_cap_bn
         FROM symbols s
         JOIN live_market_depth lmd ON s.id = lmd.symbol_id
         WHERE s.sector_code = $1;`,
                [sectorCode]
            );
            sectorData = dbSec.rows[0] || {};
        }

        const sectorMeta = getSectorData(sectorCode);

        return {
            stock: {
                ticker: stock.ticker,
                name: stock.name,
                current_price: Number(stock.current_price || 0),
                change_pct: Number(stock.change_pct || 0),
                volume: Number(stock.total_volume || 0),
                market_cap_m: Number(stock.market_cap_m || 0),
                pe: Number(stock.pe_trailing || 0),
                pb: Number(stock.pb_ratio || 0),
                roe: Number(stock.roe_pct || 0),
            },
            sector: {
                code: sectorCode,
                name: stock.sector_name || sectorMeta?.name || 'MISCELLANEOUS',
                macro_drivers: sectorMeta?.macro_tags || [],
                description: sectorMeta?.desc || '',
                avg_change_pct: Number(sectorData.avg_change_pct || 0),
                total_volume: Number(sectorData.total_volume || 0),
                market_cap_bn: Number(sectorData.market_cap_bn || 0),
                pe_trailing: Number(sectorData.pe_trailing || 8.14),
                pb_ratio: Number(sectorData.pb_ratio || 1.28),
                roe_pct: Number(sectorData.roe_pct || 16.17),
            },
            relative_strength: {
                outperforming_sector: Number(stock.change_pct || 0) > Number(sectorData.avg_change_pct || 0),
                alpha_spread_pct: Number(((stock.change_pct || 0) - (sectorData.avg_change_pct || 0)).toFixed(2)),
            },
        };
    }

    /**
     * Compare a stock directly against an Index (e.g., KSE100, KMI30)
     */
    async compareStockVsIndex(ticker, indexCode = 'KSE100') {
        const cleanTicker = ticker.toUpperCase();
        const cleanIndex = indexCode.toUpperCase();

        // 1. Get Stock Live Data
        const liveStock = await redisService.getStockPrice(cleanTicker);
        // 2. Get Index Live Data
        const liveIndex = await redisService.getIndexData(cleanIndex);
        // 3. Get Index Valuation
        const indexValuation = await redisService.getJson(`index:valuations:${cleanIndex}`);

        return {
            ticker: cleanTicker,
            index: cleanIndex,
            stock_change_pct: liveStock ? liveStock.change_pct : 0.0,
            index_change_pct: liveIndex ? liveIndex.change_pct : 0.0,
            index_current_points: liveIndex ? liveIndex.current_value : 0.0,
            index_valuation: indexValuation || {},
            outperforming_index: liveStock && liveIndex ? liveStock.change_pct > liveIndex.change_pct : false,
        };
    }

    /**
     * Compare two stocks side-by-side
     */
    async compareTwoStocks(tickerA, tickerB) {
        const stockA = await this.compareStockVsSector(tickerA);
        const stockB = await this.compareStockVsSector(tickerB);

        return {
            stockA: stockA.stock,
            stockB: stockB.stock,
        };
    }
}

module.exports = new CompareService();