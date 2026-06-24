import OpenAI from "openai";

export const parseInvoiceText = async (ocrText) => {
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const attemptCall = async () => {
const start = Date.now();

const completion = await client.chat.completions.create({
  model: "google/gemma-4-31b-it:free",

  temperature: 0,

  messages: [
  {
    role: "system",
      content: `

You are a pharmacy invoice extraction engine.

Return ONLY valid JSON matching this schema:

{
"supplier_name": "",
"supplier_gstin": "",
"invoice_no": "",
"invoice_date": "",
"subtotal": 0,
"total_discount": 0,
"taxable_amount": 0,
"cgst_amount": 0,
"sgst_amount": 0,
"grand_total": 0,
"items": [
{
"medicine_name": "",
"mrp": "0",
"quantity": 0,
"expiry_date": "",
"cost_price": 0,
"batch_number": "",
"hsn_code": "",
"gst": 0,
"amount": 0
}
]
}

Rules:

* Extract every medicine row.
* Preserve medicine names exactly.
* Never invent values.
* Missing values = null.
* Return JSON only.

Dates:

* invoice_date → YYYY-MM-DD.
* expiry_date MM/YY → last day of month.
  Example: 08/27 → 2027-08-31.

MRP RULES

There are two common invoice formats.

FORMAT 1

Columns:

MRP | Rate | GST | NET | Amount

Example:

267.28 203.65 5.00 205.28 615.83

Output:

mrp = 267.28
cost_price = 205.28

FORMAT 2

Old MRP and New MRP appear together.

Example:

268.80
252.00

Rate:
192.00

Net Rate:
180.48

Output:

mrp = 252.00
cost_price = 180.48

Rules:

If a dedicated MRP column exists:
use the MRP column value.

When two MRP values appear for the same item:
 1   | AB FLO N TABLET (10 TAB)                                   | 30049027 | 2   | STRIP| S2687008C  | LUP | 08/27  | 268.80  | 192.00| 6.00   | 180.48   | 360.96        | 2.50   | 2.50   | 379.00 |
|     |                                                            |          |     |      |            |     |        | 252.00  |       |        |          |               |        |        |        |

like here, the 2nd line only has one number that is the real mrp, take that as mrp for thsi format raw texts

Never use:
Rate
NET
Amount
Taxable Value
as MRP.
cost_price always comes from:
NET
else Rate.
Cost Price:

* Use Net Rate.
* If Net Rate missing, use Rate.

GST:

* gst = GST column.
* If only CGST and SGST exist:
  gst = CGST + SGST.

Quantity:

* Use Qty column.
* If missing:
  quantity = round(amount / net_rate).

Batch Number:

* Use Batch column exactly.

HSN:

* Use HSN/SAC column.

Ignore:

* Totals
* Tax summaries
* Online Paid
* Wallet Paid
* Coupon Discount
* COD Charges
* Platform Fees

OCR TEXT:

${ocrText}
`,
},
],
});

console.log(
  "OpenRouter Parse Time:",
  Date.now() - start,
  "ms"
);

return completion.choices[0].message.content;

};

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      return await attemptCall();
    } catch (error) {
      attempts++;
      console.error(
        "OpenRouter Parse Error (Attempt " + attempts + "):",
        error?.response?.data || error.message
      );

      const errorMessage = (error?.message || "").toLowerCase();
      const responseDataString = JSON.stringify(error?.response?.data || {}).toLowerCase();

      const isRateLimit =
        error?.status === 429 ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many request") ||
        responseDataString.includes("too many request") ||
        errorMessage.includes("server busy");

      const isUnavailable =
        error?.status === 503 || errorMessage.includes("unavailable");

      if ((isRateLimit || isUnavailable) && attempts < maxAttempts) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      throw error;
    }
  }
};