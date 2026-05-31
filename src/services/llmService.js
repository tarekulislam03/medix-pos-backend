import axios from "axios";

export const callVisionModel = async (base64Image) => {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "google/gemini-2.0-flash-001",
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
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

- supplier_name = distributor/agency issuing the bill (header). Never use manufacturer/company from item rows.
- invoice_date must be YYYY-MM-DD.
- Quantity is always written as Qty. in table rows. mostly 2nd row
- cost_price = Rate / Net Rate / Purchase Rate.
- batch_number = Batch / Batch No / B. No.
- expiry_date = Exp / Expiry.
- hsn_code = HSN / HSN Code.
- If Old MRP and New MRP both exist, use New MRP.
- gst = GST column value. If GST is not present, use CGST% + SGST%.

Tax rules:

- cgst_amount = total CGST amount on invoice.
- sgst_amount = total SGST amount on invoice.

- taxable_amount priority:
  1. use subtotal - total_discount if subtotal and total_discount are present.

- Never derive taxable_amount from rounded Grand Total if a direct taxable value exists.
- Return all medicine rows.
- Missing values = null.
- Numbers must be numbers, not strings.
- Return ONLY JSON.
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