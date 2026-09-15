/**
 * Recursively removes dangerous HTML script tags and SQL/NoSQL injection patterns
 */
const sanitizeValue = (value) => {
    if (typeof value === 'string') {
        // Strip HTML script tags & dangerous characters
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .trim();
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item));
    }
    if (typeof value === 'object' && value !== null) {
        const cleaned = {};
        for (const key of Object.keys(value)) {
            // Prevent NoSQL key injection (keys starting with $)
            const cleanKey = key.replace(/^\$/, '');
            cleaned[cleanKey] = sanitizeValue(value[key]);
        }
        return cleaned;
    }
    return value;
};

/**
 * Middleware to sanitize body, query, and route parameters
 */
const sanitizeInput = (req, res, next) => {
    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);
    next();
};

module.exports = { sanitizeInput };