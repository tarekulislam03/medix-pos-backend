import sharp from 'sharp';
import convert from 'heic-convert';

/**
 * Optimizes an invoice image for LLM processing.
 * 
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} originalMimetype - Original file mime type
 * @returns {Promise<{base64: string, width: number, height: number, sizeKb: number, mimeType: string}>}
 */
export const optimizeInvoiceImage = async (imageBuffer, originalMimetype) => {
    try {
        let bufferToProcess = imageBuffer;

        // Supported format check
        const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
        if (!originalMimetype || !supportedMimeTypes.includes(originalMimetype.toLowerCase())) {
            throw new Error(`Unsupported image format: ${originalMimetype}`);
        }

        // Handle HEIC conversion to JPEG buffer
        if (originalMimetype.toLowerCase() === 'image/heic' || originalMimetype.toLowerCase() === 'image/heif') {
            console.log('Converting HEIC image to JPEG...');
            bufferToProcess = await convert({
                buffer: imageBuffer, 
                format: 'JPEG',      
                quality: 1           // max quality out of the heic convert, we will compress with sharp later
            });
        }

        // Get initial metadata
        const metadata = await sharp(bufferToProcess).metadata();
        const origWidth = metadata.width;
        const origHeight = metadata.height;
        const origSizeKb = Math.round(imageBuffer.length / 1024);

        if (!origWidth || !origHeight) {
            throw new Error("Corrupted or invalid image: missing dimensions");
        }

        if (origWidth < 400) {
            throw new Error("Image too small. Minimum width is 400px for accurate processing.");
        }

        let quality = 85;
        let optimizedBuffer = null;
        let finalMetadata = null;
        let targetSizeExceeded = true;

        // Compression loop
        while (targetSizeExceeded && quality >= 50) {
            optimizedBuffer = await sharp(bufferToProcess)
                .rotate() // auto-orient based on EXIF
                .resize({ width: 1800, withoutEnlargement: true }) // Resize width to max 1800, preserve aspect ratio
                .jpeg({ quality, mozjpeg: true }) // Convert/compress to JPEG
                .toBuffer();

            const currentSizeKb = Math.round(optimizedBuffer.length / 1024);
            
            if (currentSizeKb <= 2048) {
                targetSizeExceeded = false; // Under 2MB max limit
            } else {
                quality -= 10; // Reduce quality for next iteration
            }
        }

        finalMetadata = await sharp(optimizedBuffer).metadata();
        const finalSizeKb = Math.round(optimizedBuffer.length / 1024);

        // Logging
        console.log(`[Image Optimizer] Original: ${origWidth}x${origHeight} (${origSizeKb} KB) | Optimized: ${finalMetadata.width}x${finalMetadata.height} (${finalSizeKb} KB) | Q: ${quality}`);
        if (origSizeKb > 0) {
            console.log(`[Image Optimizer] Compression ratio: ${((1 - (finalSizeKb / origSizeKb)) * 100).toFixed(1)}% reduction`);
        }

        return {
            base64: optimizedBuffer.toString('base64'),
            buffer: optimizedBuffer,
            width: finalMetadata.width,
            height: finalMetadata.height,
            sizeKb: finalSizeKb,
            mimeType: 'image/jpeg'
        };

    } catch (error) {
        console.error('[Image Optimizer Error]', error.message);
        throw error;
    }
};
