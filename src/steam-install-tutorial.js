const TUTORIAL_ID = 'kenzy-steam-install-tutorial';

const STEAMTOOLS_URL = 'https://steamtools.games/install';
const STEAMDB_URL = 'https://steamdb.info/';
const DEPOTBOX_URL = 'https://depotbox.org/';

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
        <p>A compact, foldable guide so the Applications page stays clean.</p>
      </div>
      <div class="steam-tutorial-icon" aria-hidden="true">◉</div>
    </div>

    <div class="steam-folds">
      <details class="steam-fold" open>
        <summary>
          <span class="steam-fold-number">01</span>
          <span class="steam-fold-title">Install section</span>
          <span class="steam-fold-chevron">⌄</span>
        </summary>
        <div class="steam-fold-content">
          <article class="steam-step-card">
            <div class="steam-step-number">1</div>
            <div>
              <h3>Download SteamTools</h3>
              <p>To set up the required desktop tool, open SteamTools and download the installer from its download page. Click the download button provided there.</p>
              <a class="download-button" href="${STEAMTOOLS_URL}" target="_blank" rel="noopener noreferrer">Open SteamTools ↗</a>
            </div>
          </article>

          <article class="steam-step-card">
            <div class="steam-step-number">2</div>
            <div>
              <h3>Install and launch it</h3>
              <p>Install SteamTools, launch it, and keep it running alongside Steam. After it starts, you should see its floating interface available on your desktop.</p>
              <div class="steam-floating-preview" aria-label="Floating SteamTools interface preview">
                <div class="steam-floating-bar"><span></span><strong>SteamTools</strong><i>−</i></div>
                <div class="steam-floating-body"><b>Steam</b><small>Floating tool is running</small><em>● Connected</em></div>
              </div>
            </div>
          </article>
        </div>
      </details>

      <details class="steam-fold">
        <summary>
          <span class="steam-fold-number">02</span>
          <span class="steam-fold-title">Picking games</span>
          <span class="steam-fold-chevron">⌄</span>
        </summary>
        <div class="steam-fold-content">
          <article class="steam-step-card">
            <div class="steam-step-number">1</div>
            <div>
              <h3>Find the game on SteamDB</h3>
              <p>Open SteamDB and search for the game you want. SteamDB provides detailed information for Steam applications.</p>
              <a class="download-button secondary-link" href="${STEAMDB_URL}" target="_blank" rel="noopener noreferrer">Open SteamDB ↗</a>
            </div>
          </article>

          <article class="steam-step-card">
            <div class="steam-step-number">2</div>
            <div>
              <h3>Copy the App ID</h3>
              <p>Open the game's SteamDB page and locate its App ID. Copy that number for the next step.</p>
              <div class="steam-appid-preview"><span>App ID</span><strong>1778820</strong></div>
            </div>
          </article>

          <article class="steam-step-card">
            <div class="steam-step-number">3</div>
            <div>
              <h3>Open DepotBox</h3>
              <p>Open DepotBox and use its search field to look up the App ID. The site accepts a game name or Steam App ID.</p>
              <a class="download-button secondary-link" href="${DEPOTBOX_URL}" target="_blank" rel="noopener noreferrer">Open DepotBox ↗</a>
            </div>
          </article>

          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">4</div>
            <div>
              <h3>Continue with the game's official Steam installation</h3>
              <p>Once you have identified the game, return to its official Steam store page and use Steam's normal purchase, redemption, and installation flow. This keeps the game files tied to the Steam account that owns the game.</p>
            </div>
          </article>
        </div>
      </details>

      <details class="steam-fold">
        <summary>
          <span class="steam-fold-number">03</span>
          <span class="steam-fold-title">Final installation</span>
          <span class="steam-fold-chevron">⌄</span>
        </summary>
        <div class="steam-fold-content">
          <article class="steam-step-card">
            <div class="steam-step-number">1</div>
            <div>
              <h3>Open the Steam library</h3>
              <p>Select the game in your Steam Library and choose <strong>Install</strong>.</p>
            </div>
          </article>
          <article class="steam-step-card">
            <div class="steam-step-number">2</div>
            <div>
              <h3>Choose the install location</h3>
              <p>Select your Steam Library drive or folder, confirm the storage requirements, and start the installation.</p>
            </div>
          </article>
          <article class="steam-step-card steam-step-wide">
            <div class="steam-step-number">3</div>
            <div>
              <h3>Launch the game</h3>
              <p>When Steam finishes downloading and installing the files, select <strong>Play</strong> from your Library.</p>
            </div>
          </article>
        </div>
      </details>
    </div>

    <div class="steam-tutorial-note">
      <strong>App ID</strong>
      <span>An App ID uniquely identifies a Steam application. SteamDB can help you find it quickly.</span>
    </div>
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeApplicationsPage, { once: true });
  } else {
    observeApplicationsPage();
  }
}
