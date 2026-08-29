import { del, get } from '@vercel/blob';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const INLINE_MAX_CHARS = 4200000;
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

function validInlineFile(file) {
  return file && ALLOWED.includes(file.mimeType) && typeof file.data === 'string' && file.data.length > 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel, then redeploy.' });

  const cleanup = [];
  try {
    const body = req.body || {};
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (!files.length && typeof body.pdf === 'string' && body.pdf) {
      files = [{ mimeType: 'application/pdf', data: body.pdf }];
    }

    if (!files.length && blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({ error: 'Large uploads are not configured. Connect a Vercel Blob store to this project first.' });
      }

      let totalBytes = 0;
      for (const blobFile of blobFiles) {
        const pathname = typeof blobFile?.pathname === 'string' ? blobFile.pathname : '';
        const mimeType = blobFile?.mimeType;
        if (!pathname || !pathname.startsWith('quiz-material/') || !ALLOWED.includes(mimeType)) {
          return res.status(400).json({ error: 'One of the uploaded files is invalid.' });
        }

        const result = await get(pathname, { access: 'private' });
        if (!result || result.statusCode !== 200 || !result.stream) {
          return res.status(404).json({ error: 'One of the uploaded study files could not be retrieved.' });
        }

        const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
        totalBytes += buffer.byteLength;
        if (totalBytes > MAX_UPLOAD_BYTES) {
          return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });
        }

        files.push({ mimeType, data: buffer.toString('base64') });
        cleanup.push(pathname);
      }
    }

    if (!files.length) return res.status(400).json({ error: 'No PDF or image was supplied.' });
    if (files.some((file) => !validInlineFile(file))) {
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, PNG, JPG, or WebP.' });
    }

    const totalChars = files.reduce((n, file) => n + file.data.length, 0);
    if (cleanup.length === 0 && totalChars > INLINE_MAX_CHARS) {
      return res.status(413).json({ error: 'The upload is too large. Please keep it under about 3 MB unless large uploads are enabled.' });
    }

    const approximateBytes = Math.floor(totalChars * 0.75);
    if (approximateBytes > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });
    }

    const count = Math.min(Math.max(Number.parseInt(body.count, 10) || 10, 1), 100);
    const prompt = [
      `Create exactly ${count} high-quality multiple-choice questions from the attached study material.`,
      `The material may be a PDF or image. Use only information supported by the supplied material.`,
      `Avoid duplicate questions, trick wording, and unsupported facts.`,
      `Each question must have exactly four plausible answer choices.`,
      `correctIndex must be zero-based: 0, 1, 2, or 3.`,
      `Return ONLY valid JSON in exactly this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]}.`,
      `Do not use markdown fences or any text outside the JSON.`,
    ].join(' ');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [...files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } })), { text: prompt }],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let message = 'Gemini could not generate the quiz.';
      try { message = JSON.parse(responseText)?.error?.message || message; } catch {}
      console.error('Gemini API error:', response.status, responseText);
      return res.status(502).json({ error: `Gemini API error (${response.status}): ${message}` });
    }

    let payload;
    try { payload = JSON.parse(responseText); } catch {
      return res.status(502).json({ error: 'Gemini returned an unreadable response.' });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!text) {
      const reason = payload?.candidates?.[0]?.finishReason;
      return res.status(502).json({ error: reason ? `Gemini returned no quiz data (finish reason: ${reason}).` : 'Gemini returned no quiz data.' });
    }

    let result;
    try { result = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'Gemini returned invalid quiz JSON. Please try again.' });
    }

    const questions = Array.isArray(result.questions)
      ? result.questions.filter((q) => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options) && q.options.length === 4 && q.options.every((option) => typeof option === 'string' && option.trim()) && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4))
      : [];

    if (!questions.length) return res.status(502).json({ error: 'Gemini did not return a valid quiz. Please try again.' });
    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({ error: error?.message || 'Something went wrong while generating the quiz.' });
  } finally {
    if (cleanup.length) {
      await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })));
    }
  }
}
