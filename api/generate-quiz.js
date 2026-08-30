const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const PPT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash'];

function validFile(file) { return file && ALLOWED.has(file.mimeType) && typeof file.data === 'string' && file.data.length > 0; }
function base64Bytes(data) { const comma = data.indexOf(','); const clean = comma >= 0 ? data.slice(comma + 1) : data; return Math.floor(clean.length * 0.75); }
function isRetryableGeminiStatus(status) { return [429, 500, 502, 503, 504].includes(Number(status)); }
function getGeminiStatus(error) { return Number(error?.status || error?.statusCode || error?.response?.status || 0); }
async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function shuffle(array) {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function randomizeQuestion(question) {
  const options = question.options.map((text, index) => ({ text, index }));
  const shuffledOptions = shuffle(options);
  return {
    ...question,
    options: shuffledOptions.map((option) => option.text),
    correctIndex: shuffledOptions.findIndex((option) => option.index === question.correctIndex),
  };
}

async function readPrivateBlob(pathname) {
  const { get } = await import('@vercel/blob');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { name: pathname.split('/').pop() || 'study-material', contentType: result.blob?.contentType || undefined, buffer };
}

async function deletePrivateBlob(pathname) {
  try { const { del } = await import('@vercel/blob'); if (typeof del === 'function') await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }); }
  catch (error) { console.error('Blob cleanup error:', error); }
}

