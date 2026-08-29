const MENU_ID = 'kenzy-side-menu';
const BACKDROP_ID = 'kenzy-menu-backdrop';

function closeMenu() {
  document.getElementById(MENU_ID)?.classList.remove('open');
  document.getElementById(BACKDROP_ID)?.classList.remove('open');
}

function openMenu() {
  document.getElementById(MENU_ID)?.classList.add('open');
  document.getElementById(BACKDROP_ID)?.classList.add('open');
}

function showComingSoon(title, description) {
  closeMenu();
  const existing = document.getElementById('kenzy-coming-soon');
  existing?.remove();
  const modal = document.createElement('div');
  modal.id = 'kenzy-coming-soon';
  modal.className = 'kenzy-modal-backdrop';
  modal.innerHTML = `
    <div class="kenzy-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <button class="kenzy-modal-close" aria-label="Close">×</button>
      <div class="kenzy-modal-icon">✦</div>
      <div class="eyebrow">KENZY TOOL</div>
      <h3>${title}</h3>
      <p>${description}</p>
      <button class="button primary kenzy-modal-action">Got it</button>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.kenzy-modal-close').addEventListener('click', close);
  modal.querySelector('.kenzy-modal-action').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
}

function clickQuizMaker() {
  closeMenu();
  const create = Array.from(document.querySelectorAll('button')).find((button) =>
    button.textContent?.trim().includes('Create a quiz')
  );
  create?.click();
}

function toggleTheme() {
  closeMenu();
  const themeButton = document.querySelector('.ghost-icon');
  themeButton?.click();
}

function mountMenu() {
  if (document.getElementById(MENU_ID)) return;

  const backdrop = document.createElement('div');
  backdrop.id = BACKDROP_ID;
  backdrop.className = 'kenzy-menu-backdrop';
  backdrop.addEventListener('click', closeMenu);
  document.body.appendChild(backdrop);

  const toggle = document.createElement('button');
  toggle.className = 'kenzy-menu-toggle';
  toggle.setAttribute('aria-label', 'Open Kenzy menu');
  toggle.setAttribute('title', 'Open menu');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  toggle.addEventListener('click', openMenu);
  document.body.appendChild(toggle);

  const menu = document.createElement('aside');
  menu.id = MENU_ID;
  menu.className = 'kenzy-side-menu';
  menu.innerHTML = `
    <div class="kenzy-menu-head">
      <div>
        <div class="eyebrow">WORKSPACE</div>
        <h3>Kenzy</h3>
      </div>
      <button class="kenzy-menu-close" aria-label="Close menu">×</button>
    </div>

    <nav class="kenzy-menu-nav">
      <button class="kenzy-menu-item active" data-action="home">
        <span class="menu-icon">⌂</span><span><strong>Home</strong><small>Your Kenzy workspace</small></span>
      </button>

      <div class="kenzy-menu-section">STUDY TOOLS</div>
      <button class="kenzy-menu-item" data-action="quiz">
        <span class="menu-icon">✦</span><span><strong>Quiz Maker</strong><small>Turn PDFs & images into quizzes</small></span>
      </button>
      <button class="kenzy-menu-item" data-action="flashcards">
        <span class="menu-icon">▤</span><span><strong>Flashcards</strong><small>Review with quick cards</small></span><span class="menu-soon">Soon</span>
      </button>
      <button class="kenzy-menu-item" data-action="notes">
        <span class="menu-icon">▣</span><span><strong>Study Notes</strong><small>Organize material and summaries</small></span><span class="menu-soon">Soon</span>
      </button>
      <button class="kenzy-menu-item" data-action="qa">
        <span class="menu-icon">?</span><span><strong>AI Q&amp;A</strong><small>Ask questions about your material</small></span><span class="menu-soon">Soon</span>
      </button>

      <div class="kenzy-menu-section">SETTINGS</div>
      <button class="kenzy-menu-item" data-action="appearance">
        <span class="menu-icon">☾</span><span><strong>Appearance</strong><small>Switch light or dark mode</small></span>
      </button>
      <button class="kenzy-menu-item" data-action="data">
        <span class="menu-icon">◫</span><span><strong>Saved quizzes</strong><small>Manage quizzes on this device</small></span>
      </button>
    </nav>

    <div class="kenzy-menu-footer">
      <span class="brand-mark">K</span>
      <div><strong>Kenzy</strong><small>Study smarter, one tool at a time.</small></div>
    </div>`;
  document.body.appendChild(menu);

  menu.querySelector('.kenzy-menu-close').addEventListener('click', closeMenu);
  menu.querySelectorAll('.kenzy-menu-item').forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'home') {
        closeMenu();
        const brand = document.querySelector('.brand');
        brand?.click();
      } else if (action === 'quiz') {
        clickQuizMaker();
      } else if (action === 'appearance') {
        toggleTheme();
      } else if (action === 'data') {
        closeMenu();
        const manage = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Your quizzes'));
        if (manage) manage.click();
        else showComingSoon('Saved quizzes', 'Create a quiz first and your saved quizzes will appear here.');
      } else if (action === 'flashcards') {
        showComingSoon('Flashcards', 'This branch is reserved for a dedicated flashcard workspace.');
      } else if (action === 'notes') {
        showComingSoon('Study Notes', 'A notes workspace is planned here so you can keep your study material organized.');
      } else if (action === 'qa') {
        showComingSoon('AI Q&A', 'This branch will let you ask Kenzy questions about uploaded study material.');
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMenu);
} else {
  mountMenu();
}
