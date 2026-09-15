// Standard HTTP Status Codes
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
});

// Application Business Error Codes
const ERROR_CODES = Object.freeze({
    // Authentication & Security
    AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
    AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    APP_INTEGRITY_FAILED: 'APP_INTEGRITY_FAILED',
    IP_BLOCKED: 'IP_BLOCKED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

    // Trading & Portfolio
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INSUFFICIENT_SHARES: 'INSUFFICIENT_SHARES',
    INVALID_TICKER: 'INVALID_TICKER',
    MARKET_CLOSED: 'MARKET_CLOSED',
    ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',

    // Community & Social
    POST_NOT_FOUND: 'POST_NOT_FOUND',
    COMMUNITY_NOT_FOUND: 'COMMUNITY_NOT_FOUND',
    UNAUTHORIZED_ACTION: 'UNAUTHORIZED_ACTION',

    // General Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    SERVER_ERROR: 'SERVER_ERROR',
});

/**
 * Standardized Success Response Wrapper
 */
const successResponse = (res, data = null, message = 'Success', statusCode = HTTP_STATUS.OK) => {
    return res.status(statusCode).json({
        success: true,
        statusCode,
        message,
        data,
    });
};

/**
 * Standardized Error Response Wrapper
 */
const errorResponse = (res, message = 'Error', statusCode = HTTP_STATUS.BAD_REQUEST, errorCode = ERROR_CODES.SERVER_ERROR, details = null) => {
    return res.status(statusCode).json({
        success: false,
        statusCode,
        errorCode,
        message,
        ...(details && { details }),
    });
};

module.exports = {
    HTTP_STATUS,
    ERROR_CODES,
    successResponse,
    errorResponse,
};