// Composition root: mounts React into index.html. No logic lives here, so it
// is excluded from unit coverage and exercised by the E2E smoke test instead.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import { browserThemeEnvironment, createThemeController } from './utilities/theme';

// The remembered theme goes on <html> before the first render, so a reload
// doesn't flash the default theme. The App Shell takes over the controller (S1).
const themeController = createThemeController(browserThemeEnvironment(window));
themeController.restore();

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
