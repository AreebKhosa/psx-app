const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../../../shared/security/rateLimiter');
const { requireAuth } = require('../../../shared/middlewares/auth.middleware');

const router = Router();

// Public auth endpoints protected with strict brute-force rate limiting (5 attempts/min)
router.post('/signup', authLimiter, authController.signup);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/resend-otp', authLimiter, authController.resendOtp);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Protected endpoint
router.get('/me', requireAuth, authController.getProfile);

module.exports = router;