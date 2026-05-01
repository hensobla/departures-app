import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Only register the SW in production builds. In dev, the SW intercepts
// module/asset requests and caches them, which breaks HMR — source edits
// never reach the page once a module is in the cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((err) => console.warn('SW registration failed', err));
  });
} else if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
  // In dev, proactively unregister any SW left over from a prior `npm run
  // preview` (or production-built session) on the same origin, and clear
  // its caches. Without this, the dev page would keep serving stale modules.
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister().catch(() => {}));
  });
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {})));
  }
}
