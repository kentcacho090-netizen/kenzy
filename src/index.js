import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './KenzyApp';
import './Kenzy.css';
import './ai-workspace-sidebar.css';
import './ai-workspace-sidebar';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
