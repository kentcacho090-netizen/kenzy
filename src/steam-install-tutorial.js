const TUTORIAL_ID = 'kenzy-steam-install-tutorial';

const STEAMTOOLS_URL = 'https://steamtools.net/';
const STEAMDB_URL = 'https://steamdb.info/';
const DEPOTBOX_URL = 'https://depotbox.org/';

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
        <h2 id="steam-tutorial-title">Steam Game Install Tutorial</h2>
        <p>Follow the sections in order. Each section is foldable so the Applications page stays clean and easy to navigate.</p>
      </div>
      <div class="steam-tutorial-icon" aria-hidden="true">◉</div>
    </div>

    <div class="steam-folds">
      <details class="steam-fold">
        <summary><span class="steam-fold-number">01</span><span class="steam-fold-title">Install section</span><span class="steam-fold-chevron">⌄</span></summary>
        <div class="steam-fold-content">
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">1</div>
            <div>
              <h3>Install SteamTools</h3>
              <p>First, open the <strong>SteamTools</strong> website using the button below. On the website, click <strong>Download Setup (Recommended)</strong> to download the installer.</p>
              <a class="download-button" href="${STEAMTOOLS_URL}" target="_blank" rel="noopener noreferrer">Open SteamTools ↗</a>
              ${guideImage(GUIDE_IMAGES.download, 'Screenshot showing the Download Setup (Recommended) button', 'guide-wide')}
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">2</div>
            <div>
              <h3>Install and run SteamTools</h3>
              <p>After the download is complete, install SteamTools and run it. When it is running, you should see the <strong>floating Steam interface</strong> shown in the screenshot below.</p>
              ${guideImage(GUIDE_IMAGES.logo, 'Screenshot reference showing the floating Steam interface', 'guide-logo')}
            </div>
          </article>
        </div>
      </details>

      <details class="steam-fold">
        <summary><span class="steam-fold-number">02</span><span class="steam-fold-title">Picking games</span><span class="steam-fold-chevron">⌄</span></summary>
        <div class="steam-fold-content">
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">1</div>
            <div>
              <h3>Search for the game on SteamDB</h3>
              <p>Open <strong>SteamDB — Database of everything on Steam</strong> and search for the game you want.</p>
              <a class="download-button secondary-link" href="${STEAMDB_URL}" target="_blank" rel="noopener noreferrer">Open SteamDB ↗</a>
              ${guideImage(GUIDE_IMAGES.search, 'Search field reference showing a game name or AppID can be entered', 'guide-wide')}
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">2</div>
            <div>
              <h3>Open the game and copy its App ID</h3>
              <p>After finding the game, open its page and locate the <strong>App ID</strong>. Copy the number shown there before continuing.</p>
              ${guideImage(GUIDE_IMAGES.appid, 'App ID screenshot reference showing the example 1778820', 'guide-wide')}
              <p><strong>Example:</strong> the screenshot shows <strong>1778820</strong>. Your game will have a different App ID.</p>
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">3</div>
            <div>
              <h3>Open DepotBox</h3>
              <p>Open <strong>DepotBox — Steam Depot Generator</strong> using the button below. Enter the App ID you copied earlier and press <strong>Search</strong>.</p>
              <a class="download-button secondary-link" href="${DEPOTBOX_URL}" target="_blank" rel="noopener noreferrer">Open DepotBox ↗</a>
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">4</div>
            <div>
              <h3>Find your game and download the Lua file</h3>
              <p>After searching, you should see your game in the results. Click the game, then download the <strong>Lua</strong> file provided for it.</p>
            </div>
          </article>
        </div>
      </details>

      <details class="steam-fold">
        <summary><span class="steam-fold-number">03</span><span class="steam-fold-title">Add files &amp; restart Steam</span><span class="steam-fold-chevron">⌄</span></summary>
        <div class="steam-fold-content">
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">1</div>
            <div>
              <h3>Prepare the downloaded files</h3>
              <p>After downloading the files, locate them on your computer. If the download is contained in a ZIP file, extract it first. Then select all of the downloaded files together.</p>
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">2</div>
            <div>
              <h3>Drag the files into the floating Steam interface</h3>
              <p>With SteamTools running and the floating Steam interface visible, drag all of the selected files into the floating Steam interface at once.</p>
              ${guideImage(GUIDE_IMAGES.logo, 'Floating Steam interface reference', 'guide-logo')}
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">3</div>
            <div>
              <h3>Restart Steam</h3>
              <p>Right-click the floating application and restart Steam. After restarting, the changes should take effect.</p>
              ${guideImage(GUIDE_IMAGES.toast, 'Screenshot showing that the Lua scripts take effect after Steam restarts', 'guide-wide')}
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">4</div>
            <div>
              <h3>Enjoy</h3>
              <p>Once Steam has restarted, open Steam and check that everything has loaded correctly.</p>
            </div>
          </article>
        </div>
      </details>
    </div>

    <div class="steam-tutorial-note"><strong>App ID example</strong><span>The number <strong>1778820</strong> in the reference image is an example only. Always use the App ID belonging to the game you selected.</span></div>
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
