let bound = false;

function bindAiEnterKey() {
  if (bound) return;
  bound = true;

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    if (!target.closest('.chat-form')) return;
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;

    event.preventDefault();
    const form = target.closest('form');
    if (!form) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindAiEnterKey);
} else {
  bindAiEnterKey();
}
