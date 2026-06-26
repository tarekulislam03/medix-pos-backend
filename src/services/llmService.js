import axios from "axios";
import FormData from "form-data";

/**
 * Sends an image buffer to the Python OCR pipeline for extraction.
 *
 * @param {Buffer} imageBuffer - The compressed image buffer.
 * @param {string} fileName - Original filename.
 * @param {string} mimeType - Image mime type.
 * @returns {Promise<Object>} - The parsed invoice JSON from the pipeline.
 */
export const extractInvoiceFromPython = async (imageBuffer, fileName, mimeType = "image/jpeg") => {
    try {
        const formData = new FormData();
        formData.append("file", imageBuffer, {
            filename: fileName,
            contentType: mimeType,
        });

        const pythonServiceUrl = process.env.PYTHON_OCR_URL || "http://127.0.0.1:8001/extract?mode=full";
        
        const start = Date.now();
        console.log(`[Python Pipeline] Sending request to ${pythonServiceUrl}...`);
        
        const response = await axios.post(pythonServiceUrl, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 120000, // 2 minutes, as the full pipeline can be slow
        });

        console.log(`[Python Pipeline] Extraction completed in ${Date.now() - start} ms`);
        
        return response.data;
    } catch (error) {
        console.error("[Python Pipeline Error]", error?.response?.data || error.message);
        throw new Error(error?.response?.data?.detail || error.message || "Failed to extract invoice via Python pipeline");
    }
};