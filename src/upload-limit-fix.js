/* Normalize the product upload limit to 25 MB without replacing the existing upload pipelines. */
(function () {
  const MAX_BYTES = 25 * 1024 * 1024;
  const AI_OLD_LIMIT = 3 * 1024 * 1024;
  const AI_META_KEY = 'kenzy-ai-file-meta-v2';
  const AI_DB = 'kenzy-ai-files-v2';
  const AI_STORE = 'files';
  const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

  function trueSize(file) {
    return Number.isFinite(file?.__kenzyTrueSize) ? file.__kenzyTrueSize : file?.size || 0;
  }

  function patchLimitCopy() {
    document.querySelectorAll('.upload-box small, .ai-v2-files-section small').forEach((node) => {
      if (/3\s*MB/i.test(node.textContent || '')) {
        node.textContent = (node.textContent || '').replace(/3\s*MB(?:\s+combined)?/gi, '25 MB combined');
      }
    });
    document.querySelectorAll('.error-box').forEach((node) => {
      if (/3\s*MB/i.test(node.textContent || '')) {
        node.textContent = (node.textContent || '').replace(/(?:under|below|at or below)?\s*3\s*MB(?:\s+total|\s+combined)?/gi, '25 MB');
      }
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AI_DB, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function repairAiRecords(ids, files) {
    if (!ids.length || !files.length) return;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(AI_STORE, 'readwrite');
        const store = tx.objectStore(AI_STORE);
        ids.forEach((id, index) => {
          const file = files[index];
          if (!file) return;
          const get = store.get(id);
          get.onsuccess = () => {
            const record = get.result;
            if (record) store.put({ ...record, size: trueSize(file), blob: file });
          };
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }

  function handleAiInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    if (!input.classList.contains('ai-v2-file-input') && !input.classList.contains('ai-v2-compose-file-input')) return;

    const files = Array.from(input.files || []);
    if (!files.length) return;
    const allowed = files.every((file) => ALLOWED.has(file.type));
    if (!allowed) return;

    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(AI_META_KEY) || '[]'); } catch {}
    const existingBytes = existing.reduce((sum, item) => sum + (Number(item?.size) || 0), 0);
    const incomingBytes = files.reduce((sum, file) => sum + trueSize(file), 0);
    const total = existingBytes + incomingBytes;

    if (total > MAX_BYTES) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.alert('Keep your saved AI files at or below 25 MB total. Remove an older file or choose a smaller upload.');
      return;
    }

    /* The old AI workspace still contains a 3 MB guard. Temporarily make that
       legacy guard see a tiny size while preserving the real size in IndexedDB
       and localStorage immediately after its own handler finishes. */
    if (total <= MAX_BYTES && total > AI_OLD_LIMIT) {
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      const fakeExisting = existing.map((item) => ({ ...item, size: 0 }));
      let savedCandidate = null;

      Storage.prototype.getItem = function (key) {
        if (this === localStorage && key === AI_META_KEY) return JSON.stringify(fakeExisting);
        return originalGetItem.call(this, key);
      };

      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === AI_META_KEY) {
          try {
            const candidate = JSON.parse(value);
            const existingById = new Map(existing.map((item) => [item.id, item]));
            const incomingQueue = files.map((file) => ({ file, used: false }));
            const repaired = candidate.map((item) => {
              if (existingById.has(item.id)) return { ...item, size: existingById.get(item.id).size };
              const match = incomingQueue.find((entry) => !entry.used && entry.file.name === item.name && entry.file.type === item.type);
              if (match) {
                match.used = true;
                return { ...item, size: trueSize(match.file) };
              }
              return item;
            });
            savedCandidate = repaired;
            return originalSetItem.call(this, key, JSON.stringify(repaired));
          } catch {}
        }
        return originalSetItem.call(this, key, value);
      };

      files.forEach((file) => {
        try {
          Object.defineProperty(file, '__kenzyTrueSize', { configurable: true, value: file.size });
          Object.defineProperty(file, 'size', { configurable: true, value: 1024 });
        } catch {}
      });

      queueMicrotask(async () => {
        Storage.prototype.getItem = originalGetItem;
        Storage.prototype.setItem = originalSetItem;
        files.forEach((file) => { try { delete file.size; } catch {} });
        const ids = (savedCandidate || []).slice(0, files.length).map((item) => item.id);
        const newIds = (savedCandidate || []).filter((item) => !existing.some((old) => old.id === item.id)).map((item) => item.id);
        await repairAiRecords(newIds, files);
        patchLimitCopy();
      });
    }
  }

  document.addEventListener('change', handleAiInput, true);
  document.addEventListener('click', patchLimitCopy, true);
  document.addEventListener('input', patchLimitCopy, true);
  patchLimitCopy();
  window.setInterval(patchLimitCopy, 1000);
})();
