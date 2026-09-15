const { redis, createSubClient } = require('../config/redis');
const logger = require('./logger.service');

const redisService = {
    /**
     * Get parsed JSON data by key
     */
    async getJson(key) {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            logger.error(`[Redis] Failed to get key: ${key}`, { error: err.message });
            return null;
        }
    },

    /**
     * Set JSON data with optional TTL (seconds)
     */
    async setJson(key, value, ttlSeconds = null) {
        try {
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await redis.set(key, serialized, 'EX', ttlSeconds);
            } else {
                await redis.set(key, serialized);
            }
            return true;
        } catch (err) {
            logger.error(`[Redis] Failed to set key: ${key}`, { error: err.message });
            return false;
        }
    },

    /**
     * Delete a key or array of keys
     */
    async del(keys) {
        try {
            if (Array.isArray(keys)) {
                if (keys.length > 0) await redis.del(...keys);
            } else {
                await redis.del(keys);
            }
            return true;
        } catch (err) {
            logger.error(`[Redis] Failed to delete key(s)`, { error: err.message });
            return false;
        }
    },

    /**
     * Get live stock market data populated by trading_board.py (e.g., key "stock:LUCK")
     */
    async getStockPrice(ticker) {
        if (!ticker) return null;
        return await this.getJson(`stock:${ticker.toUpperCase()}`);
    },

    /**
     * Get live index data populated by market_indices.py (e.g., key "index:KSE100")
     */
    async getIndexData(indexCode) {
        if (!indexCode) return null;
        return await this.getJson(`index:${indexCode.toUpperCase()}`);
    },

    /**
     * Publish a message to a Redis Pub/Sub channel
     */
    async publish(channel, message) {
        try {
            const payload = typeof message === 'object' ? JSON.stringify(message) : String(message);
            return await redis.publish(channel, payload);
        } catch (err) {
            logger.error(`[Redis] Publish error on channel ${channel}`, { error: err.message });
            return null;
        }
    },

    /**
     * Subscribe to a Redis Pub/Sub channel
     */
    createSubscriber(channel, onMessageCallback) {
        const sub = createSubClient();
        sub.subscribe(channel, (err) => {
            if (err) logger.error(`[Redis] Subscription error on ${channel}`, { error: err.message });
            else logger.info(`[Redis] Subscribed to channel: ${channel}`);
        });

        sub.on('message', (chan, message) => {
            if (chan === channel) {
                try {
                    const parsed = JSON.parse(message);
                    onMessageCallback(parsed);
                } catch {
                    onMessageCallback(message);
                }
            }
        });

        return sub;
    },
};

module.exports = redisService;