async function generateWithGeminiFiles(apiKey, prompt, files) {
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  let lastError = null;
  try {
    for (const file of files) {
      const clean = String(file.data || '').split(',').pop();
      const buffer = Buffer.from(clean, 'base64');
      const item = await ai.files.upload({ file: new Blob([buffer], { type: file.mimeType }), config: { mimeType: file.mimeType, displayName: file.name || 'kenzy-study-material' } });
      let status = item;
      for (let attempt = 0; attempt < 12 && status?.state === 'PROCESSING'; attempt += 1) { await sleep(500); status = await ai.files.get({ name: item.name }); }
      if (!status?.uri || status?.state !== 'ACTIVE') throw new Error(`Gemini could not finish processing ${file.name || 'the presentation'}.`);
      uploaded.push(status);
    }
    const contents = createUserContent([...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)), prompt]);
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await ai.models.generateContent({ model, contents, config: { responseMimeType: 'application/json', maxOutputTokens: 32768 } });
          if (!response.text) throw new Error(`Gemini returned no quiz data from ${model}.`);
          return response.text;
        } catch (error) {
          lastError = error;
          const status = getGeminiStatus(error);
          if (!isRetryableGeminiStatus(status) || attempt === 1) break;
          await sleep(1000 * (attempt + 1));
        }
      }
    }
    throw new Error(lastError?.message || 'All Gemini quiz-generation models were unavailable.');
  } finally { await Promise.allSettled(uploaded.filter((file) => file?.name).map((file) => ai.files.delete({ name: file.name }))); }
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
    if (!files.length && typeof body.pdf === 'string' && body.pdf) files = [{ mimeType: 'application/pdf', data: body.pdf, name: 'study-material.pdf' }];

    if (!files.length && blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large uploads are not configured. Connect the Vercel Blob store to this project and redeploy.' });
      let totalBytes = 0;
      const resolvedFiles = [];
      for (const blobFile of blobFiles.slice(0, 8)) {
        const pathname = typeof blobFile?.pathname === 'string' ? blobFile.pathname : '';
        const mimeType = blobFile?.mimeType;
        if (!pathname || !pathname.startsWith('kenzy-material/') || !ALLOWED.has(mimeType)) return res.status(400).json({ error: 'One of the uploaded study files is invalid.' });
        const stored = await readPrivateBlob(pathname);
        if (!stored) return res.status(404).json({ error: 'One of the uploaded study files could not be retrieved.' });
        totalBytes += stored.buffer.byteLength;
        if (totalBytes > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });
        resolvedFiles.push({ name: blobFile.name || stored.name, mimeType, data: stored.buffer.toString('base64') });
        cleanupBlobs.push(pathname);
      }
      files = resolvedFiles;
    }

    if (!files.length) return res.status(400).json({ error: 'No study material was supplied.' });
    if (files.some((file) => !validFile(file))) return res.status(400).json({ error: 'Unsupported file type. Use PDF, PPT, PPTX, PNG, JPG, or WebP.' });
    const totalBytes = files.reduce((sum, file) => sum + base64Bytes(file.data), 0);
    if (totalBytes > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'The combined upload is too large. Please keep it at or below 25 MB.' });

    const count = Math.min(Math.max(Number.parseInt(body.count, 10) || 10, 1), 100);
    const suggestion = typeof body.suggestion === 'string' ? body.suggestion.trim().slice(0, 1000) : '';
    const prompt = [
      `Create exactly ${count} high-quality multiple-choice questions from the attached study material.`,
      'Use only information supported by the supplied material.',
      'Avoid duplicate questions, trick wording, and unsupported facts.',
      'Each question must have exactly four plausible answer choices.',
      'correctIndex must be zero-based: 0, 1, 2, or 3.',
      'Use clear, student-friendly wording while preserving important terminology from the material.',
      suggestion ? `Follow this optional student request when it is compatible with the material: ${suggestion}` : '',
      'Return ONLY valid JSON in exactly this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]}.',
      'Do not use markdown fences or any text outside the JSON.',
    ].filter(Boolean).join(' ');

    const needsFileApi = files.some((file) => PPT_TYPES.has(file.mimeType)) || totalBytes > 3 * 1024 * 1024;
    let text;
    if (needsFileApi) {
      text = await generateWithGeminiFiles(apiKey, prompt, files);
    } else {
      const contentsParts = [...files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } })), { text: prompt }];
      let lastStatus = 502;
      let lastMessage = 'Gemini could not generate the quiz.';
      let generatedText = null;
      outer: for (const model of GEMINI_MODELS) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({ contents: [{ role: 'user', parts: contentsParts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: Math.min(32768, Math.max(8192, count * 650)) } }),
          });
          const responseText = await response.text();
          if (response.ok) {
            let payload;
            try { payload = JSON.parse(responseText); } catch { return res.status(502).json({ error: 'Gemini returned an unreadable response.' }); }
            generatedText = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
            if (!generatedText) { const reason = payload?.candidates?.[0]?.finishReason; lastStatus = 502; lastMessage = reason ? `Gemini returned no quiz data (finish reason: ${reason}).` : 'Gemini returned no quiz data.'; break; }
            break outer;
          }
          lastStatus = response.status;
          try { lastMessage = JSON.parse(responseText)?.error?.message || lastMessage; } catch {}
          console.error(`Gemini API error (${model}):`, response.status, responseText);
          if (!isRetryableGeminiStatus(response.status) || attempt === 1) break;
          await sleep(1000 * (attempt + 1));
        }
      }
      if (!generatedText) return res.status(502).json({ error: `Gemini API error (${lastStatus}): ${lastMessage}` });
      text = generatedText;
    }

    let result;
    try { result = JSON.parse(text); } catch { return res.status(502).json({ error: 'Gemini returned invalid quiz JSON. Please try again.' }); }
    const questions = Array.isArray(result.questions)
      ? result.questions.filter((q) => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options) && q.options.length === 4 && q.options.every((option) => typeof option === 'string' && option.trim()) && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4)
      : [];
    if (!questions.length) return res.status(502).json({ error: 'Gemini did not return a valid quiz. Please try again.' });

    // Randomize question order and answer-choice order on the server.
    // The correct index is remapped so scoring and answer review remain accurate.
    const randomizedQuestions = shuffle(questions).map(randomizeQuestion);
    return res.status(200).json({ questions: randomizedQuestions });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return res.status(/too large|25 MB/i.test(error?.message || '') ? 413 : 500).json({ error: error?.message || 'Something went wrong while generating the quiz.' });
  } finally { if (cleanupBlobs.length) await Promise.allSettled(cleanupBlobs.map((pathname) => deletePrivateBlob(pathname))); }
}
