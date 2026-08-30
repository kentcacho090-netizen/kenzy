const TUTORIAL_ID = 'kenzy-steam-install-tutorial';

const STEAMTOOLS_URL = 'https://steamtools.net/';
const STEAMDB_URL = 'https://steamdb.info/';
const DEPOTBOX_URL = 'https://depotbox.org/';

const GUIDE_IMAGES = {
  search: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAQAgCdASoQAAkABUB8JQBOgCHgAA==',
  logo: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAQAgCdASoQAAkABUB8JQBOgCHgAA==',
  download: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAQAgCdASoQAAkABUB8JQBOgCHgAA==',
  appid: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAQAgCdASoQAAkABUB8JQBOgCHgAA==',
  toast: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAQAgCdASoQAAkABUB8JQBOgCHgAA=='
};

function guideImage(src, alt, className = '') {
  return `<figure class="steam-guide-image ${className}"><img src="${src}" alt="${alt}" loading="lazy" decoding="async"></figure>`;
}

function createTutorial() {
  const section = document.createElement('section');
  section.id = TUTORIAL_ID;
  section.className = 'steam-tutorial';
  section.setAttribute('aria-labelledby', 'steam-tutorial-title');
  section.innerHTML = `
    <div class="steam-tutorial-header">
      <div>
        <div class="eyebrow">APPLICATION GUIDE</div>
        <h2 id="steam-tutorial-title">SteamTools Game Setup Guide</h2>
        <p>Follow the screenshots in order. Each section can be opened only when you need it.</p>
      </div>
      <div class="steam-tutorial-icon" aria-hidden="true">◉</div>
    </div>
    <div class="steam-folds">
      <details class="steam-fold"><summary><span class="steam-fold-number">01</span><span class="steam-fold-title">Download &amp; install SteamTools</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">1</div><div><h3>Open SteamTools.net</h3><p>Use the button below to open the SteamTools website.</p><a class="download-button" href="${STEAMTOOLS_URL}" target="_blank" rel="noopener noreferrer">Open SteamTools.net ↗</a></div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Click “Download Setup (Recommended)”</h3><p>On the download page, use the purple <strong>Download Setup (Recommended)</strong> button shown below.</p>${guideImage(GUIDE_IMAGES.download, 'Screenshot showing the purple Download Setup (Recommended) button', 'guide-wide')}</div></article>
        <article class="steam-step-card"><div class="steam-step-number">3</div><div><h3>Install SteamTools</h3><p>Run the downloaded installer and complete the installation. Then launch SteamTools.</p></div></article>
        <article class="steam-step-card"><div class="steam-step-number">4</div><div><h3>Wait for Steam to appear</h3><p>When Steam starts or restarts, you may briefly see the Steam logo while the client loads.</p>${guideImage(GUIDE_IMAGES.logo, 'Screenshot of the Steam logo while Steam is loading', 'guide-logo')}</div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">02</span><span class="steam-fold-title">Find the game's App ID</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card"><div class="steam-step-number">1</div><div><h3>Search for the game</h3><p>Open SteamDB and search for the game you want. Use the search field shown in the screenshot.</p><a class="download-button secondary-link" href="${STEAMDB_URL}" target="_blank" rel="noopener noreferrer">Open SteamDB ↗</a>${guideImage(GUIDE_IMAGES.search, 'SteamDB search field showing the placeholder e.g., Half-Life or AppID 70', 'guide-wide')}</div></article>
        <article class="steam-step-card"><div class="steam-step-number">2</div><div><h3>Open the game entry</h3><p>Open the matching SteamDB application page and look for the <strong>App ID</strong> field.</p>${guideImage(GUIDE_IMAGES.appid, 'SteamDB App ID field showing 1778820', 'guide-wide')}</div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">3</div><div><h3>Copy the App ID</h3><p>Copy the number shown next to <strong>App ID</strong>. The screenshot example shows <strong>1778820</strong>; your game's number will be different.</p></div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">03</span><span class="steam-fold-title">Use the App ID in the tool</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">1</div><div><h3>Paste the App ID into the search box</h3><p>Return to the tool's search area and enter the App ID you copied. The field is designed to accept a game name or App ID.</p>${guideImage(GUIDE_IMAGES.search, 'Search field showing that a game name or App ID can be entered', 'guide-wide')}</div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Select the matching game</h3><p>Double-check the title and App ID before continuing so you work with the intended Steam application.</p></div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">04</span><span class="steam-fold-title">Compile the Lua script</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">1</div><div><h3>Compile the selected Lua script</h3><p>Use the tool's compile action for the selected application. Wait for the operation to finish before restarting Steam.</p></div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Confirm the success message</h3><p>The screenshot below shows the expected confirmation: <strong>“Compiled 1 Lua scripts, will take effect after Steam restarts.”</strong></p>${guideImage(GUIDE_IMAGES.toast, 'Confirmation toast saying Compiled 1 Lua scripts, will take effect after Steam restarts.', 'guide-wide')}</div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">05</span><span class="steam-fold-title">Restart Steam &amp; finish</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card"><div class="steam-step-number">1</div><div><h3>Fully restart Steam</h3><p>Exit Steam completely, then launch it again. The compilation notice specifically says the Lua scripts take effect after Steam restarts.</p></div></article>
        <article class="steam-step-card"><div class="steam-step-number">2</div><div><h3>Check the result</h3><p>After Steam has restarted, open the relevant game and verify that the installed/compiled setup is available.</p></div></article>
      </div></details>
    </div>
    <div class="steam-tutorial-note"><strong>Screenshot guide</strong><span>The images above are placed beside the exact step they illustrate. The App ID example is only an example—use the App ID for the game you actually selected.</span></div>
  `;
  return section;
}

function mountTutorial() {
  const grid = document.querySelector('.applications-grid');
  if (!grid || document.getElementById(TUTORIAL_ID)) return;
  const page = grid.closest('.page');
  if (!page) return;
  page.insertBefore(createTutorial(), grid);
}

function observeApplicationsPage() {
  mountTutorial();
  const observer = new MutationObserver(() => mountTutorial());
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeApplicationsPage, { once: true });
  else observeApplicationsPage();
}
