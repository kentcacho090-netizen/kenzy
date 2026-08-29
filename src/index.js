import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './KenzyApp';
import './Kenzy.css';
import './ai-workspace-v2.css';
import './ai-workspace-v2';
import './quiz-upgrade.css';
import './quiz-upgrade';
import './quiz-ui-cleanup';
import './home-button-effects.css';
import './ai-polish';
import './ai-paste-upload';
import './polish.css';
import './mobile-theme-fix.css';
import './large-upload';
import './notes-stable.css';
import './notes-stable';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
