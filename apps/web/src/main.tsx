import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { applyAppearance, storedAppearance } from './core/preferences/appearance';
import { startAppRecorder } from './modules/bugs/lib/capture-session';
// Self-hosted fonts (CSP allows font-src 'self' only). Browsers download a face only when it's used.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/inter';
import '@fontsource-variable/ibm-plex-sans';
import './styles/globals.css';

// Bug reports (E6): console, errors, requests and clicks from the start, redacted, kept in memory.
startAppRecorder();

// The last appearance this browser saw, until the user's preferences load.
applyAppearance(storedAppearance());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Installable app and offline shell (F1). Production builds only: in development Vite serves
// files that change all the time, and a service worker would hand out stale ones.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
