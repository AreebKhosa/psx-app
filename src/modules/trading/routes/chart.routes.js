const { Router } = require('express');
const chartController = require('../controllers/chart.controller');
const compareController = require('../controllers/compare.controller');

const router = Router();

// Candlestick historical data & live quotes
router.get('/:ticker/candles', chartController.getCandles);

// Technical Indicators (RSI, SMA, MACD)
router.get('/:ticker/indicators', chartController.getIndicators);

// Stock vs Sector Comparison
router.get('/:ticker/compare/sector', compareController.compareVsSector);

// Stock vs Index Comparison (e.g. ?index=KSE100)
router.get('/:ticker/compare/index', compareController.compareVsIndex);

// Peer-to-Peer Stock Comparison (?tickerA=LUCK&tickerB=DGKC)
router.get('/compare/peers', compareController.compareTwoStocks);

module.exports = router;