import type { ReactNode } from 'react';
import { EmptyState } from './kit/emptyState/EmptyState';
import { ROUTES, type RouteId } from './shell/routes';
import type { ShellActions } from './shell/shellConfig';
import { useI18n } from './utilities/I18nProvider';

// Stand-ins for the Experiences not built yet (S1, OQ-156). Each X task
// replaces its own entries in `App.tsx` — its pages, its data hooks, its
// handlers — and this file shrinks until it goes away with the last one. The
// data hooks are all provided since X3 (OQ-159).

/**
 * A page whose Experience isn't built yet.
 *
 * @returns A "coming soon" notice.
 */
export function ComingSoon() {
  const translator = useI18n();
  return (
    <EmptyState
      icon="lightbulb-outline"
      title={translator.text('shell', 'placeholder.title')}
      description={translator.text('shell', 'placeholder.description')}
    />
  );
}

/** Every page, as a "coming soon" notice. */
export const placeholderPages = Object.fromEntries(
  ROUTES.map((route) => [route.id, <ComingSoon key={route.id} />]),
) as Record<RouteId, ReactNode>;

/** Chrome actions whose Experiences don't exist yet: the audit export does nothing. */
export const placeholderActions: Omit<ShellActions, 'signOut'> = {
  exportAuditLog: () => {},
};
