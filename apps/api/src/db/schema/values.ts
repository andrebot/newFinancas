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
/** When a fixed-term contract pays interest (FR-11.2, OQ-201). */
export const INTEREST_PAYMENTS = ['at_maturity', 'monthly', 'semiannual'] as const;
export const ARCHIVED_BY = ['system', 'user'] as const;
export const SNAPSHOT_SOURCES = ['manual', 'transaction'] as const;
export const TRANSACTION_EFFECTS = [
  'movement', 'transfer', 'bill_payment', 'investment_trade',
] as const;
export const TRANSACTION_SOURCES = ['manual', 'schedule'] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type SystemRole = (typeof SYSTEM_ROLES)[number];
/** A household role (FR-1.6): the vocabulary authorization, the Manager and the Accessors share. */
export type Role = (typeof ROLES)[number];
/** The roles a role change or an invite can give; the Owner role moves only by a transfer. */
export type AssignableRole = Exclude<Role, 'Owner'>;
/** What a Financial Account is (FR-2.1, OQ-76); immutable once set (OQ-32). */
export type AccountType = (typeof ACCOUNT_TYPES)[number];
/** Who sees a record: its owner only, or the whole household (FR-2.3/FR-4.2). */
export type Visibility = (typeof VISIBILITIES)[number];
/** When a fixed-term contract pays interest (OQ-201). */
export type InterestPayment = (typeof INTEREST_PAYMENTS)[number];
/** How a Valuation Snapshot was written: by hand, or by a trade (OQ-56). */
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];
