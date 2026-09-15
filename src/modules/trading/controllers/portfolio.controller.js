const portfolioService = require('../services/portfolio.service');
const { successResponse } = require('../../../shared/constants/responseCodes');

class PortfolioController {
    async getPortfolio(req, res, next) {
        try {
            const userId = req.user.id;
            const data = await portfolioService.getPortfolioDetails(userId);
            return successResponse(res, data, 'Portfolio details and allocation retrieved.');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PortfolioController();