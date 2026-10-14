import { DEFAULT_LOCALE, type Locale } from '@financas/i18n';
import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/theme.css';
import type { Theme } from '../src/utilities/theme';
import { StoryFrame } from '../stories/support/StoryFrame';

// Every story renders with the real tokens and fonts (theme.css imports
// typography.css) inside StoryFrame, which applies the toolbar's theme and
// locale. The canvas is the theme's own background, so Storybook's
// backgrounds tool is off.

/**
 * Wraps a story in the toolbar's theme and locale.
 *
 * @param Story - The story to render.
 * @param context - The story context, holding the toolbar globals.
 * @returns The story, framed.
 */
const withThemeAndLocale: Decorator = (Story, context) => (
  <StoryFrame theme={context.globals.theme as Theme} locale={context.globals.locale as Locale}>
    <Story />
  </StoryFrame>
);

const preview: Preview = {
  decorators: [withThemeAndLocale],
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'pt-BR', title: 'Português (Brasil)' },
          { value: 'en-US', title: 'English (US)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'dark', locale: DEFAULT_LOCALE },
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { expanded: true },
    // axe runs on every story; a violation shows as an error in the panel.
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default preview;
