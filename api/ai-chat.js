import { get } from '@vercel/blob';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const PPT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const FAST_MODEL = 'gemini-3.5-flash-lite';
const FILE_MODEL = 'gemini-3.7-flash';

function approxBytes(data) { return Math.floor((data.length * 3) / 4); }

async function blobToBase64(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Could not read one of the uploaded files.');
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { data: buffer.toString('base64'), size: buffer.byteLength, contentType: result.blob.contentType };
}

function buildPrompt(messages) {
  const history = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8);
  const prompt = history.filter((m) => m.role === 'user').at(-1)?.content || 'Please help me study the attached material.';
  const context = history.slice(0, -1).map((m) => `${m.role === 'assistant' ? 'Kenzy' : 'Student'}: ${m.content.slice(0, 2200)}`).join('\n');
  return context ? `Recent conversation:\n${context}\n\nStudent's latest request:\n${prompt}` : prompt;
}

async function generateWithGeminiFiles(apiKey, messages, files) {
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  try {
    for (const file of files) {
      const clean = String(file.data || '').split(',').pop();
      const buffer = Buffer.from(clean, 'base64');
      const item = await ai.files.upload({ file: new Blob([buffer], { type: file.mimeType }), config: { mimeType: file.mimeType, displayName: file.name || 'study-material' } });
      let status = item;
      for (let attempt = 0; attempt < 10 && status?.state === 'PROCESSING'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        status = await ai.files.get({ name: item.name });
      }
      if (!status?.uri || status?.state !== 'ACTIVE') throw new Error(`Gemini could not finish processing ${file.name || 'the study file'}.`);
      uploaded.push(status);
    }
    const contents = createUserContent([...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)), buildPrompt(messages)]);
    const response = await ai.models.generateContent({ model: FILE_MODEL, contents, config: { maxOutputTokens: 750, thinkingConfig: { thinkingLevel: 'low' } } });
    if (!response.text) throw new Error('Kenzy received no answer from Gemini.');
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
    const messages = Array.isArray(body.messages) ? body.messages : [];
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large uploads are not configured. Connect a Vercel Blob store to this project.' });
      const resolved = [];
      let total = 0;
      for (const blobFile of blobFiles.slice(0, 8)) {
        const pathname = typeof blobFile?.pathname === 'string' ? blobFile.pathname : '';
        if (!pathname || !pathname.startsWith('kenzy-material/')) return res.status(400).json({ error: 'One of the large uploaded files is invalid.' });
        if (!ALLOWED.has(blobFile.mimeType)) return res.status(400).json({ error: 'One of the large uploaded files has an unsupported type.' });
        const stored = await blobToBase64(pathname);
        total += stored.size;
        if (total > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'Attached AI files must stay at or below 25 MB combined.' });
        resolved.push({ name: blobFile.name, mimeType: blobFile.mimeType, data: stored.data });
        cleanup.push(pathname);
      }
      files = [...files, ...resolved];
    }

    const clean = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 2500) }] }));
    if (!clean.some((m) => m.role === 'user')) return res.status(400).json({ error: 'Please enter a question.' });

    const safeFiles = files.filter((f) => f && ALLOWED.has(f.mimeType) && typeof f.data === 'string' && f.data.length > 0).slice(0, 8);
    const totalBytes = safeFiles.reduce((sum, f) => sum + approxBytes(f.data), 0);
    if (totalBytes > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'Attached AI files must stay at or below 25 MB combined.' });

    const originalMessages = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8);
    const needsFilesApi = safeFiles.some((file) => PPT_TYPES.has(file.mimeType)) || totalBytes > 3 * 1024 * 1024;
    let reply;

    if (needsFilesApi) {
      reply = await generateWithGeminiFiles(apiKey, originalMessages, safeFiles);
    } else {
      const last = clean[clean.length - 1];
      if (safeFiles.length && last?.role === 'user') last.parts.push(...safeFiles.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })));
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FAST_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: [
            'You are Kenzy, a fast and patient study assistant.',
            'Answer directly and concisely unless the student asks for detail.',
            'When files are attached, answer from the supplied material and say when it does not contain the answer.',
            'Make every answer easy for a student to read and understand.',
            'Do NOT use raw LaTeX or programming-style math notation.',
            'Use readable Unicode notation such as √, ², ³, ⁴, ×, ÷, ±, ≤, ≥, ≈ and subscripts such as log₁₀.',
            'For fractions, write (numerator / denominator). For square roots, write √(expression).',
            'For powers, use Unicode superscripts when practical, such as x² or 10³.',
            'For calculations, put steps on separate lines and label the final answer.',
          ].join(' ') }] },
          contents: clean,
          generationConfig: { maxOutputTokens: 600, thinkingConfig: { thinkingLevel: 'low' } },
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
      reply = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
      if (!reply) return res.status(502).json({ error: 'Kenzy received no answer from Gemini.' });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat exception:', error);
    return res.status(/25 MB|too large/i.test(error?.message || '') ? 413 : 500).json({ error: error?.message || 'Something went wrong while contacting Kenzy AI.' });
  } finally {
    if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try { const { del } = await import('@vercel/blob'); await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }))); } catch {}
    }
  }
}
