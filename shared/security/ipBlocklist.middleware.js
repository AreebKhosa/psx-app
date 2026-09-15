const { redis } = require('../config/redis');
const { HTTP_STATUS, ERROR_CODES, errorResponse } = require('../constants/responseCodes');
const logger = require('../services/logger.service');

const BLOCKLIST_PREFIX = 'blocklist:ip:';

/**
 * Middleware to reject requests from blacklisted IPs
 */
const checkIpBlocklist = async (req, res, next) => {
    try {
        const ip = req.clientIp || req.ip;
        const isBlocked = await redis.get(`${BLOCKLIST_PREFIX}${ip}`);

        if (isBlocked) {
            logger.warn(`[Security] Blocked IP attempted access: ${ip}`);
            return errorResponse(
                res,
                'Access denied. Your IP address has been blocked.',
                HTTP_STATUS.FORBIDDEN,
                ERROR_CODES.IP_BLOCKED
            );
        }
        next();
    } catch (err) {
        // Fail open on Redis error so legitimate users aren't locked out
        logger.error('[Security] IP Blocklist check error:', { error: err.message });
        next();
    }
};

/**
 * Helper to ban an IP address for a specific duration
 */
const banIp = async (ip, reason = 'Abuse detected', ttlSeconds = 86400) => {
    try {
        await redis.set(`${BLOCKLIST_PREFIX}${ip}`, reason, 'EX', ttlSeconds);
        logger.warn(`[Security] Banned IP: ${ip} for ${ttlSeconds}s | Reason: ${reason}`);
        return true;
    } catch (err) {
        logger.error(`[Security] Failed to ban IP: ${ip}`, { error: err.message });
        return false;
    }
};

/**
 * Helper to unban an IP address
 */
const unbanIp = async (ip) => {
    try {
        await redis.del(`${BLOCKLIST_PREFIX}${ip}`);
        logger.info(`[Security] Unbanned IP: ${ip}`);
        return true;
    } catch (err) {
        logger.error(`[Security] Failed to unban IP: ${ip}`, { error: err.message });
        return false;
    }
};

module.exports = {
    checkIpBlocklist,
    banIp,
    unbanIp,
};