const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const PPT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);

// Prefer lightweight models for Notes AI, then fall back to broader models.
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

function retryable(status) { return [429, 500, 502, 503, 504].includes(Number(status)); }
async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isTemporaryCapacityError(status) { return [429, 503].includes(Number(status)); }

async function readPrivateBlob(pathname) {
  const { get } = await import('@vercel/blob');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('The imported file could not be read.');
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}
function decodeBase64(value) {
  const text = String(value || '');
  const comma = text.indexOf(',');
  return Buffer.from(comma >= 0 ? text.slice(comma + 1) : text, 'base64');
}

const SYSTEM = [
  'You are Kenzy, a helpful study-notes assistant.',
  'Use only information present in the supplied note text or uploaded files.',
  'Do not invent facts, citations, examples, or definitions not supported by the source.',
  'Make results easy for a student to understand, memorize, and print.',
  'First identify what the material actually contains: topics, key terms, definitions, concepts, formulas, procedures, examples, comparisons, timelines, people, places, and important facts.',
  'When the source introduces a word or technical term, write it as: Term — clear definition. Example: Communication — The process of exchanging information to convey thoughts, ideas, and feelings.',
  'For concepts, explain what they are and why they matter before listing details.',
  'For procedures, write the steps in the correct order.',
  'For timelines, keep each date paired with the event and person involved.',
  'Group related information under meaningful topic headings.',
  'Avoid repeating the same fact in multiple sections.',
  'Use concise student-friendly wording while preserving important source terminology.',
  'Do not use decorative Markdown such as *** or repeated asterisks for emphasis.',
  'Use simple Markdown headings with # or ## only when a heading helps structure the notes.',
  'Use a single hyphen for bullet points only when a list is genuinely useful.',
  'For definitions and key terms, prefer the clean "Term — definition" format instead of bold markers.',
  'Use readable Unicode math such as √, ², ³, ×, ÷, ±, ≤, ≥ and log₁₀.',
  'Never output raw LaTeX or programming-style math such as ^3, sqrt(x), \\frac, $, or escaped math delimiters.',
  'Keep the final notes clean enough to print without visible Markdown punctuation.',
].join(' ');

function outputLimit(action, hasFiles) {
  const text = String(action || '').toLowerCase();
  if (hasFiles || text.includes('import')) return 3200;
  if (text.includes('summar')) return 1600;
  if (text.includes('simplif')) return 2000;
  return 2400;
}

async function callGemini(apiKey, prompt, files, action) {
  const parts = files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } }));
  parts.push({ text: prompt });
  let lastStatus = 502;
  let lastMessage = 'Gemini could not process the note.';

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { maxOutputTokens: outputLimit(action, files.length > 0), thinkingConfig: { thinkingLevel: 'low' } },
          }),
        });
        const text = await response.text();
        if (response.ok) {
          const data = JSON.parse(text);
          const result = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
          if (result) return result;
          lastMessage = 'Kenzy received no result from Gemini.';
          break;
        }
        lastStatus = response.status;
        try { lastMessage = JSON.parse(text)?.error?.message || lastMessage; } catch {}
        if (!retryable(response.status) || attempt === 1) break;
        await sleep(isTemporaryCapacityError(response.status) ? 1200 * (attempt + 1) : 800 * (attempt + 1));
      } catch (error) {
        if (error?.name === 'AbortError') { lastStatus = 504; lastMessage = 'Kenzy took too long to process this request.'; }
        else { lastStatus = Number(error?.status || 502); lastMessage = error?.message || lastMessage; }
        if (!retryable(lastStatus) || attempt === 1) break;
        await sleep(1200 * (attempt + 1));
      } finally { clearTimeout(timeout); }
    }
  }
  throw new Error(`Gemini API error (${lastStatus}): ${lastMessage}`);
}

