import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Interceptor global de fetch para enviar siempre el token de sesión persistido (evita cierre de sesión al recargar)
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.startsWith('/api')) {
      const token = localStorage.getItem('kabaly_session_token');
      const headers = new Headers(init?.headers || {});
      if (token && !headers.has('x-kabaly-session')) {
        headers.set('x-kabaly-session', token);
      }
      init = {
        ...init,
        headers,
        credentials: init?.credentials || 'same-origin',
      };
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
