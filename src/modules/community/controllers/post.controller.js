const postService = require('../services/post.service');
const feedService = require('../services/feed.service');
const imageUploadService = require('../../../shared/services/imageUpload.service');
const { successResponse, errorResponse, HTTP_STATUS } = require('../../../shared/constants/responseCodes');

class PostController {
    async createPost(req, res, next) {
        try {
            const userId = req.user.id;
            const { content, communityId } = req.body;

            // Handle image attachments via Cloudinary if uploaded
            const mediaUrls = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadRes = await imageUploadService.uploadFromBuffer(file.buffer, 'posts');
                    mediaUrls.push(uploadRes.url);
                }
            }

            const data = await postService.createPost({
                userId,
                content,
                communityId,
                mediaUrls,
            });

            return successResponse(res, data, 'Post created successfully.', HTTP_STATUS.CREATED);
        } catch (err) {
            next(err);
        }
    }

    async getGlobalFeed(req, res, next) {
        try {
            const currentUserId = req.user?.id || null;
            const { limit = 20, offset = 0 } = req.query;

            const data = await feedService.getGlobalFeed(currentUserId, parseInt(limit, 10), parseInt(offset, 10));
            return successResponse(res, data, 'Global feed retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async getTickerFeed(req, res, next) {
        try {
            const { ticker } = req.params;
            const currentUserId = req.user?.id || null;
            const { limit = 20, offset = 0 } = req.query;

            const data = await feedService.getTickerFeed(ticker, currentUserId, parseInt(limit, 10), parseInt(offset, 10));
            return successResponse(res, data, `Feed for $${ticker.toUpperCase()} retrieved.`);
        } catch (err) {
            next(err);
        }
    }

    async toggleLike(req, res, next) {
        try {
            const userId = req.user.id;
            const { postId } = req.params;

            const data = await postService.toggleLike(userId, postId);
            return successResponse(res, data, data.liked ? 'Post liked.' : 'Post unliked.');
        } catch (err) {
            next(err);
        }
    }

    async addComment(req, res, next) {
        try {
            const userId = req.user.id;
            const { postId } = req.params;
            const { content } = req.body;

            const data = await postService.addComment(userId, postId, content);
            return successResponse(res, data, 'Comment added.', HTTP_STATUS.CREATED);
        } catch (err) {
            next(err);
        }
    }

    async getComments(req, res, next) {
        try {
            const { postId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const data = await postService.getPostComments(postId, parseInt(limit, 10), parseInt(offset, 10));
            return successResponse(res, data, 'Comments retrieved.');
        } catch (err) {
            next(err);
        }
    }

    async deletePost(req, res, next) {
        try {
            const userId = req.user.id;
            const { postId } = req.params;

            const data = await postService.deletePost(userId, postId);
            return successResponse(res, data, 'Post deleted.');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PostController();