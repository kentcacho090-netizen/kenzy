(() => {
  const MAX = 25 * 1024 * 1024;
  const OLD = 3 * 1024 * 1024;
  const AI_META = 'kenzy-ai-file-meta-v2';

  function isUploadInput(input) {
    return input instanceof HTMLInputElement && input.type === 'file' && (
      input.classList.contains('ai-v2-file-input') ||
      input.classList.contains('ai-v2-compose-file-input') ||
      !!input.closest('.quiz-page')
    );
  }

  function patchCopy() {
    document.querySelectorAll('.upload-box small,.ai-v2-files-section small').forEach((node) => {
      node.textContent = (node.textContent || '')
        .replace(/maximum\s+3\s*MB(?:\s+combined)?/gi, 'maximum 25 MB combined')
        .replace(/under\s+3\s*MB/gi, 'at or below 25 MB');
    });
    document.querySelectorAll('.error-box').forEach((node) => {
      node.textContent = (node.textContent || '').replace(/(?:under|below|at or below)?\s*3\s*MB(?:\s+total|\s+combined)?/gi, '25 MB');
    });
  }

  function getTrueSize(file) {
    return Number.isFinite(file?.__kenzyTrueSize) ? file.__kenzyTrueSize : Number(file?.size || 0);
  }

  function patchIncoming(files) {
    const changed = [];
    files.forEach((file) => {
      try {
        if (!Number.isFinite(file.__kenzyTrueSize)) {
          Object.defineProperty(file, '__kenzyTrueSize', { configurable: true, value: file.size });
        }
        Object.defineProperty(file, 'size', { configurable: true, value: 1024 });
        changed.push(file);
      } catch {}
    });
    return changed;
  }

  function restore(files) {
    files.forEach((file) => { try { delete file.size; } catch {} });
  }

  function handleChange(event) {
    const input = event.target;
    if (!isUploadInput(input)) return;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const incoming = files.reduce((sum, file) => sum + getTrueSize(file), 0);
    if (incoming > MAX) return;

    if (input.classList.contains('ai-v2-file-input') || input.classList.contains('ai-v2-compose-file-input')) {
      let existing = [];
      try { existing = JSON.parse(localStorage.getItem(AI_META) || '[]'); } catch {}
      const existingBytes = existing.reduce((sum, item) => sum + (Number(item?.size) || 0), 0);
      if (existingBytes + incoming > MAX) return;

      if (existingBytes + incoming > OLD) {
        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;
        const fakeExisting = existing.map((item) => ({ ...item, size: 0 }));
        let patchedFiles = [];

        Storage.prototype.getItem = function (key) {
          if (this === localStorage && key === AI_META) return JSON.stringify(fakeExisting);
          return originalGetItem.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage && key === AI_META) {
            try {
              const candidate = JSON.parse(value);
              const oldById = new Map(existing.map((item) => [item.id, item]));
              let queue = [...files];
              const fixed = candidate.map((item) => {
                if (oldById.has(item.id)) return { ...item, size: oldById.get(item.id).size };
                const matchIndex = queue.findIndex((file) => file.name === item.name && file.type === item.type);
                if (matchIndex >= 0) {
                  const file = queue.splice(matchIndex, 1)[0];
                  return { ...item, size: getTrueSize(file) };
                }
                return item;
              });
              return originalSetItem.call(this, key, JSON.stringify(fixed));
            } catch {}
          }
          return originalSetItem.call(this, key, value);
        };

        patchedFiles = patchIncoming(files);
        queueMicrotask(() => {
          Storage.prototype.getItem = originalGetItem;
          Storage.prototype.setItem = originalSetItem;
          restore(patchedFiles);
        });
      } else {
        patchCopy();
      }
    } else if (incoming > OLD) {
      const patchedFiles = patchIncoming(files);
      queueMicrotask(() => restore(patchedFiles));
    }

    patchCopy();
  }

  document.addEventListener('change', handleChange, true);
  patchCopy();
  window.setInterval(patchCopy, 1000);
})();