// Route Study Notes AI requests through the resilient Gemini endpoint.
// This keeps the existing Notes UI and behavior unchanged while adding
// lightweight-model fallbacks for temporary Gemini capacity errors.
(() => {
  if (window.__kenzyNotesAiResilient) return;
  window.__kenzyNotesAiResilient = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!String(url).endsWith('/api/study-notes')) return originalFetch(input, init);
    const method = String(init?.method || (typeof input === 'object' ? input.method : 'GET')).toUpperCase();
    if (method !== 'POST') return originalFetch(input, init);
    return originalFetch('/api/study-notes-resilient', init);
  };
})();
