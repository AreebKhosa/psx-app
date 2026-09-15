const communityService = require('../services/community.service');
const feedService = require('../services/feed.service');
const { successResponse, HTTP_STATUS } = require('../../../shared/constants/responseCodes');

class CommunityController {
    async createCommunity(req, res, next) {
        try {
            const creatorId = req.user.id;
            const { name, description, avatarUrl } = req.body;

            const data = await communityService.createCommunity({ creatorId, name, description, avatarUrl });
            return successResponse(res, data, 'Community created successfully.', HTTP_STATUS.CREATED);
        } catch (err) {
            next(err);
        }
    }

    async joinCommunity(req, res, next) {
        try {
            const userId = req.user.id;
            const { communityId } = req.params;

            const data = await communityService.joinCommunity(userId, communityId);
            return successResponse(res, data, data.message);
        } catch (err) {
            next(err);
        }
    }

    async leaveCommunity(req, res, next) {
        try {
            const userId = req.user.id;
            const { communityId } = req.params;

            const data = await communityService.leaveCommunity(userId, communityId);
            return successResponse(res, data, data.message);
        } catch (err) {
            next(err);
        }
    }

    async getCommunity(req, res, next) {
        try {
            const currentUserId = req.user?.id || null;
            const { idOrSlug } = req.params;

            const data = await communityService.getCommunityDetails(idOrSlug, currentUserId);
            return successResponse(res, data, 'Community details retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async getCommunityFeed(req, res, next) {
        try {
            const currentUserId = req.user?.id || null;
            const { communityId } = req.params;
            const { limit = 20, offset = 0 } = req.query;

            const data = await feedService.getCommunityFeed(communityId, currentUserId, parseInt(limit, 10), parseInt(offset, 10));
            return successResponse(res, data, 'Community feed retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async listCommunities(req, res, next) {
        try {
            const { limit = 30, offset = 0 } = req.query;
            const data = await communityService.listCommunities(parseInt(limit, 10), parseInt(offset, 10));
            return successResponse(res, data, 'Communities list retrieved.');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new CommunityController();