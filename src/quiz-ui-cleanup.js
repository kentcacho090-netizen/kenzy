/* Keep quiz access controls scoped to the quiz-maker and share links scoped to an active quiz. */
(function () {
  const VISIBILITY_ID = 'kenzy-visibility-panel';
  const SHARE_ID = 'kenzy-share-panel';
  let lastMaker = null;
  let lastQuiz = null;

  function remove(id) {
    document.getElementById(id)?.remove();
  }

  function isQuizMaker(page) {
    return !!page && !!Array.from(page.querySelectorAll('button')).find((b) => /^Generate quiz/i.test((b.textContent || '').trim()));
  }

  function isActiveQuiz(page) {
    return !!page && page.classList.contains('quiz-page');
  }

  function cleanup() {
    const pages = Array.from(document.querySelectorAll('.page'));
    const maker = pages.find(isQuizMaker) || null;
    const quiz = pages.find(isActiveQuiz) || null;

    if (lastMaker && lastMaker !== maker) remove(VISIBILITY_ID);
    if (lastQuiz && lastQuiz !== quiz) remove(SHARE_ID);

    if (!maker) remove(VISIBILITY_ID);
    if (!quiz) remove(SHARE_ID);

    /* The old share module could create the visibility panel while React was
       transitioning between pages. Never allow that panel outside the maker. */
    const visibility = document.getElementById(VISIBILITY_ID);
    if (visibility && !maker) visibility.remove();

    lastMaker = maker;
    lastQuiz = quiz;

    /* Multiple file selection is supported by the real quiz input. Make the
       limit text reflect the product limit without changing React's handler. */
    if (maker) {
      const input = maker.querySelector('input[type="file"]');
      if (input) input.multiple = true;
      const hint = maker.querySelector('.upload-hint')?.previousElementSibling;
      if (hint && /maximum 3 MB combined/i.test(hint.textContent || '')) {
        hint.textContent = 'PDF, PNG, JPG, or WebP · maximum 25 MB combined';
      }
      const label = maker.querySelector('.upload-box');
      if (label && !label.dataset.multiCleaned) {
        label.dataset.multiCleaned = '1';
        label.title = 'Choose one or more PDF/image files';
      }
    }
  }

  function boot() {
    if (window.__kenzyQuizUiCleanupStarted) return;
    window.__kenzyQuizUiCleanupStarted = true;
    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { childList: true, subtree: true });
    cleanup();
    window.setInterval(cleanup, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
