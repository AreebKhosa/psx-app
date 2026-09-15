const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { HTTP_STATUS, ERROR_CODES, errorResponse } = require('../constants/responseCodes');
const logger = require('../services/logger.service');

/**
 * Required authentication middleware
 */
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse(
            res,
            'Authentication token required.',
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.AUTH_TOKEN_MISSING
        );
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        req.user = decoded; // { id, email, role, ... }
        next();
    } catch (err) {
        logger.warn('[Auth] Invalid or expired token', { error: err.message });
        const isExpired = err.name === 'TokenExpiredError';
        return errorResponse(
            res,
            isExpired ? 'Session expired. Please log in again.' : 'Invalid token.',
            HTTP_STATUS.UNAUTHORIZED,
            isExpired ? ERROR_CODES.AUTH_TOKEN_EXPIRED : ERROR_CODES.AUTH_TOKEN_INVALID
        );
    }
};

/**
 * Role-based access control middleware
 */
const requireRole = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return errorResponse(
                res,
                'You do not have permission to perform this action.',
                HTTP_STATUS.FORBIDDEN,
                ERROR_CODES.UNAUTHORIZED_ACTION
            );
        }
        next();
    };
};

/**
 * Optional authentication middleware (populates req.user if token is present, continues if not)
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            req.user = jwt.verify(token, env.JWT_SECRET);
        } catch {
            req.user = null;
        }
    }
    next();
};

module.exports = {
    requireAuth,
    requireRole,
    optionalAuth,
};