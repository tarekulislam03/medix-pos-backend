import axios from "axios";

export const callVisionModel = async (base64Image) => {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "google/gemini-2.0-flash-001",
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
Extract all the required information from the pharmacy bill.

Fields required:
- medicine_name
- mrp
- quantity
- expiry_date
- cost_price ("RATE" in bills)
- batch_number ("BATCH", "BATCH NO", "B. NO" etc.)
- hsn_code ("HSN", "HSN CODE" etc.)
- gst (percentage number, e.g., 5, 12, 18, or 28, representing "GST", "TAX", "GST RATE" etc.)

Also extract the following top-level invoice metadata from the bill:
- supplier_name (The distributor/agency issuing the bill, e.g. "S B HEALTHCARE")
- supplier_gstin (The GSTIN of the supplier)
- invoice_no (The bill/invoice number)
- invoice_date (The date of the invoice in YYYY-MM-DD format)
- taxable_amount (The total taxable value or sub-total before taxes)
- cgst_amount (The total CGST amount charged in the bill)
- sgst_amount (The total SGST amount charged in the bill)

Rules:
- Return ONLY valid JSON
- Do NOT explain
- Do NOT add markdown
- If expiry_date, batch_number, hsn_code, or gst is not found, return null or default values
- Supplier Name rule (IMPORTANT):
  * The "supplier_name" should be the name of the distributor or agency ISSUING the bill (usually printed at the top, e.g., "S B HEALTHCARE"). Do NOT use the manufacturer or company name from the individual item rows (e.g., do not use the "Comp" column like "SUN").
- MRP column rule (IMPORTANT):
  * If the bill has TWO MRP columns — one labeled "Old MRP", "O.MRP", "O. MRP", or similar, AND another labeled "New MRP", "N.MRP", "N. MRP", or similar — use ONLY the NEW MRP value as the "mrp" field.
  * If the bill has only ONE MRP column (regardless of label), use that value as the "mrp" field.
- GST column rule (IMPORTANT):
  * If a combined "GST" column is not explicitly available, but separate "CGST" and "SGST" columns exist or check for CGST+SGST column, add their percentage values together to determine the final "gst" (e.g., if CGST is 6% and SGST is 6%, gst is 12).

Format:

{
  "supplier_name": "",
  "supplier_gstin": "",
  "invoice_no": "",
  "invoice_date": "",
  "taxable_amount": 0,
  "cgst_amount": 0,
  "sgst_amount": 0,
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
`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    }
  );

  if (!response.data?.choices?.[0]?.message?.content) {
    console.error("OpenRouter Error Response:", response.data);
    throw new Error("AI service returned an empty response");
  }

  return response.data.choices[0].message.content;
};