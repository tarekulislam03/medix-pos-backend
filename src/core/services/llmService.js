import OpenAI from "openai";
import { safeParseJSON } from "./jsonParser.js";

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return openaiClient;
};

const INVOICE_EXTRACTION_PROMPT = `Extract this Indian pharmacy purchase invoice into the following JSON format.

Column Mapping
Description of Goods → medicine_name
Batch → batch_number
Exp Dt → expiry_date (convert to YYYY-MM-DD; if only MM/YY, use the last day of that month)
Qty → quantity
Unit → unit
Rate → purchase_price
MRP (NOT Old MRP) → mrp
Discount % → discount_percentage
Taxable Value → taxable_value
CGST + SGST → gst_percentage (e.g., 2.5 + 2.5 = 5)
Amount → total_amount
HSN/SAC → hsn_code

Ignore:

Sr. No.
Old MRP
Net Price
Totals
GST summary
Headers/Footers
Non-product rows

Return only valid JSON in this format:

{
  "invoice": {
    "invoice_number": "",
    "invoice_date": "",
    "supplier_name": "",
    "supplier_gstin": "",
    "buyer_name": "",
    "buyer_gstin": ""
  },
  "items": [
    {
      "medicine_name": "",
      "batch_number": "",
      "expiry_date": "",
      "quantity": 0,
      "unit": "",
      "purchase_price": 0,
      "mrp": 0,
      "discount_percentage": 0,
      "taxable_value": 0,
      "gst_percentage": 0,
      "total_amount": 0,
      "hsn_code": ""
    }
  ]
}

Rules:

Preserve medicine names exactly as printed.
Never use Old MRP.
Return numbers as numbers.
Use null for missing values.
Do not infer values that are not visible.
Return only the JSON object with no explanations or markdown.`;

/**
 * Sends a base64 image to the LLM for extraction.
 *
 * @param {string} base64Image - The base64 encoded image string.
 * @param {string} mimeType - Image mime type.
 * @returns {Promise<Object>} - The parsed invoice JSON from the pipeline.
 */
export const extractInvoiceFromLLM = async (base64Image, mimeType = "image/jpeg") => {
    try {
        const start = Date.now();
        console.log(`[LLM Pipeline] Sending request to OpenRouter...`);
        
        const response = await getOpenAIClient().chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: INVOICE_EXTRACTION_PROMPT },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 4000,
        });

        console.log(`[LLM Pipeline] Extraction completed in ${Date.now() - start} ms`);
        
        const content = response.choices[0].message.content;
        return safeParseJSON(content);
    } catch (error) {
        console.error("[LLM Pipeline Error]", error?.response?.data || error.message);
        throw new Error(error?.response?.data?.error?.message || error.message || "Failed to extract invoice via LLM");
    }
};