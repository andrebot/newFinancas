import { useEffect } from 'react';
import { useLocaleController } from '../utilities/I18nProvider';
import type { ThemeController } from '../utilities/theme';
import type { ShellIdentity, SourceState } from './shellConfig';

// The user's saved theme and language win once their profile loads (S1,
// OQ-122, OQ-123): until then the page shows the remembered or browser
// defaults `main.tsx` restored. Each is applied once per change, through the
// page's one controller, so Edit Preferences (X3) and the shell never disagree.

/**
 * Applies the signed-in user's saved theme and language when they load or change.
 *
 * @param identity - The signed-in user, as Manage Profile reports them.
 * @param themeController - The page's theme controller.
 */
const useSavedPreferences = (
  identity: SourceState<ShellIdentity>,
  themeController: ThemeController,
) => {
  const localeController = useLocaleController();
  const user = identity.status === 'ready' ? identity.data : undefined;
  const theme = user?.theme;
  const language = user?.language;

  useEffect(() => {
    if (theme) {
      themeController.apply(theme);
    }
  }, [theme, themeController]);

  useEffect(() => {
    if (language) {
      localeController.apply(language);
    }
  }, [language, localeController]);
};

export default useSavedPreferences;
