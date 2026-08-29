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

function polishLimitCopy() {
  document.querySelectorAll('.upload-box small').forEach((node) => {
    if (node.textContent?.includes('maximum 3 MB combined')) {
      node.textContent = node.textContent.replace('maximum 3 MB combined', 'maximum 25 MB combined');
    }
  });
  document.querySelectorAll('.error-box').forEach((node) => {
    if (node.textContent?.includes('under 3 MB')) {
      node.textContent = node.textContent.replace('under 3 MB', 'at or below 25 MB');
    }
  });
  document.querySelectorAll('.ai-v2-files-section small').forEach((node) => {
    if (node.textContent?.includes('3 MB')) node.textContent = node.textContent.replace(/3 MB/g, '25 MB');
  });
}

const refreshCopy = () => setTimeout(polishLimitCopy, 0);
document.addEventListener('click', refreshCopy, true);
document.addEventListener('change', refreshCopy, true);
refreshCopy();

// Legacy React handlers still contain a 3 MB client-side guard. For files between
// 3 MB and 25 MB, temporarily expose a small File.size while those handlers run.
// The underlying File bytes are never changed; the true size is restored after the event.
document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
  const files = Array.from(input.files || []);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= LARGE_UPLOAD_THRESHOLD || total > MAX_UPLOAD_BYTES) return;

  const patched = files.map((file) => {
    try { Object.defineProperty(file, 'size', { configurable: true, value: 1024 }); } catch {}
    return file;
  });
  queueMicrotask(() => patched.forEach((file) => { try { delete file.size; } catch {} }));
}, true);

async function uploadLargeFiles(files) {
  const uploaded = [];
  for (const file of files) {
    const blob = base64ToBlob(file.data, file.mimeType);
    const result = await upload(
      `kenzy-material/${crypto.randomUUID()}-${safeName(file.name)}`,
      blob,
      {
        access: 'private',
        handleUploadUrl: '/api/blob-upload',
        multipart: blob.size > 5 * 1024 * 1024,
      },
    );
    uploaded.push({ pathname: result.pathname, mimeType: file.mimeType, name: file.name });
  }
  return uploaded;
}

window.fetch = async function largeUploadFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';
  const supported = url.endsWith('/api/generate-quiz') || url.endsWith('/api/ai-chat');
  if (!supported || typeof init.body !== 'string') return originalFetch(input, init);

  let body;
  try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return originalFetch(input, init);

  const totalBytes = files.reduce((sum, file) => sum + (typeof file.data === 'string' ? base64Bytes(file.data) : 0), 0);
  if (totalBytes <= LARGE_UPLOAD_THRESHOLD) return originalFetch(input, init);
  if (totalBytes > MAX_UPLOAD_BYTES) throw new Error('The combined upload is too large. Please keep it at or below 25 MB.');

  try {
    const uploaded = await uploadLargeFiles(files);
    return originalFetch(input, { ...init, body: JSON.stringify({ ...body, files: [], blobFiles: uploaded }) });
  } catch (error) {
    throw new Error(error?.message || 'The larger file could not be uploaded.');
  }
};
