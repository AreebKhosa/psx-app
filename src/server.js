const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Shared Configs & Logger
const env = require('./shared/config/env');
const logger = require('./shared/services/logger.service');

// Security Middlewares
const { getRealIp } = require('./shared/security/realIp.middleware');
const { checkIpBlocklist } = require('./shared/security/ipBlocklist.middleware');
const { globalLimiter } = require('./shared/security/rateLimiter');
const { verifyAppIntegrity } = require('./shared/security/appIntegrity.middleware');
const { sanitizeInput } = require('./shared/security/sanitize.middleware');

// Error Middlewares
const { notFoundHandler, globalErrorHandler } = require('./shared/middlewares/error.middleware');

// Routes
const authRoutes = require('./modules/auth/routes/auth.routes');
const chartRoutes = require('./modules/trading/routes/chart.routes');
const paperTradeRoutes = require('./modules/trading/routes/paperTrade.routes');
const portfolioRoutes = require('./modules/trading/routes/portfolio.routes');
const postRoutes = require('./modules/community/routes/post.routes');
const communityRoutes = require('./modules/community/routes/community.routes');
const pageRoutes = require('./modules/community/routes/page.routes');

const app = express();

// 1. Tell Express to trust reverse proxies (Render / Cloudflare Load Balancers)
app.set('trust proxy', 1);

// 2. Base Security Headers & CORS
app.use(helmet());
app.use(
    cors({
        origin: env.ALLOWED_ORIGINS,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    })
);

// 3. Body Parsers with payload size limits (Prevents massive payload DoS)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Load Balancer Health Check (Bypasses rate limiting & HMAC checks)
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 5. Apply Global Security Pipeline (Applied in strict sequence)
app.use(getRealIp);            // Extract true client IP
app.use(checkIpBlocklist);     // Reject banned IPs via Redis
app.use(globalLimiter);        // Distributed 120 req/min rate limiter
app.use(verifyAppIntegrity);   // HMAC app signature check (Blocks Postman/Curl)
app.use(sanitizeInput);        // Cleans XSS & injection patterns

// 6. Mount API Business Modules
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trading/charts', chartRoutes);
app.use('/api/v1/trading/orders', paperTradeRoutes);
app.use('/api/v1/trading/portfolio', portfolioRoutes);
app.use('/api/v1/community/posts', postRoutes);
app.use('/api/v1/community/groups', communityRoutes);
app.use('/api/v1/community/pages', pageRoutes);

// 7. Error Handling Middlewares
app.use(notFoundHandler);
app.use(globalErrorHandler);

// 8. Start HTTP Server
const PORT = process.env.PORT || env.COMMUNITY_PORT || 5000;

app.listen(PORT, () => {
    logger.info(`🚀 PSX Platform Backend API running on port ${PORT} [${env.NODE_ENV}]`);
});

module.exports = app;