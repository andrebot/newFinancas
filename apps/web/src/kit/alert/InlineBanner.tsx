import type { ReactNode } from 'react';
import { IconButton } from '../button/IconButton';
import { Icon } from '../icons/Icon';
import {
  roleOf, TONE_ACCENTS, TONE_ICONS, type AlertTone,
} from './tones';

// The kit's inline banner (K25, OQ-141): a note that stays in the page, where
// it applies — a form's failed save, a caution above a section. It takes the
// look of the inline confirm box in mockup 41: a tinted, ringed block with the
// tone's glyph, an optional bold title, the message, an optional action and,
// when the caller allows it, a close button.

/** The tinted block's border and background, per tone. */
const SURFACES: Record<AlertTone, string> = {
  success: 'border-mint/30 bg-mint/10',
  info: 'border-sky/30 bg-sky/10',
  warning: 'border-sun/30 bg-sun/10',
  error: 'border-coral/30 bg-coral/10',
};

/** How a banner can be closed. */
export interface BannerDismiss {
  /** The close button's name, already translated, e.g. "Dismiss". */
  readonly label: string;
  readonly onDismiss: () => void;
}

/** The inline banner's props. */
export interface InlineBannerProps {
  readonly tone: AlertTone;
  /** What happened, already translated. */
  readonly message: string;
  /** A bold line above the message, already translated. */
  readonly title?: string | undefined;
  /** A way forward under the message, e.g. a "Try again" button. */
  readonly action?: ReactNode;
  /** Shows a close button when given; without it the banner stays. */
  readonly dismiss?: BannerDismiss | undefined;
}

/**
 * Renders the inline banner. An error is announced at once (`alert`), the
 * other tones politely (`status`).
 *
 * @param props - The tone, the texts, the action and how to close it.
 * @returns The banner.
 */
export function InlineBanner({
  tone, message, title, action, dismiss,
}: InlineBannerProps) {
  return (
    <div
      role={roleOf(tone)}
      className={`flex items-start gap-2.5 rounded-2xl border p-3 ${SURFACES[tone]}`}
    >
      <Icon name={TONE_ICONS[tone]} className={`mt-px size-4.5 shrink-0 ${TONE_ACCENTS[tone]}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 type-body-sm text-ink">
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {dismiss && (
        <IconButton
          icon="close"
          label={dismiss.label}
          size="xs"
          className="-my-1 -mr-1"
          onClick={dismiss.onDismiss}
        />
      )}
    </div>
  );
}
