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
        <small>Follow each step in order</small>
      </div>
      <span class="ai-badge">STEAM</span>
    </div>
    <div class="steam-guide-body">

      <section>
        <div class="eyebrow">STEP 1 · INSTALL</div>
        <h3>Download and install SteamTools</h3>
        <ol class="sg-steps">
          <li>Open the download page using the button below.</li>
          <li>Click <strong>Download Setup (Recommended)</strong>.</li>
          <li>Run the installer and finish the setup.</li>
          <li>Launch SteamTools. A floating SteamTools window should appear on your screen.</li>
        </ol>
        <a class="download-button" href="https://www.steamtools.net/download" target="_blank" rel="noreferrer">Download SteamTools ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-download-btn">↓  Download Setup (Recommended)</div>
            <figcaption>Click this button on the download page</figcaption>
          </figure>
          <figure class="sg-fig">
            <div class="sg-mock sg-steam-logo"><span class="sg-steam-circle"></span></div>
            <figcaption>Floating window you should see after launching SteamTools</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">STEP 2 · PICK THE GAME</div>
        <h3>Find the game App ID on SteamDB</h3>
        <ol class="sg-steps">
          <li>Open SteamDB using the button below.</li>
          <li>Search for the exact game name you want.</li>
          <li>Open the correct game page.</li>
          <li>Copy the number next to <strong>App ID</strong> (example shown below).</li>
        </ol>
        <a class="download-button" href="https://steamdb.info/" target="_blank" rel="noreferrer">Open SteamDB ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-appid"><span class="sg-label">App ID ?</span><span class="sg-value">1778820</span></div>
            <figcaption>Copy this App ID number</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">STEP 3 · DOWNLOAD LUA</div>
        <h3>Generate the Lua file on DepotBox</h3>
        <ol class="sg-steps">
          <li>Open DepotBox using the button below.</li>
          <li>Paste the App ID into the search field.</li>
          <li>Press <strong>Search</strong>.</li>
          <li>Click your game in the results.</li>
          <li>Download the Lua file (or ZIP if offered).</li>
        </ol>
        <a class="download-button" href="https://depotbox.org/" target="_blank" rel="noreferrer">Open DepotBox ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-search">e.g., Half-Life or AppID 70</div>
            <figcaption>Paste the App ID here, then press Search</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">STEP 4 · APPLY &amp; RESTART</div>
        <h3>Load the files into SteamTools and restart</h3>
        <ol class="sg-steps">
          <li>If the download is a ZIP, extract it first so you can see the files inside.</li>
          <li>Select <strong>all</strong> the extracted files.</li>
          <li>Drag them onto the floating SteamTools window at once.</li>
          <li>Right-click the floating SteamTools window → choose <strong>Restart Steam</strong>.</li>
          <li>Wait for the confirmation message. The game is then ready to play.</li>
        </ol>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-toast">Compiled 1 Lua scripts, will take effect after Steam restarts.</div>
            <figcaption>You should see a message like this after restart</figcaption>
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
