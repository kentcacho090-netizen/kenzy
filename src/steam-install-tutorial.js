const TUTORIAL_ID = 'kenzy-steam-install-tutorial';

const STEAM_DOWNLOAD_URL = 'https://store.steampowered.com/about/';
const STEAMDB_URL = 'https://steamdb.info/';

function createTutorial() {
  const section = document.createElement('section');
  section.id = TUTORIAL_ID;
  section.className = 'steam-tutorial';
  section.setAttribute('aria-labelledby', 'steam-tutorial-title');
  section.innerHTML = `
    <div class="steam-tutorial-header">
      <div>
        <div class="eyebrow">STEAM GAME INSTALLATION</div>
        <h2 id="steam-tutorial-title">Steam Game Install Tutorial</h2>
        <p>Follow these steps to find a game and install it through the official Steam client.</p>
      </div>
      <div class="steam-tutorial-icon" aria-hidden="true">◉</div>
    </div>

    <div class="steam-tutorial-grid">
      <article class="steam-tutorial-card">
        <div class="steam-step-number">01</div>
        <div>
          <h3>Install Steam</h3>
          <p>Download the Steam client from Valve's official website, install it, and sign in to your Steam account.</p>
          <a class="download-button" href="${STEAM_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer">Download Steam ↗</a>
        </div>
      </article>

      <article class="steam-tutorial-card">
        <div class="steam-step-number">02</div>
        <div>
          <h3>Find your game</h3>
          <p>Use SteamDB to search for the game you want. Open its listing to review its Steam information and App ID.</p>
          <a class="download-button secondary-link" href="${STEAMDB_URL}" target="_blank" rel="noopener noreferrer">Open SteamDB ↗</a>
        </div>
      </article>

      <article class="steam-tutorial-card">
        <div class="steam-step-number">03</div>
        <div>
          <h3>Install through Steam</h3>
          <p>Open the game's official Steam store page, purchase or redeem it when required, then choose <strong>Install</strong> in the Steam client.</p>
        </div>
      </article>

      <article class="steam-tutorial-card">
        <div class="steam-step-number">04</div>
        <div>
          <h3>Choose your install location</h3>
          <p>Select your Steam library drive or folder, confirm the required storage space, and wait for Steam to finish downloading.</p>
        </div>
      </article>

      <article class="steam-tutorial-card steam-tutorial-wide">
        <div class="steam-step-number">05</div>
        <div>
          <h3>Launch and manage the game</h3>
          <p>When installation finishes, select <strong>Play</strong> from your Steam library. Steam will also handle supported updates, files, and installation management.</p>
        </div>
      </article>
    </div>

    <div class="steam-tutorial-note">
      <strong>About App IDs</strong>
      <span>An App ID identifies a Steam application. SteamDB can display this information, but normal game installation should be completed through Steam.</span>
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
