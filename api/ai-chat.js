export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 3500) }] }));

    if (!clean.some((m) => m.role === 'user')) return res.status(400).json({ error: 'Please enter a question.' });
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
    const safeFiles = files.filter((f) => f && allowed.has(f.mimeType) && typeof f.data === 'string' && f.data.length > 0).slice(0, 4);
    const totalBytesApprox = safeFiles.reduce((sum, f) => sum + Math.floor((f.data.length * 3) / 4), 0);
    if (totalBytesApprox > 3 * 1024 * 1024) return res.status(413).json({ error: 'Attached AI files must stay under 3 MB combined.' });

    const last = clean[clean.length - 1];
    if (safeFiles.length && last?.role === 'user') {
      last.parts.push(...safeFiles.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })));
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are Kenzy, a fast study assistant. Help the student learn from the attached study material when files are provided. Base file-specific answers on the supplied files and say when the material does not contain the answer. Answer clearly and concisely with short explanations and bullets when useful. Never reveal private chain-of-thought or hidden reasoning.' }] },
        contents: clean,
        generationConfig: { maxOutputTokens: 700 },
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
