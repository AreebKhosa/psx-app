const authService = require('../services/auth.service');
const { HTTP_STATUS, successResponse, errorResponse } = require('../../../shared/constants/responseCodes');

class AuthController {
    async signup(req, res, next) {
        try {
            const { username, email, password } = req.body;
            if (!username || !email || !password) {
                return errorResponse(res, 'Username, email, and password are required.', HTTP_STATUS.BAD_REQUEST);
            }
            const data = await authService.signup({ username, email, password });
            return successResponse(res, data, 'Signup successful. Please verify OTP.', HTTP_STATUS.CREATED);
        } catch (err) {
            next(err);
        }
    }

    async verifyOtp(req, res, next) {
        try {
            const { email, otp } = req.body;
            if (!email || !otp) {
                return errorResponse(res, 'Email and OTP code are required.', HTTP_STATUS.BAD_REQUEST);
            }
            const data = await authService.verifyOtp({ email, otp });
            return successResponse(res, data, 'Account verified successfully.');
        } catch (err) {
            next(err);
        }
    }

    async resendOtp(req, res, next) {
        try {
            const { email, purpose } = req.body;
            if (!email) {
                return errorResponse(res, 'Email is required.', HTTP_STATUS.BAD_REQUEST);
            }
            const data = await authService.resendOtp({ email, purpose });
            return successResponse(res, data, 'OTP sent.');
        } catch (err) {
            next(err);
        }
    }

    async login(req, res, next) {
        try {
            const { emailOrUsername, password } = req.body;
            if (!emailOrUsername || !password) {
                return errorResponse(res, 'Email/Username and password are required.', HTTP_STATUS.BAD_REQUEST);
            }
            const data = await authService.login({ emailOrUsername, password });
            return successResponse(res, data, 'Login successful.');
        } catch (err) {
            next(err);
        }
    }

    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            if (!email) {
                return errorResponse(res, 'Email is required.', HTTP_STATUS.BAD_REQUEST);
            }
            const data = await authService.forgotPassword({ email });
            return successResponse(res, data, 'Password reset instructions sent.');
        } catch (err) {
            next(err);
        }
    }

    async resetPassword(req, res, next) {
        try {
            const { email, otp, newPassword } = req.body;
            if (!email || !otp || !newPassword) {
                return errorResponse(res, 'Email, OTP, and new password are required.', HTTP_STATUS.BAD_REQUEST);
            }
            const data = await authService.resetPassword({ email, otp, newPassword });
            return successResponse(res, data, 'Password reset successful.');
        } catch (err) {
            next(err);
        }
    }

    async getProfile(req, res) {
        return successResponse(res, req.user, 'Profile retrieved.');
    }
}

module.exports = new AuthController();