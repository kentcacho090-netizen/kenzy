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

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

function approxBytes(data) {
  return Math.floor((String(data || '').replace(/^data:[^,]+,/, '').length * 3) / 4);
}

function retryable(status) {
  return [429, 500, 502, 503, 504].includes(Number(status));
}

function statusOf(error) {
  return Number(error?.status || error?.statusCode || error?.response?.status || 0);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(messages) {
  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8);
  const prompt = history.filter((m) => m.role === 'user').at(-1)?.content || 'Please help me study the attached material.';
  const context = history
    .slice(0, -1)
    .map((m) => `${m.role === 'assistant' ? 'Kenzy' : 'Student'}: ${m.content.slice(0, 2200)}`)
    .join('\n');
  return context ? `Recent conversation:\n${context}\n\nStudent's latest request:\n${prompt}` : prompt;
}

const SYSTEM_PROMPT = [
  'You are Kenzy, a fast and patient study assistant.',
  'Answer the student directly and completely. Do not stop in the middle of a sentence, explanation, example, or list.',
  'Use clean, well-spaced paragraphs. Leave a blank line between distinct ideas or sections.',
  'For a broad topic request, briefly define the topic first, then explain the key ideas in a logical order, then give a simple example when helpful.',
  'Prefer short paragraphs of 2–5 sentences instead of one large block of text.',
  'Use headings and bullet points only when they genuinely improve readability; do not over-format simple answers.',
  'Do not use raw Markdown emphasis markers such as **, ***, or excessive # headings. Use plain text headings or simple bullets.',
  'When a technical term is introduced, explain what it means in simple language before using it heavily.',
  'When files are attached, answer from the supplied material and say when it does not contain the answer.',
  'Make every answer easy for a student to read, review, and print.',
  'Do not use raw LaTeX or programming-style math notation.',
  'Use readable Unicode notation such as √, ², ³, ⁴, ×, ÷, ±, ≤, ≥, ≈ and subscripts such as log₁₀.',
  'For fractions, write (numerator / denominator). For square roots, write √(expression).',
  'For powers, use Unicode superscripts when practical, such as x² or 10³.',
  'For calculations, put steps on separate lines and label the final answer.',
  'Never reveal private chain-of-thought or hidden reasoning.',
].join(' ');

