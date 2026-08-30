const TUTORIAL_ID = 'kenzy-steam-install-tutorial';

const STEAMTOOLS_URL = 'https://steamtools.net/';
const STEAMDB_URL = 'https://steamdb.info/';

// Screenshot-derived guide visuals supplied by the user, kept inline so the guide has no extra asset dependencies.
const GUIDE_IMAGES = {
  search: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 151"><rect width="1536" height="151" fill="#15151b"/><rect x="18" y="52" width="1500" height="54" rx="12" fill="#2b2b33" stroke="#383841"/><text x="40" y="86" fill="#85858e" font-family="Arial,sans-serif" font-size="24">e.g., Half-Life or AppID 70</text></svg>`),
  logo: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1260"><rect width="1536" height="1260" fill="#000"/><rect x="390" y="300" width="756" height="660" rx="150" fill="#151820"/><circle cx="768" cy="630" r="255" fill="#eee"/><circle cx="880" cy="525" r="82" fill="#242832" stroke="#bbb" stroke-width="14"/><circle cx="880" cy="525" r="35" fill="#333"/><path d="M560 610 L760 720 L835 630" fill="none" stroke="#242832" stroke-width="75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="760" cy="720" r="55" fill="#eee" stroke="#242832" stroke-width="25"/></svg>`),
  download: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 252"><rect width="1536" height="252" fill="#172338"/><rect x="65" y="42" width="1406" height="168" rx="30" fill="#9a2fe9"/><path d="M768 78v74m0 0-25-25m25 25 25-25M731 164h74" fill="none" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><text x="810" y="157" fill="white" font-family="Arial,sans-serif" font-size="38" font-weight="700">Download Setup (Recommended)</text></svg>`),
  appid: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 143"><rect width="1536" height="143" fill="#11141b"/><rect x="32" y="20" width="1472" height="103" rx="10" fill="#14171e" stroke="#30343d" stroke-width="3"/><line x1="585" y1="20" x2="585" y2="123" stroke="#30343d" stroke-width="3"/><text x="55" y="84" fill="#f0f0f2" font-family="Arial,sans-serif" font-size="31" font-weight="700">App ID</text><circle cx="194" cy="73" r="15" fill="none" stroke="#aaa" stroke-width="3"/><text x="188" y="80" fill="#aaa" font-family="Arial,sans-serif" font-size="20">?</text><text x="615" y="84" fill="#f0f0f2" font-family="Arial,sans-serif" font-size="31" font-weight="700">1778820</text></svg>`),
  toast: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 168"><rect width="1536" height="168" fill="#000"/><rect x="0" y="26" width="1536" height="116" rx="45" fill="#29292d"/><text x="54" y="100" fill="#f5f5f7" font-family="Arial,sans-serif" font-size="40">Compiled 1 Lua scripts, will take effect after Steam restarts.</text></svg>`)
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
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Click “Download Setup (Recommended)”</h3><p>On the download page, use the purple <strong>Download Setup (Recommended)</strong> button shown below.</p>${guideImage(GUIDE_IMAGES.download, 'Screenshot reference for the Download Setup (Recommended) button', 'guide-wide')}</div></article>
        <article class="steam-step-card"><div class="steam-step-number">3</div><div><h3>Install SteamTools</h3><p>Run the downloaded installer and complete the installation. Then launch SteamTools.</p></div></article>
        <article class="steam-step-card"><div class="steam-step-number">4</div><div><h3>Wait for Steam to appear</h3><p>When Steam starts or restarts, you may briefly see the Steam logo while the client loads.</p>${guideImage(GUIDE_IMAGES.logo, 'Steam loading logo screenshot reference', 'guide-logo')}</div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">02</span><span class="steam-fold-title">Find the game's App ID</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">1</div><div><h3>Search for the game</h3><p>Open SteamDB and search for the game you want. The search field accepts a game name or App ID.</p><a class="download-button secondary-link" href="${STEAMDB_URL}" target="_blank" rel="noopener noreferrer">Open SteamDB ↗</a>${guideImage(GUIDE_IMAGES.search, 'Search field screenshot reference showing e.g., Half-Life or AppID 70', 'guide-wide')}</div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Open the game entry and locate App ID</h3><p>Open the matching application page and look for the <strong>App ID</strong> field.</p>${guideImage(GUIDE_IMAGES.appid, 'App ID screenshot reference showing 1778820', 'guide-wide')}</div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">3</div><div><h3>Copy the App ID</h3><p>Copy the number shown next to <strong>App ID</strong>. The screenshot example shows <strong>1778820</strong>; your game's number will be different.</p></div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">03</span><span class="steam-fold-title">Enter the App ID</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">1</div><div><h3>Paste the App ID into the search box</h3><p>Return to the tool and enter the App ID you copied. Follow the same field layout shown below.</p>${guideImage(GUIDE_IMAGES.search, 'Search box screenshot reference', 'guide-wide')}</div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Select the matching game</h3><p>Double-check the title and App ID before continuing so you work with the intended Steam application.</p></div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">04</span><span class="steam-fold-title">Compile the Lua script</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">1</div><div><h3>Compile the selected Lua script</h3><p>Use the tool's compile action for the selected application and wait for it to finish.</p></div></article>
        <article class="steam-step-card steam-step-wide"><div class="steam-step-number">2</div><div><h3>Confirm the success message</h3><p>Use the screenshot below as the visual reference for a successful compilation.</p>${guideImage(GUIDE_IMAGES.toast, 'Compilation success toast screenshot reference', 'guide-wide')}</div></article>
      </div></details>
      <details class="steam-fold"><summary><span class="steam-fold-number">05</span><span class="steam-fold-title">Restart Steam &amp; finish</span><span class="steam-fold-chevron">⌄</span></summary><div class="steam-fold-content">
        <article class="steam-step-card"><div class="steam-step-number">1</div><div><h3>Fully restart Steam</h3><p>Exit Steam completely, then launch it again. The compilation message says the Lua scripts take effect after Steam restarts.</p></div></article>
        <article class="steam-step-card"><div class="steam-step-number">2</div><div><h3>Check the result</h3><p>After Steam has restarted, open the relevant game and verify that the setup is available.</p></div></article>
      </div></details>
    </div>
    <div class="steam-tutorial-note"><strong>Screenshot guide</strong><span>The visual references are positioned beside the exact actions they illustrate. The App ID shown in the reference is only an example.</span></div>
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
