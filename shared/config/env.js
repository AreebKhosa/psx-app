const path = require('path');
const dotenv = require('dotenv');

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // Service Ports
    COMMUNITY_PORT: parseInt(process.env.COMMUNITY_PORT, 10) || 5001,
    TRADING_PORT: parseInt(process.env.TRADING_PORT, 10) || 5002,

    // Database (PostgreSQL)
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/psx_db',

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
    REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

    // Security & Authentication
    JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    APP_INTEGRITY_SECRET: process.env.APP_INTEGRITY_SECRET || 'dev_app_integrity_secret',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : ['*'],

    // AI Engine
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    AI_MODEL: process.env.AI_MODEL || 'gpt-4o-mini',

    // Media / Image Storage (Cloudinary)
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};

// Validate critical variables in production
if (env.isProduction) {
    const required = ['DATABASE_URL', 'JWT_SECRET', 'APP_INTEGRITY_SECRET'];
    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`[CRITICAL] Missing required environment variable in production: ${key}`);
        }
    }
}

module.exports = env;