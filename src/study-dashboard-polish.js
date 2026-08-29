/* Adds a lightweight study dashboard to the existing Home page without changing React state. */
(function () {
  const QUIZ_STORAGE = 'kenzy-quizzes-v4';
  const NOTES_STORAGE = 'kenzy-notes-v1';

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }

  function addDashboard() {
    const home = document.querySelector('.home-page');
    if (!home || home.querySelector('.dashboard-polish')) return;

    const quizzes = read(QUIZ_STORAGE);
    const notes = read(NOTES_STORAGE);
    const attempts = quizzes.flatMap((quiz) => Array.isArray(quiz.attempts) ? quiz.attempts : []);
    const answered = attempts.reduce((sum, attempt) => sum + Number(attempt?.answers?.filter((answer) => answer >= 0)?.length || 0), 0);
    const correct = attempts.reduce((sum, attempt) => sum + Number(attempt?.correct || 0), 0);
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

    const wrap = document.createElement('section');
    wrap.className = 'dashboard-polish';
    wrap.setAttribute('aria-label', 'Study overview');

    const overview = document.createElement('div');
    overview.className = 'dashboard-polish-card';
    overview.innerHTML = `
      <div class="dashboard-polish-head">
        <div><div class="eyebrow">YOUR PROGRESS</div><h3>Study overview</h3><p>A quick look at the work saved on this device.</p></div>
      </div>
      <div class="dashboard-polish-stats">
        <div class="dashboard-polish-stat"><strong>${quizzes.length}</strong><span>Quizzes</span></div>
        <div class="dashboard-polish-stat"><strong>${notes.length}</strong><span>Notes</span></div>
        <div class="dashboard-polish-stat"><strong>${accuracy}%</strong><span>Answer accuracy</span></div>
      </div>`;

    const latestQuiz = quizzes.find((quiz) => quiz?.questions?.length);
    const latestNote = notes.find((note) => note?.content?.trim());
    const continueCard = document.createElement('div');
    continueCard.className = 'dashboard-polish-card';
    continueCard.innerHTML = `
      <div class="dashboard-polish-head">
        <div><div class="eyebrow">CONTINUE</div><h3>${latestQuiz ? 'Keep practicing' : latestNote ? 'Keep writing' : 'Start your workspace'}</h3><p>${latestQuiz ? 'Jump back into your most recently saved quiz.' : latestNote ? 'Open your latest note and keep building it.' : 'Create a quiz or start a note to begin.'}</p></div>
      </div>`;

    if (latestQuiz) {
      const button = document.createElement('button');
      button.className = 'dashboard-polish-continue';
      button.innerHTML = `<strong>${escapeHtml(latestQuiz.title || 'Saved quiz')}</strong><small>${latestQuiz.questions.length} questions · ${latestQuiz.timeLimit || 0} min</small>`;
      button.addEventListener('click', () => clickText('Saved quizzes'));
      continueCard.appendChild(button);
    } else if (latestNote) {
      const button = document.createElement('button');
      button.className = 'dashboard-polish-continue';
      button.innerHTML = `<strong>${escapeHtml(latestNote.title || 'Saved note')}</strong><small>Continue your study notes</small>`;
      button.addEventListener('click', () => clickText('Study Notes'));
      continueCard.appendChild(button);
    } else {
      const button = document.createElement('button');
      button.className = 'dashboard-polish-continue';
      button.textContent = 'Create your first study resource →';
      button.addEventListener('click', () => clickText('Create a quiz'));
      continueCard.appendChild(button);
    }

    wrap.append(overview, continueCard);
    const hero = home.querySelector('.hero-copy');
    hero?.after(wrap);
  }

  function clickText(label) {
    const candidates = Array.from(document.querySelectorAll('button'));
    const match = candidates.find((button) => (button.textContent || '').trim().includes(label));
    match?.click();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
  }

  let lastHome = null;
  function tick() {
    const home = document.querySelector('.home-page');
    if (home !== lastHome) {
      lastHome = home;
      if (home) addDashboard();
    }
  }

  tick();
  window.setInterval(tick, 900);
})();
