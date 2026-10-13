// Fixed application settings (OQ-101): the same in every environment, changed
// only in code, grouped by area. Facts that belong to an algorithm (a regular
// expression, a date format) stay next to the code that implements it.

/** Form field rules (FU1 ValidationUtility). */
export const validation = {
  /** FR-1.1: the shortest password accepted (mirrors the API's `authentication.password`). */
  password: {
    minLength: 12,
  },
  /** A whole percent (Goal allocations, OQ-87) — the contract's `percentage` bounds. */
  wholePercent: {
    min: 1,
    max: 100,
  },
};

/** The advisory strength meter (FU2 PasswordStrengthUtility, NFR-SEC-4). */
export const passwordStrength = {
  /** Words about this app; a password built from them scores low. */
  appWords: ['financas', 'finanças', 'finance', 'household', 'casa'],
  /** Also match near-misses of a dictionary word (`Pasword`), not only exact ones. */
  useLevenshteinDistance: true,
};

/** Dark / light / system and the category palette (FU4 ThemeUtility, FR-1.21, OQ-85). */
export const theme = {
  /** The product default (FR-1.21): used until a preference is saved or loaded. */
  defaultPreference: 'dark',
  /** Where the last applied preference is remembered, so a reload starts in it. */
  storageKey: 'financas.theme',
  /** Shown for a category colour this build doesn't know (a newer palette). */
  fallbackCategoryColor: 'slate',
} as const;

/** The interface language (FU5 I18nUtility, FR-1.21, NFR-I18N-1). */
export const i18n = {
  /** Where the last applied locale is remembered, so a reload starts in it. */
  storageKey: 'financas.locale',
} as const;

/** The backend API client (FU7, OQ-124). */
export const api = {
  /** Same origin everywhere; in development Vite proxies it to the API. */
  baseUrl: '/api/v1',
  /** Where the refresh token is kept, so a reload or a new tab stays signed in. */
  refreshTokenStorageKey: 'financas.refreshToken',
  /** The cross-tab lock every refresh takes, so two tabs never rotate the same token. */
  refreshLockName: 'financas.auth.refresh',
} as const;
