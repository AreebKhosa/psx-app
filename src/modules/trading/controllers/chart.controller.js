const chartService = require('../services/chart.service');
const { successResponse, errorResponse, HTTP_STATUS } = require('../../../shared/constants/responseCodes');

class ChartController {
    async getCandles(req, res, next) {
        try {
            const { ticker } = req.params;
            const { timeframe = '1D', limit = 100 } = req.query;

            if (!ticker) {
                return errorResponse(res, 'Ticker symbol is required.', HTTP_STATUS.BAD_REQUEST);
            }

            const data = await chartService.getCandles(ticker, timeframe, parseInt(limit, 10));
            return successResponse(res, data, 'Candlestick data retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async getIndicators(req, res, next) {
        try {
            const { ticker } = req.params;
            const data = await chartService.getCandles(ticker, '1D', 150);
            const closes = data.candles.map((c) => Number(c.close));

            const indicators = {
                ticker: ticker.toUpperCase(),
                rsi_14: chartService.calculateRSI(closes, 14),
                sma_20: chartService.calculateSMA(closes, 20),
                sma_50: chartService.calculateSMA(closes, 50),
                macd: chartService.calculateMACD(closes),
            };

            return successResponse(res, indicators, 'Technical indicators computed.');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ChartController();