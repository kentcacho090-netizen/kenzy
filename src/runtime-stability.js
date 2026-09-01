/* Runtime guard for StudyKen/Kenzy storage and browser APIs. */
(function () {
  if (window.__kenzyRuntimeStability) return;
  window.__kenzyRuntimeStability = true;

  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const arrayKeys = new Set([
    'kenzy-quizzes-v4', 'kenzy-notes-v1',
    'studyken-ai-conversations-v3', 'studyken-ai-file-meta-v3', 'studyken-ai-selected-v3',
    'kenzy-ai-file-meta-v2', 'kenzy-ai-selected-files-v2', 'kenzy-quiz-review-v3'
  ]);

  function isArrayStorageKey(key) { return arrayKeys.has(String(key)); }
  function sanitize(key, value) {
    const k = String(key);
    if (isArrayStorageKey(k)) {
      if (!Array.isArray(value)) return '[]';
      if (k === 'kenzy-quizzes-v4') {
        value = value.filter(q => q && typeof q === 'object' && Array.isArray(q.questions) && q.questions.length > 0);
      } else if (k === 'kenzy-notes-v1') {
        value = value.filter(n => n && typeof n === 'object' && typeof n.title === 'string' && typeof n.content === 'string');
      } else if (k === 'studyken-ai-conversations-v3') {
        value = value.filter(c => c && typeof c === 'object' && typeof c.id === 'string' && Array.isArray(c.messages))
          .map(c => ({ ...c, messages: c.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') }));
      } else if (k.includes('selected')) {
        value = value.filter(v => typeof v === 'string');
      }
      return JSON.stringify(value);
    }
    return null;
  }

  Storage.prototype.getItem = function (key) {
    const raw = originalGetItem.call(this, key);
    if (!raw || !isArrayStorageKey(key)) return raw;
    try {
      const cleaned = sanitize(key, JSON.parse(raw));
      if (cleaned !== null && cleaned !== raw) originalSetItem.call(this, key, cleaned);
      return cleaned;
    } catch {
      try { originalSetItem.call(this, key, '[]'); } catch {}
      return '[]';
    }
  };

  Storage.prototype.setItem = function (key, value) {
    try {
      const cleaned = sanitize(key, JSON.parse(String(value)));
      originalSetItem.call(this, key, cleaned === null ? value : cleaned);
    } catch {
      try { originalSetItem.call(this, key, value); } catch (error) { console.warn('StudyKen storage write skipped:', error); }
    }
  };

  window.addEventListener('error', event => {
    if (/QuotaExceeded|localStorage|sessionStorage/i.test(String(event?.error?.message || event?.message || ''))) {
      event.preventDefault();
      console.warn('StudyKen recovered from a browser storage error.');
    }
  });

  window.addEventListener('unhandledrejection', event => {
    if (/QuotaExceeded|localStorage|sessionStorage/i.test(String(event?.reason?.message || event?.reason || ''))) {
      event.preventDefault();
      console.warn('StudyKen recovered from a browser storage error.');
    }
  });
})();
