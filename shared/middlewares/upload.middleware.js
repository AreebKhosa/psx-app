const multer = require('multer');
const { HTTP_STATUS, ERROR_CODES, errorResponse } = require('../constants/responseCodes');

// Memory storage keeps files as buffer in RAM for Cloudinary/S3 streaming
const storage = multer.memoryStorage();

// Allow only safe image MIME types
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max file size
    fileFilter,
});

/**
 * Helper middleware wrapper to catch Multer file upload errors cleanly
 */
const handleUpload = (multerMiddleware) => {
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return errorResponse(res, 'File size too large. Maximum size is 5MB.', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
                }
                return errorResponse(res, err.message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
            } else if (err) {
                return errorResponse(res, err.message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
            }
            next();
        });
    };
};

module.exports = {
    uploadSingle: (fieldName) => handleUpload(upload.single(fieldName)),
    uploadArray: (fieldName, maxCount = 4) => handleUpload(upload.array(fieldName, maxCount)),
};