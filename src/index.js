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
import './ai-scroll-fix.css';
import './ai-v3-scroll-polish.css';
import './ai-v3-message-alignment.css';
import './ai-thinking-simple.css';
import './steam-install-tutorial.css';
import './ai-chat-readability';
import './steam-install-tutorial';
import './steam-tutorial-folder';
import './quiz-results-polish';
import './ai-final-polish';

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
