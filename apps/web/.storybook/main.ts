import type { StorybookConfig } from '@storybook/react-vite';

// Component library (N14, OQ-128): a dev-only Storybook to review each kit
// component in both themes and both locales. It reuses the app's Vite config
// (React + Tailwind), so stories render with the real tokens and fonts.
// `pnpm storybook` runs it; `pnpm storybook:build` writes the git-ignored
// `storybook-static/`. It never ships in the app.

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  core: { disableTelemetry: true },
};

export default config;
