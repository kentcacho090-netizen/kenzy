const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const INLINE_LIMIT_BYTES = 3 * 1024 * 1024;

function validFile(file) {
  return file && ALLOWED.has(file.mimeType) && typeof file.data === 'string' && file.data.length > 0;
}

function base64Bytes(data) {
  const comma = data.indexOf(',');
  const clean = comma >= 0 ? data.slice(comma + 1) : data;
  return Math.floor(clean.length * 0.75);
}

async function readPrivateBlob(pathname) {
  const { get } = await import('@vercel/blob');
  const result = await get(pathname, {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return {
    name: pathname.split('/').pop() || 'study-material',
    contentType: result.blob?.contentType || undefined,
    buffer,
  };
}

async function deletePrivateBlob(pathname) {
  try {
    const { del } = await import('@vercel/blob');
    if (typeof del === 'function') {
      await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
  } catch (error) {
    console.error('Blob cleanup error:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel.' });

  const cleanupBlobs = [];

  try {
    const body = req.body || {};
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (!files.length && typeof body.pdf === 'string' && body.pdf) {
      files = [{ mimeType: 'application/pdf', data: body.pdf, name: 'study-material.pdf' }];
    }

    // Large uploads arrive as private Vercel Blob references. The Blob SDK is
    // loaded only for this path so ordinary quiz generation cannot fail at
    // function startup because of a Blob module import.
    if (!files.length && blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({ error: 'Large uploads are not configured. Connect the Vercel Blob store to this project and redeploy.' });
      }

      let totalBytes = 0;
      const resolvedFiles = [];

      for (const blobFile of blobFiles.slice(0, 4)) {
        const pathname = typeof blobFile?.pathname === 'string' ? blobFile.pathname : '';
        const mimeType = blobFile?.mimeType;
        if (!pathname || !pathname.startsWith('quiz-material/') || !ALLOWED.has(mimeType)) {
          return res.status(400).json({ error: 'One of the large uploaded files is invalid.' });
        }

        const stored = await readPrivateBlob(pathname);
        if (!stored) return res.status(404).json({ error: 'One of the uploaded study files could not be retrieved.' });

        totalBytes += stored.buffer.byteLength;
        if (totalBytes > MAX_UPLOAD_BYTES) {
          return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });
        }

        resolvedFiles.push({
          name: blobFile.name || stored.name,
          mimeType,
          data: stored.buffer.toString('base64'),
        });
        cleanupBlobs.push(pathname);
      }

      files = resolvedFiles;
    }

    if (!files.length) return res.status(400).json({ error: 'No PDF or image was supplied.' });
    if (files.some((file) => !validFile(file))) {
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, PNG, JPG, or WebP.' });
    }

    const totalBytes = files.reduce((sum, file) => sum + base64Bytes(file.data), 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });
    }

    const count = Math.min(Math.max(Number.parseInt(body.count, 10) || 10, 1), 100);
    const prompt = [
      `Create exactly ${count} high-quality multiple-choice questions from the attached study material.`,
      'Use only information supported by the supplied material.',
      'Avoid duplicate questions, trick wording, and unsupported facts.',
      'Each question must have exactly four plausible answer choices.',
      'correctIndex must be zero-based: 0, 1, 2, or 3.',
      'Use clear, student-friendly wording while preserving important terminology from the material.',
      'Return ONLY valid JSON in exactly this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]}.',
      'Do not use markdown fences or any text outside the JSON.',
    ].join(' ');

    // Files under 3 MB can be sent inline. Large files have already been
    // uploaded through Blob and are read back here, so the browser never sends
    // a 25 MB request body to this serverless function.
    const contentsParts = [
      ...files.map((file) => ({
        inlineData: { mimeType: file.mimeType, data: file.data },
      })),
      { text: prompt },
    ];

    // Keep a clear error for files that would exceed the practical inline
    // request budget after Blob retrieval. The 25 MB upload limit remains the
    // product limit; this message is only a fallback if Gemini rejects the
    // resulting model request.
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: contentsParts }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: Math.min(32768, Math.max(8192, count * 650)),
          temperature: 0.25,
        },
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
    try {
      payload = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ error: 'Gemini returned an unreadable response.' });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!text) {
      const reason = payload?.candidates?.[0]?.finishReason;
      return res.status(502).json({ error: reason ? `Gemini returned no quiz data (finish reason: ${reason}).` : 'Gemini returned no quiz data.' });
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Gemini returned invalid quiz JSON. Please try again.' });
    }

    const questions = Array.isArray(result.questions)
      ? result.questions.filter((q) => (
          q &&
          typeof q.question === 'string' && q.question.trim() &&
          Array.isArray(q.options) && q.options.length === 4 &&
          q.options.every((option) => typeof option === 'string' && option.trim()) &&
          Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4
        ))
      : [];

    if (!questions.length) return res.status(502).json({ error: 'Gemini did not return a valid quiz. Please try again.' });

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({ error: error?.message || 'Something went wrong while generating the quiz.' });
  } finally {
    if (cleanupBlobs.length) {
      await Promise.allSettled(cleanupBlobs.map((pathname) => deletePrivateBlob(pathname)));
    }
  }
}
