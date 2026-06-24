export const safeParseJSON = (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Input is null, undefined, or not a string');
    }
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