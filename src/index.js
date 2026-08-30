import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './KenzyApp';
import './Kenzy.css';
import './quiz-upgrade.css';
import './home-button-effects.css';
import './polish.css';
import './mobile-theme-fix.css';
import './notes-stable.css';
import './study-dashboard-polish.css';
import './ai-workspace-v3.css';
import './steam-game-guide.css';
import './ai-chat-readability';
import './steam-game-guide';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Kenzy could not find the root element.');
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Load optional enhancement scripts after the core application has mounted.
// Each import is a static module expression so Create React App can compile it safely,
// and each module is isolated so one enhancement cannot stop the entire website.
function loadEnhancements() {
  const loaders = [
    ['quiz enhancements', () => import('./quiz-upgrade')],
    ['AI polish', () => import('./ai-polish')],
    ['AI upload enhancements', () => import('./ai-paste-upload')],
    ['large upload support', () => import('./large-upload')],
    ['upload limit handling', () => import('./true-upload-limit')],
    ['presentation support', () => import('./presentation-support')],
    ['notes enhancements', () => import('./notes-stable')],
    ['notes result controls', () => import('./notes-ai-result-controls')],
    ['dashboard polish', () => import('./study-dashboard-polish')],
    ['stability fixes', () => import('./stability-fixes')],
    ['AI workspace enhancements', () => import('./ai-workspace-v3')],
  ];

  for (const [label, load] of loaders) {
    void load().catch((error) => {
      console.error(`Kenzy ${label} failed to load. Core features remain available.`, error);
    });
  }
}

function startEnhancements() {
  loadEnhancements();
}

if (typeof window !== 'undefined') {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(startEnhancements);
  } else {
    window.setTimeout(startEnhancements, 0);
  }
}

// Remove duplicate legacy quiz-instruction panels after the Create Quiz page renders.
// This is deliberately independent from the optional enhancement modules.
function normalizeQuizInstructions() {
  const inputs = Array.from(document.querySelectorAll('textarea[aria-label="Optional quiz instructions"]'));
  if (!inputs.length) return;

  const first = inputs[0];
  const getPanel = (textarea) => textarea.closest('#kenzy-quiz-suggestion, .kenzy-suggestion-panel, .quiz-instructions-panel') || textarea.parentElement;
  const primary = getPanel(first);
  if (!primary) return;

  inputs.slice(1).forEach((textarea) => {
    const duplicate = getPanel(textarea);
    if (duplicate && duplicate !== primary) duplicate.remove();
  });

  const eyebrow = primary.querySelector('.eyebrow');
  const heading = primary.querySelector('strong');
  const description = primary.querySelector('p, small');

  if (eyebrow) eyebrow.textContent = 'OPTIONAL INSTRUCTIONS';
  if (heading) heading.textContent = 'Customize how your quiz is generated';
  if (description) description.textContent = 'Specify any additional preferences for difficulty, question format, topics to emphasize, or problem-solving requirements.';

  first.placeholder = 'Example:\nCreate challenging questions that require problem-solving and critical thinking. Include a balanced mix of conceptual and application-based questions.';
  first.maxLength = 1500;
  first.style.boxSizing = 'border-box';
}

function watchQuizInstructions() {
  normalizeQuizInstructions();
  const observer = new MutationObserver(normalizeQuizInstructions);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 15000);
}

if (typeof window !== 'undefined') {
  window.setTimeout(watchQuizInstructions, 0);
}
