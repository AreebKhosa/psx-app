const { Router } = require('express');
const postController = require('../controllers/post.controller');
const { requireAuth, optionalAuth } = require('../../../shared/middlewares/auth.middleware');
const { uploadArray } = require('../../../shared/middlewares/upload.middleware');

const router = Router();

// Global Feed (Public / Optional Auth for personalized 'is_liked' status)
router.get('/feed', optionalAuth, postController.getGlobalFeed);

// Feed filtered by $CASHTAG (e.g., /api/v1/community/posts/tag/OGDC)
router.get('/tag/:ticker', optionalAuth, postController.getTickerFeed);

// Create Post with up to 4 images (Protected)
router.post('/', requireAuth, uploadArray('images', 4), postController.createPost);

// Like / Unlike Post (Protected)
router.post('/:postId/like', requireAuth, postController.toggleLike);

// Comments Endpoints
router.post('/:postId/comments', requireAuth, postController.addComment);
router.get('/:postId/comments', postController.getComments);

// Delete Post (Protected)
router.delete('/:postId', requireAuth, postController.deletePost);

module.exports = router;