(() => {
  const MAX = 25 * 1024 * 1024;
  const OLD = 3 * 1024 * 1024;
  const AI_META = 'kenzy-ai-file-meta-v2';

  function allowedInput(input) {
    return input instanceof HTMLInputElement && input.type === 'file' &&
      (input.classList.contains('ai-v2-file-input') || input.classList.contains('ai-v2-compose-file-input') ||
       !!input.closest('.quiz-page') || !!input.closest('.quiz-maker-page'));
  }

  function patchCopy() {
    document.querySelectorAll('.upload-box small,.ai-v2-files-section small').forEach((n) => {
      n.textContent = (n.textContent || '').replace(/maximum\s+3\s*MB(?:\s+combined)?/gi, 'maximum 25 MB combined').replace(/under\s+3\s*MB/gi, 'at or below 25 MB');
    });
    document.querySelectorAll('.error-box').forEach((n) => {
      n.textContent = (n.textContent || '').replace(/(?:under|below|at or below)?\s*3\s*MB(?:\s+total|\s+combined)?/gi, '25 MB');
    });
  }

  function total(files) { return Array.from(files || []).reduce((n, f) => n + Number(f.size || 0), 0); }

  function patchFilesForLegacyGuard(files) {
    const changed = [];
    for (const file of files) {
      try {
        if (!Number.isFinite(file.__kenzyOriginalSize)) Object.defineProperty(file, '__kenzyOriginalSize', { configurable: true, value: file.size });
        Object.defineProperty(file, 'size', { configurable: true, value: 1024 });
        changed.push(file);
      } catch {}
    }
    queueMicrotask(() => changed.forEach((file) => { try { delete file.size; } catch {} }));
  }

  function handleChange(event) {
    const input = event.target;
    if (!allowedInput(input)) return;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const size = total(files);
    if (size > MAX) return;
    if (size > OLD) patchFilesForLegacyGuard(files);
    patchCopy();
  }

  // The old AI workspace used a 3 MB guard internally. Hide only that legacy
  // message; the actual add-file handler is allowed to continue with the
  // temporary file-size patch above and the real 25 MB validation here.
  const originalAlert = window.alert.bind(window);
  window.alert = (message) => {
    const text = String(message || '');
    if (/saved AI files under 3 MB|saved AI files.*3\s*MB|under 3\s*MB total/i.test(text)) {
      originalAlert('Keep your saved AI files at or below 25 MB total. Remove an older file or choose a smaller upload.');
      return;
    }
    originalAlert(message);
  };

  document.addEventListener('change', handleChange, true);
  patchCopy();
  window.setInterval(patchCopy, 1000);
})();
