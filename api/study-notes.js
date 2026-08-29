export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });

  try {
    const { action, title = '', content = '' } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Write some note content first.' });

    const prompt = [
      'You are Kenzy, a study notes assistant.',
      `Task: ${typeof action === 'string' ? action : 'Improve these notes for studying.'}`,
      `Note title: ${String(title).slice(0, 200)}`,
      'Use only the supplied notes for factual content. Do not invent details.',
      'Return a useful result that a student can study from.',
      `Notes:\n${content.slice(0, 20000)}`,
    ].join('\n\n');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = 'Gemini could not process the note.';
      try { message = JSON.parse(text)?.error?.message || message; } catch {}
      console.error('Study notes AI error:', response.status, text);
      return res.status(502).json({ error: `Gemini API error (${response.status}): ${message}` });
    }

    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: 'Gemini returned an unreadable response.' }); }
    const result = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!result) return res.status(502).json({ error: 'Kenzy received no result from Gemini.' });
    return res.status(200).json({ result });
  } catch (error) {
    console.error('Study notes exception:', error);
    return res.status(500).json({ error: 'Something went wrong while processing your notes.' });
  }
}
