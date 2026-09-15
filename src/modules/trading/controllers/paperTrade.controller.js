const orderEngineService = require('../services/orderEngine.service');
const { successResponse, errorResponse, HTTP_STATUS } = require('../../../shared/constants/responseCodes');

class PaperTradeController {
    async placeBuyOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const { ticker, quantity, orderType = 'MARKET', targetPrice } = req.body;

            if (!ticker || !quantity) {
                return errorResponse(res, 'Ticker and quantity are required.', HTTP_STATUS.BAD_REQUEST);
            }

            const data = await orderEngineService.executeBuyOrder({
                userId,
                ticker,
                quantity,
                orderType,
                targetPrice,
            });

            return successResponse(res, data, 'Buy order executed successfully.', HTTP_STATUS.CREATED);
        } catch (err) {
            next(err);
        }
    }

    async placeSellOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const { ticker, quantity, orderType = 'MARKET', targetPrice } = req.body;

            if (!ticker || !quantity) {
                return errorResponse(res, 'Ticker and quantity are required.', HTTP_STATUS.BAD_REQUEST);
            }

            const data = await orderEngineService.executeSellOrder({
                userId,
                ticker,
                quantity,
                orderType,
                targetPrice,
            });

            return successResponse(res, data, 'Sell order executed successfully.');
        } catch (err) {
            next(err);
        }
    }

    async getOrderHistory(req, res, next) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0 } = req.query;

            const data = await orderEngineService.getOrderHistory(userId, parseInt(limit, 10), parseInt(offset, 10));
            return successResponse(res, data, 'Order history retrieved.');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PaperTradeController();