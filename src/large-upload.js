import { upload } from '@vercel/blob/client';

const LARGE_UPLOAD_THRESHOLD = 3 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const originalFetch = window.fetch.bind(window);

function base64Bytes(value) {
  const comma = value.indexOf(',');
  const clean = comma >= 0 ? value.slice(comma + 1) : value;
  return Math.floor((clean.length * 3) / 4) - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
}

function base64ToBlob(data, mimeType) {
  const comma = data.indexOf(',');
  const clean = comma >= 0 ? data.slice(comma + 1) : data;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function safeName(name) {
  return String(name || 'study-material').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

// The existing quiz page has an older 3MB client-side guard. For files between
// 3MB and 25MB, temporarily mask File.size only while that change handler runs.
// The original size is restored immediately, so the UI still displays the real size.
document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
  const files = Array.from(input.files || []);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= LARGE_UPLOAD_THRESHOLD || total > MAX_UPLOAD_BYTES) return;

  const patched = [];
  try {
    for (const file of files) {
      const originalSize = file.size;
      Object.defineProperty(file, 'size', { configurable: true, value: Math.min(originalSize, 1024) });
      patched.push([file, originalSize]);
    }
    queueMicrotask(() => {
      for (const [file] of patched) {
        try { delete file.size; } catch {}
      }
    });
  } catch {
    for (const [file] of patched) {
      try { delete file.size; } catch {}
    }
  }
}, true);

window.fetch = async function largeUploadFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!url.endsWith('/api/generate-quiz') || typeof init.body !== 'string') {
    return originalFetch(input, init);
  }

  let body;
  try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return originalFetch(input, init);

  const totalBytes = files.reduce((sum, file) => sum + (typeof file.data === 'string' ? base64Bytes(file.data) : 0), 0);
  if (totalBytes <= LARGE_UPLOAD_THRESHOLD) return originalFetch(input, init);
  if (totalBytes > MAX_UPLOAD_BYTES) {
    throw new Error('The combined upload is too large. Please keep it at or below 25 MB.');
  }

  const uploaded = [];
  try {
    for (const file of files) {
      if (!file?.data || !file?.mimeType) throw new Error('One of the selected files could not be read.');
      const blob = base64ToBlob(file.data, file.mimeType);
      const result = await upload(
        `quiz-material/${crypto.randomUUID()}-${safeName(file.name || 'study-material')}`,
        blob,
        {
          access: 'private',
          handleUploadUrl: '/api/blob-upload',
          multipart: blob.size > 5 * 1024 * 1024,
        },
      );
      uploaded.push({ pathname: result.pathname, mimeType: file.mimeType });
    }
  } catch (error) {
    throw new Error(error?.message || 'The larger file could not be uploaded.');
  }

  const nextBody = { ...body, files: [], blobFiles: uploaded };
  return originalFetch(input, { ...init, body: JSON.stringify(nextBody) });
};
