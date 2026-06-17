import sharp from "sharp";
import heicConvert from "heic-convert";
import path from "path";


const normalizeImage = async (req, res, next) => {

    // If no file or buffer in req, it'll skip normalization
    if (!req.file || !req.file.buffer) {
        return next();
    }

    const { mimetype, originalname } = req.file;

    try {

        let buffer = req.file.buffer;

        // validate heic
        const ext = originalname.split('.').pop()?.toLowerCase();
        const isHeic =
            ["image/heic", "image/heif"].includes(mimetype) || ["heic", "heif"].includes(ext);

        if (isHeic) {
            // convert heic to jpeg
            buffer = await heicConvert({
                buffer,
                format: "JPEG",
                quality: 0.9,
            })
        };

        // rotate and resize
        buffer = await sharp(buffer)
            .rotate()
            .resize({
                width: 400,
                withoutEnlargement: true
            })
            .jpeg({ quality: 90 })
            .toBuffer();

        // Standardize metadata
        req.file.buffer = buffer;
        req.file.mimetype = "image/jpeg";
        req.file.size = buffer.length;

        console.log(`Image normalized: ${originalname} (${buffer.length / 1024 } kb)`);

        // Standard extension
        const baseName = path.parse(originalname).name;
        req.file.originalname = `${baseName}.jpg`;``

        return next();

    } catch (error) {
        console.error("Image Normalization Failed:", error);

        return res.status(400).json({
            success: false,
            message: `Image normalization failed: ${error.message}. Please try a different photo or a standard format (JPEG, PNG).`,
            error: error.message
        });
    }
};

export { normalizeImage };