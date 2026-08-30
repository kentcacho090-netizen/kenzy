import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
function retryable(status) { return [429, 500, 502, 503, 504].includes(Number(status)); }
async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function decode(value) { const text = String(value || ''); const comma = text.indexOf(','); return Buffer.from(comma >= 0 ? text.slice(comma + 1) : text, 'base64'); }
function normalizeMime(file) { const name = String(file?.name || '').toLowerCase(); if (name.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint'; return file?.mimeType; }
async function readBlob(pathname) { const { get } = await import('@vercel/blob'); const result = await get(pathname, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN, useCache: false }); if (!result?.stream || result.statusCode !== 200) throw new Error('Could not read one of the uploaded files.'); return Buffer.from(await new Response(result.stream).arrayBuffer()); }

async function askGemini(apiKey, kind, body, files) {
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  try {
    for (const file of files) {
      const mimeType = normalizeMime(file);
      if (!ALLOWED.has(mimeType)) throw new Error(`Unsupported file type: ${file.name || 'uploaded file'}`);
      const uploadedFile = await ai.files.upload({ file: new Blob([decode(file.data)], { type: mimeType }), config: { mimeType, displayName: file.name || 'study-file' } });
      let current = uploadedFile;
      for (let i = 0; i < 20 && current?.state === 'PROCESSING'; i += 1) { await sleep(500); current = await ai.files.get({ name: current.name }); }
      if (!current?.uri || current.state !== 'ACTIVE') throw new Error(`Gemini could not process ${file.name || 'the uploaded file'}.`);
      uploaded.push(current);
    }
    const count = Math.min(Math.max(Number.parseInt(body.count, 10) || 10, 1), 100);
    const prompt = kind === 'quiz'
      ? `Create exactly ${count} high-quality multiple-choice questions from the supplied study files. Use only information supported by the supplied files. Each question must have exactly four answer choices. correctIndex must be 0, 1, 2, or 3. Avoid duplicates and unsupported facts. Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]}. Do not include markdown fences or any other text.`
      : kind === 'ai'
        ? `You are StudyKen, a fast and patient study assistant. Answer the student's latest request using the supplied files when relevant. Keep the explanation easy to understand. Avoid raw LaTeX and programming-style math; use √, ², ³, ×, ÷, ≤, ≥, ≈ and readable fractions. Student conversation:\n${(Array.isArray(body.messages) ? body.messages : []).slice(-8).map((m) => `${m.role}: ${String(m.content || '')}`).join('\n')}`
        : [`Task: ${String(body.action || 'Improve these notes for studying.').slice(0, 500)}`, body.title ? `Note title: ${String(body.title).slice(0, 200)}` : '', body.content ? `Current note:\n${String(body.content).slice(0, 30000)}` : '', 'Use the supplied files as the primary source when provided.', 'Create accurate, editable, student-friendly notes. Preserve important terminology and structure.', 'Use readable Unicode math such as √, ², ³, ×, ÷, ±, ≤, ≥ and log₁₀. Never use raw LaTeX.'].filter(Boolean).join('\n\n');
    const parts = [...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)), prompt];
    const config = kind === 'quiz' ? { responseMimeType: 'application/json', maxOutputTokens: Math.min(32768, Math.max(8192, count * 650)) } : { maxOutputTokens: kind === 'notes' ? 3500 : 800 };
    let lastError = null;
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await ai.models.generateContent({ model, contents: createUserContent(parts), config });
          if (response.text) return response.text;
          throw new Error('Gemini returned no result.');
        } catch (error) {
          lastError = error;
          const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
          if (!retryable(status) || attempt === 1) break;
          await sleep(1000 * (attempt + 1));
        }
      }
    }
    throw new Error(lastError?.message || 'All Gemini file-processing models were unavailable.');
  } finally { await Promise.allSettled(uploaded.filter((file) => file?.name).map((file) => ai.files.delete({ name: file.name }))); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });
  const cleanup = [];
  try {
    const body = req.body || {};
    const kind = ['quiz','ai','notes'].includes(body.kind) ? body.kind : 'ai';
    let files = Array.isArray(body.files) ? body.files.filter(Boolean).slice(0, 8) : [];
    const blobs = Array.isArray(body.blobFiles) ? body.blobFiles.filter(Boolean).slice(0, 8) : [];
    if (blobs.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large file uploads are not configured.' });
      files = []; let total = 0;
      for (const item of blobs) {
        const pathname = String(item.pathname || ''); const mimeType = normalizeMime(item);
        if (!/^(presentation-material|quiz-material|notes-material|kenzy-material)\//.test(pathname)) return res.status(400).json({ error: 'Invalid uploaded file reference.' });
        if (!ALLOWED.has(mimeType)) return res.status(400).json({ error: `Unsupported file type: ${item.name || 'uploaded file'}` });
        const buffer = await readBlob(pathname); total += buffer.byteLength;
        if (total > MAX_BYTES) return res.status(413).json({ error: 'Keep the combined upload size at or below 25 MB.' });
        files.push({ name: item.name || pathname.split('/').pop(), mimeType, data: buffer.toString('base64') }); cleanup.push(pathname);
      }
    }
    if (!files.length) return res.status(400).json({ error: 'No study file was supplied.' });
    let total = 0;
    for (const file of files) { const mimeType = normalizeMime(file); if (!ALLOWED.has(mimeType) || typeof file.data !== 'string' || !file.data) return res.status(400).json({ error: `Unsupported file type: ${file.name || 'uploaded file'}` }); total += Math.floor(file.data.length * 0.75); }
    if (total > MAX_BYTES) return res.status(413).json({ error: 'Keep the combined upload size at or below 25 MB.' });
    const result = await askGemini(apiKey, kind, body, files.map((file) => ({ ...file, mimeType: normalizeMime(file) })));
    if (kind === 'quiz') { let parsed; try { parsed = JSON.parse(result); } catch { return res.status(502).json({ error: 'Gemini returned invalid quiz JSON.' }); } return res.status(200).json({ questions: Array.isArray(parsed.questions) ? parsed.questions : [] }); }
    return res.status(200).json(kind === 'ai' ? { reply: result } : { result });
  } catch (error) { console.error('Presentation content error:', error); return res.status(502).json({ error: error?.message || 'Could not process the uploaded study material.' }); }
  finally { if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) { try { const { del } = await import('@vercel/blob'); await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }))); } catch {} } }
}
