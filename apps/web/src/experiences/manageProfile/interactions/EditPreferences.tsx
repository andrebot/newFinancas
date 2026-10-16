import { SUPPORTED_LOCALES, type Locale } from '@financas/i18n';
import { Card } from '../../../kit/card/Card';
import { OptionCardGroup, type OptionCard } from '../../../kit/optionCard/OptionCardGroup';
import { SectionHeader } from '../../../kit/sectionHeader/SectionHeader';
import { SegmentedControl } from '../../../kit/segmentedControl/SegmentedControl';
import { useI18n } from '../../../utilities/I18nProvider';
import type { Translator } from '../../../utilities/i18n';
import type { Theme, ThemePreference } from '../../../utilities/theme';

// Edit Preferences (X3, OQ-159; FR-1.21, mockup 70): the user's theme — dark,
// light or following the device — and language. There is no Save: each pick
// is emitted at once, and the Experience applies and saves it. Each theme tile
// draws a thumbnail of that theme in its own tokens (`data-theme` scopes
// them), so the thumbnails stay true whatever theme the page is in. Language
// names are in their own language, the same in every locale.

/** Edit Preferences' props. */
export interface EditPreferencesProps {
  readonly theme: ThemePreference;
  readonly language: Locale;
  /** Gets a newly picked theme. */
  readonly onTheme: (theme: ThemePreference) => void;
  /** Gets a newly picked language. */
  readonly onLanguage: (language: Locale) => void;
}

/** The order the language options are listed in: as mockup 70 shows them. */
const LANGUAGES: readonly Locale[] = [...SUPPORTED_LOCALES].reverse();

/** The thumbnail's props. */
interface ThemeThumbnailProps {
  readonly theme: Theme;
}

/**
 * Draws a small page in one theme's tokens: a mint bar and two lines.
 *
 * @param props - The theme drawn.
 * @returns The thumbnail.
 */
function ThemeThumbnail({ theme }: ThemeThumbnailProps) {
  return (
    <span
      data-theme={theme}
      className="flex h-16 flex-col gap-1.5 rounded-xl border border-line bg-bg p-2"
    >
      <span className="h-2 w-1/2 rounded bg-mint" />
      <span className="h-2 w-3/4 rounded bg-line" />
      <span className="h-2 w-2/3 rounded bg-line" />
    </span>
  );
}

/**
 * Draws the device-following theme: the dark and light pages side by side.
 *
 * @returns The thumbnail.
 */
function SystemThumbnail() {
  return (
    <span className="flex h-16 overflow-hidden rounded-xl border border-line">
      <span data-theme="dark" className="flex-1 bg-bg" />
      <span data-theme="light" className="flex-1 bg-bg" />
    </span>
  );
}

/**
 * Builds the theme tiles.
 *
 * @param translator - The current locale's translator.
 * @returns One tile per preference.
 */
export const themeOptions = (translator: Translator): readonly OptionCard<ThemePreference>[] => [
  {
    value: 'dark',
    label: translator.text('profile', 'theme.dark'),
    icon: 'dark-mode-outline',
    preview: <ThemeThumbnail theme="dark" />,
  },
  {
    value: 'light',
    label: translator.text('profile', 'theme.light'),
    icon: 'light-mode-outline',
    preview: <ThemeThumbnail theme="light" />,
  },
  {
    value: 'system',
    label: translator.text('profile', 'theme.system'),
    icon: 'contrast',
    preview: <SystemThumbnail />,
  },
];

/**
 * Renders the preferences panel: the theme tiles and the language switch.
 *
 * @param props - The saved preferences and the pick handlers.
 * @returns The panel.
 */
export function EditPreferences({
  theme, language, onTheme, onLanguage,
}: EditPreferencesProps) {
  const translator = useI18n();
  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader title={translator.text('profile', 'preferences.title')} />
      <div className="flex flex-col gap-2">
        <p className="type-label text-muted">{translator.text('profile', 'preferences.theme')}</p>
        <OptionCardGroup
          layout="tiles"
          label={translator.text('profile', 'preferences.theme')}
          options={themeOptions(translator)}
          value={theme}
          onChange={onTheme}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="type-label text-muted">
          {translator.text('profile', 'preferences.language')}
        </p>
        <SegmentedControl
          label={translator.text('profile', 'preferences.language')}
          options={LANGUAGES.map((locale) => ({
            value: locale,
            label: translator.text('profile', `language.${locale}`),
          }))}
          value={language}
          onChange={onLanguage}
        />
      </div>
    </Card>
  );
}
