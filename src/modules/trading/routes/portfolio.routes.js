const { Router } = require('express');
const portfolioController = require('../controllers/portfolio.controller');
const { requireAuth } = require('../../../shared/middlewares/auth.middleware');

const router = Router();

// Fetch real-time portfolio value, P&L, and sector allocation
router.get('/', requireAuth, portfolioController.getPortfolio);

module.exports = router;