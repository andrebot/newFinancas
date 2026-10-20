// Fixed application settings (OQ-101): the same in every environment, changed
// only in code, grouped by area. Facts that belong to an algorithm (a regular
// expression, a date format) stay next to the code that implements it.

import type { CardNetwork, CategoryIcon } from '@financas/reference';

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
  /** How much of a category's colour its tint keeps (the mockups' `/15` discs, K50). */
  categoryTintPercent: 15,
} as const;

/** The interface language (FU5 I18nUtility, FR-1.21, NFR-I18N-1). */
export const i18n = {
  /** Where the last applied locale is remembered, so a reload starts in it. */
  storageKey: 'financas.locale',
} as const;

/** Money, rates, percents, dates and lists (FU6 FormattingUtility, NFR-I18N-2, OQ-179). */
export const formatting = {
  /** Money follows its own currency's conventions, whatever the interface language. */
  currencyLocale: { BRL: 'pt-BR', USD: 'en-US' },
  /** The decimals a rate shows: 10.50% (OQ-179). */
  rateFractionDigits: 2,
  /** The ways a calendar date is written on screen. */
  dateStyles: {
    /** 30/09/2026 · 09/30/2026 — tables, due dates, forms. */
    numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
    /** 7 de set. · Sep 7 — ledger rows. */
    dayMonth: { day: 'numeric', month: 'short' },
    /** setembro de 2026 · September 2026 — month headers. */
    monthYear: { month: 'long', year: 'numeric' },
    /** seg., 7 de set. · Mon, Sep 7 — ledger day headers. */
    weekdayDayMonth: { weekday: 'short', day: 'numeric', month: 'short' },
  },
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

/** Floating panels: the popover and everything built on it (K22, OQ-131). */
export const overlay = {
  /** The gap between a panel and the element it opens from, in px. */
  offset: 8,
  /** The space a panel keeps from the viewport's edges, in px (the page gutter). */
  viewportPadding: 16,
} as const;

/** The drawer / sheet (K20, OQ-191). */
export const drawer = {
  /** How long it slides in or out, in ms; no motion when the device asks for less. */
  transitionMs: 200,
} as const;

/** The credit-card preview and saved-card rows (K48, OQ-187). */
export const creditCard = {
  /** Each network's card: a dark gradient (start, end) in both themes, like a real card. */
  gradients: {
    visa: ['#1E3A5F', '#14202E'],
    mastercard: ['#3A2A12', '#14100A'],
    amex: ['#1C4A5A', '#0F232B'],
    elo: ['#2B2B2B', '#121212'],
    hipercard: ['#5A1A1A', '#2A0E0E'],
    diners: ['#2A3A4A', '#151C24'],
    discover: ['#4A2A12', '#1F130A'],
    jcb: ['#173F2A', '#0C1F15'],
    unionpay: ['#13404A', '#0A1F24'],
    other: ['#2A302D', '#141816'],
  } satisfies Record<CardNetwork, readonly [string, string]>,
  /** The preview's chip: gold, light to dark. */
  chip: ['#E9C46A', '#B88A2E'],
  /** The digits the preview draws while fewer are typed, when the network allows that many. */
  placeholderLength: 16,
} as const;

/** The money input (K7, OQ-188). */
export const moneyInput = {
  /** The most digits an amount takes, cents included: up to 99,999,999,999.99. */
  maxDigits: 13,
} as const;

/** The number, rate and percent input (K8, OQ-189): the most whole digits each kind takes. */
export const numberInput = {
  maxWholeDigits: {
    /** Up to 9,999,999.99999999 units: × 10⁸ on the wire must stay a safe integer. */
    quantity: 7,
    /** Up to 9,999.9999% — a rate like 110% of CDI fits with room to spare. */
    rate: 4,
    /** Up to 100%, and ValidationUtility holds the 1–100 range (OQ-87). */
    percent: 3,
  },
} as const;

/** The category form's icon picker (K18, OQ-185). */
export const iconPicker = {
  /** The icons always offered in the row, before "More icons" (mockup 41). */
  quickIcons: [
    'pets', 'school-outline', 'flight', 'redeem', 'fitness-center', 'child-care-outline',
  ] as const satisfies readonly CategoryIcon[],
  /** The "More icons" panel's width, in px: eight 36px icons a row. */
  panelWidth: 354,
} as const;

/** The kit's tooltip (K24, OQ-160). */
export const tooltip = {
  /** How long the pointer rests on a trigger before the tooltip shows, in ms (focus: at once). */
  openDelayMs: 400,
} as const;

/** Count badges, e.g. the bell's unseen notifications (K30, OQ-133). */
export const badge = {
  /** The highest count shown as is; above it the badge reads "9+", so it stays a 16px circle. */
  maxCount: 9,
} as const;

/** Placeholders shown while a list loads (K28, OQ-132). */
export const skeleton = {
  /** How many loading rows stand in for the next page, as the ledger mockup shows. */
  rows: 2,
} as const;

/** Initials avatars: members, profile and the nav drawer (K31, OQ-134). */
export const avatar = {
  /** The signed-in user's own colour, on every screen. */
  selfTone: 'mint',
  /** Everyone else is hashed by user id onto one of these; coral is left out (it means errors). */
  memberTones: ['sky', 'sun', 'lilac'],
} as const;

/** Household roles (FR-1.6, FR-1.7) — reference data, never hard-coded in a Flow (EBD Step 5). */
export const household = {
  /** The roles an Owner/Admin may give: on an invite or a role change (FR-1.12). */
  assignableRoles: ['Admin', 'Member', 'Viewer'],
  /** The role an invite starts on. */
  defaultInviteRole: 'Member',
  /** The roles that manage members, roles and invitations (FR-1.5, FR-1.11). */
  managerRoles: ['Owner', 'Admin'],
  /** The members list's order: the Owner first, then by how much each role may do. */
  roleOrder: ['Owner', 'Admin', 'Member', 'Viewer'],
} as const;

/** Manage Profile (X3). */
export const profile = {
  /**
   * Whether the page offers Delete Account (FL8). Off until its endpoint
   * exists: `DELETE /users/me` is the Delete User cascade, task 136 (M1D),
   * which turns this on (code review A1, OQ-163).
   */
  deleteAccount: false,
} as const;

/** The product's identity, drawn by the brand mark (K34, OQ-135). A proper noun: not translated. */
export const brand = {
  name: 'Finance APP',
} as const;

/** Two-factor sign-in codes (K17, OQ-139); they mirror the API's `authentication` settings. */
export const mfa = {
  /** Digits in an authenticator code (the API's `totp.digits`). */
  codeLength: 6,
  /** A backup code (the API's `recoveryCodes`): 16 characters shown in groups of 4. */
  backupCode: {
    length: 16,
    groupSize: 4,
  },
  /** The second factors offered at enrollment, in order (FR-1.15, OQ-149); v1 has the app only. */
  methods: ['authenticator'],
  /** The setup key (base32 secret) shown in groups of this many characters, for typing by hand. */
  setupKeyGroupSize: 4,
  /** The QR code's side, in CSS pixels, quiet zone included — mockup 06's white tile. */
  qrSizePx: 150,
  /**
   * The white margin the QR code draws around itself, in modules (the QR
   * standard's quiet zone): scanners need it, whatever the card behind it.
   */
  qrQuietZoneModules: 4,
} as const;

/** Copy buttons (OQ-149): how long "Copied" shows after a copy, in ms. */
export const clipboard = {
  copiedFeedbackMs: 2000,
} as const;

/** Toasts: the brief notes after a save or an error (K25, OQ-141). */
export const toast = {
  /** How long a success or info toast stays, in ms, while not hovered or focused. */
  durationMs: 5000,
  /** These stay until closed: a warning or an error must not vanish unread. */
  stickyTones: ['warning', 'error'],
  /** How many show at once (FU3 AlertUtility, OQ-152); the rest wait their turn. */
  maxVisible: 3,
} as const;

/** The App Shell (S1, OQ-156): the page addresses and what the shell remembers. */
export const shell = {
  /** Where the last active household is remembered, so a reload returns to it. */
  householdStorageKey: 'financas.household',
  /** Every page's address. `resetPassword` mirrors the API's `passwordReset.path` (OQ-147). */
  paths: {
    signIn: '/sign-in',
    register: '/register',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    onboard: '/setup',
    createHousehold: '/households/new',
    dashboard: '/',
    transactions: '/transactions',
    accountSetup: '/account-setup',
    investments: '/investments',
    household: '/household',
    profile: '/profile',
  },
} as const;
