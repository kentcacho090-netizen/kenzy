import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './KenzyApp';
import './Kenzy.css';
import './ai-workspace-v2.css';
import './ai-workspace-v2';
import './quiz-upgrade.css';
import './quiz-upgrade';
import './home-button-effects.css';
import './ai-polish';
import './ai-paste-upload';
import './polish.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
