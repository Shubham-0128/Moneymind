export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Read API key from server-side environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    }

    try {
        const summary = req.body;

        const prompt = `You are an expert personal finance coach analyzing a user's expense data.

Here is the compact aggregated spending summary:
${JSON.stringify(summary, null, 2)}

Provide 2 to 3 concise, specific, and actionable budgeting tips or observations based on these exact figures.

CRITICAL INSTRUCTIONS:
1. Reference specific categories and amounts (in ₹).
2. For any standout or high spending category, recommend a concrete, practical action they can take this week.
3. NEVER return vague advice like "try to save more money" or "cut unnecessary expenses".
4. Return ONLY a valid JSON array of 2 to 3 short strings, with no markdown code blocks, explanations, or wrapping.
Example format:
["Your Food spending (₹4,200) is 35% above your recent average — try meal-prepping twice this week to trim ~₹800.", "Bills total ₹3,100 this month — review recurring subscriptions to ensure there are no unused services."]`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 500,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: errorData.error?.message || `Anthropic API error: ${response.status}`
            });
        }

        const data = await response.json();
        const rawText = data.content?.[0]?.text || '';

        // Clean potential markdown code fences
        let cleanedText = rawText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const suggestions = JSON.parse(cleanedText);

        if (!Array.isArray(suggestions)) {
            throw new Error("Invalid response format: expected an array of strings.");
        }

        return res.status(200).json({ suggestions });
    } catch (err) {
        console.error("Error generating AI suggestions:", err);
        return res.status(500).json({ error: "Failed to generate suggestions." });
    }
}
