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
Extract ONLY the medicine rows from the pharmacy bill.

Fields required:
- medicine_name
- mrp
- quantity
- expiry_date
- cost_price ("RATE" in bills)
- supplier_name
- batch_number ("BATCH", "BATCH NO", "B. NO" etc.)
- hsn_code ("HSN", "HSN CODE" etc.)
- gst (percentage number, e.g., 5, 12, 18, or 28, representing "GST", "TAX", "GST RATE" etc.)

Rules:
- Return ONLY valid JSON
- Do NOT explain
- Do NOT add markdown
- If expiry_date, batch_number, hsn_code, or gst is not found, return null or default values
- MRP column rule (IMPORTANT):
  * If the bill has TWO MRP columns — one labeled "Old MRP", "O.MRP", "O. MRP", or similar, AND another labeled "New MRP", "N.MRP", "N. MRP", or similar — use ONLY the NEW MRP value as the "mrp" field.
  * If the bill has only ONE MRP column (regardless of label), use that value as the "mrp" field.

Format:

{
  "items":[
    {
      "medicine_name":"",
      "mrp":0,
      "quantity":0,
      "expiry_date":"",
      "cost_price":0,
      "supplier_name":"",
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