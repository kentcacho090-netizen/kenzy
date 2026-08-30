(() => {
  if (window.__kenzyNotesAiResultControls) return;
  window.__kenzyNotesAiResultControls = true;

  function addRemoveButton(root = document) {
    root.querySelectorAll?.('.notes-stable-result').forEach((result) => {
      if (result.querySelector('[data-remove-result]')) return;
      const actions = result.querySelector('.notes-stable-result-actions');
      if (!actions) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.removeResult = '1';
      button.textContent = 'Remove result';
      button.title = 'Remove this AI result';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        result.classList.remove('visible', 'working');
        result.querySelector('.notes-stable-result-body')?.replaceChildren();
        const state = result.querySelector('.notes-stable-result-state');
        if (state) state.textContent = 'Ready.';
        const page = result.closest('.notes-page');
        const status = page?.querySelector('.notes-stable-status');
        if (status) {
          status.classList.remove('visible');
          status.textContent = '';
          delete status.dataset.kind;
        }
      });

      actions.appendChild(button);
    });
  }

  const observer = new MutationObserver(() => addRemoveButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addRemoveButton();
})();
