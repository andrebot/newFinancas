import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { AuthenticateExperience } from './experiences/authenticate/AuthenticateExperience';
import signOut from './experiences/authenticate/signOut';
import {
  placeholderActions, placeholderPages, placeholderSources,
} from './placeholders';
import { AppRoutes } from './shell/AppRoutes';
import type { ShellConfig } from './shell/shellConfig';
import type { AppStore } from './store';
import type { ThemeController } from './utilities/theme';

// The composition root (S1, OQ-156): it gives the App Shell its
// configuration — each page's element, the chrome's data hooks and handlers,
// the notification routing table — and wraps it in the store and the router.
// Each Experience, once built, swaps its placeholders here for its own.

/** The root's props: what `main.tsx` built for the page. */
export interface AppProps {
  readonly store: AppStore;
  readonly themeController: ThemeController;
}

/**
 * Builds the shell's configuration.
 *
 * @param store - The page's store.
 * @param themeController - The page's theme controller.
 * @returns The configuration.
 */
export const shellConfigFor = (store: AppStore, themeController: ThemeController): ShellConfig => ({
  pages: {
    ...placeholderPages,
    signIn: <AuthenticateExperience entry="signIn" />,
    forgotPassword: <AuthenticateExperience entry="recovery" />,
    resetPassword: <AuthenticateExperience entry="recovery" />,
  },
  sources: placeholderSources,
  actions: {
    ...placeholderActions,
    signOut: () => {
      store.dispatch(signOut());
    },
  },
  notificationRoutes: {},
  themeController,
});

/**
 * Renders the app.
 *
 * @param props - The page's store and theme controller.
 * @returns The app, routed by the address bar.
 */
export default function App({ store, themeController }: AppProps) {
  const config = useMemo(() => shellConfigFor(store, themeController), [store, themeController]);
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes config={config} />
      </BrowserRouter>
    </Provider>
  );
}
