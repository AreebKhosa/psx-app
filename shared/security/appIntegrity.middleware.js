const crypto = require('crypto');
const env = require('../config/env');
const { HTTP_STATUS, ERROR_CODES, errorResponse } = require('../constants/responseCodes');
const logger = require('../services/logger.service');

const MAX_TIMESTAMP_DRIFT_MS = 60000; // 60-second replay attack window

/**
 * Middleware to verify request authenticity from official app/web clients
 */
const verifyAppIntegrity = (req, res, next) => {
    // Allow health check and webhook bypass
    if (req.path === '/healthz' || req.path === '/api/health') {
        return next();
    }

    // Bypass in local development unless explicitly enforced
    if (!env.isProduction && !process.env.ENFORCE_INTEGRITY) {
        return next();
    }

    const timestamp = req.headers['x-app-timestamp'];
    const clientSignature = req.headers['x-app-signature'];

    if (!timestamp || !clientSignature) {
        logger.warn(`[Security] Missing integrity headers from IP: ${req.clientIp || req.ip}`);
        return errorResponse(
            res,
            'Invalid client request signature.',
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.APP_INTEGRITY_FAILED
        );
    }

    // 1. Replay attack check: reject requests older or skewed by more than 60s
    const requestTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_TIMESTAMP_DRIFT_MS) {
        logger.warn(`[Security] Request timestamp expired or invalid from IP: ${req.clientIp || req.ip}`);
        return errorResponse(
            res,
            'Request timestamp expired.',
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.APP_INTEGRITY_FAILED
        );
    }

    // 2. Generate expected HMAC signature (method + path + timestamp + rawBody)
    const bodyString = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
    const payload = `${req.method.toUpperCase()}:${req.baseUrl + req.path}:${timestamp}:${bodyString}`;

    const expectedSignature = crypto
        .createHmac('sha256', env.APP_INTEGRITY_SECRET)
        .update(payload)
        .digest('hex');

    // 3. Constant-time signature comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
        Buffer.from(clientSignature),
        Buffer.from(expectedSignature)
    );

    if (!isValid) {
        logger.warn(`[Security] HMAC mismatch detected from IP: ${req.clientIp || req.ip}`);
        return errorResponse(
            res,
            'Unauthorized client application.',
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.APP_INTEGRITY_FAILED
        );
    }

    next();
};

module.exports = { verifyAppIntegrity };