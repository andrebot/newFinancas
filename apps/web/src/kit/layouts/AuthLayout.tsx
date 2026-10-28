import type { Catalog } from '@financas/i18n';
import type { ReactNode } from 'react';
import { brand } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import type { Translator } from '../../utilities/i18n';
import { BrandMark } from '../brand/BrandMark';
import { Icon, type IconName } from '../icons/Icon';
import { ProgressRing } from '../progressRing/ProgressRing';

// The kit's auth layout (K34, OQ-135): every sign-in, sign-up, recovery and
// MFA page (mockups 01–09). The brand panel on the left is the same on all of
// them: the mark, the headline, a tilted product preview and the three
// feature lines. The page's form sits centred on the right. Below `lg` the
// panel gives way to the mark above the form.

/** The auth layout's props. */
export interface AuthLayoutProps {
  /** The page's heading and form. */
  readonly children: ReactNode;
}

type FeatureKey = Extract<keyof Catalog['brand'], `feature.${string}`>;

type PreviewKey = Extract<keyof Catalog['brand'], `preview.${string}`>;

/** The goal card's share in the preview: its ring and its label both show it. */
const PREVIEW_GOAL_SHARE = 0.57;

const FEATURES: readonly { icon: IconName; key: FeatureKey }[] = [
  { icon: 'group-outline', key: 'feature.together' },
  { icon: 'flag-outline', key: 'feature.goals' },
  { icon: 'query-stats', key: 'feature.netWorth' },
];

const PREVIEW_CARD = 'absolute rounded-card border border-line shadow-overlay';

const BALANCE_CARD = [
  PREVIEW_CARD,
  'top-0 left-0 flex w-55 -rotate-2 flex-col gap-2 bg-card/90 p-4',
].join(' ');

const GOAL_CARD = [
  PREVIEW_CARD,
  'top-19.5 left-42.5 flex w-60 rotate-1 items-center gap-3 bg-card/95 p-3.5',
].join(' ');

const PANEL = [
  'relative hidden w-130 shrink-0 flex-col justify-between overflow-hidden',
  'border-r border-line bg-deep p-12 lg:flex',
].join(' ');

const SMALL_TEXT = 'text-[0.6875rem] tabular-nums';

/**
 * Formats the preview goal's share as a whole percent in the page's locale.
 *
 * @param translator - The current locale's translator.
 * @returns The percent, e.g. "57%".
 */
export const previewGoalPercent = (translator: Translator) => (
  new Intl.NumberFormat(translator.locale, { style: 'percent' }).format(PREVIEW_GOAL_SHARE)
);

/**
 * Draws the brand panel's product preview: a balance card and a goal card,
 * tilted. It is an illustration, so screen readers skip it.
 *
 * @param props - The current locale's translator.
 * @returns The two overlapping cards.
 */
function ProductPreview({ translator }: { readonly translator: Translator }) {
  /**
   * Reads one of the preview's sample texts.
   *
   * @param key - The text's catalog key.
   * @returns The text in the current locale.
   */
  const text = (key: PreviewKey) => translator.text('brand', key);
  return (
    <div className="relative h-50" aria-hidden="true">
      <div className={BALANCE_CARD}>
        <span className="flex items-center gap-2 type-caption text-muted">
          <span className="grid size-6 place-items-center rounded-full bg-mint/15 text-mint">
            <Icon name="account-balance-outline" className="size-3.5" />
          </span>
          {text('preview.account')}
        </span>
        <span className="type-display-xs tabular-nums">{text('preview.balance')}</span>
        <span className={`${SMALL_TEXT} text-mint`}>{text('preview.change')}</span>
      </div>
      <div className={GOAL_CARD}>
        <ProgressRing
          value={PREVIEW_GOAL_SHARE * 100}
          label={previewGoalPercent(translator)}
          size="sm"
          ariaLabel={text('preview.goal')}
        />
        <span>
          <span className="block text-[0.8125rem] font-semibold">{text('preview.goal')}</span>
          <span className={`block ${SMALL_TEXT} text-muted`}>{text('preview.goalProgress')}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Draws the brand panel: glows, the mark, the headline, the preview, the
 * feature lines and the copyright.
 *
 * @returns The panel, shown from `lg` up.
 */
function BrandPanel() {
  const translator = useI18n();
  // A string, so ICU doesn't group the digits ("2,026").
  const year = String(new Date().getFullYear());
  return (
    <aside className={PANEL}>
      <span
        aria-hidden="true"
        className="absolute -top-32 -left-24 size-105 rounded-full bg-mint/20 blur-[110px]"
      />
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-0 size-75 rounded-full bg-sky/10 blur-[100px]"
      />
      <div className="relative"><BrandMark size="lg" /></div>
      <div className="relative flex flex-col gap-8">
        <h2 className="max-w-95 type-display-xl">
          {translator.text('brand', 'headline.lead')}
          {' '}
          <span className="text-mint">{translator.text('brand', 'headline.accent')}</span>
        </h2>
        <ProductPreview translator={translator} />
        <ul className="flex flex-col gap-3 type-body-lg text-muted">
          {FEATURES.map(({ icon, key }) => (
            <li key={key} className="flex items-center gap-3">
              <Icon name={icon} className="size-5 text-mint" />
              {translator.text('brand', key)}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative type-caption text-faint">
        {translator.text('brand', 'copyright', { year, name: brand.name })}
      </p>
    </aside>
  );
}

/**
 * Renders an auth page: the brand panel beside the centred form.
 *
 * @param props - The page's heading and form.
 * @returns The split screen.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-bg text-ink type-body">
      <BrandPanel />
      <main className="relative grid flex-1 place-items-center p-6 sm:p-12">
        <div className="flex w-full max-w-100 flex-col gap-6">
          <div className="lg:hidden"><BrandMark /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
