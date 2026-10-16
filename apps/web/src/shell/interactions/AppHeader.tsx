import type { ReactNode, Ref } from 'react';
import { BrandMark } from '../../kit/brand/BrandMark';
import { IconButton } from '../../kit/button/IconButton';
import { useI18n } from '../../utilities/I18nProvider';

// The App Shell's header (S1, mockups 20–24, 34): the menu button that opens
// the nav drawer, the brand, and the notification bell on the far side. It
// sticks to the top while the page scrolls, so the menu and bell are always
// one tap away.

const HEADER = [
  'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3',
  'border-b border-line bg-card/80 px-4 backdrop-blur sm:px-6',
].join(' ');

/** The header's props. */
export interface AppHeaderProps {
  /** Whether the nav drawer is open: the button turns into its close button. */
  readonly menuOpen: boolean;
  /** The drawer's element id, which the button controls. */
  readonly drawerId: string;
  /** Toggles the drawer. */
  readonly onToggleMenu: () => void;
  /** The drawer anchors its focus return and outside-click handling on the button. */
  readonly menuButtonRef?: Ref<HTMLButtonElement> | undefined;
  /** The notification bell, when Review Insights provides one. */
  readonly bell?: ReactNode;
}

/**
 * Renders the header bar.
 *
 * @param props - The drawer's state and toggle, and the bell.
 * @returns The header.
 */
export function AppHeader({
  menuOpen, drawerId, onToggleMenu, menuButtonRef, bell,
}: AppHeaderProps) {
  const translator = useI18n();
  const menuLabel = menuOpen ? 'header.closeMenu' : 'header.openMenu';

  return (
    <header className={HEADER}>
      <IconButton
        ref={menuButtonRef}
        icon={menuOpen ? 'close' : 'menu'}
        label={translator.text('shell', menuLabel)}
        size="lg"
        aria-expanded={menuOpen}
        aria-controls={drawerId}
        className="text-ink"
        onClick={onToggleMenu}
      />
      <BrandMark />
      {bell && <div className="ml-auto">{bell}</div>}
    </header>
  );
}
