(() => {
  const SELECTOR = '.results-wide';

  function refreshResults() {
    const page = document.querySelector(SELECTOR);
    if (!page) return;

    const cards = [...page.querySelectorAll('.review-card')];
    if (!cards.length) return;

    const correct = cards.filter((card) => card.classList.contains('correct')).length;
    const unanswered = cards.filter((card) => card.querySelector('.review-status')?.textContent.trim().toLowerCase() === 'unanswered').length;
    const total = cards.length;
    const incorrect = Math.max(0, total - correct - unanswered);
    const score = total ? Math.round((correct / total) * 100) : 0;

    const scoreValue = page.querySelector('.big-score span');
    if (scoreValue) scoreValue.textContent = String(score);

    const stats = [...page.querySelectorAll('.stat-grid > div')];
    if (stats[0]?.querySelector('strong')) stats[0].querySelector('strong').textContent = String(correct);
    if (stats[1]?.querySelector('strong')) stats[1].querySelector('strong').textContent = String(incorrect);
    if (stats[3]?.querySelector('strong')) stats[3].querySelector('strong').textContent = String(total);
  }

  function hideStaleSuggestion() {
    if (document.querySelector('.quiz-page, .results-wide')) {
      document.getElementById('kenzy-suggestion-panel')?.remove();
      document.getElementById('kenzy-visibility-panel')?.remove();
    }
  }

  function tick() {
    hideStaleSuggestion();
    refreshResults();
  }

  if (typeof window !== 'undefined') {
    tick();
    window.setInterval(tick, 350);
  }
})();
