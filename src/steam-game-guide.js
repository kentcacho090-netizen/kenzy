// Add a safe Steam setup reference to Kenzy's Applications page.
// This guide intentionally keeps installation within Steam's normal, licensed flow.

const GUIDE_ID = 'kenzy-steam-game-guide';

function createGuide() {
  if (document.getElementById(GUIDE_ID)) return;
  const grid = document.querySelector('.applications-grid');
  if (!grid) return;

  const section = document.createElement('section');
  section.id = GUIDE_ID;
  section.className = 'workspace-card steam-guide-card';
  section.innerHTML = `
    <div class="card-heading">
      <div>
        <span>Steam Game Setup Guide</span>
        <small>Install and identify games you already own</small>
      </div>
      <span class="ai-badge">STEAM</span>
    </div>
    <div class="steam-guide-body">
      <section>
        <div class="eyebrow">INSTALL</div>
        <h3>1. Install Steam</h3>
        <p>Start by downloading the official Steam client. Install it, open Steam, and sign in to the account that owns the game you want to play.</p>
        <a class="download-button" href="https://store.steampowered.com/about/" target="_blank" rel="noreferrer">Download Steam ↗</a>
      </section>
      <section>
        <div class="eyebrow">PICKING GAMES</div>
        <h3>2. Find the game on SteamDB</h3>
        <p>Open SteamDB and search for the game you want. Select the correct title, then use the App ID on its page as a reference for identifying the game.</p>
        <a class="download-button" href="https://steamdb.info/" target="_blank" rel="noreferrer">Open SteamDB ↗</a>
      </section>
      <section>
        <h3>3. Install the game normally through Steam</h3>
        <p>Return to Steam, open your Library, select the game you own, and choose <strong>Install</strong>. Steam will handle the download and installation for you.</p>
      </section>
      <section class="steam-guide-note">
        <strong>About third-party depot tools</strong>
        <p>Kenzy does not provide step-by-step instructions for extracting or loading Steam depot files with third-party tools when that could bypass Steam's licensing or distribution controls. For games you own, use Steam's normal installation, update, and backup features.</p>
      </section>
    </div>
  `;

  grid.insertAdjacentElement('afterend', section);
}

function watch() {
  createGuide();
  const observer = new MutationObserver(createGuide);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 15000);
}

if (typeof window !== 'undefined') {
  if (document.body) watch();
  else window.addEventListener('DOMContentLoaded', watch, { once: true });
}
