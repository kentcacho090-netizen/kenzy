export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 6000) }] }));

    if (!clean.some((m) => m.role === 'user')) return res.status(400).json({ error: 'Please enter a question.' });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are Kenzy, a helpful study assistant. Explain clearly, encourage learning, avoid pretending to know facts unsupported by the user context, and format answers for easy reading. Do not reveal private chain-of-thought or hidden reasoning.' }] },
        contents: clean,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = 'Gemini could not answer right now.';
      try { message = JSON.parse(text)?.error?.message || message; } catch {}
      console.error('AI chat error:', response.status, text);
      return res.status(502).json({ error: `Gemini API error (${response.status}): ${message}` });
    }

    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: 'Gemini returned an unreadable response.' }); }
    const reply = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!reply) return res.status(502).json({ error: 'Kenzy received no answer from Gemini.' });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat exception:', error);
    return res.status(500).json({ error: 'Something went wrong while contacting Kenzy AI.' });
  }
}
