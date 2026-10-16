// Composition root: mounts React into index.html. No logic lives here, so it
// is excluded from unit coverage and exercised by the E2E smoke test instead.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { sessionEnded } from './api/baseQuery';
import { browserApiEnvironment } from './api/environment';
import App from './App';
import { api, shell, toast } from './config/constants';
import { watchSignOutElsewhere } from './shell/signOutElsewhere';
import { createAppStore } from './store';
import './styles/theme.css';
import { browserLocaleEnvironment, createLocaleController } from './utilities/i18n';
import { AlertProvider } from './utilities/AlertProvider';
import { createAlertQueue } from './utilities/alerts';
import { I18nProvider } from './utilities/I18nProvider';
import { safeStorage } from './utilities/safeStorage';
import { browserThemeEnvironment, createThemeController } from './utilities/theme';

// The remembered theme goes on <html> before the first render, so a reload
// doesn't flash the default theme. The App Shell applies the user's saved one
// once their profile loads (S1).
const themeController = createThemeController(browserThemeEnvironment(window));
themeController.restore();

// The locale, likewise: remembered, else the browser's language, else pt-BR.
// The user's saved language replaces it once their profile loads (S1).
const localeController = createLocaleController(browserLocaleEnvironment(window));
localeController.restore();

// The page's toasts; the provider draws them over whatever page is shown.
const alertQueue = createAlertQueue(toast.maxVisible);

// The page's one store, over the browser's API client and the shell's storage.
const store = createAppStore({
  api: browserApiEnvironment(window),
  shell: { householdMemory: safeStorage(() => window.localStorage, shell.householdStorageKey) },
});

// Signing out in another tab ends this tab's session too (OQ-124 follow-up).
watchSignOutElsewhere(window, api.refreshTokenStorageKey, () => store.dispatch(sessionEnded()));

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <I18nProvider controller={localeController}>
        <AlertProvider queue={alertQueue}>
          <App store={store} themeController={themeController} />
        </AlertProvider>
      </I18nProvider>
    </StrictMode>,
  );
}
