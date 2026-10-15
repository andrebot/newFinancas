// Composition root: mounts React into index.html. No logic lives here, so it
// is excluded from unit coverage and exercised by the E2E smoke test instead.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { toast } from './config/constants';
import './styles/theme.css';
import { browserLocaleEnvironment, createLocaleController } from './utilities/i18n';
import { AlertProvider } from './utilities/AlertProvider';
import { createAlertQueue } from './utilities/alerts';
import { I18nProvider } from './utilities/I18nProvider';
import { browserThemeEnvironment, createThemeController } from './utilities/theme';

// The remembered theme goes on <html> before the first render, so a reload
// doesn't flash the default theme. The App Shell takes over the controller (S1).
const themeController = createThemeController(browserThemeEnvironment(window));
themeController.restore();

// The locale, likewise: remembered, else the browser's language, else pt-BR.
// The user's saved language replaces it once preferences load (S1).
const localeController = createLocaleController(browserLocaleEnvironment(window));
localeController.restore();

// The page's toasts; the provider draws them over whatever page is shown.
const alertQueue = createAlertQueue(toast.maxVisible);

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <I18nProvider controller={localeController}>
        <AlertProvider queue={alertQueue}>
          <App />
        </AlertProvider>
      </I18nProvider>
    </StrictMode>,
  );
}
