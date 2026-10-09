// Closed value sets, stored as text + CHECK (OQ-95). Extensible reference data
// (transaction kinds, asset types, card networks, index codes, notification
// types, …) is plain text validated in code instead (02-data-model.md).

/** Platform-wide role (OQ-111): ADMIN includes USER; registration always makes a USER. */
export const SYSTEM_ROLES = ['USER', 'ADMIN'] as const;
/** Role within one household (FR-1.6). */
export const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'] as const;
export const INVITABLE_ROLES = ['Admin', 'Member', 'Viewer'] as const;
export const INVITATION_STATUSES = ['pending', 'accepted', 'declined', 'revoked'] as const;
export const THEMES = ['dark', 'light', 'system'] as const;
export const LANGUAGES = ['pt-BR', 'en-US'] as const;
export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card_only', 'investment'] as const;
export const VISIBILITIES = ['personal', 'shared'] as const;
export const RATE_TYPES = ['fixed', 'cdi', 'ipca', 'igpm', 'selic'] as const;
export const ARCHIVED_BY = ['system', 'user'] as const;
export const SNAPSHOT_SOURCES = ['manual', 'transaction'] as const;
export const TRANSACTION_EFFECTS = [
  'movement', 'transfer', 'bill_payment', 'investment_trade',
] as const;
export const TRANSACTION_SOURCES = ['manual', 'schedule'] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type SystemRole = (typeof SYSTEM_ROLES)[number];
