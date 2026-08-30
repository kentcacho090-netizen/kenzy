// Steam Games folder — foldable + password (case-sensitive).
const GUIDE_ID = 'kenzy-steam-game-guide';
const STEAM_KEY = 'Franciskent999@';
const STEAM_UNLOCK_STORAGE = 'kenzy-steam-unlocked-v1';

function isUnlocked() {
  try {
    return localStorage.getItem(STEAM_UNLOCK_STORAGE) === '1';
  } catch {
    return false;
  }
}

function setUnlocked(value) {
  try {
    if (value) localStorage.setItem(STEAM_UNLOCK_STORAGE, '1');
    else localStorage.removeItem(STEAM_UNLOCK_STORAGE);
  } catch {
    // ignore
  }
}

function createSteamIconSvg() {
  return `
    <svg class="sg-steam-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1b2838"/>
      <path fill="#66c0f4" d="M8.5 14.2c-.9 0-1.7.5-2.1 1.2L4 14.6v2.2l2.3 1.1c.4.7 1.2 1.2 2.1 1.2 1.4 0 2.5-1.1 2.5-2.5s-1.1-2.4-2.4-2.4zm0 3.6c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2z"/>
      <path fill="#c7d5e0" d="M18.2 7.2c-1.8 0-3.3 1.5-3.3 3.3 0 .3 0 .5.1.8l-2.6 1.8c-.4-.2-.8-.3-1.2-.3-1.5 0-2.7 1.2-2.7 2.7 0 .2 0 .4.1.6l2.4 1.1c.4.8 1.2 1.3 2.1 1.3 1.3 0 2.4-1.1 2.4-2.4 0-.2 0-.4-.1-.6l2.5-1.7c.4.2.9.3 1.3.3 1.8 0 3.3-1.5 3.3-3.3s-1.5-3.3-3.3-3.3zm-5.6 9.2c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm5.6-5.9c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8z"/>
    </svg>
  `;
}

function buildGuideHtml() {
  const unlocked = isUnlocked();
  return `
    <article class="steam-guide-card application-card" id="${GUIDE_ID}">
      <div class="sg-folder">
        <div class="sg-folder-head" data-sg-toggle role="button" tabindex="0" aria-expanded="false">
          <div class="sg-folder-left">
            ${createSteamIconSvg()}
            <div>
              <span>Steam Games</span>
              <small>SteamTools setup & depot install guide</small>
            </div>
          </div>
          <span class="sg-chevron" data-sg-chevron>▾</span>
        </div>
        <div class="sg-folder-body" data-sg-body hidden>
          ${unlocked ? buildUnlockedContent() : buildLockBox()}
        </div>
      </div>
    </article>
  `;
}

function buildLockBox() {
  return `
    <div class="sg-lock-box">
      <p>This folder is locked. Enter the password to unlock the Steam game install tutorial.</p>
      <input class="sg-key-input" type="password" data-sg-key placeholder="Password" autocomplete="off" />
      <button class="button primary sg-unlock-btn" type="button" data-sg-unlock>Unlock</button>
      <div class="sg-lock-error" data-sg-error hidden></div>
    </div>
  `;
}

