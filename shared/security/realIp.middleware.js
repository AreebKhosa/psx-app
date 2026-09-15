/**
 * Middleware to extract and normalize the true client IP address
 */
const getRealIp = (req, res, next) => {
    let ip = null;

    // 1. Cloudflare proxy header (Highest priority)
    if (req.headers['cf-connecting-ip']) {
        ip = req.headers['cf-connecting-ip'];
    }
    // 2. Standard X-Real-IP header
    else if (req.headers['x-real-ip']) {
        ip = req.headers['x-real-ip'];
    }
    // 3. X-Forwarded-For header (Take the first IP in the chain)
    else if (req.headers['x-forwarded-for']) {
        const forwardedIps = req.headers['x-forwarded-for'].split(',');
        ip = forwardedIps[0].trim();
    }
    // 4. Express native / Socket fallback
    else {
        ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    }

    // Normalize IPv6 loopback addresses to standard IPv4
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1';
    } else if (ip && ip.startsWith('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }

    // Attach resolved IP to request object for downstream middlewares
    req.clientIp = ip;
    next();
};

module.exports = { getRealIp };