import js from '@eslint/js';
import { configs, plugins } from 'eslint-config-airbnb-extended';

const WEB_FILES = ['apps/web/**/*.{ts,tsx}'];
const NODE_FILES = [
  'apps/api/**/*.ts', 'packages/**/*.ts', 'tools/**/*.ts', '*.{js,ts}', 'tests/e2e/**/*.ts',
];
const DEV_ONLY_FILES = ['**/tests/**', '**/*.config.{js,ts}'];
const NO_CLASSES = 'Purely functional codebase — no classes (NFR-MAINT-1).';

/**
 * Scopes every entry of a flat-config list to the given file globs.
 *
 * @param {import('eslint').Linter.Config[]} configList - Configs to scope.
 * @param {string[]} files - Globs the configs should apply to.
 * @returns {import('eslint').Linter.Config[]} The same configs, restricted to `files`.
 */
const scopeTo = (configList, files) => configList.map((config) => ({ ...config, files }));

export default [
  {
    name: 'project/ignores',
    ignores: [
      '**/node_modules/', '**/dist/', '**/coverage/', 'playwright-report/', 'test-results/',
      'docs/', '.claude/', '.superdesign/',
      // Generated from openapi.yaml (N7); regenerate, never hand-edit.
      'packages/api-types/src/generated/',
    ],
  },

  // Airbnb base (JS + TypeScript), everywhere.
  { name: 'js/recommended', ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
  plugins.typescriptEslint,
  ...configs.base.typescript,

  // Airbnb React + a11y + hooks, web app only.
  ...scopeTo([plugins.react, plugins.reactHooks, plugins.reactA11y], WEB_FILES),
  ...scopeTo([...configs.react.recommended, ...configs.react.typescript], WEB_FILES),
  {
    name: 'project/react-jsx-runtime',
    files: WEB_FILES,
    // React 17+ automatic JSX runtime: `React` no longer needs to be in scope.
    rules: { 'react/react-in-jsx-scope': 'off', 'react/jsx-uses-react': 'off' },
  },

  // Node rules for everything that runs on Node.
  ...scopeTo([plugins.node, ...configs.node.recommended], NODE_FILES),
  {
    name: 'project/node-version',
    files: NODE_FILES,
    // Matches `engines` / .nvmrc; workspace package.json files don't repeat it.
    settings: { node: { version: '>=24.10.0' } },
  },

  // Tests and tool configs may import devDependencies.
  {
    name: 'project/dev-only-files',
    files: DEV_ONLY_FILES,
    rules: { 'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }] },
  },

  // Message catalogs: an ICU message stays one readable string, however long.
  {
    name: 'project/i18n-catalogs',
    files: ['packages/i18n/src/catalogs/**'],
    rules: { '@stylistic/max-len': ['error', { code: 100, ignoreStrings: true }] },
  },

  // Project rules (CLAUDE.md / NFR-MAINT-1, NFR-MAINT-2).
  {
    name: 'project/rules',
    rules: {
      complexity: ['error', 7],
      'max-params': ['error', 7],
      'no-restricted-syntax': [
        'error',
        { selector: 'ClassDeclaration', message: NO_CLASSES },
        { selector: 'ClassExpression', message: NO_CLASSES },
      ],
    },
  },
];
