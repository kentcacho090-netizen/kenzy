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
const FAST_MODEL = 'llama-3.1-8b-instant';
const GEMINI_MODEL = 'gemini-3.7-flash';
const OPENROUTER_MODEL = 'openrouter/free';

function approxBytes(data) { return Math.floor((String(data || '').replace(/^data:[^,]+,/, '').length * 3) / 4); }

async function blobToBase64(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Could not read one of the uploaded files.');
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { data: buffer.toString('base64'), size: buffer.byteLength, contentType: result.blob?.contentType };
}

function buildPrompt(messages) {
  const history = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8);
  const prompt = history.filter((m) => m.role === 'user').at(-1)?.content || 'Please help me study the attached material.';
  const context = history.slice(0, -1).map((m) => `${m.role === 'assistant' ? 'Kenzy' : 'Student'}: ${m.content.slice(0, 2200)}`).join('\n');
  return context ? `Recent conversation:\n${context}\n\nStudent's latest request:\n${prompt}` : prompt;
}

const SYSTEM_PROMPT = [
  'You are Kenzy, a fast and patient study assistant.',
  'Answer directly and concisely unless the student asks for detail.',
  'When files are attached, answer from the supplied material and say when it does not contain the answer.',
  'Make every answer easy for a student to read and understand.',
  'Do not use raw LaTeX or programming-style math notation.',
  'Use readable Unicode notation such as √, ², ³, ⁴, ×, ÷, ±, ≤, ≥, ≈ and subscripts such as log₁₀.',
  'For fractions, write (numerator / denominator). For square roots, write √(expression).',
  'For powers, use Unicode superscripts when practical, such as x² or 10³.',
  'For calculations, put steps on separate lines and label the final answer.',
  'Never reveal private chain-of-thought or hidden reasoning.',
].join(' ');

async function callOpenAICompatible({ apiUrl, apiKey, model, messages, maxTokens = 600, extraHeaders = {} }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { detail = JSON.parse(text)?.error?.message || detail; } catch {}
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }
    const data = JSON.parse(text);
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Provider returned no answer.');
    return reply;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Provider timeout.');
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

async function generateFastText(apiKey, messages) {
  const history = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8);
  const prompt = buildPrompt(messages);
  const compact = history.length ? [...history.slice(0, -1), { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }];
  const system = { role: 'system', content: SYSTEM_PROMPT };

  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      return await callOpenAICompatible({
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY.trim(),
        model: FAST_MODEL,
        messages: [system, ...compact],
        maxTokens: 600,
      });
    } catch (error) {
      console.warn('Groq fallback:', error?.message || error);
    }
  }

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    try {
      return await callOpenAICompatible({
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY.trim(),
        model: OPENROUTER_MODEL,
        messages: [system, ...compact],
        maxTokens: 700,
        extraHeaders: { 'HTTP-Referer': 'https://studyken.vercel.app', 'X-Title': 'StudyKen' },
      });
    } catch (error) {
      console.warn('OpenRouter fallback:', error?.message || error);
    }
  }

  if (apiKey) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 2600) }] })),
        generationConfig: { maxOutputTokens: 600, thinkingConfig: { thinkingLevel: 'low' } },
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = 'Gemini could not answer right now.';
      try { message = JSON.parse(text)?.error?.message || message; } catch {}
      throw new Error(`Gemini API error (${response.status}): ${message}`);
    }
    const data = JSON.parse(text);
    const reply = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!reply) throw new Error('Kenzy received no answer from Gemini.');
    return reply;
  }

  throw new Error('No AI provider is configured.');
}

async function generateWithGeminiFiles(apiKey, messages, files) {
  if (!apiKey) throw new Error('Gemini is required for attached PDF, PowerPoint, and image analysis.');
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  try {
    for (const file of files) {
      const buffer = Buffer.from(String(file.data || '').split(',').pop(), 'base64');
      const item = await ai.files.upload({ file: new Blob([buffer], { type: file.mimeType }), config: { mimeType: file.mimeType, displayName: file.name || 'study-material' } });
      let status = item;
      for (let attempt = 0; attempt < 12 && status?.state === 'PROCESSING'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        status = await ai.files.get({ name: item.name });
      }
      if (!status?.uri || status?.state !== 'ACTIVE') throw new Error(`Gemini could not finish processing ${file.name || 'the study file'}.`);
      uploaded.push(status);
    }
    const contents = createUserContent([...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)), buildPrompt(messages)]);
    const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents, config: { maxOutputTokens: 750, thinkingConfig: { thinkingLevel: 'low' } });
    if (!response.text) throw new Error('Kenzy received no answer from Gemini.');
    return response.text;
  } finally {
    await Promise.allSettled(uploaded.filter((file) => file?.name).map((file) => ai.files.delete({ name: file.name })));
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const cleanup = [];
  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Large uploads are not configured. Connect the Vercel Blob store to this project.' });
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

    const cleanMessages = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8);
    if (!cleanMessages.some((m) => m.role === 'user')) return res.status(400).json({ error: 'Please enter a question.' });
    const safeFiles = files.filter((f) => f && ALLOWED.has(f.mimeType) && typeof f.data === 'string' && f.data.length > 0).slice(0, 8);
    const totalBytes = safeFiles.reduce((sum, f) => sum + approxBytes(f.data), 0);
    if (totalBytes > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'Attached AI files must stay at or below 25 MB combined.' });

    const needsFilesApi = safeFiles.some((file) => PPT_TYPES.has(file.mimeType)) || totalBytes > 3 * 1024 * 1024;
    const reply = needsFilesApi ? await generateWithGeminiFiles(apiKey, cleanMessages, safeFiles) : await generateFastText(apiKey, cleanMessages);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat exception:', error);
    return res.status(/25 MB|too large/i.test(error?.message || '') ? 413 : 502).json({ error: error?.message || 'Something went wrong while contacting Kenzy AI.' });
  } finally {
    if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try { const { del } = await import('@vercel/blob'); await Promise.allSettled(cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }))); } catch {}
    }
  }
}
