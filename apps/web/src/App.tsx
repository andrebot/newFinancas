import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { AuthenticateExperience } from './experiences/authenticate/AuthenticateExperience';
import signOut from './experiences/authenticate/signOut';
import { useHouseholds } from './api/identityApi';
import { useAccountInUse } from './api/setupApi';
import { AccountSetupExperience } from './experiences/accountSetup/AccountSetupExperience';
import ManageFinancesExperience from './experiences/manageFinances/ManageFinancesExperience';
import { ManageHouseholdExperience } from './experiences/manageHousehold/ManageHouseholdExperience';
import { ManageProfileExperience } from './experiences/manageProfile/ManageProfileExperience';
import {
  invitationRoute, type InvitationFeedback,
} from './experiences/manageProfile/respondToInvitation';
import {
  useIdentity, usePendingInvitationCount,
} from './experiences/manageProfile/shellSources';
import { OnboardExperience } from './experiences/onboard/OnboardExperience';
import { placeholderActions, placeholderPages } from './placeholders';
import { AppRoutes } from './shell/AppRoutes';
import type { ShellConfig } from './shell/shellConfig';
import type { AppStore } from './store';
import { useAlerts } from './utilities/AlertProvider';
import { useI18n } from './utilities/I18nProvider';
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
 * @param feedback - The page's toasts and translator, for routed notifications.
 * @returns The configuration.
 */
export const shellConfigFor = (
  store: AppStore,
  themeController: ThemeController,
  feedback: InvitationFeedback,
): ShellConfig => ({
  pages: {
    ...placeholderPages,
    signIn: <AuthenticateExperience entry="signIn" />,
    forgotPassword: <AuthenticateExperience entry="recovery" />,
    resetPassword: <AuthenticateExperience entry="recovery" />,
    register: <OnboardExperience entry="registration" />,
    onboard: <OnboardExperience entry="household" />,
    createHousehold: <OnboardExperience entry="additionalHousehold" />,
    guidedSetup: <OnboardExperience entry="guidedSetup" />,
    household: <ManageHouseholdExperience />,
    profile: <ManageProfileExperience />,
    accountSetup: <AccountSetupExperience />,
    transactions: <ManageFinancesExperience />,
  },
  sources: {
    useIdentity, useHouseholds, usePendingInvitationCount, useAccountInUse,
  },
  actions: {
    ...placeholderActions,
    signOut: () => {
      store.dispatch(signOut());
    },
  },
  notificationRoutes: {
    'invitation.received': invitationRoute(store.dispatch, feedback),
  },
  themeController,
});

/**
 * Renders the app. It sits inside the page's alert and locale providers, whose
 * toasts and translator reach the notification routes.
 *
 * @param props - The page's store and theme controller.
 * @returns The app, routed by the address bar.
 */
export default function App({ store, themeController }: AppProps) {
  const alerts = useAlerts();
  const translator = useI18n();
  const config = useMemo(
    () => shellConfigFor(store, themeController, { alerts, translator }),
    [store, themeController, alerts, translator],
  );
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes config={config} />
      </BrowserRouter>
    </Provider>
  );
}
