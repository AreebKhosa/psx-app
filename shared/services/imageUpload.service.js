const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const logger = require('./logger.service');

// Configure Cloudinary credentials
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
});

const imageUploadService = {
    /**
     * Upload image buffer to Cloudinary
     * @param {Buffer} fileBuffer - The memory buffer from multer
     * @param {string} folder - Target folder in Cloudinary (e.g., 'posts', 'avatars')
     */
    async uploadFromBuffer(fileBuffer, folder = 'general') {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `psx_platform/${folder}`,
                    resource_type: 'image',
                    quality: 'auto:good',
                    fetch_format: 'auto',
                },
                (error, result) => {
                    if (error) {
                        logger.error('[Cloudinary] Upload failed', { error: error.message });
                        return reject(error);
                    }
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format,
                        bytes: result.bytes,
                    });
                }
            );

            uploadStream.end(fileBuffer);
        });
    },

    /**
     * Delete an image from Cloudinary by public ID
     */
    async deleteImage(publicId) {
        try {
            if (!publicId) return null;
            const result = await cloudinary.uploader.destroy(publicId);
            return result;
        } catch (err) {
            logger.error('[Cloudinary] Delete failed', { error: err.message, publicId });
            return null;
        }
    },
};

module.exports = imageUploadService;