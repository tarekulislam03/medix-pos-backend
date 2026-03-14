import axios from "axios";

export const callVisionModel = async (base64Image) => {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
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

Rules:
- Return ONLY valid JSON
- Do NOT explain
- Do NOT add markdown
- If expiry_date not found return null
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
      "supplier_name":""
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