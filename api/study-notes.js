const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

async function readPrivateBlob(pathname) {
  const { get } = await import('@vercel/blob');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('The imported file could not be read.');
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { buffer, contentType: result.blob?.contentType };
}

async function callGemini(apiKey, prompt, files) {
  const parts = [];
  for (const file of files) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
  parts.push({ text: prompt });
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: [
        'You are Kenzy, a helpful study-notes assistant.',
        'Use only information present in the supplied note text or uploaded files.',
        'Do not invent facts, citations, examples, or definitions that are not supported by the source.',
        'Make the result easy for a student to understand and study.',
        'Preserve important terminology and structure when improving notes.',
        'Use readable Unicode math such as √, ², ³, ×, ÷, ±, ≤, ≥ and log₁₀.',
        'Never output raw LaTeX delimiters or programming-style math notation such as ^3, sqrt(x), \\frac, $, or \\( \\).',
        'Use headings, short paragraphs, and bullet lists when they improve study readability.',
        'For an imported document, create clean editable notes that preserve the source structure and important details.',
      ].join(' ') }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 6000 },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = 'Gemini could not process the note.';
    try { message = JSON.parse(text)?.error?.message || message; } catch {}
    return { error: `Gemini API error (${response.status}): ${message}` };
  }
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'Gemini returned an unreadable response.' }; }
  const result = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  return result ? { result } : { error: 'Kenzy received no result from Gemini.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });

  const cleanup = [];
  try {
    const body = req.body || {};
    const action = typeof body.action === 'string' ? body.action : 'Improve these notes for studying.';
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : '';
    const noteContent = typeof body.content === 'string' ? body.content : '';
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large note imports are not configured. Connect the Vercel Blob store first.' });
      let total = 0;
      files = [];
      for (const item of blobFiles.slice(0, 3)) {
        const pathname = typeof item?.pathname === 'string' ? item.pathname : '';
        const mimeType = item?.mimeType;
        if (!pathname.startsWith('notes-material/') || !ALLOWED.has(mimeType)) return res.status(400).json({ error: 'Invalid note file.' });
        const stored = await readPrivateBlob(pathname);
        total += stored.buffer.byteLength;
        if (total > MAX_BYTES) return res.status(413).json({ error: 'Keep imported note files at or below 25 MB combined.' });
        files.push({ name: item.name || 'study-file', mimeType, data: stored.buffer.toString('base64') });
        cleanup.push(pathname);
      }
    }

    if (files.some((file) => !file || !ALLOWED.has(file.mimeType) || typeof file.data !== 'string' || !file.data)) return res.status(400).json({ error: 'Use PDF, PNG, JPG, or WebP files only.' });
    const approxBytes = files.reduce((sum, file) => sum + Math.floor(file.data.length * 0.75), 0);
    if (approxBytes > MAX_BYTES) return res.status(413).json({ error: 'Keep imported note files at or below 25 MB combined.' });
    if (!noteContent.trim() && !files.length) return res.status(400).json({ error: 'Add some note text or import a PDF/image first.' });

    const prompt = [
      `Task: ${action}`,
      title ? `Note title: ${title}` : '',
      noteContent.trim() ? `Current note:\n${noteContent.slice(0, 30000)}` : '',
      files.length ? 'The uploaded study file is the primary source for this request.' : '',
      'For an import task, return clean editable notes rather than a description of the file.',
    ].filter(Boolean).join('\n\n');

    const result = await callGemini(apiKey, prompt, files);
    if (result.error) return res.status(502).json({ error: result.error });
    return res.status(200).json({ result: result.result });
  } catch (error) {
    console.error('Study notes exception:', error);
    return res.status(500).json({ error: error?.message || 'Something went wrong while processing your notes.' });
  } finally {
    if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { del } = await import('@vercel/blob');
        await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })));
      } catch {}
    }
  }
}
