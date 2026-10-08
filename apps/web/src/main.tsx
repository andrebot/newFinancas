// Composition root: mounts React into index.html. No logic lives here, so it
// is excluded from unit coverage and exercised by the E2E smoke test instead.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
