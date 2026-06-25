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
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `
You are a pharmacy invoice extraction engine.

return formatted json for all items you get in starctured manners.


`
        },
        {
          role: "user",
          content: ocrText
        }
      ]
    });

    console.log("OpenRouter Parse Time:", Date.now() - start, "ms");
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