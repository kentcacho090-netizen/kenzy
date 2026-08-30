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

// Keep the core app independent from optional enhancement scripts.
// Each enhancement loads after the first render and cannot prevent Kenzy from mounting.
const enhancements = [
  ['./quiz-upgrade', 'quiz enhancements'],
  ['./ai-polish', 'AI polish'],
  ['./ai-paste-upload', 'AI upload enhancements'],
  ['./large-upload', 'large upload support'],
  ['./true-upload-limit', 'upload limit handling'],
  ['./presentation-support', 'presentation support'],
  ['./notes-stable', 'notes enhancements'],
  ['./notes-ai-result-controls', 'notes result controls'],
  ['./study-dashboard-polish', 'dashboard polish'],
  ['./stability-fixes', 'stability fixes'],
  ['./ai-workspace-v3', 'AI workspace enhancements'],
];

async function loadEnhancements() {
  for (const [path, label] of enhancements) {
    try {
      await import(path);
    } catch (error) {
      console.error(`Kenzy ${label} failed to load. Core features remain available.`, error);
    }
  }
}

function startEnhancements() {
  void loadEnhancements();
}

if (typeof window !== 'undefined') {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(startEnhancements);
  } else {
    window.setTimeout(startEnhancements, 0);
  }
}

// Remove duplicate legacy quiz-instruction panels once the Create Quiz page is rendered.
// The cleanup is DOM-only and does not interfere with React state.
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
