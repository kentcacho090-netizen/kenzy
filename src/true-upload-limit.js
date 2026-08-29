/* Unified 25 MB upload compatibility layer. */
(() => {
  const MAX = 25 * 1024 * 1024;
  const LEGACY = 3 * 1024 * 1024;
  const AI_META = 'kenzy-ai-file-meta-v2';
  const AI_INPUTS = new Set(['ai-v2-file-input', 'ai-v2-compose-file-input']);
  const ALLOWED = new Set([
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
  ]);

  function readMeta() { try { return JSON.parse(localStorage.getItem(AI_META) || '[]'); } catch { return []; } }
  function sumMeta(items) { return items.reduce((sum, item) => sum + (Number(item?.size) || 0), 0); }

  function cloneForLegacy(file) {
    class LegacySizeFile extends File {
      constructor(source) { super([source], source.name, { type: source.type, lastModified: source.lastModified }); this.__kenzyActualSize = source.size; this.__kenzyUseLegacySize = true; }
      get size() { return this.__kenzyUseLegacySize ? 1024 : super.size; }
    }
    return new LegacySizeFile(file);
  }

  function replaceInputFiles(input, files) {
    try { const transfer = new DataTransfer(); files.forEach((file) => transfer.items.add(file)); input.files = transfer.files; return true; } catch { return false; }
  }

  function patchAiStorage(existing, incoming) {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    let active = true;
    const existingView = existing.map((item) => ({ ...item, size: 0 }));
    Storage.prototype.getItem = function (key) { if (active && this === localStorage && key === AI_META) return JSON.stringify(existingView); return originalGet.call(this, key); };
    Storage.prototype.setItem = function (key, value) {
      if (active && this === localStorage && key === AI_META) {
        try {
          const candidate = JSON.parse(value);
          const existingById = new Map(existing.map((item) => [item.id, item]));
          const used = new Set();
          const repaired = candidate.map((item) => {
            if (existingById.has(item.id)) return { ...item, size: existingById.get(item.id).size };
            const match = incoming.find((file) => !used.has(file) && file.name === item.name && file.type === item.type);
            if (match) { used.add(match); return { ...item, size: match.size }; }
            return item;
          });
          return originalSet.call(this, key, JSON.stringify(repaired));
        } catch {}
      }
      return originalSet.call(this, key, value);
    };
    const restore = () => { if (!active) return; active = false; Storage.prototype.getItem = originalGet; Storage.prototype.setItem = originalSet; };
    window.setTimeout(restore, 2500);
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    const files = Array.from(input.files || []);
    if (!files.length || files.some((file) => !ALLOWED.has(file.type))) return;
    const incomingBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (incomingBytes > MAX) { input.value = ''; return; }
    const isAi = AI_INPUTS.has(input.classList[0]) || AI_INPUTS.has(input.className);
    if (isAi) {
      const existing = readMeta();
      const existingBytes = sumMeta(existing);
      if (existingBytes + incomingBytes > MAX) { event.preventDefault(); event.stopImmediatePropagation(); window.alert('Keep your saved AI files at or below 25 MB total.'); input.value = ''; return; }
      if (existingBytes + incomingBytes > LEGACY) { patchAiStorage(existing, files); const patched = files.map(cloneForLegacy); replaceInputFiles(input, patched); window.setTimeout(() => patched.forEach((file) => { file.__kenzyUseLegacySize = false; }), 0); }
      return;
    }
    if (incomingBytes > LEGACY) { const patched = files.map(cloneForLegacy); if (replaceInputFiles(input, patched)) window.setTimeout(() => patched.forEach((file) => { file.__kenzyUseLegacySize = false; }), 0); }
  }, true);

  function polishCopy() {
    document.querySelectorAll('.upload-box small, .ai-v2-files-section small, .error-box').forEach((node) => {
      const text = node.textContent || '';
      if (/3\s*MB/i.test(text)) node.textContent = text.replace(/(?:maximum|under|below|at or below|saved AI files under)?\s*3\s*MB(?:\s+(?:combined|total))?/gi, '25 MB');
    });
  }
  polishCopy();
  window.setInterval(polishCopy, 1000);
})();
