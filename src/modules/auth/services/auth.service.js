const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../../shared/config/db');
const { redis } = require('../../../shared/config/redis');
const env = require('../../../shared/config/env');
const emailService = require('../../../shared/services/email.service');
const logger = require('../../../shared/services/logger.service');

const OTP_EXPIRY_SECONDS = 300; // 5 minutes TTL

class AuthService {
    _generateOtp() {
        return crypto.randomInt(100000, 999999).toString();
    }

    _generateToken(user) {
        return jwt.sign(
            { id: user.id, email: user.email, username: user.username, role: user.role || 'user' },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN }
        );
    }

    async signup({ username, email, password }) {
        const cleanEmail = email.toLowerCase().trim();
        const cleanUsername = username.trim();

        // 1. Check existing user
        const existing = await query(
            'SELECT id, is_verified FROM users WHERE email = $1 OR username = $2 LIMIT 1;',
            [cleanEmail, cleanUsername]
        );

        if (existing.rows.length > 0 && existing.rows[0].is_verified) {
            throw new Error('An account with this email or username already exists.');
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Upsert unverified user
        await query(
            `INSERT INTO users (username, email, password_hash, is_verified, updated_at)
       VALUES ($1, $2, $3, FALSE, NOW())
       ON CONFLICT (email) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         updated_at = NOW();`,
            [cleanUsername, cleanEmail, passwordHash]
        );

        // 4. Generate & store 6-digit OTP in Redis
        const otp = this._generateOtp();
        await redis.set(`otp:verify:${cleanEmail}`, otp, 'EX', OTP_EXPIRY_SECONDS);

        // 5. Send OTP email
        await emailService.sendOtpEmail(cleanEmail, otp, 'VERIFY_ACCOUNT');

        return { email: cleanEmail, message: 'Verification code sent to your email.' };
    }

    async verifyOtp({ email, otp }) {
        const cleanEmail = email.toLowerCase().trim();
        const storedOtp = await redis.get(`otp:verify:${cleanEmail}`);

        if (!storedOtp || storedOtp !== String(otp).trim()) {
            throw new Error('Invalid or expired verification code.');
        }

        // 1. Mark verified in DB
        const res = await query(
            `UPDATE users SET is_verified = TRUE, updated_at = NOW() 
       WHERE email = $1 
       RETURNING id, username, email, is_verified, avatar_url, role;`,
            [cleanEmail]
        );

        if (res.rows.length === 0) throw new Error('User not found.');

        await redis.del(`otp:verify:${cleanEmail}`);
        const user = res.rows[0];
        const token = this._generateToken(user);

        return { user, token };
    }

    async resendOtp({ email, purpose = 'VERIFY_ACCOUNT' }) {
        const cleanEmail = email.toLowerCase().trim();
        const otp = this._generateOtp();
        const key = purpose === 'RESET_PASSWORD' ? `otp:reset:${cleanEmail}` : `otp:verify:${cleanEmail}`;

        await redis.set(key, otp, 'EX', OTP_EXPIRY_SECONDS);
        await emailService.sendOtpEmail(cleanEmail, otp, purpose);

        return { message: 'A new verification code has been sent to your email.' };
    }

    async login({ emailOrUsername, password }) {
        const identifier = emailOrUsername.toLowerCase().trim();

        const res = await query(
            'SELECT * FROM users WHERE email = $1 OR username = $1 LIMIT 1;',
            [identifier]
        );

        if (res.rows.length === 0) throw new Error('Invalid email or password.');

        const user = res.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) throw new Error('Invalid email or password.');

        if (!user.is_verified) {
            const otp = this._generateOtp();
            await redis.set(`otp:verify:${user.email}`, otp, 'EX', OTP_EXPIRY_SECONDS);
            await emailService.sendOtpEmail(user.email, otp, 'VERIFY_ACCOUNT');
            return {
                is_verified: false,
                email: user.email,
                message: 'Account not verified. A new code has been sent to your email.',
            };
        }

        const token = this._generateToken(user);
        delete user.password_hash;

        return {
            is_verified: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url,
                bio: user.bio,
                role: user.role,
            },
            token,
        };
    }

    async forgotPassword({ email }) {
        const cleanEmail = email.toLowerCase().trim();
        const res = await query('SELECT id FROM users WHERE email = $1 LIMIT 1;', [cleanEmail]);

        if (res.rows.length > 0) {
            const otp = this._generateOtp();
            await redis.set(`otp:reset:${cleanEmail}`, otp, 'EX', OTP_EXPIRY_SECONDS);
            await emailService.sendOtpEmail(cleanEmail, otp, 'RESET_PASSWORD');
        }

        return { message: 'If this email exists, a password reset code has been sent.' };
    }

    async resetPassword({ email, otp, newPassword }) {
        const cleanEmail = email.toLowerCase().trim();
        const storedOtp = await redis.get(`otp:reset:${cleanEmail}`);

        if (!storedOtp || storedOtp !== String(otp).trim()) {
            throw new Error('Invalid or expired reset code.');
        }

        if (!newPassword || newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2;', [
            newHash,
            cleanEmail,
        ]);

        await redis.del(`otp:reset:${cleanEmail}`);
        logger.info(`[Auth] Password reset successfully for: ${cleanEmail}`);
        return { message: 'Password has been reset successfully. You can now log in.' };
    }
}

module.exports = new AuthService();