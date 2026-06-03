import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export const callVisionModel = async (base64Image) => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
- invoice_date must be YYYY-MM-DD.
- Quantity is always Qty.
- cost_price = Rate / Net Rate / Purchase Rate.
- batch_number = Batch / Batch No.
- expiry_date = Exp / Expiry.
- hsn_code = HSN Code.
- If Old MRP and New MRP both exist, use New MRP.
- gst = GST column value.
- Return all medicine rows.
- Missing values = null.
- Numbers must be numbers.
- Return ONLY JSON.
`
                    },
                    {
                        inlineData: {
                            mimeType: "image/png",
                            data: base64Image
                        }
                    }
                ]
            }
        ]
    });

    return response.text;
};