async function callGeminiFilesApi(apiKey, prompt, files, action) {
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  let lastError = null;
  try {
    for (const file of files) {
      const item = await ai.files.upload({ file: new Blob([decodeBase64(file.data)], { type: file.mimeType }), config: { mimeType: file.mimeType, displayName: file.name || 'kenzy-note-source' } });
      let status = item;
      for (let attempt = 0; attempt < 10 && status?.state === 'PROCESSING'; attempt += 1) { await sleep(350); status = await ai.files.get({ name: item.name }); }
      if (!status?.uri || status?.state !== 'ACTIVE') throw new Error(`Gemini could not finish processing ${file.name || 'the file'}.`);
      uploaded.push(status);
    }
    const contents = createUserContent([...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)), prompt]);
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await ai.models.generateContent({ model, contents, config: { maxOutputTokens: outputLimit(action, true), thinkingConfig: { thinkingLevel: 'low' } } });
          if (response.text) return response.text;
          throw new Error('Kenzy received no result from Gemini.');
        } catch (error) {
          lastError = error;
          const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
          if (!retryable(status) || attempt === 1) break;
          await sleep(isTemporaryCapacityError(status) ? 1200 * (attempt + 1) : 800 * (attempt + 1));
        }
      }
    }
    throw new Error(lastError?.message || 'All Gemini note models were unavailable.');
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
    const action = typeof body.action === 'string' ? body.action.slice(0, 500) : 'Improve these notes for studying.';
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : '';
    const content = typeof body.content === 'string' ? body.content.slice(0, 30000) : '';
    let files = Array.isArray(body.files) ? body.files.filter(Boolean).slice(0, 8) : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles.filter(Boolean).slice(0, 8) : [];
    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large note imports need a connected Vercel Blob store.' });
      files = [];
      let total = 0;
      for (const item of blobFiles) {
        const pathname = typeof item.pathname === 'string' ? item.pathname : '';
        const mimeType = item.mimeType;
        if (!pathname.startsWith('notes-material/') || !ALLOWED.has(mimeType)) return res.status(400).json({ error: 'Invalid note file.' });
        const buffer = await readPrivateBlob(pathname); total += buffer.byteLength;
        if (total > MAX_BYTES) return res.status(413).json({ error: 'Keep imported note files at or below 25 MB combined.' });
        files.push({ name: item.name || 'study-file', mimeType, data: buffer.toString('base64') });
        cleanup.push(pathname);
      }
    }
    if (files.some((file) => !ALLOWED.has(file.mimeType) || typeof file.data !== 'string' || !file.data)) return res.status(400).json({ error: 'Use PDF, PPT, PPTX, JPG, PNG, or WebP files only.' });
    const totalBytes = files.reduce((sum, file) => sum + Math.floor(file.data.length * 0.75), 0);
    if (totalBytes > MAX_BYTES) return res.status(413).json({ error: 'Keep note files at or below 25 MB combined.' });
    if (!content.trim() && !files.length) return res.status(400).json({ error: 'Write some notes or import a PDF, PowerPoint, or image first.' });
    const prompt = [
      `Task: ${action}`,
      title ? `Note title: ${title}` : '',
      content.trim() ? `Current note:\n${content}` : '',
      files.length ? 'The uploaded file is the primary source. Read it carefully. Identify the actual topics, terms, definitions, concepts, formulas, examples, procedures, comparisons, people, dates, and important facts instead of treating every sentence as equally important.' : '',
      files.length ? 'When a source introduces a word or technical term, format it as "Term — clear definition". When it contains a timeline, keep each date paired with its event. Group related material under meaningful headings.' : '',
      'Produce polished study notes that are accurate, concise, easy to memorize, and suitable for printing.',
      'Do not use decorative asterisks or repeated Markdown emphasis. Prefer plain headings and the "Term — definition" format. Use # or ## headings sparingly; the app will format them for display and printing.',
    ].filter(Boolean).join('\n\n');
    const result = files.some((file) => PPT_TYPES.has(file.mimeType)) || totalBytes > 3 * 1024 * 1024
      ? await callGeminiFilesApi(apiKey, prompt, files, action)
      : await callGemini(apiKey, prompt, files, action);
    return res.status(200).json({ result });
  } catch (error) {
    console.error('Study notes exception:', error);
    const message = error?.message || 'Something went wrong while processing your notes.';
    return res.status(/too large|25 MB/i.test(message) ? 413 : 502).json({ error: message });
  } finally {
    if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try { const { del } = await import('@vercel/blob'); await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }))); } catch {}
    }
  }
}
