import { NavLink } from 'react-router';
import { Icon } from '../../kit/icons/Icon';
import { useI18n } from '../../utilities/I18nProvider';
import { MAIN_NAV } from '../routes';

// The nav drawer's main navigation (S1, mockup 21): one link per page the
// routing table lists, the current page in mint. The links come from the
// routing table, so the nav never points at a page that doesn't exist.

/** The main nav's props. */
export interface MainNavProps {
  /** Called when a link is followed, so the drawer can close. */
  readonly onNavigate: () => void;
}

const LINK = [
  'flex h-11 items-center gap-3 rounded-full px-3 type-body-sm',
  'outline-none focus-visible:outline-2 focus-visible:outline-mint',
].join(' ');

/**
 * Builds a link's classes: the current page in mint on its deep tint.
 *
 * @param state - React Router's link state.
 * @param state.isActive - Whether the link points at the current page.
 * @returns The classes.
 */
export const navLinkClasses = ({ isActive }: { readonly isActive: boolean }) => (
  isActive
    ? `${LINK} bg-mintdeep font-semibold text-mint`
    : `${LINK} font-medium text-muted hover:bg-ink/5`
);

/**
 * Renders the main nav's links.
 *
 * @param props - The follow handler.
 * @returns The list of links.
 */
export function MainNav({ onNavigate }: MainNavProps) {
  const translator = useI18n();

  return (
    <ul className="flex flex-col gap-0.5">
      {MAIN_NAV.map((entry) => (
        <li key={entry.id}>
          <NavLink to={entry.path} end className={navLinkClasses} onClick={onNavigate}>
            <Icon name={entry.nav.icon} className="size-5 shrink-0" />
            {translator.text('shell', entry.nav.label)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
