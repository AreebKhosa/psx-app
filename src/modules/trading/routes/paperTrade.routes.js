const { Router } = require('express');
const paperTradeController = require('../controllers/paperTrade.controller');
const { requireAuth } = require('../../../shared/middlewares/auth.middleware');
const { tradingLimiter } = require('../../../shared/security/rateLimiter');

const router = Router();

// Place Buy order (Protected + 25 orders/min rate limit)
router.post('/buy', requireAuth, tradingLimiter, paperTradeController.placeBuyOrder);

// Place Sell order (Protected + 25 orders/min rate limit)
router.post('/sell', requireAuth, tradingLimiter, paperTradeController.placeSellOrder);

// Fetch executed order history
router.get('/history', requireAuth, paperTradeController.getOrderHistory);

module.exports = router;