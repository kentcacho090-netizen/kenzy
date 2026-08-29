/* StudyKen stability fixes: AI navigation, fast/consistent uploads, PPT/PPTX input compatibility. */
(function () {
  const MAX = 25 * 1024 * 1024;
  const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const PPT = 'application/vnd.ms-powerpoint';
  const originalFetch = window.fetch.bind(window);

  function isPpt(file) {
    const name = String(file?.name || '').toLowerCase();
    return name.endsWith('.ppt') || name.endsWith('.pptx') || file?.type === PPT || file?.type === PPTX;
  }

  function patchLegacyFile(file) {
    if (!isPpt(file)) return file;
    try { Object.defineProperty(file, 'type', { configurable: true, value: 'application/pdf' }); } catch {}
    return file;
  }

  function patchSize(file) {
    try { Object.defineProperty(file, 'size', { configurable: true, value: 1024 }); } catch {}
    return file;
  }

  function enhanceInputs() {
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      const current = input.getAttribute('accept') || '';
      const extras = `.ppt,.pptx,${PPT},${PPTX}`;
      if (!current.includes('.ppt')) input.setAttribute('accept', `${current ? `${current},` : ''}${extras}`);
      input.multiple = true;
    });
  }

  function enhanceAiBack() {
    const shell = document.querySelector('.ai-v2-shell');
    const head = shell?.querySelector('.ai-v2-chat-head');
    if (!shell || !head || head.querySelector('.ai-v2-back')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-v2-back';
    button.textContent = '← Back';
    button.setAttribute('aria-label', 'Back to StudyKen home');
    button.onclick = () => document.querySelector('.brand')?.click();
    head.insertBefore(button, head.firstChild);
  }

  // Let legacy React handlers accept PPT/PPTX and 3–25 MB files.
  // The real bytes and names remain intact. presentation-support.js restores the
  // real PowerPoint MIME type before the server receives the request.
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const total = files.reduce((sum, file) => sum + file.size, 0);
    const inQuiz = !!input.closest('.upload-box');
    const inAi = !!input.closest('.ai-page');
    if (!inQuiz && !inAi) return;
    if (total > MAX) return;
    files.forEach((file) => { patchLegacyFile(file); if (total > 3 * 1024 * 1024) patchSize(file); });
    enhanceInputs();
    queueMicrotask(() => {
      // Keep the original size available for later code that relies on File.size.
      // Actual request bodies are normalized by the upload bridge.
      files.forEach((file) => {
        try { delete file.size; } catch {}
      });
    });
  }, true);

  // Keep the public upload text honest across the legacy layers.
  function polishCopy() {
    document.querySelectorAll('.upload-box small').forEach((node) => {
      node.textContent = (node.textContent || '')
        .replace(/maximum\s+3\s*MB\s+combined/gi, 'maximum 25 MB combined')
        .replace(/PDF, PNG, JPG, or WebP/gi, 'PDF, PPT, PPTX, PNG, JPG, or WebP');
    });
    document.querySelectorAll('.ai-v2-files-section small').forEach((node) => {
      node.textContent = (node.textContent || '')
        .replace(/3\s*MB/g, '25 MB')
        .replace(/PDF or image/gi, 'PDF, PPT, PPTX, or image');
    });
  }

  window.fetch = async function stabilityFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (/\/api\/(generate-quiz|ai-chat|study-notes)$/.test(url) && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length) {
          const normalized = files.map((file) => {
            const lower = String(file.name || '').toLowerCase();
            if (lower.endsWith('.pptx')) return { ...file, mimeType: PPTX };
            if (lower.endsWith('.ppt')) return { ...file, mimeType: PPT };
            return file;
          });
          const total = normalized.reduce((sum, file) => sum + Math.floor(String(file.data || '').length * 0.75), 0);
          if (total <= MAX) {
            init = { ...init, body: JSON.stringify({ ...body, files: normalized }) };
          }
        }
      } catch {}
    }
    return originalFetch(input, init);
  };

  function boot() {
    enhanceInputs();
    enhanceAiBack();
    polishCopy();
  }

  boot();
  window.setInterval(boot, 600);
})();
