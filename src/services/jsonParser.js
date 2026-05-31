export const safeParseJSON = (text) => {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {
    console.error('JSON Parse Error:', err);
    throw new Error('Invalid AI response format');
  }
};