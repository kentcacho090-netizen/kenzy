const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

async function readPrivateBlob(pathname) {
  const { get } = await import('@vercel/blob');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('The imported file could not be read.');
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return buffer;
}

function decodeBase64(value) {
  const text = String(value || '');
  const comma = text.indexOf(',');
  return Buffer.from(comma >= 0 ? text.slice(comma + 1) : text, 'base64');
}

async function callGemini(apiKey, prompt, files) {
  const parts = files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } }));
  parts.push({ text: prompt });
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: [
        'You are Kenzy, a helpful study-notes assistant.',
        'Use only information present in the supplied note text or uploaded files.',
        'Do not invent facts, citations, examples, or definitions that are not supported by the source.',
        'Make results easy for a student to understand and study.',
        'Preserve important terminology and structure when improving notes.',
        'Use readable Unicode math such as √, ², ³, ×, ÷, ±, ≤, ≥ and log₁₀.',
        'Never output raw LaTeX delimiters or programming-style math notation such as ^3, sqrt(x), \\frac, $, or escaped math delimiters.',
        'Use headings, short paragraphs, and bullet lists when useful.',
        'For imported files, create clean editable notes that preserve the source structure and important details.',
      ].join(' ') }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 6000 },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = 'Gemini could not process the note.';
    try { message = JSON.parse(text)?.error?.message || message; } catch {}
    throw new Error(`Gemini API error (${response.status}): ${message}`);
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Gemini returned an unreadable response.'); }
  const result = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (!result) throw new Error('Kenzy received no result from Gemini.');
  return result;
}

async function callGeminiFilesApi(apiKey, prompt, files) {
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  try {
    for (const file of files) {
      const item = await ai.files.upload({
        file: new Blob([decodeBase64(file.data)], { type: file.mimeType }),
        config: { mimeType: file.mimeType, displayName: file.name || 'kenzy-note-source' },
      });
      let status = item;
      for (let attempt = 0; attempt < 20 && status?.state === 'PROCESSING'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        status = await ai.files.get({ name: item.name });
      }
      if (!status?.uri || status?.state !== 'ACTIVE') throw new Error(`Gemini could not finish processing ${file.name || 'the file'}.`);
      uploaded.push(status);
    }
    const contents = createUserContent([...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)), prompt]);
    const response = await ai.models.generateContent({ model: 'gemini-3.7-flash', contents, config: { maxOutputTokens: 6000, thinkingConfig: { thinkingLevel: 'low' } } });
    if (!response.text) throw new Error('Kenzy received no result from Gemini.');
    return response.text;
  } finally {
    await Promise.allSettled(uploaded.filter((file) => file?.name).map((file) => ai.files.delete({ name: file.name })));
  }
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
    const content = typeof body.content === 'string' ? body.content.slice(0, 30000) : '';
    let files = Array.isArray(body.files) ? body.files.filter(Boolean) : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles.filter(Boolean) : [];

    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large note imports need a connected Vercel Blob store.' });
      files = [];
      let total = 0;
      for (const item of blobFiles.slice(0, 3)) {
        const pathname = typeof item.pathname === 'string' ? item.pathname : '';
        const mimeType = item.mimeType;
        if (!pathname.startsWith('notes-material/') || !ALLOWED.has(mimeType)) return res.status(400).json({ error: 'Invalid note file.' });
        const buffer = await readPrivateBlob(pathname);
        total += buffer.byteLength;
        if (total > MAX_BYTES) return res.status(413).json({ error: 'Keep imported note files at or below 25 MB combined.' });
        files.push({ name: item.name || 'study-file', mimeType, data: buffer.toString('base64') });
        cleanup.push(pathname);
      }
    }

    if (files.some((file) => !ALLOWED.has(file.mimeType) || typeof file.data !== 'string' || !file.data)) return res.status(400).json({ error: 'Use PDF, PNG, JPG, or WebP files only.' });
    const totalBytes = files.reduce((sum, file) => sum + Math.floor(file.data.length * 0.75), 0);
    if (totalBytes > MAX_BYTES) return res.status(413).json({ error: 'Keep note files at or below 25 MB combined.' });
    if (!content.trim() && !files.length) return res.status(400).json({ error: 'Write some notes or import a PDF/image first.' });

    const prompt = [
      `Task: ${action}`,
      title ? `Note title: ${title}` : '',
      content.trim() ? `Current note:\n${content}` : '',
      files.length ? 'The uploaded file is the primary source. Read it carefully and create accurate, editable study notes.' : '',
      'For summarize/simplify/study-guide tasks, improve the current note without adding unsupported facts.',
    ].filter(Boolean).join('\n\n');

    const result = totalBytes > 3 * 1024 * 1024
      ? await callGeminiFilesApi(apiKey, prompt, files)
      : await callGemini(apiKey, prompt, files);
    return res.status(200).json({ result });
  } catch (error) {
    console.error('Study notes exception:', error);
    return res.status(/too large|25 MB/i.test(error?.message || '') ? 413 : 502).json({ error: error?.message || 'Something went wrong while processing your notes.' });
  } finally {
    if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { del } = await import('@vercel/blob');
        await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })));
      } catch {}
    }
  }
}
