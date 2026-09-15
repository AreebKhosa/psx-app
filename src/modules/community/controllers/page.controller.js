const { query } = require('../../../shared/config/db');
const redisService = require('../../../shared/services/redis.service');
const feedService = require('../services/feed.service');
const { successResponse, errorResponse, HTTP_STATUS } = require('../../../shared/constants/responseCodes');

class PageController {
    /**
     * Returns dedicated stock page (Profile + Live Stats + Social Posts for $TICKER)
     */
    async getStockPage(req, res, next) {
        try {
            const { ticker } = req.params;
            const currentUserId = req.user?.id || null;
            const cleanTicker = ticker.toUpperCase();

            // 1. Fetch Company info & live price
            const symbolRes = await query(
                `SELECT s.id, s.ticker, s.name, s.sector_code, s.sector_name,
                cp.business_description, cp.ceo, cp.chairperson, cp.website,
                cp.circuit_low, cp.circuit_high, cp.week52_low, cp.week52_high,
                cp.total_shares, cp.free_float_shares, cp.free_float_pct
         FROM symbols s
         LEFT JOIN company_profiles cp ON s.id = cp.symbol_id
         WHERE s.ticker = $1 LIMIT 1;`,
                [cleanTicker]
            );

            if (symbolRes.rows.length === 0) {
                return errorResponse(res, `Stock '$${cleanTicker}' not found.`, HTTP_STATUS.NOT_FOUND);
            }

            const stock = symbolRes.rows[0];
            const livePrice = await redisService.getStockPrice(cleanTicker);

            // 2. Fetch social feed tagged with $TICKER
            const posts = await feedService.getTickerFeed(cleanTicker, currentUserId, 15, 0);

            return successResponse(
                res,
                {
                    stock,
                    live: livePrice,
                    social_feed: posts,
                },
                `Dedicated page for $${cleanTicker} retrieved.`
            );
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PageController();