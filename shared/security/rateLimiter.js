const { RateLimiterRedis } = require('rate-limiter-flexible');
const { redis } = require('../config/redis');
const { HTTP_STATUS, ERROR_CODES, errorResponse } = require('../constants/responseCodes');
const logger = require('../services/logger.service');

// 1. General API rate limiter (120 requests per minute per IP)
const globalLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:global',
    points: 120,
    duration: 60,
    blockDuration: 60, // Block for 1 min if consumed
});

// 2. Strict Auth limiter (5 attempts per minute per IP to prevent brute-force)
const authLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:auth',
    points: 5,
    duration: 60,
    blockDuration: 300, // Block for 5 minutes if exceeded
});

// 3. Trading limiter (25 order submissions per minute per user)
const tradingLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:trade',
    points: 25,
    duration: 60,
    blockDuration: 60,
});

/**
 * Generic middleware generator for rate-limiter-flexible
 */
const createRateLimitMiddleware = (limiter, keyExtractor) => {
    return async (req, res, next) => {
        const key = keyExtractor(req);
        try {
            const resRate = await limiter.consume(key);
            res.setHeader('X-RateLimit-Limit', limiter.points);
            res.setHeader('X-RateLimit-Remaining', resRate.remainingPoints);
            res.setHeader('X-RateLimit-Reset', new Date(Date.now() + resRate.msBeforeNext).toISOString());
            next();
        } catch (rejRes) {
            const retrySecs = Math.round(rejRes.msBeforeNext / 1000) || 60;
            res.setHeader('Retry-After', retrySecs);
            logger.warn(`[Security] Rate limit exceeded for key: ${key}`);
            return errorResponse(
                res,
                `Too many requests. Please try again in ${retrySecs} seconds.`,
                HTTP_STATUS.TOO_MANY_REQUESTS,
                ERROR_CODES.RATE_LIMIT_EXCEEDED
            );
        }
    };
};

const globalLimiter = createRateLimitMiddleware(globalLimiterInstance, (req) => req.clientIp || req.ip);
const authLimiter = createRateLimitMiddleware(authLimiterInstance, (req) => req.clientIp || req.ip);
const tradingLimiter = createRateLimitMiddleware(tradingLimiterInstance, (req) => req.user?.id || req.clientIp || req.ip);

module.exports = {
    globalLimiter,
    authLimiter,
    tradingLimiter,
};