async function generateText(apiKey, messages) {
  if (!apiKey) throw new Error('Gemini API key is not configured.');
  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8);
  let lastMessage = 'Gemini could not answer right now.';
  let lastStatus = 502;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: history.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content.slice(0, 5000) }],
            })),
            generationConfig: {
              maxOutputTokens: 1600,
              temperature: 0.45,
            },
          }),
        });

        const text = await response.text();
        if (response.ok) {
          const data = JSON.parse(text);
          const reply = data?.candidates?.[0]?.content?.parts
            ?.find((part) => typeof part.text === 'string')?.text?.trim();
          if (reply) return reply;
          lastMessage = 'Kenzy received no answer from Gemini.';
          break;
        }

        lastStatus = response.status;
        try {
          lastMessage = JSON.parse(text)?.error?.message || lastMessage;
        } catch {
          // Keep the previous readable error message.
        }

        if (!retryable(response.status) || attempt === 1) break;
        await sleep(1000 * (attempt + 1));
      } catch (error) {
        lastStatus = statusOf(error) || 502;
        lastMessage = error?.name === 'AbortError'
          ? 'Kenzy took too long to answer.'
          : (error?.message || lastMessage);
        if (!retryable(lastStatus) || attempt === 1) break;
        await sleep(1000 * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw new Error(`Gemini API error (${lastStatus}): ${lastMessage}`);
}

async function generateWithGeminiFiles(apiKey, messages, files) {
  if (!apiKey) throw new Error('Gemini API key is not configured.');
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = [];
  let lastError = null;

  try {
    for (const file of files) {
      const buffer = Buffer.from(String(file.data || '').split(',').pop(), 'base64');
      const item = await ai.files.upload({
        file: new Blob([buffer], { type: file.mimeType }),
        config: { mimeType: file.mimeType, displayName: file.name || 'study-material' },
      });

      let status = item;
      for (let attempt = 0; attempt < 30 && status?.state === 'PROCESSING'; attempt += 1) {
        await sleep(500);
        status = await ai.files.get({ name: item.name });
      }

      if (!status?.uri || status?.state !== 'ACTIVE') {
        throw new Error(`Gemini could not finish processing ${file.name || 'the study file'}.`);
      }
      uploaded.push(status);
    }

    const contents = createUserContent([
      ...uploaded.map((file) => createPartFromUri(file.uri, file.mimeType)),
      buildPrompt(messages),
    ]);

    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              maxOutputTokens: 1800,
              temperature: 0.45,
            },
          });
          const reply = response?.text?.trim();
          if (reply) return reply;
          throw new Error('Kenzy received no answer from Gemini.');
        } catch (error) {
          lastError = error;
          const status = statusOf(error);
          if (!retryable(status) || attempt === 1) break;
          await sleep(1000 * (attempt + 1));
        }
      }
    }

    throw new Error(lastError?.message || 'All Gemini chat models were unavailable.');
  } finally {
    await Promise.allSettled(
      uploaded
        .filter((file) => file?.name)
        .map((file) => ai.files.delete({ name: file.name }))
    );
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const cleanup = [];

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    let files = Array.isArray(body.files) ? body.files : [];
    const blobFiles = Array.isArray(body.blobFiles) ? body.blobFiles : [];

    if (blobFiles.length) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({ error: 'Large uploads are not configured. Connect the Vercel Blob store to this project.' });
      }

      const resolved = [];
      let total = 0;

      for (const blobFile of blobFiles.slice(0, 8)) {
        const pathname = typeof blobFile?.pathname === 'string' ? blobFile.pathname : '';
        if (!pathname || !pathname.startsWith('kenzy-material/')) {
          return res.status(400).json({ error: 'One of the large uploaded files is invalid.' });
        }
        if (!ALLOWED.has(blobFile.mimeType)) {
          return res.status(400).json({ error: 'One of the large uploaded files has an unsupported type.' });
        }

        const result = await get(pathname, { access: 'private', useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) {
          throw new Error('Could not read one of the uploaded files.');
        }

        const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
        total += buffer.byteLength;
        if (total > MAX_UPLOAD_BYTES) {
          return res.status(413).json({ error: 'Attached AI files must stay at or below 25 MB combined.' });
        }

        resolved.push({
          name: blobFile.name,
          mimeType: blobFile.mimeType,
          data: buffer.toString('base64'),
        });
        cleanup.push(pathname);
      }

      files = [...files, ...resolved];
    }

    const cleanMessages = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-8);

    if (!cleanMessages.some((m) => m.role === 'user')) {
      return res.status(400).json({ error: 'Please enter a question.' });
    }

    const safeFiles = files
      .filter((f) => f && ALLOWED.has(f.mimeType) && typeof f.data === 'string' && f.data.length > 0)
      .slice(0, 8);
    const totalBytes = safeFiles.reduce((sum, f) => sum + approxBytes(f.data), 0);

    if (totalBytes > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'Attached AI files must stay at or below 25 MB combined.' });
    }

    const needsFilesApi = safeFiles.some((file) => PPT_TYPES.has(file.mimeType)) || totalBytes > 3 * 1024 * 1024;
    const reply = needsFilesApi
      ? await generateWithGeminiFiles(apiKey, cleanMessages, safeFiles)
      : await generateText(apiKey, cleanMessages);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat exception:', error);
    const message = error?.message || 'Something went wrong while contacting Kenzy AI.';
    return res.status(/25 MB|too large/i.test(message) ? 413 : 502).json({ error: message });
  } finally {
    if (cleanup.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { del } = await import('@vercel/blob');
        await Promise.allSettled(
          cleanup.map((pathname) => del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }))
        );
      } catch {
        // Cleanup failure should not change the AI response.
      }
    }
  }
}
