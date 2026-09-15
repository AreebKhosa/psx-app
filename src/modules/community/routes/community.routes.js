const { Router } = require('express');
const communityController = require('../controllers/community.controller');
const { requireAuth, optionalAuth } = require('../../../shared/middlewares/auth.middleware');

const router = Router();

// Explore / List all communities (Public)
router.get('/', communityController.listCommunities);

// Create a new Community (Protected)
router.post('/', requireAuth, communityController.createCommunity);

// Get Community Details by ID or Slug (Optional Auth)
router.get('/:idOrSlug', optionalAuth, communityController.getCommunity);

// Get Posts inside a specific Community
router.get('/:communityId/feed', optionalAuth, communityController.getCommunityFeed);

// Join Community (Protected)
router.post('/:communityId/join', requireAuth, communityController.joinCommunity);

// Leave Community (Protected)
router.post('/:communityId/leave', requireAuth, communityController.leaveCommunity);

module.exports = router;