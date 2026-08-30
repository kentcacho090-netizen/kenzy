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
    // ignore storage errors
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
              <small>Guides, App IDs & install tips</small>
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
      <p>This folder is locked. Enter the password to unlock Steam game guides.</p>
      <input class="sg-key-input" type="password" data-sg-key placeholder="Password" autocomplete="off" />
      <button class="button primary sg-unlock-btn" type="button" data-sg-unlock>Unlock</button>
      <div class="sg-lock-error" data-sg-error hidden></div>
    </div>
  `;
}

function buildUnlockedContent() {
  return `
    <section>
      <h3>How to find a Steam App ID</h3>
      <ol class="sg-steps">
        <li>Open the Steam store page for the game.</li>
        <li>Look at the URL — the number after <strong>/app/</strong> is the App ID.</li>
        <li>Example: <code>store.steampowered.com/app/<strong>730</strong>/</code> → App ID <strong>730</strong> (CS2).</li>
      </ol>
      <div class="steam-guide-images">
        <figure class="sg-fig">
          <div class="sg-mock sg-appid"><span class="sg-label">App ID</span><span class="sg-value">730</span></div>
          <figcaption>App ID appears in the store URL</figcaption>
        </figure>
      </div>
    </section>
    <section>
      <h3>Install a game by App ID</h3>
      <ol class="sg-steps">
        <li>In Steam, click the search bar at the top.</li>
        <li>Type <code>steam://install/APPID</code> (replace APPID with the number).</li>
        <li>Press Enter — Steam will open the install dialog for that game.</li>
      </ol>
      <div class="steam-guide-images">
        <figure class="sg-fig">
          <div class="sg-mock sg-search">steam://install/730</div>
          <figcaption>Paste the install protocol into Steam search</figcaption>
        </figure>
        <figure class="sg-fig">
          <div class="sg-mock sg-toast">Install dialog opened for App ID 730</div>
          <figcaption>Steam confirms the install request</figcaption>
        </figure>
      </div>
    </section>
    <section>
      <h3>Useful links</h3>
      <p>Keep these bookmarked when managing a large library.</p>
      <a class="download-button sg-download-btn" href="https://steamdb.info/" target="_blank" rel="noreferrer">SteamDB ↗</a>
      <div class="sg-lock-again">
        <button class="button secondary" type="button" data-sg-lock>Lock folder again</button>
      </div>
    </section>
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

  // Prefer the applications page grid when present
  const grid =
    document.querySelector('.applications-grid') ||
    document.querySelector('[class*="applications"]') ||
    document.querySelector('main .page');

  if (!grid) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildGuideHtml().trim();
  const card = wrapper.firstElementChild;
  if (!card) return;

  // Insert near other application cards if possible
  if (grid.classList && grid.classList.contains('applications-grid')) {
    grid.appendChild(card);
  } else {
    grid.appendChild(card);
  }
  wireCard(card);
}

function startSteamGuide() {
  injectSteamGuide();

  // Re-inject when the Applications page is navigated to (SPA)
  const observer = new MutationObserver(() => {
    injectSteamGuide();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Soft limit so we don't run forever
  setTimeout(() => observer.disconnect(), 60000);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSteamGuide);
  } else {
    startSteamGuide();
  }
}
