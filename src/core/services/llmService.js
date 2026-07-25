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

// ── TWO-STEP PIPELINE MODELS ────────────────────────────────────────────────
// You can swap these with your preferred paid/flagship models later.
// Currently using free OpenRouter models.

// Step 1: Vision Models (For raw OCR / Markdown extraction)
const VISION_MODELS = [
    { id: "google/gemma-4-26b-a4b-it:free",             name: "Gemma 4 26B A4B" },
    { id: "google/gemma-4-26b-a4b-it:free",             name: "Gemma 4 26B A4B (Retry)" },
    { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B" },
    
];

// Step 2: Text Models (For reasoning and strict JSON parsing)
const TEXT_MODELS = [
    { id: "cohere/north-mini-code:free",        name: "North Mini Code" },
    { id: "google/gemma-4-26b-a4b-it:free",          name: "Gemma 4 26B A4B" },
];

// ── PROMPTS ──────────────────────────────────────────────────────────────────

const OCR_PROMPT = `Please transcribe all the text and tabular data from this invoice image exactly as written. 
Format the output as a clean Markdown table. 
Do not attempt to interpret, calculate, or fix anything. Just read the text.
If there are multiple tables, transcribe all of them.`;

const JSON_PROMPT = `You are a strict data extraction system.
Map the following raw invoice text (Markdown) into the provided JSON schema.

Column Mapping Hints:
Description of Goods → medicine_name
Batch → batch_number
Exp Dt → expiry_date (convert to YYYY-MM-DD; if only MM/YY, use the last day of that month)
Qty → quantity
Unit → unit
Rate → purchase_price
Discount % → discount_percentage
Taxable Value → taxable_value
CGST + SGST → gst_percentage (e.g., 2.5 + 2.5 = 5)
Amount → total_amount
HSN/SAC → hsn_code

Rules:
1. Preserve medicine names exactly as written in the text.
2. Never use Old MRP.
3. Return numbers as numbers, not strings.
4. Use null for missing values. Do not hallucinate data that is not explicitly in the text.
5. Return ONLY the raw JSON object, no markdown fences, no explanations.

Schema:
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

Raw Invoice Text to Parse:
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ORIGINAL SINGLE-IMAGE EXTRACTION (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

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
                        { type: "text", text: OCR_PROMPT + "\n\n" + JSON_PROMPT },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                    ],
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 4000,
        });

        console.log(`[LLM Pipeline] Extraction completed in ${Date.now() - start} ms`);
        return safeParseJSON(response.choices[0].message.content);
    } catch (error) {
        console.error("[LLM Pipeline Error]", error?.response?.data || error.message);
        throw new Error(error?.response?.data?.error?.message || error.message || "Failed to extract invoice via LLM");
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING (Rule-based + Anti-Hallucination)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute confidence for a single item, checking against the raw OCR text.
 */
const computeItemConfidence = (item, rawMarkdown) => {
    let score = 0;
    const weights = {
        requiredFields: 25,
        numericSanity: 15,
        dateValidity: 10,
        mathConsistency: 20,
        nameQuality: 10,
        groundTruth: 20, // Anti-hallucination check
    };

    // ── 0. ANTI-HALLUCINATION GROUND TRUTH CHECK (Critical) ──
    const name = String(item.medicine_name || "").trim().toLowerCase();
    const markdownLower = (rawMarkdown || "").toLowerCase();
    
    let groundTruthScore = 0;
    if (name.length > 2) {
        // Look for parts of the name in the raw text to handle slight OCR misspellings
        const parts = name.split(/\s+/).filter(p => p.length > 2);
        let matchCount = 0;
        parts.forEach(p => {
            if (markdownLower.includes(p)) matchCount++;
        });
        
        if (matchCount > 0) {
            groundTruthScore = matchCount / parts.length;
        }
    }
    
    // If the item name is absolutely nowhere in the OCR text, penalize heavily (likely a hallucination)
    if (groundTruthScore === 0) {
        return 0; // Immediate 0% confidence for full hallucination
    }
    score += groundTruthScore * weights.groundTruth;

    // ── 1. Required fields present (25%) ──
    const hasName = name.length > 0;
    const hasQty = item.quantity !== null && item.quantity !== undefined && !isNaN(Number(item.quantity));

    let requiredScore = 0;
    if (hasName) requiredScore += 0.5;
    if (hasQty) requiredScore += 0.5;
    score += requiredScore * weights.requiredFields;

    // ── 2. Numeric sanity (15%) ──
    let numericScore = 0;
    const qty = Number(item.quantity) || 0;
    const purchasePrice = Number(item.purchase_price) || 0;

    if (qty > 0 && qty < 10000) numericScore += 0.5;
    if (purchasePrice >= 0 && purchasePrice < 50000) numericScore += 0.5;
    score += numericScore * weights.numericSanity;

    // ── 3. Date validity (10%) ──
    let dateScore = 0;
    if (item.expiry_date) {
        const parsed = new Date(item.expiry_date);
        if (!isNaN(parsed.getTime())) {
            dateScore += 0.5;
            if (parsed > new Date()) dateScore += 0.5;
            else dateScore += 0.2;
        }
    } else {
        dateScore += 0.4;
    }
    score += dateScore * weights.dateValidity;

    // ── 4. Math consistency (20%) ──
    let mathScore = 0;
    const totalAmount = Number(item.total_amount) || 0;

    if (purchasePrice > 0 && qty > 0 && totalAmount > 0) {
        const expected = qty * purchasePrice;
        const diff = Math.abs(expected - totalAmount) / totalAmount;
        if (diff <= 0.10) mathScore = 1.0;
        else if (diff <= 0.25) mathScore = 0.6;
        else mathScore = 0.2;
    } else if (purchasePrice > 0 || totalAmount > 0) {
        mathScore = 0.4;
    } else {
        mathScore = 0.5;
    }
    score += mathScore * weights.mathConsistency;

    // ── 5. Name quality (10%) ──
    let nameScore = 0;
    if (name.length > 2) nameScore += 0.4;
    if (name.length > 5) nameScore += 0.2;
    if (!/^\d+$/.test(name)) nameScore += 0.2;
    if (/[a-zA-Z]/.test(name)) nameScore += 0.2;
    score += nameScore * weights.nameQuality;

    return Math.round(Math.min(100, Math.max(0, score)));
};

export const computeConfidence = (items, rawMarkdown) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return { overallConfidence: 0, itemConfidences: [], validationWarnings: ["No items extracted"] };
    }

    const warnings = [];
    const itemConfidences = items.map((item, idx) => {
        const confidence = computeItemConfidence(item, rawMarkdown);
        if (confidence < 70) {
            const name = item.medicine_name || `Item ${idx + 1}`;
            warnings.push(confidence === 0 
                ? `Possible hallucination detected: ${name}`
                : `Low confidence (${confidence}%) on: ${name}`);
        }
        return confidence;
    });

    const overallConfidence = Math.round(
        itemConfidences.reduce((sum, c) => sum + c, 0) / itemConfidences.length
    );

    if (items.length === 0) warnings.push("No items were extracted from the invoice");

    return { overallConfidence, itemConfidences, validationWarnings: warnings };
};

// ═══════════════════════════════════════════════════════════════════════════════
// TWO-STEP CASCADE: Vision (OCR) -> Text (JSON)
// ═══════════════════════════════════════════════════════════════════════════════

const transcribeImage = async (image, modelId) => {
    const response = await getOpenAIClient().chat.completions.create({
        model: modelId,
        messages: [{
            role: "user",
            content: [
                { type: "text", text: OCR_PROMPT },
                { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }
            ],
        }],
        temperature: 0.1,
        max_tokens: 4000,
    });
    return response.choices[0].message.content;
};

const parseMarkdownToJSON = async (markdownText, modelId) => {
    const response = await getOpenAIClient().chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: JSON_PROMPT + "\n\n" + markdownText }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8000,
    });
    
    const choice = response.choices[0];
    if (choice.finish_reason === "length") {
        console.warn(`[LLM Text] ${modelId}: Response truncated (finish_reason=length).`);
    }
    
    return safeParseJSON(choice.message.content);
};

const sanitizeExpiryDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    const str = dateStr.trim();
    try {
        let year, month;
        if (/^\d{1,2}[\/\-]\d{2,4}$/.test(str)) {
            const parts = str.split(/[\/\-]/);
            month = parseInt(parts[0]);
            const yy = parts[1];
            year = parseInt(yy.length === 2 ? `20${yy}` : yy);
        } else if (/^\d{4}-\d{2}(-\d{2})?$/.test(str)) {
            const parts = str.split("-");
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
        }
        if (year && month) {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        }
    } catch (e) {
        // Fallback to original string on error
    }
    return str;
};

export const extractWithCascade = async (images, confidenceThreshold = 90) => {
    const attempts = [];
    let combinedMarkdown = "";

    // ── STEP 1: OCR Each Page Individually ──
    console.log(`[LLM Cascade] Step 1: Starting OCR on ${images.length} pages...`);
    for (let i = 0; i < images.length; i++) {
        let pageSuccess = false;
        
        for (const visionModel of VISION_MODELS) {
            try {
                console.log(`[LLM Cascade] Page ${i+1}: Trying Vision Model ${visionModel.name}...`);
                const markdown = await transcribeImage(images[i], visionModel.id);
                combinedMarkdown += `\n\n--- PAGE ${i+1} ---\n\n` + markdown;
                pageSuccess = true;
                break; // Stop cascading vision models for this page on success
            } catch (err) {
                console.warn(`[LLM Cascade] Page ${i+1}: Vision Model ${visionModel.name} failed. Retrying...`, err.message);
            }
        }
        
        if (!pageSuccess) {
            console.error(`[LLM Cascade] Page ${i+1}: All vision models failed.`);
        }
    }

    if (!combinedMarkdown.trim()) {
        return {
            items: [], invoice: {}, overallConfidence: 0, itemConfidences: [],
            validationWarnings: ["All vision models failed to read the images."],
            modelUsed: "", attempts: [], status: "failed",
        };
    }

    console.log(`\n================== RAW MARKDOWN (OCR) ==================\n${combinedMarkdown}\n========================================================\n`);

    // ── STEP 2: Parse Markdown to JSON (Cascade) ──
    console.log(`[LLM Cascade] Step 2: Parsing ${combinedMarkdown.length} chars of Markdown to JSON...`);
    
    let bestResult = null;
    let bestConfidence = 0;
    let bestModel = "";
    let bestItemConfidences = [];
    let bestWarnings = [];
    let bestInvoice = {};

    for (const textModel of TEXT_MODELS) {
        const attemptRecord = {
            model: textModel.id, started_at: new Date(), completed_at: null,
            success: false, confidence: 0, error: "", items_count: 0,
        };

        try {
            console.log(`[LLM Cascade] Trying Text Model ${textModel.name}...`);
            const parsed = await parseMarkdownToJSON(combinedMarkdown, textModel.id);
            attemptRecord.completed_at = new Date();

            if (!parsed || !parsed.items || !Array.isArray(parsed.items)) {
                throw new Error("Invalid response format: missing items array");
            }

            // Sanitize dates globally before scoring and saving
            parsed.items = parsed.items.map(item => ({
                ...item,
                expiry_date: sanitizeExpiryDate(item.expiry_date)
            }));

            attemptRecord.items_count = parsed.items.length;
            attemptRecord.success = true;

            const { overallConfidence, itemConfidences, validationWarnings } = 
                computeConfidence(parsed.items, combinedMarkdown); // Pass markdown for anti-hallucination

            attemptRecord.confidence = overallConfidence;
            attempts.push(attemptRecord);

            console.log(`[LLM Cascade] ${textModel.name}: ${parsed.items.length} items, conf ${overallConfidence}%`);

            if (overallConfidence > bestConfidence) {
                bestResult = parsed.items;
                bestConfidence = overallConfidence;
                bestModel = textModel.id;
                bestItemConfidences = itemConfidences;
                bestWarnings = validationWarnings;
                bestInvoice = parsed.invoice || {};
            }

            if (overallConfidence >= confidenceThreshold) {
                console.log(`[LLM Cascade] ✓ Target confidence reached. Used ${textModel.name}`);
                break;
            }
        } catch (error) {
            attemptRecord.completed_at = new Date();
            attemptRecord.error = error.message;
            attempts.push(attemptRecord);
            console.error(`[LLM Cascade] ✗ Text Model ${textModel.name} failed: ${error.message}`);
        }
    }

    const status = bestConfidence >= confidenceThreshold ? "review_ready" : "low_confidence";

    if (!bestResult || bestResult.length === 0) {
        return {
            items: [], invoice: {}, overallConfidence: 0, itemConfidences: [],
            validationWarnings: ["All text models failed to extract valid JSON data."],
            modelUsed: "", attempts, status: "low_confidence",
        };
    }

    const itemsWithConfidence = bestResult.map((item, idx) => ({
        ...item,
        item_confidence: bestItemConfidences[idx] || 0,
    }));

    const finalResult = {
        items: itemsWithConfidence, invoice: bestInvoice, overallConfidence: bestConfidence,
        itemConfidences: bestItemConfidences, validationWarnings: bestWarnings,
        modelUsed: bestModel, attempts, status,
    };

    console.log(`\n================== FINAL JSON RESULT ==================\n${JSON.stringify({ invoice: bestInvoice, items: itemsWithConfidence }, null, 2)}\n=======================================================\n`);

    return finalResult;
};