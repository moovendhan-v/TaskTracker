import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { applyAppearance, storedAppearance } from './core/preferences/appearance';
import './styles/globals.css';

// The last appearance this browser saw, until the user's preferences load.
applyAppearance(storedAppearance());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
