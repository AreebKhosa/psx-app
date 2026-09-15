const { Router } = require('express');
const pageController = require('../controllers/page.controller');
const { optionalAuth } = require('../../../shared/middlewares/auth.middleware');

const router = Router();

// Dedicated Stock Profile Page + Live Data + $TICKER Social Feed
router.get('/stock/:ticker', optionalAuth, pageController.getStockPage);

module.exports = router;