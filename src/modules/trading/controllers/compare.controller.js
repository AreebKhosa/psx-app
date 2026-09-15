const compareService = require('../services/compare.service');
const { successResponse, errorResponse, HTTP_STATUS } = require('../../../shared/constants/responseCodes');

class CompareController {
    async compareVsSector(req, res, next) {
        try {
            const { ticker } = req.params;
            if (!ticker) return errorResponse(res, 'Ticker is required.', HTTP_STATUS.BAD_REQUEST);

            const data = await compareService.compareStockVsSector(ticker);
            return successResponse(res, data, 'Stock vs Sector comparison retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async compareVsIndex(req, res, next) {
        try {
            const { ticker } = req.params;
            const { index = 'KSE100' } = req.query;

            const data = await compareService.compareStockVsIndex(ticker, index);
            return successResponse(res, data, 'Stock vs Index comparison retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async compareTwoStocks(req, res, next) {
        try {
            const { tickerA, tickerB } = req.query;
            if (!tickerA || !tickerB) {
                return errorResponse(res, 'Both tickerA and tickerB query parameters are required.', HTTP_STATUS.BAD_REQUEST);
            }

            const data = await compareService.compareTwoStocks(tickerA, tickerB);
            return successResponse(res, data, 'Peer-to-peer comparison retrieved.');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new CompareController();