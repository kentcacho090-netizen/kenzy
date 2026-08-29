export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel, then redeploy.'
    });
  }

  try {
    const { pdf, count = 10 } = req.body || {};

    if (typeof pdf !== 'string' || pdf.length === 0) {
      return res.status(400).json({ error: 'No PDF was supplied.' });
    }

    if (pdf.length > 3_800_000) {
      return res.status(413).json({
        error: 'That PDF is too large. Please use a PDF smaller than 2.7 MB.'
      });
    }

    const questionCount = Math.min(
      Math.max(Number.parseInt(count, 10) || 10, 3),
      30
    );

    const prompt = [
      `Create exactly ${questionCount} high-quality multiple-choice questions from the attached PDF.`,
      'Use only information supported by the document.',
      'Avoid duplicates and trick questions.',
      'Each question must have exactly four plausible answer choices.',
      'correctIndex is zero-based (0, 1, 2, or 3).',
      'Return ONLY valid JSON in this exact shape:',
      '{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]}',
      'Do not include markdown fences or any text outside the JSON object.'
    ].join(' ');

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: pdf
                  }
                },
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      let message = 'Gemini could not generate the quiz.';
      try {
        const apiError = JSON.parse(responseText)?.error;
        if (apiError?.message) message = apiError.message;
      } catch {
        // Keep the safe fallback message.
      }

      console.error('Gemini API error:', response.status, responseText);
      return res.status(502).json({
        error: `Gemini API error (${response.status}): ${message}`
      });
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        error: 'Gemini returned an unreadable response.'
      });
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.find((part) => typeof part.text === 'string')?.text;

    if (!text) {
      const finishReason = payload?.candidates?.[0]?.finishReason;
      return res.status(502).json({
        error: finishReason
          ? `Gemini returned no quiz data (finish reason: ${finishReason}).`
          : 'Gemini returned no quiz data.'
      });
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      console.error('Gemini non-JSON output:', text);
      return res.status(502).json({
        error: 'Gemini returned invalid quiz JSON. Please try again.'
      });
    }

    const questions = Array.isArray(result.questions)
      ? result.questions
          .slice(0, questionCount)
          .filter((item) => (
            item &&
            typeof item.question === 'string' &&
            item.question.trim().length > 0 &&
            Array.isArray(item.options) &&
            item.options.length === 4 &&
            item.options.every((option) => (
              typeof option === 'string' && option.trim().length > 0
            )) &&
            Number.isInteger(item.correctIndex) &&
            item.correctIndex >= 0 &&
            item.correctIndex <= 3
          ))
      : [];

    if (questions.length === 0) {
      return res.status(502).json({
        error: 'Gemini did not return a valid quiz. Please try again.'
      });
    }

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({
      error: 'Something went wrong while generating the quiz.'
    });
  }
}
