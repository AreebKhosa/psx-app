const { query } = require('../../../shared/config/db');

class PostService {
    /**
     * Helper to extract $CASHTAGS and #HASHTAGS from post text
     */
    _extractTags(content) {
        const cashtagMatches = content.match(/\$[A-Za-z0-9]+/g) || [];
        const hashtagMatches = content.match(/#[A-Za-z0-9_]+/g) || [];

        const cashtags = [...new Set(cashtagMatches.map((t) => t.toUpperCase()))];
        const hashtags = [...new Set(hashtagMatches.map((t) => t.toUpperCase()))];

        return { cashtags, hashtags };
    }

    /**
     * Create a new post (supports images and community tagging)
     */
    async createPost({ userId, content, communityId = null, mediaUrls = [] }) {
        if (!content || !content.trim()) {
            throw new Error('Post content cannot be empty.');
        }

        const { cashtags, hashtags } = this._extractTags(content);

        const res = await query(
            `INSERT INTO posts (user_id, community_id, content, media_urls, cashtags, hashtags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
            [userId, communityId || null, content.trim(), mediaUrls, cashtags, hashtags]
        );

        return res.rows[0];
    }

    /**
     * Like / Unlike a post (Toggle behavior)
     */
    async toggleLike(userId, postId) {
        const existing = await query(
            'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1;',
            [postId, userId]
        );

        if (existing.rows.length > 0) {
            // Unlike
            await query('DELETE FROM post_likes WHERE id = $1;', [existing.rows[0].id]);
            await query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1;', [postId]);
            return { liked: false };
        } else {
            // Like
            await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2);', [postId, userId]);
            await query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1;', [postId]);
            return { liked: true };
        }
    }

    /**
     * Add a comment to a post
     */
    async addComment(userId, postId, content) {
        if (!content || !content.trim()) {
            throw new Error('Comment content cannot be empty.');
        }

        const res = await query(
            `INSERT INTO post_comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *;`,
            [postId, userId, content.trim()]
        );

        await query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1;', [postId]);

        // Fetch comment with user details
        const commentRes = await query(
            `SELECT pc.*, u.username, u.avatar_url
       FROM post_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.id = $1;`,
            [res.rows[0].id]
        );

        return commentRes.rows[0];
    }

    /**
     * Get all comments for a post
     */
    async getPostComments(postId, limit = 50, offset = 0) {
        const res = await query(
            `SELECT pc.*, u.username, u.avatar_url
       FROM post_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.post_id = $1
       ORDER BY pc.created_at ASC
       LIMIT $2 OFFSET $3;`,
            [postId, limit, offset]
        );
        return res.rows;
    }

    /**
     * Delete a post (Owner or Admin)
     */
    async deletePost(userId, postId) {
        const postRes = await query('SELECT user_id FROM posts WHERE id = $1;', [postId]);
        if (postRes.rows.length === 0) throw new Error('Post not found.');

        if (postRes.rows[0].user_id !== userId) {
            throw new Error('You are not authorized to delete this post.');
        }

        await query('DELETE FROM posts WHERE id = $1;', [postId]);
        return { message: 'Post deleted successfully.' };
    }
}

module.exports = new PostService();