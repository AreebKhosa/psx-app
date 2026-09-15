const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('./logger.service');

// Configure SMTP Transporter (e.g., Gmail, SendGrid, Mailgun)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
});

const emailService = {
    /**
     * Sends 6-digit OTP code to user's email
     * @param {string} to - Recipient email
     * @param {string} otp - 6-digit numeric OTP code
     * @param {string} purpose - 'VERIFY_ACCOUNT' or 'RESET_PASSWORD'
     */
    async sendOtpEmail(to, otp, purpose = 'VERIFY_ACCOUNT') {
        const isReset = purpose === 'RESET_PASSWORD';
        const subject = isReset ? 'Reset Your PSX Platform Password' : 'Verify Your PSX Platform Account';

        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f172a; text-align: center;">PSX Trading & Community</h2>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 16px; color: #334155;">Hello,</p>
        <p style="font-size: 15px; color: #475569;">
          Your one-time verification code for <strong>${isReset ? 'Password Reset' : 'Account Verification'}</strong> is:
        </p>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; text-align: center;">
          This code is valid for <strong>5 minutes</strong>. If you did not request this, please ignore this email.
        </p>
      </div>
    `;

        try {
            // In development without SMTP credentials, log OTP to terminal for easy testing
            if (!process.env.SMTP_USER) {
                logger.info(`📧 [DEV EMAIL SIMULATOR] OTP for ${to} (${purpose}): [ ${otp} ]`);
                return true;
            }

            await transporter.sendMail({
                from: `"PSX Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to,
                subject,
                html,
            });

            logger.info(`📧 OTP email sent successfully to ${to}`);
            return true;
        } catch (err) {
            logger.error(`Failed to send email to ${to}:`, { error: err.message });
            return false;
        }
    },
};

module.exports = emailService;