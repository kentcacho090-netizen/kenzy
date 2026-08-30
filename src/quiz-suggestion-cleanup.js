const PANEL_SELECTOR = 'section.page.narrow-page > div';
const SUGGESTION_INPUT = 'textarea[aria-label="Optional quiz instructions"]';
const PLACEHOLDER = 'Example:\nCreate challenging questions that require problem-solving and critical thinking. Include a balanced mix of conceptual and application-based questions.';

function normalizeQuizInstructions() {
  document.querySelectorAll('#kenzy-suggestion-panel, .kenzy-suggestion-panel').forEach((node) => node.remove());

  const panels = Array.from(document.querySelectorAll(PANEL_SELECTOR)).filter((panel) => {
    const eyebrow = panel.querySelector('.eyebrow');
    const textarea = panel.querySelector(SUGGESTION_INPUT);
    return Boolean(eyebrow && textarea && /OPTIONAL\s+(SUGGESTION|INSTRUCTIONS)/i.test(eyebrow.textContent || ''));
  });

  if (!panels.length) return;

  panels.slice(1).forEach((panel) => panel.remove());

  const panel = panels[0];
  const eyebrow = panel.querySelector('.eyebrow');
  const heading = panel.querySelector('strong');
  const description = panel.querySelector('p');
  const textarea = panel.querySelector(SUGGESTION_INPUT);

  if (eyebrow) eyebrow.textContent = 'OPTIONAL INSTRUCTIONS';
  if (heading) heading.textContent = 'Customize how your quiz is generated';
  if (description) description.textContent = 'Specify additional preferences for difficulty, question format, topics to emphasize, or problem-solving requirements.';
  if (textarea) {
    textarea.placeholder = PLACEHOLDER;
    textarea.maxLength = 1500;
    textarea.style.boxSizing = 'border-box';
  }
}

function boot() {
  normalizeQuizInstructions();
  const observer = new MutationObserver(normalizeQuizInstructions);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setInterval(normalizeQuizInstructions, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
