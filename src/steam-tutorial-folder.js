(() => {
  const FOLDER_CLASS = 'steam-tutorial-folder-ready';

  function polishTutorial() {
    const tutorial = document.getElementById('kenzy-steam-install-tutorial');
    if (!tutorial || tutorial.dataset.folderReady === 'true') return;

    const header = tutorial.querySelector('.steam-tutorial-header');
    const folds = tutorial.querySelector('.steam-folds');
    const note = tutorial.querySelector('.steam-tutorial-note');
    if (!header || !folds) return;

    const details = document.createElement('details');
    details.className = 'steam-tutorial-folder';

    const summary = document.createElement('summary');
    summary.className = 'steam-tutorial-folder-summary';
    summary.innerHTML = `
      <span class="steam-folder-icon" aria-hidden="true">⌘</span>
      <span class="steam-folder-copy">
        <strong>Steam Game Install Tutorial</strong>
        <small>SteamTools · SteamDB · DepotBox</small>
      </span>
      <span class="steam-folder-arrow" aria-hidden="true">→</span>
    `;

    details.appendChild(summary);
    details.appendChild(header);
    details.appendChild(folds);
    if (note) details.appendChild(note);

    tutorial.replaceChildren(details);
    tutorial.classList.add(FOLDER_CLASS);
    tutorial.dataset.folderReady = 'true';
  }

  const style = document.createElement('style');
  style.textContent = `
    .steam-tutorial-folder-ready{margin:18px 0;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
    .steam-tutorial-folder{margin:0;background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(20,28,55,.06)}
    .steam-tutorial-folder-summary{list-style:none;display:flex;align-items:center;gap:13px;padding:14px 15px;cursor:pointer;user-select:none;color:var(--text);transition:background .16s ease,transform .16s ease}
    .steam-tutorial-folder-summary::-webkit-details-marker{display:none}
    .steam-tutorial-folder-summary:hover{background:var(--soft)}
    .steam-folder-icon{width:48px;height:48px;flex:0 0 48px;border-radius:14px;display:grid;place-items:center;background:var(--soft);color:var(--accent);font-size:22px;font-weight:900;box-shadow:inset 0 0 0 1px var(--border)}
    .steam-folder-copy{display:grid;gap:3px;min-width:0;flex:1}
    .steam-folder-copy strong{font-size:15px;letter-spacing:-.01em}
    .steam-folder-copy small{font-size:11px;color:var(--muted);line-height:1.4}
    .steam-folder-arrow{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:var(--surface2);color:var(--muted);font-size:17px;transition:transform .18s ease,background .18s ease}
    .steam-tutorial-folder[open] .steam-folder-arrow{transform:rotate(90deg);background:var(--soft);color:var(--accent)}
    .steam-tutorial-folder>.steam-tutorial-header{margin:0 15px;padding:16px 4px 12px;border-top:1px solid var(--border)}
    .steam-tutorial-folder>.steam-tutorial-header .steam-tutorial-icon{display:none}
    .steam-tutorial-folder>.steam-folds{padding:0 15px 10px}
    .steam-tutorial-folder>.steam-tutorial-note{margin:2px 19px 15px}
    .steam-tutorial-folder>.steam-folds .steam-fold{background:var(--surface2)}
    .dark .steam-tutorial-folder{box-shadow:0 12px 34px rgba(0,0,0,.18)}
    @media(max-width:700px){
      .steam-tutorial-folder-ready{margin-top:14px}
      .steam-folder-icon{width:44px;height:44px;flex-basis:44px}
      .steam-folder-copy strong{font-size:14px}
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(polishTutorial);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', polishTutorial, { once: true });
  else polishTutorial();
})();
