const env = require('../config/env');

const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
};

const formatMessage = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();

    // JSON format for cloud production log collectors
    if (env.isProduction) {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta,
        });
    }

    // Readable colored format for local terminal development
    const colors = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[36m',  // Cyan
        DEBUG: '\x1b[90m', // Gray
        RESET: '\x1b[0m',
    };

    const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
    return `${colors[level]}[${timestamp}] [${level}]${colors.RESET} ${message}${metaStr}`;
};

const logger = {
    info: (message, meta) => console.log(formatMessage(LOG_LEVELS.INFO, message, meta)),
    warn: (message, meta) => console.warn(formatMessage(LOG_LEVELS.WARN, message, meta)),
    error: (message, meta) => console.error(formatMessage(LOG_LEVELS.ERROR, message, meta)),
    debug: (message, meta) => {
        if (!env.isProduction) {
            console.debug(formatMessage(LOG_LEVELS.DEBUG, message, meta));
        }
    },
};

module.exports = logger;