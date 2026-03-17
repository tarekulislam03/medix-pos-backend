import sharp from "sharp";
import { Readable } from "stream";

/**
 * Middleware to normalize uploaded images.
 * Specifically handles HEIC images by converting them to JPEG (quality 90).
 * Replaces the original buffer with the converted output.
 * Uses streaming to handle large files safely and avoid memory spikes.
 */
export const normalizeImage = async (req, res, next) => {
    if (!req.file || !req.file.buffer) {
        return next();
    }

    const { mimetype, originalname } = req.file;

    try {
        console.log(`[Backend] Processing normalization for: ${originalname} (${mimetype})`);
        
        // Use streaming to avoid memory spikes with large buffers
        const bufferStream = new Readable();
        bufferStream.push(req.file.buffer);
        bufferStream.push(null);

        // Standardize to JPEG with auto-rotation (EXIF orientation fix)
        // This handles HEIC to JPEG conversion automatically if sharp has heif support.
        const transformer = sharp({ failOn: 'none' })
            .rotate()
            .jpeg({ 
                quality: 90,
                chromaSubsampling: '4:4:4' 
            });

        const convertedBuffer = await bufferStream
            .pipe(transformer)
            .toBuffer();

        // Standardize metadata
        req.file.buffer = convertedBuffer;
        req.file.mimetype = "image/jpeg";
        req.file.size = convertedBuffer.length;

        // Standard extension
        const lowerName = originalname.toLowerCase();
        if (!lowerName.endsWith(".jpg") && !lowerName.endsWith(".jpeg")) {
            const lastDot = originalname.lastIndexOf('.');
            const baseName = lastDot !== -1 ? originalname.substring(0, lastDot) : originalname;
            req.file.originalname = baseName + ".jpg";
        }

        console.log(`[Backend] Normalization successful for ${req.file.originalname} (${req.file.size} bytes)`);
        next();
    } catch (error) {
        console.error("[Backend] CRITICAL: Image Normalization Failed:", error);
        
        return res.status(400).json({
            success: false,
            message: `Image normalization failed: ${error.message}. Please try a different photo or a standard format (JPEG, PNG).`,
            error: error.message
        });
    }
};
