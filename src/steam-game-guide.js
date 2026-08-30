// Steam Games folder — foldable + password (case-sensitive).
// Only appears on the Applications page (.applications-grid).
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
          <li>Open the official SteamTools download page and click the purple <strong>Download Setup (Recommended)</strong> button.</li>
          <li>Run the installer and finish setup.</li>
          <li>Launch SteamTools. A floating Steam logo should appear on your desktop (see image 2).</li>
        </ol>
        <a class="download-button sg-download-btn" href="https://www.steamtools.net/download" target="_blank" rel="noreferrer">Download SteamTools ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-img1" style="margin:12px;height:52px;border-radius:26px;background:#a855f7;color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;font-size:15px;box-shadow:0 4px 14px rgba(168,85,247,.4);">
              <span style="font-size:18px;line-height:1;">↓</span> Download Setup (Recommended)
            </div>
            <figcaption>Image 1 — Click this purple button on the SteamTools site</figcaption>
          </figure>
          <figure class="sg-fig">
            <div class="sg-mock sg-img2" style="margin:12px;height:100px;border-radius:12px;background:#0d0d0d;display:flex;align-items:center;justify-content:center;">
              <div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;border:2px solid #333;display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="#c7d5e0"/>
                  <path fill="#1b2838" d="M8.5 14.2c-.9 0-1.7.5-2.1 1.2L4 14.6v2.2l2.3 1.1c.4.7 1.2 1.2 2.1 1.2 1.4 0 2.5-1.1 2.5-2.5s-1.1-2.4-2.4-2.4zm0 3.6c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2z"/>
                  <path fill="#1b2838" d="M18.2 7.2c-1.8 0-3.3 1.5-3.3 3.3 0 .3 0 .5.1.8l-2.6 1.8c-.4-.2-.8-.3-1.2-.3-1.5 0-2.7 1.2-2.7 2.7 0 .2 0 .4.1.6l2.4 1.1c.4.8 1.2 1.3 2.1 1.3 1.3 0 2.4-1.1 2.4-2.4 0-.2 0-.4-.1-.6l2.5-1.7c.4.2.9.3 1.3.3 1.8 0 3.3-1.5 3.3-3.3s-1.5-3.3-3.3-3.3zm-5.6 9.2c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm5.6-5.9c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8z"/>
                </svg>
              </div>
            </div>
            <figcaption>Image 2 — Floating SteamTools logo that appears after you launch the app</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">PICKING GAMES</div>
        <h3>2. Find the App ID on SteamDB</h3>
        <ol class="sg-steps">
          <li>Open <a href="https://steamdb.info/" target="_blank" rel="noreferrer"><strong>SteamDB</strong></a> (database of everything on Steam).</li>
          <li>Search for the game you want.</li>
          <li>Open the game page and copy the <strong>App ID</strong> (see image 3).</li>
        </ol>
        <a class="download-button" href="https://steamdb.info/" target="_blank" rel="noreferrer">Open SteamDB ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-img3" style="margin:12px;height:48px;border-radius:10px;background:#161820;border:1px solid #2a2c36;display:flex;align-items:center;justify-content:space-between;padding:0 18px;color:#e6e6eb;font-size:14px;">
              <span style="color:#9698a5;font-weight:500;">App ID <span style="opacity:.6;">?</span></span>
              <span style="font-weight:700;letter-spacing:.3px;">1778820</span>
            </div>
            <figcaption>Image 3 — Copy this App ID number from the SteamDB game page</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <div class="eyebrow">DOWNLOAD LUA</div>
        <h3>3. Generate the Lua on DepotBox</h3>
        <ol class="sg-steps">
          <li>Open <a href="https://depotbox.org/" target="_blank" rel="noreferrer"><strong>DepotBox</strong></a> (Steam Depot Generator).</li>
          <li>Paste the App ID into the search field (image 4) and press <strong>Search</strong>.</li>
          <li>Select your game from the results and download the generated <strong>.lua</strong> file.</li>
          <li>You should see a confirmation toast: “Compiled 1 Lua scripts…” (image 5).</li>
        </ol>
        <a class="download-button" href="https://depotbox.org/" target="_blank" rel="noreferrer">Open DepotBox ↗</a>
        <div class="steam-guide-images">
          <figure class="sg-fig">
            <div class="sg-mock sg-img4" style="margin:12px;height:44px;border-radius:12px;background:#2a2c36;color:#7d808c;display:flex;align-items:center;padding:0 18px;font-size:13px;font-weight:500;">
              e.g., Half-Life or AppID 70
            </div>
            <figcaption>Image 4 — Paste the App ID into this DepotBox search box</figcaption>
          </figure>
          <figure class="sg-fig">
            <div class="sg-mock sg-img5" style="margin:12px;height:44px;border-radius:12px;background:#2a2c34;color:#e8e8ec;display:flex;align-items:center;justify-content:center;padding:0 16px;font-size:12.5px;font-weight:500;">
              Compiled 1 Lua scripts, will take effect after Steam restarts.
            </div>
            <figcaption>Image 5 — Confirmation after the Lua file is ready</figcaption>
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
          <li>Steam restarts. The game should appear in your library — enjoy.</li>
        </ol>
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

function isOnApplicationsPage() {
  // Only inject when the Applications page grid is in the DOM
  return !!document.querySelector('.applications-grid');
}

function removeSteamGuide() {
  const existing = document.getElementById(GUIDE_ID);
  if (existing) existing.remove();
}

function injectSteamGuide() {
  // Hard rule: never show outside Applications page
  if (!isOnApplicationsPage()) {
    removeSteamGuide();
    return;
  }

  const existing = document.getElementById(GUIDE_ID);
  if (existing) {
    // Make sure it still lives inside the applications grid
    const grid = document.querySelector('.applications-grid');
    if (grid && !grid.contains(existing)) {
      existing.remove();
    } else {
      wireCard(existing);
      return;
    }
  }

  const grid = document.querySelector('.applications-grid');
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
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSteamGuide);
  } else {
    startSteamGuide();
  }
}
