// Steam Game Install tutorial for Kenzy Applications page.

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
        <span>Steam Game Install Tutorial</span>
        <small>Step-by-step setup using SteamTools and DepotBox</small>
      </div>
      <span class="ai-badge">STEAM</span>
    </div>
    <div class="steam-guide-body">

      <section>
        <div class="eyebrow">INSTALL</div>
        <h3>1. Install SteamTools</h3>
        <p>Download SteamTools using the official setup button, install it, then run the application. After it launches you should see the floating SteamTools window on your screen.</p>
        <a class="download-button" href="https://steamtools.app/" target="_blank" rel="noreferrer">Download SteamTools ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-download-btn">↓  Download Setup (Recommended)</div>
            <figcaption>Official download button — click this to download</figcaption>
          </figure>
          <figure class="sg-fig">
            <div class="sg-mock sg-steam-logo"><span class="sg-steam-circle"></span></div>
            <figcaption>Floating SteamTools window after launch</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">PICKING GAMES</div>
        <h3>2. Find the game App ID</h3>
        <p>Open SteamDB, search for the game you want, open its page, then copy the App ID (shown next to “App ID”).</p>
        <a class="download-button" href="https://steamdb.info/" target="_blank" rel="noreferrer">Open SteamDB ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-appid"><span class="sg-label">App ID ?</span><span class="sg-value">1778820</span></div>
            <figcaption>Copy this App ID from the game page</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">DOWNLOAD LUA</div>
        <h3>3. Generate and download the Lua file</h3>
        <p>Go to DepotBox, paste the App ID into the search field, and press Search. When your game appears, click it and download the Lua file.</p>
        <a class="download-button" href="https://depotbox.org/" target="_blank" rel="noreferrer">Open DepotBox ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-search">e.g., Half-Life or AppID 70</div>
            <figcaption>Paste the App ID here and search</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">APPLY &amp; RESTART</div>
        <h3>4. Load the files into SteamTools</h3>
        <p>If the download is a ZIP, extract it first. Select all files and drag them onto the floating SteamTools window. Right-click the floating window → Restart Steam. You should see a confirmation that the Lua scripts were compiled and will take effect after Steam restarts. Then enjoy the game.</p>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-toast">Compiled 1 Lua scripts, will take effect after Steam restarts.</div>
            <figcaption>Success — Lua scripts compiled, restart Steam</figcaption>
          </figure>
        </div>
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
