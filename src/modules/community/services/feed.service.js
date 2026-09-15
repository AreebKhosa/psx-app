const { query } = require('../../../shared/config/db');

class FeedService {
    /**
     * Helper to build post query with author info and user's like status
     */
    _buildFeedQuery(whereClause, params) {
        return `
      SELECT 
        p.id, p.content, p.media_urls, p.cashtags, p.hashtags, 
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as user_id, u.username, u.avatar_url,
        c.id as community_id, c.name as community_name, c.slug as community_slug,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $1
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    }

    /**
     * Get Global Timeline Feed
     */
    async getGlobalFeed(currentUserId = null, limit = 20, offset = 0) {
        const sql = this._buildFeedQuery('', [currentUserId, limit, offset]);
        const res = await query(sql, [currentUserId, limit, offset]);
        return res.rows;
    }

    /**
     * Get Feed for a specific Stock Ticker (e.g. $OGDC or $LUCK)
     */
    async getTickerFeed(ticker, currentUserId = null, limit = 20, offset = 0) {
        const formattedTag = `$${ticker.toUpperCase().replace('$', '')}`;
        const whereClause = `WHERE $4 = ANY(p.cashtags)`;

        const sql = `
      SELECT 
        p.id, p.content, p.media_urls, p.cashtags, p.hashtags, 
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as user_id, u.username, u.avatar_url,
        c.id as community_id, c.name as community_name, c.slug as community_slug,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $1
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

        const res = await query(sql, [currentUserId, limit, offset, formattedTag]);
        return res.rows;
    }

    /**
     * Get Feed for a specific Community group
     */
    async getCommunityFeed(communityId, currentUserId = null, limit = 20, offset = 0) {
        const whereClause = `WHERE p.community_id = $4`;

        const sql = `
      SELECT 
        p.id, p.content, p.media_urls, p.cashtags, p.hashtags, 
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as user_id, u.username, u.avatar_url,
        c.id as community_id, c.name as community_name,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN communities c ON p.community_id = c.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $1
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

        const res = await query(sql, [currentUserId, limit, offset, communityId]);
        return res.rows;
    }

    /**
     * Get User profile feed
     */
    async getUserFeed(targetUserId, currentUserId = null, limit = 20, offset = 0) {
        const whereClause = `WHERE p.user_id = $4`;

        const sql = `
      SELECT 
        p.id, p.content, p.media_urls, p.cashtags, p.hashtags, 
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as user_id, u.username, u.avatar_url,
        c.id as community_id, c.name as community_name,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = $1
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

        const res = await query(sql, [currentUserId, limit, offset, targetUserId]);
        return res.rows;
    }
}

module.exports = new FeedService();