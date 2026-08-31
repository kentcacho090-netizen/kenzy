/* Final AI UX guardrails: readable chat + reliable Back + one simple thinking state. */
(function () {
  if (window.__kenzyAiFinalPolish) return;
  window.__kenzyAiFinalPolish = true;

  function fixThinking() {
    document.querySelectorAll('.ai-v3-thinking-message').forEach((message) => {
      if (message._thinkingTimer) {
        window.clearInterval(message._thinkingTimer);
        message._thinkingTimer = null;
      }
      const text = message.querySelector('.ai-v3-thinking-text');
      if (text) {
        text.textContent = 'Kenzy is thinking';
        text.classList.remove('is-changing');
      }
    });
  }

  function fixBackButton() {
    const button = document.querySelector('.ai-v3-back');
    if (!button || button.dataset.finalBackFix === '1') return;
    button.dataset.finalBackFix = '1';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      /* The main React app already owns the real Home navigation. */
      const brand = document.querySelector('.topbar .brand');
      if (brand) {
        brand.click();
        return;
      }

      /* Fallback for an alternate shell/version. */
      window.dispatchEvent(new CustomEvent('studyken:navigate', { detail: { page: 'home' } }));
    }, true);
  }

  function polish() {
    fixThinking();
    fixBackButton();
  }

  function boot() {
    polish();
    const observer = new MutationObserver(polish);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
