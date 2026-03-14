export const safeParseJSON = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("No JSON found");
    }

    return JSON.parse(match[0]);
  } catch (error) {
    console.error("JSON Parse Error:", error);
    throw new Error("Invalid AI response format");
  }
};