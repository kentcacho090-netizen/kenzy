export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });
  }

  try {
    const { pdf, count = 10 } = req.body || {};

    if (typeof pdf !== 'string' || !pdf) {
      return res.status(400).json({ error: 'No PDF was supplied.' });
    }

    // Vercel Functions have a request payload limit. Base64 expands the PDF,
    // so the browser intentionally limits uploads to about 2.7 MB.
    if (pdf.length > 3800000) {
      return res.status(413).json({ error: 'That PDF is too large. Please use a PDF smaller than 2.7 MB.' });
    }

    const questionCount = Math.min(Math.max(Number.parseInt(count, 10) || 10, 3), 30);

    const prompt = [
      `Create exactly ${questionCount} high-quality multiple-choice questions from the attached PDF.`,
      'Use only information that can be supported by the document.',
      'Avoid duplicate questions and avoid trick questions.',
      'Each question must have exactly four plausible answer choices.',
      'The correctIndex must identify the correct option using zero-based indexing.',
      'Return only the requested JSON object.'
    ].join(' ');

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdf } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      options: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 4,
                        maxItems: 4
                      },
                      correctIndex: { type: 'integer', minimum: 0, maximum: 3 }
                    },
                    required: ['question', 'options', 'correctIndex']
                  }
                }
              },
              required: ['questions']
            }
          }
        })
      }
    );

    const responseText = await response.text();
    if (!response.ok) {
      console.error('Gemini error:', responseText);
      return res.status(502).json({ error: 'Gemini could not generate the quiz. Check your Gemini API key and try again.' });
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ error: 'Gemini returned an unreadable response.' });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!text) {
      return res.status(502).json({ error: 'Gemini returned no quiz data.' });
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Gemini returned invalid quiz JSON.' });
    }

    const questions = Array.isArray(result.questions)
      ? result.questions.filter((item) => (
          item &&
          typeof item.question === 'string' &&
          Array.isArray(item.options) &&
          item.options.length === 4 &&
          item.options.every((option) => typeof option === 'string') &&
          Number.isInteger(item.correctIndex) &&
          item.correctIndex >= 0 &&
          item.correctIndex <= 3
        ))
      : [];

    if (questions.length === 0) {
      return res.status(502).json({ error: 'Gemini did not return a valid quiz.' });
    }

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({ error: 'Something went wrong while generating the quiz.' });
  }
}
