const { query, getClient } = require('../../../shared/config/db');

class CommunityService {
    /**
     * Helper to generate URL-friendly slug
     */
    _slugify(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    /**
     * Create a new investor community group
     */
    async createCommunity({ creatorId, name, description = '', avatarUrl = '' }) {
        if (!name || !name.trim()) throw new Error('Community name is required.');

        const cleanName = name.trim();
        const slug = this._slugify(cleanName);

        // Check existing
        const existing = await query('SELECT id FROM communities WHERE slug = $1 LIMIT 1;', [slug]);
        if (existing.rows.length > 0) {
            throw new Error('A community with this name already exists.');
        }

        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Create Community
            const comRes = await client.query(
                `INSERT INTO communities (name, slug, description, avatar_url, creator_id, members_count)
         VALUES ($1, $2, $3, $4, $5, 1)
         RETURNING *;`,
                [cleanName, slug, description.trim(), avatarUrl, creatorId]
            );

            const community = comRes.rows[0];

            // 2. Add creator as 'creator' member
            await client.query(
                `INSERT INTO community_members (community_id, user_id, role)
         VALUES ($1, $2, 'creator');`,
                [community.id, creatorId]
            );

            await client.query('COMMIT');
            return community;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Join a community
     */
    async joinCommunity(userId, communityId) {
        const existing = await query(
            'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2 LIMIT 1;',
            [communityId, userId]
        );

        if (existing.rows.length > 0) {
            throw new Error('You are already a member of this community.');
        }

        await query(
            `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member');`,
            [communityId, userId]
        );

        await query('UPDATE communities SET members_count = members_count + 1 WHERE id = $1;', [communityId]);

        return { joined: true, message: 'Joined community successfully.' };
    }

    /**
     * Leave a community
     */
    async leaveCommunity(userId, communityId) {
        const memberRes = await query(
            'SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2 LIMIT 1;',
            [communityId, userId]
        );

        if (memberRes.rows.length === 0) {
            throw new Error('You are not a member of this community.');
        }

        if (memberRes.rows[0].role === 'creator') {
            throw new Error('Community creators cannot leave their own community.');
        }

        await query('DELETE FROM community_members WHERE community_id = $1 AND user_id = $2;', [
            communityId,
            userId,
        ]);

        await query(
            'UPDATE communities SET members_count = GREATEST(members_count - 1, 1) WHERE id = $1;',
            [communityId]
        );

        return { left: true, message: 'Left community successfully.' };
    }

    /**
     * Get community details & member status
     */
    async getCommunityDetails(communityIdOrSlug, currentUserId = null) {
        const res = await query(
            `SELECT c.*, u.username as creator_name,
              CASE WHEN cm.id IS NOT NULL THEN TRUE ELSE FALSE END as is_member,
              cm.role as user_role
       FROM communities c
       JOIN users u ON c.creator_id = u.id
       LEFT JOIN community_members cm ON c.id = cm.community_id AND cm.user_id = $1
       WHERE c.id::text = $2 OR c.slug = $2 LIMIT 1;`,
            [currentUserId, communityIdOrSlug]
        );

        if (res.rows.length === 0) throw new Error('Community not found.');
        return res.rows[0];
    }

    /**
     * List all discoverable communities
     */
    async listCommunities(limit = 30, offset = 0) {
        const res = await query(
            `SELECT id, name, slug, description, avatar_url, members_count, created_at
       FROM communities
       ORDER BY members_count DESC, created_at DESC
       LIMIT $1 OFFSET $2;`,
            [limit, offset]
        );
        return res.rows;
    }
}

module.exports = new CommunityService();