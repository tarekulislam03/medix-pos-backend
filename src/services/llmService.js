import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export const callVisionModel = async (base64Image, mimeType = 'image/jpeg') => {
    // Helper function to call a specific model
    const attemptCall = async (modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `
Extract pharmacy invoice data and return ONLY valid JSON in this format:

{
  "supplier_name":"",
  "supplier_gstin":"",
  "invoice_no":"",
  "invoice_date":"",
  "subtotal":0,
  "total_discount":0,
  "taxable_amount":0,
  "cgst_amount":0,
  "sgst_amount":0,
  "items":[
    {
      "medicine_name":"",
      "mrp":0,
      "quantity":0,
      "expiry_date":"",
      "cost_price":0,
      "batch_number":"",
      "hsn_code":"",
      "gst":0
    }
  ]
}

Rules:

- supplier_name = distributor/agency issuing the bill.
- invoice_date must be YYYY-MM-DD. date must be last date of the month. eg. 07/28 it means 31/07/2028.
- Quantity is always Qty.
- cost_price = Rate / Net Rate / Purchase Rate.
- batch_number = Batch / Batch No.
- expiry_date = Exp / Expiry.
- hsn_code = HSN Code.
- If Old MRP and New MRP both exist, use New MRP. some bills contains old and new mrp in one column. the bottom one is the new mrp, take that. 
- gst = GST column value. if CGST and SGST appears, add them and give the GST.
- Return all medicine rows.
- Missing values = null.
- Numbers must be numbers.
- Return ONLY JSON.
`
                        },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Image
                            }
                        }
                    ]
                }
            ]
        });
        return response.text;
    };

    try {
        // First attempt with gemini-2.5-flash (more stable than lite)
        console.log("Calling Gemini API: gemini-2.5-flash...");
        return await attemptCall("gemini-2.5-flash");
    } catch (error) {
        console.error('Google GenAI Primary Error:', error.message);
        
        // If it's a 429 error, wait 60 seconds and retry
        if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
            console.log("429 Quota Exceeded. Waiting 60 seconds before retrying...");
            await new Promise(resolve => setTimeout(resolve, 60000));
            console.log("Retrying after 60s delay...");
            try {
                return await attemptCall("gemini-2.5-flash");
            } catch (retryError) {
                console.error("Retry failed:", retryError.message);
                throw retryError;
            }
        }

        // If it's a 503 error (High Demand), fallback to gemini-1.5-flash
        if (error?.status === 503 || error?.message?.includes("503") || error?.message?.includes("high demand") || error?.message?.includes("UNAVAILABLE")) {
            console.log("503 High Demand detected. Retrying with fallback model (gemini-1.5-flash)...");
            try {
                return await attemptCall("gemini-1.5-flash");
            } catch (fallbackError) {
                console.error('Google GenAI Fallback Error:', fallbackError.message);
                throw fallbackError;
            }
        }
        
        throw error;
    }
};