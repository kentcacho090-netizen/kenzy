import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './KenzyApp';
import './Kenzy.css';
import './quiz-upgrade.css';
import './quiz-upgrade';
import './home-button-effects.css';
import './ai-polish';
import './ai-paste-upload';
import './polish.css';
import './mobile-theme-fix.css';
import './large-upload';
import './true-upload-limit';
import './presentation-support';
import './notes-stable.css';
import './notes-stable';
import './notes-ai-result-controls';
import './study-dashboard-polish.css';
import './study-dashboard-polish';
import './stability-fixes';
import './ai-workspace-v3.css';
import './ai-workspace-v3';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
