const env = require('../config/env');
const { HTTP_STATUS, ERROR_CODES, errorResponse } = require('../constants/responseCodes');
const logger = require('../services/logger.service');

/**
 * 404 Route Not Found handler
 */
const notFoundHandler = (req, res) => {
    return errorResponse(
        res,
        `Route ${req.method} ${req.originalUrl} not found.`,
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
    );
};

/**
 * Global centralized error-catching middleware
 */
const globalErrorHandler = (err, req, res, next) => {
    logger.error(`[Unhandled Error] ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        ip: req.clientIp || req.ip,
        stack: err.stack,
    });

    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = env.isProduction && statusCode === 500
        ? 'An unexpected internal server error occurred.'
        : err.message || 'Internal Server Error';

    return errorResponse(
        res,
        message,
        statusCode,
        err.errorCode || ERROR_CODES.SERVER_ERROR,
        !env.isProduction ? { stack: err.stack } : null
    );
};

module.exports = {
    notFoundHandler,
    globalErrorHandler,
};