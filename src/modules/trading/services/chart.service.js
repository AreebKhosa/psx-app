const { query } = require('../../../shared/config/db');
const redisService = require('../../../shared/services/redis.service');

class ChartService {
    /**
     * Fetch OHLC candlestick data for a symbol
     */
    async getCandles(ticker, timeframe = '1D', limit = 100) {
        const symbolRes = await query('SELECT id, ticker, name FROM symbols WHERE ticker = $1 LIMIT 1;', [
            ticker.toUpperCase(),
        ]);

        if (symbolRes.rows.length === 0) {
            throw new Error(`Stock ticker '${ticker}' not found.`);
        }

        const symbolId = symbolRes.rows[0].id;

        // Fetch candles from DB
        const res = await query(
            `SELECT open, high, low, close, volume, timestamp 
       FROM stock_candles_1m 
       WHERE symbol_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2;`,
            [symbolId, limit]
        );

        const candles = res.rows.reverse();

        // Attach latest live price from Redis if available
        const livePrice = await redisService.getStockPrice(ticker);

        return {
            ticker: ticker.toUpperCase(),
            timeframe,
            live: livePrice,
            candles,
        };
    }

    /**
     * Calculate Relative Strength Index (RSI - 14 period)
     */
    calculateRSI(closes, period = 14) {
        if (closes.length <= period) return [];

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        const rsiArray = [];
        const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiArray.push(100 - 100 / (1 + firstRS));

        for (let i = period + 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) {
                avgGain = (avgGain * (period - 1) + diff) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - diff) / period;
            }

            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsiArray.push(Number((100 - 100 / (1 + rs)).toFixed(2)));
        }

        return rsiArray;
    }

    /**
     * Calculate Simple Moving Average (SMA)
     */
    calculateSMA(closes, period = 20) {
        const sma = [];
        for (let i = period - 1; i < closes.length; i++) {
            const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(Number((sum / period).toFixed(2)));
        }
        return sma;
    }

    /**
     * Calculate Moving Average Convergence Divergence (MACD 12, 26, 9)
     */
    calculateMACD(closes) {
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);

        const minLen = Math.min(ema12.length, ema26.length);
        const macdLine = [];

        const offset12 = ema12.length - minLen;
        const offset26 = ema26.length - minLen;

        for (let i = 0; i < minLen; i++) {
            macdLine.push(Number((ema12[offset12 + i] - ema26[offset26 + i]).toFixed(2)));
        }

        const signalLine = this.calculateEMA(macdLine, 9);
        return { macdLine, signalLine };
    }

    /**
     * Helper to calculate Exponential Moving Average (EMA)
     */
    calculateEMA(values, period) {
        if (values.length < period) return [];
        const k = 2 / (period + 1);
        const emaArray = [];

        // First EMA is SMA
        let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
        emaArray.push(Number(ema.toFixed(2)));

        for (let i = period; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
            emaArray.push(Number(ema.toFixed(2)));
        }
        return emaArray;
    }
}

module.exports = new ChartService();