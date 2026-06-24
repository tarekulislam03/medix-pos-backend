import axios from "axios";
import FormData from "form-data";

export const extractTextFromOCRSpace = async (buffer, fileName) => {
    try {
        const formData = new FormData();

        formData.append("file", buffer, fileName);

        formData.append("language", "eng");
        formData.append("isTable", "true");
        formData.append("scale", "true");
        formData.append("OCREngine", "3");

        const response = await axios.post(
            "https://api.ocr.space/parse/image",
            formData,
            {
                headers: {
                    apikey: process.env.OCR_SPACE_API_KEY,
                    ...formData.getHeaders(),
                },
            }
        );

        const result = response.data;

        if (result.IsErroredOnProcessing) {
            throw new Error(
                result.ErrorMessage ||
                "OCR processing failed"
            );
        }

        const text = result.ParsedResults
            ?.map(page => page.ParsedText)
            .join("\n");

        return text || "";

    } catch (error) {
        console.error(
            "OCR Error:",
            error.response?.data || error.message
        );

        throw error;

    }
};