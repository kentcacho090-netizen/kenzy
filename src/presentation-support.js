import { upload } from '@vercel/blob/client';

/* PowerPoint upload support for Quiz Maker, AI Assistant, and Study Notes. */
(function () {
  const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const PPT = 'application/vnd.ms-powerpoint';
  const FALLBACK = 'application/pdf';
  const MAX = 25 * 1024 * 1024;
  const originalFetch = window.fetch.bind(window);

  function mimeFor(name, fallback) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('.pptx')) return PPTX;
    if (lower.endsWith('.ppt')) return PPT;
    return fallback;
  }

  function looksLikePptx(base64) {
    try {
      const clean = String(base64 || '').split(',').pop();
      if (!clean || clean.length < 8) return false;
      const bytes = Uint8Array.from(atob(clean.slice(0, 8192)), (c) => c.charCodeAt(0));
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
      const text = new TextDecoder().decode(bytes);
      return text.includes('ppt/presentation.xml') || text.includes('ppt/slides/');
    } catch { return false; }
  }

  function looksLikeLegacyPpt(base64) {
    try {
      const clean = String(base64 || '').split(',').pop();
      if (clean.length < 16) return false;
      const bytes = Uint8Array.from(atob(clean.slice(0, 24)), (c) => c.charCodeAt(0));
      return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    } catch { return false; }
  }

  function inferMime(file) {
    const byName = mimeFor(file?.name, '');
    if (byName) return byName;
    if (looksLikePptx(file?.data)) return PPTX;
    if (looksLikeLegacyPpt(file?.data)) return PPT;
    return file?.mimeType || FALLBACK;
  }

  function patchFile(file) {
    if (!file || typeof file !== 'object') return;
    const mime = mimeFor(file.name, file.type);
    if (mime !== PPT && mime !== PPTX) return;
    try {
      Object.defineProperty(file, '__kenzyOriginalMime', { configurable: true, value: mime });
      Object.defineProperty(file, 'type', { configurable: true, value: FALLBACK });
    } catch {}
  }

  function enhanceInputs() {
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      const current = input.getAttribute('accept') || '';
      if (!current.includes('.ppt')) input.setAttribute('accept', `${current ? `${current},` : ''}.ppt,.pptx,${PPT},${PPTX}`);
      input.multiple = true;
    });
    document.querySelectorAll('.upload-box small,.ai-v2-files-section small').forEach((node) => {
      const text = node.textContent || '';
      if (!text.includes('PPT')) node.textContent = text.replace(/PDF, PNG, JPG, or WebP/gi, 'PDF, PPT, PPTX, PNG, JPG, or WebP');
    });
  }

  function dataToBlob(data, mimeType) {
    const clean = String(data || '').split(',').pop();
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }

  async function uploadFiles(files) {
    const uploaded = [];
    for (const file of files) {
      const mimeType = inferMime(file);
      const blob = dataToBlob(file.data, mimeType);
      const result = await upload(
        `presentation-material/${crypto.randomUUID()}-${String(file.name || 'study-material').replace(/[^a-zA-Z0-9._-]+/g, '-')}`,
        blob,
        { access: 'private', handleUploadUrl: '/api/blob-upload', multipart: blob.size > 5 * 1024 * 1024 },
      );
      uploaded.push({ pathname: result.pathname, mimeType, name: file.name || 'study-material' });
    }
    return uploaded;
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    Array.from(input.files || []).forEach(patchFile);
    enhanceInputs();
  }, true);

  document.addEventListener('paste', (event) => {
    Array.from(event.clipboardData?.files || []).forEach(patchFile);
  }, true);

  window.fetch = async function presentationAwareFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const supported = /\/api\/(generate-quiz|ai-chat|study-notes)$/.test(url);
    if (!supported || typeof init.body !== 'string') return originalFetch(input, init);

    let body;
    try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return originalFetch(input, init);

    const normalized = files.map((file) => ({ ...file, mimeType: inferMime(file) }));
    const hasPresentation = normalized.some((file) => file.mimeType === PPT || file.mimeType === PPTX);
    if (!hasPresentation) return originalFetch(input, { ...init, body: JSON.stringify({ ...body, files: normalized }) });

    const total = normalized.reduce((sum, file) => sum + Math.floor(String(file.data || '').length * 0.75), 0);
    if (total > MAX) throw new Error('The combined upload is too large. Please keep it at or below 25 MB.');

    const blobFiles = await uploadFiles(normalized);
    const kind = url.endsWith('/generate-quiz') ? 'quiz' : url.endsWith('/study-notes') ? 'notes' : 'ai';
    return originalFetch('/api/presentation-content', {
      ...init,
      body: JSON.stringify({ ...body, kind, files: [], blobFiles }),
    });
  };

  enhanceInputs();
  window.setInterval(enhanceInputs, 1000);
})();
