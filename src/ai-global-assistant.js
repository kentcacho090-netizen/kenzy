/* Kenzy AI Global Assistant
 * Additive integration: does not replace the existing AI workspace.
 * Keeps a single assistant shell mounted outside page-specific content.
 */
(function () {
  if (window.__kenzyGlobalAI) return;
  window.__kenzyGlobalAI = true;

  const QUICK = [
    ['Explain simply', 'Explain this simply'],
    ['Make a reviewer', 'Make a concise study reviewer for this topic'],
    ['Make flashcards', 'Make flashcards from this topic'],
    ['Quiz me', 'Quiz me on this topic'],
    ['Study plan', 'Make me a study plan for this topic'],
    ['Summarize', 'Summarize this topic clearly'],
    ['Find weak areas', 'Help me identify my weak areas from this material']
  ];

  function mount() {
    if (document.getElementById('kenzy-global-ai')) return;
    const root = document.createElement('div');
    root.id = 'kenzy-global-ai';
    root.innerHTML = `
      <button class="kga-fab" type="button" aria-label="Open Kenzy AI">K</button>
      <section class="kga-panel" aria-label="Kenzy AI assistant" hidden>
        <header class="kga-head">
          <div><span>KENZY AI</span><strong>Study Assistant</strong><small>Available across Kenzy</small></div>
          <button class="kga-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="kga-quick">${QUICK.map(([label, prompt]) => `<button type="button" data-kga-prompt="${escapeAttr(prompt)}">${escapeHtml(label)}</button>`).join('')}</div>
        <div class="kga-body"><p class="kga-empty">Ask Kenzy anything about your studies.</p></div>
        <form class="kga-form">
          <textarea rows="2" placeholder="Ask Kenzy…"></textarea>
          <button type="submit">Send</button>
        </form>
      </section>`;
    document.body.appendChild(root);
    bind(root);
  }

  function bind(root) {
    const fab = root.querySelector('.kga-fab');
    const panel = root.querySelector('.kga-panel');
    const close = root.querySelector('.kga-close');
    const form = root.querySelector('.kga-form');
    const input = form.querySelector('textarea');
    const body = root.querySelector('.kga-body');

    const open = () => { panel.hidden = false; input.focus(); };
    fab.onclick = open;
    close.onclick = () => { panel.hidden = true; };

    root.querySelectorAll('[data-kga-prompt]').forEach(btn => {
      btn.onclick = () => { input.value = btn.dataset.kgaPrompt; input.focus(); };
    });

    form.onsubmit = async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage(body, 'You', text);
      input.value = '';
      const thinking = addMessage(body, 'Kenzy', 'Thinking…', true);
      try {
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: text }],
            files: []
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'AI request failed.');
        thinking.remove();
        addMessage(body, 'Kenzy', data.reply || 'I did not receive a response.');
      } catch (error) {
        thinking.remove();
        addMessage(body, 'Kenzy', `I couldn't complete that request. ${error.message || ''}`.trim());
      }
      body.scrollTop = body.scrollHeight;
    };
  }

  function addMessage(body, who, text, temporary) {
    const node = document.createElement('div');
    node.className = `kga-message ${who === 'You' ? 'user' : 'assistant'}${temporary ? ' temporary' : ''}`;
    node.innerHTML = `<span>${escapeHtml(who)}</span><p>${formatText(text)}</p>`;
    const empty = body.querySelector('.kga-empty');
    if (empty) empty.remove();
    body.appendChild(node);
    body.scrollTop = body.scrollHeight;
    return node;
  }

  function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
  function escapeAttr(value) { return escapeHtml(value).replaceAll('`', '&#096;'); }
  function formatText(value) { return escapeHtml(value).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }

  function boot() {
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  }

  boot();
})();
