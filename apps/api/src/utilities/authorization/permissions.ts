import type { Role } from '../../accessors/householdAccessor';
import type { VISIBILITIES } from '../../db/schema/values';

// The household role → permission table (U5, FR-1.7, OQ-111). It is product
// reference data, like Transaction Kind's effects: a new built-in role or action
// changes this table, not a database row (VBD §2.3 rejected a RolePermissionAccessor).
// `decide` is pure: the caller supplies the role and the facts about the target.
// Rules about the household's state — who may be removed (never the Owner by
// someone else), succession, transfer — are IdentityManager's, not this table's.

export type Visibility = (typeof VISIBILITIES)[number];

/** Actions on the household itself. */
export type HouseholdAction = | 'household.view'
  | 'household.delete'
  | 'household.transferOwnership'
  | 'members.manage'
  | 'audit.export';

/** Actions on household data that is personal or shared (accounts, budgets, goals…). */
export type DataAction = 'data.view' | 'data.create' | 'data.edit' | 'data.delete';

export type Action = HouseholdAction | DataAction;

/** What is being attempted, with the facts about its target the rules need. */
export type AccessRequest = | { readonly action: HouseholdAction }
  /** `ownerUserId` is the personal owner, or who created shared data (null when unknown). */
  | {
    readonly action: DataAction;
    readonly visibility: Visibility;
    readonly ownerUserId: string | null;
  };

/**
 * `not_visible`: the target is someone else's personal data — the caller
 * answers 404 so its existence isn't revealed. `forbidden`: answer 403.
 */
export type Decision = 'allowed' | 'forbidden' | 'not_visible';

const EVERYONE: readonly Role[] = ['Owner', 'Admin', 'Member', 'Viewer'];

/** Roles allowed each action; a Member may also edit and delete shared data they created. */
export const PERMISSIONS: Readonly<Record<Action, readonly Role[]>> = {
  'household.view': EVERYONE,
  'household.delete': ['Owner'],
  'household.transferOwnership': ['Owner'],
  'members.manage': ['Owner', 'Admin'],
  'audit.export': ['Owner', 'Admin'],
  'data.view': EVERYONE,
  'data.create': ['Owner', 'Admin', 'Member'],
  'data.edit': ['Owner', 'Admin'],
  'data.delete': ['Owner', 'Admin'],
};

/** Shared-data actions a Member may also take on what they created (OQ-111). */
const CREATOR_ACTIONS: ReadonlySet<Action> = new Set(['data.edit', 'data.delete']);

/**
 * Turns a yes/no into a decision.
 *
 * @param allowed - Whether the rule allows it.
 * @returns `allowed` or `forbidden`.
 */
const allowIf = (allowed: boolean): Decision => (allowed ? 'allowed' : 'forbidden');

/**
 * Decides an action on personal or shared data. Personal data belongs to its
 * owner whatever their role — a Viewer manages their own — and is invisible
 * to everyone else. Shared data follows the table, plus a Member may edit and
 * delete anything they created, even an account holding others' transactions
 * (OQ-111).
 *
 * @param role - The actor's role.
 * @param actorId - The actor.
 * @param request - The data action and its target.
 * @returns The decision.
 */
const decideData = (
  role: Role,
  actorId: string,
  request: Extract<AccessRequest, { action: DataAction }>,
): Decision => {
  const isOwn = request.ownerUserId === actorId;
  if (request.visibility === 'personal') return isOwn ? 'allowed' : 'not_visible';
  const createdIt = CREATOR_ACTIONS.has(request.action) && role === 'Member' && isOwn;
  return allowIf(PERMISSIONS[request.action].includes(role) || createdIt);
};

/**
 * Decides whether a household member may do something (FR-1.7, FR-1.20,
 * FR-7.2, FR-2.3/4.2/8.1).
 *
 * @param role - The actor's role in the household.
 * @param actorId - The actor.
 * @param request - The action and the facts about its target.
 * @returns The decision.
 */
export const decide = (role: Role, actorId: string, request: AccessRequest): Decision => (
  'visibility' in request
    ? decideData(role, actorId, request)
    : allowIf(PERMISSIONS[request.action].includes(role))
);
