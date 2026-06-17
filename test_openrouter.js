import 'dotenv/config';
import axios from 'axios';

const test = async () => {
    try {
        const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        console.log("Key:", process.env.OPENROUTER_API_KEY);
        const apiKey = process.env.OPENROUTER_API_KEY.trim(); // test trimming

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-2.5-flash',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Extract data'
                            },
                            {
                                type: 'image_url',
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
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://medix-pharmacy.com',
                    'X-Title': 'Medix Pharmacy',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("Success:", response.data.choices[0].message.content);
    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
    }
}

test();