function buildUnlockedContent() {
  return `
    <div class="steam-guide-body">

      <section>
        <div class="eyebrow">INSTALL</div>
        <h3>1. Install SteamTools</h3>
        <ol class="sg-steps">
          <li>Download <strong>SteamTools</strong> from the official site using the button below.</li>
          <li>Run the installer and complete setup.</li>
          <li>Launch SteamTools. You should see a floating Steam logo window on your desktop (see image below).</li>
        </ol>
        <a class="download-button sg-download-btn" href="https://steamtools.app/" target="_blank" rel="noreferrer">Download SteamTools ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-download-btn" style="margin:12px;height:48px;border-radius:24px;background:#a855f7;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;">Download Setup (Recommended)</div>
            <figcaption>Click the purple Download Setup button on steamtools.app</figcaption>
          </figure>
          <figure class="sg-fig">
            <div class="sg-mock" style="margin:12px;height:80px;border-radius:12px;background:#1b2838;color:#66c0f4;display:flex;align-items:center;justify-content:center;font-weight:600;gap:10px;">
              <span style="font-size:28px;">◎</span> Floating SteamTools window
            </div>
            <figcaption>After launch, the floating Steam logo should appear on screen</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">PICKING GAMES</div>
        <h3>2. Find the App ID on SteamDB</h3>
        <ol class="sg-steps">
          <li>Go to <a href="https://steamdb.info/" target="_blank" rel="noreferrer"><strong>SteamDB</strong></a> (Database of everything on Steam).</li>
          <li>Search for the game you want.</li>
          <li>Open the game page and copy the <strong>App ID</strong>.</li>
        </ol>
        <a class="download-button" href="https://steamdb.info/" target="_blank" rel="noreferrer">Open SteamDB ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-appid"><span class="sg-label">App ID</span><span class="sg-value">1778820</span></div>
            <figcaption>Copy the App ID shown on the game page (example: 1778820)</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">DOWNLOAD LUA</div>
        <h3>3. Generate the Lua on DepotBox</h3>
        <ol class="sg-steps">
          <li>Open <a href="https://depotbox.org/" target="_blank" rel="noreferrer"><strong>DepotBox</strong></a> (Steam Depot Generator).</li>
          <li>Paste the App ID into the search field and press <strong>Search</strong>.</li>
          <li>Select your game from the results.</li>
          <li>Download the generated <strong>.lua</strong> file.</li>
        </ol>
        <a class="download-button" href="https://depotbox.org/" target="_blank" rel="noreferrer">Open DepotBox ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-search">e.g., Half-Life or AppID 70</div>
            <figcaption>Enter the App ID in the DepotBox search box</figcaption>
          </figure>
          <figure class="sg-fig">
            <div class="sg-mock sg-toast">Compiled 1 Lua scripts</div>
            <figcaption>After download you should see a confirmation that the Lua was compiled</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">APPLY & RESTART</div>
        <h3>4. Load the files into SteamTools</h3>
        <ol class="sg-steps">
          <li>If the download is a ZIP, extract it first.</li>
          <li>Select all extracted files and drag them onto the floating SteamTools window at once.</li>
          <li>Right-click the floating SteamTools window and choose <strong>Restart Steam</strong>.</li>
          <li>Steam will restart. The game should now appear in your library — enjoy.</li>
        </ol>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock" style="margin:12px;height:72px;border-radius:12px;background:#161820;color:#e6e6eb;display:flex;align-items:center;justify-content:center;font-weight:600;padding:0 16px;text-align:center;">Drag .lua files → floating SteamTools → Restart Steam</div>
            <figcaption>Drag the Lua files onto the floating window, then restart Steam</figcaption>
          </figure>
        </div>
      </section>

      <section class="sg-lock-again">
        <button class="button secondary" type="button" data-sg-lock>Lock folder again</button>
      </section>

    </div>
  `;
}

function wireCard(card) {
  if (!card || card.dataset.sgWired === '1') return;
  card.dataset.sgWired = '1';

  const head = card.querySelector('[data-sg-toggle]');
  const body = card.querySelector('[data-sg-body]');
  const chevron = card.querySelector('[data-sg-chevron]');

  function toggle() {
    const open = body.hasAttribute('hidden');
    if (open) body.removeAttribute('hidden');
    else body.setAttribute('hidden', '');
    if (chevron) chevron.classList.toggle('open', open);
    if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (head) {
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }

  card.addEventListener('click', (e) => {
    const unlockBtn = e.target.closest('[data-sg-unlock]');
    const lockBtn = e.target.closest('[data-sg-lock]');

    if (unlockBtn) {
      const input = card.querySelector('[data-sg-key]');
      const err = card.querySelector('[data-sg-error]');
      const value = (input && input.value) || '';
      if (value === STEAM_KEY) {
        setUnlocked(true);
        if (body) body.innerHTML = buildUnlockedContent();
      } else if (err) {
        err.hidden = false;
        err.textContent = 'Wrong password.';
      }
      return;
    }

    if (lockBtn) {
      setUnlocked(false);
      if (body) body.innerHTML = buildLockBox();
    }
  });
}

function injectSteamGuide() {
  const existing = document.getElementById(GUIDE_ID);
  if (existing) {
    wireCard(existing);
    return;
  }

  const grid =
    document.querySelector('.applications-grid') ||
    document.querySelector('[class*="applications"]') ||
    document.querySelector('main .page');

  if (!grid) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildGuideHtml().trim();
  const card = wrapper.firstElementChild;
  if (!card) return;

  grid.appendChild(card);
  wireCard(card);
}

function startSteamGuide() {
  injectSteamGuide();

  const observer = new MutationObserver(() => {
    injectSteamGuide();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 60000);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSteamGuide);
  } else {
    startSteamGuide();
  }
}
