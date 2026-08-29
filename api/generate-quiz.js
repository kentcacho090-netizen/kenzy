import { del, get } from '@vercel/blob';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

function validInlineFile(file) {
  return file && ALLOWED.has(file.mimeType) && typeof file.data === 'string' && file.data.length > 0;
}

function base64ToBuffer(data) {
  const comma = data.indexOf(',');
  const clean = comma >= 0 ? data.slice(comma + 1) : data;
  return Buffer.from(clean, 'base64');
}

async function readBlob(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { buffer, contentType: result.blob.contentType || undefined };
}

async function uploadToGemini(ai, file) {
  const buffer = base64ToBuffer(file.data);
  const uploaded = await ai.files.upload({
    file: new Blob([buffer], { type: file.mimeType }),
    config: { mimeType: file.mimeType, displayName: file.name || 'kenzy-study-material' },
  });

  let status = uploaded;
  for (let attempt = 0; attempt < 12 && status?.state === 'PROCESSING'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await ai.files.get({ name: uploaded.name });
  }

  if (status?.state === 'FAILED') throw new Error(`Gemini could not process ${file.name || 'the study file'}.`);
  if (!status?.uri || status?.state !== 'ACTIVE') throw new Error(`Gemini did not finish processing ${file.name || 'the study file'}.`);
  return status;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel, then redeploy.' });

  const cleanupBlobs = [];
  const cleanupGeminiFiles = [];
  try {
    const body = req.body || {};
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (!files.length && typeof body.pdf === 'string' && body.pdf) {
      files = [{ mimeType: 'application/pdf', data: body.pdf, name: 'study-material.pdf' }];
    }

    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({ error: 'Large uploads are not configured. Connect a Vercel Blob store to this project first.' });
      }
      let totalBytes = 0;
      const resolved = [];
      for (const blobFile of blobFiles.slice(0, 4)) {
        const pathname = typeof blobFile?.pathname === 'string' ? blobFile.pathname : '';
        const mimeType = blobFile?.mimeType;
        if (!pathname || !pathname.startsWith('kenzy-material/') || !ALLOWED.has(mimeType)) {
          return res.status(400).json({ error: 'One of the large uploaded files is invalid.' });
        }
        const stored = await readBlob(pathname);
        if (!stored) return res.status(404).json({ error: 'One of the uploaded study files could not be retrieved.' });
        totalBytes += stored.buffer.byteLength;
        if (totalBytes > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });
        resolved.push({ mimeType, name: blobFile.name, data: stored.buffer.toString('base64') });
        cleanupBlobs.push(pathname);
      }
      files = resolved;
    }

    if (!files.length) return res.status(400).json({ error: 'No PDF or image was supplied.' });
    if (files.some((file) => !validInlineFile(file))) return res.status(400).json({ error: 'Unsupported file type. Use PDF, PNG, JPG, or WebP.' });

    const totalBytes = files.reduce((sum, file) => sum + Math.floor((file.data.length * 3) / 4), 0);
    if (totalBytes > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });

    const count = Math.min(Math.max(Number.parseInt(body.count, 10) || 10, 1), 100);
    const prompt = [
      `Create exactly ${count} high-quality multiple-choice questions from the attached study material.`,
      'Use only information supported by the supplied material.',
      'Avoid duplicates, trick wording, and unsupported facts.',
      'Each question must have exactly four plausible answer choices.',
      'correctIndex must be zero-based: 0, 1, 2, or 3.',
      'Return ONLY valid JSON in exactly this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]}.',
      'Do not use markdown fences or any text outside the JSON.',
    ].join(' ');

    const ai = new GoogleGenAI({ apiKey });
    const uploadedFiles = [];
    for (const file of files) {
      const uploaded = await uploadToGemini(ai, file);
      uploadedFiles.push(uploaded);
      cleanupGeminiFiles.push(uploaded.name);
    }

    const contents = createUserContent([
      ...uploadedFiles.map((file) => createPartFromUri(file.uri, file.mimeType)),
      prompt,
    ]);

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: Math.min(32000, Math.max(8000, count * 650)),
        thinkingConfig: { thinkingLevel: 'low' },
      },
    });

    const text = response.text;
    if (!text) return res.status(502).json({ error: 'Gemini returned no quiz data.' });
    let result;
    try { result = JSON.parse(text); } catch { return res.status(502).json({ error: 'Gemini returned invalid quiz JSON. Please try again.' }); }

    const questions = Array.isArray(result.questions)
      ? result.questions.filter((q) => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options) && q.options.length === 4 && q.options.every((option) => typeof option === 'string' && option.trim()) && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4))
      : [];

    if (!questions.length) return res.status(502).json({ error: 'Gemini did not return a valid quiz. Please try again.' });
    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Quiz generation error:', error);
    const status = /25 MB|too large/i.test(error?.message || '') ? 413 : 500;
    return res.status(status).json({ error: error?.message || 'Something went wrong while generating the quiz.' });
  } finally {
    if (cleanupGeminiFiles.length) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY?.trim() });
        await Promise.allSettled(cleanupGeminiFiles.map((name) => ai.files.delete({ name })));
      } catch {}
    }
    if (cleanupBlobs.length && process.env.BLOB_READ_WRITE_TOKEN) {
      await Promise.allSettled(cleanupBlobs.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })));
    }
  }
}
