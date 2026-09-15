const Redis = require('ioredis');
const env = require('./env');

const redisConfig = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    autoResubscribe: true,
    lazyConnect: false,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
};

// Create main Redis client
const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, redisConfig)
    : new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        ...redisConfig,
    });

redis.on('connect', () => console.log('[Redis] Connecting to Redis server...'));
redis.on('ready', () => console.log('[Redis] Connected & ready to serve requests.'));
redis.on('error', (err) => console.error('[Redis] Client error:', err.message));
redis.on('close', () => console.warn('[Redis] Connection closed.'));

/**
 * Creates a duplicate Redis connection (required for Pub/Sub subscribers)
 */
const createSubClient = () => redis.duplicate();

module.exports = {
    redis,
    createSubClient,
};