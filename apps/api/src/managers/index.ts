import type { ServiceBus } from '../utilities/serviceBus';
import {
  createAccountManager, subscribeAccountManager, type AccountDeps, type AccountManager,
} from './account';
import { createIdentityManager, type IdentityDeps, type IdentityManager } from './identity';

// The Managers, built and joined on the bus in one step (VBD §3.0, OQ-199): a
// Manager can't be had without its subscriptions, so the composition root can't
// lose one quietly, and the bus seam test runs the wiring server.ts runs. No
// Manager calls another here — this only composes them.

/** What every Manager needs, by Manager; the bus is shared. */
export interface ManagersDeps {
  readonly bus: ServiceBus;
  readonly identity: Omit<IdentityDeps, 'bus'>;
  readonly account: AccountDeps;
}

/** Every Manager, as the HTTP app takes them. */
export interface Managers {
  readonly identity: IdentityManager;
  readonly account: AccountManager;
}

/**
 * Creates every Manager and subscribes each to the events it handles.
 *
 * @param deps - The bus, and each Manager's tier below.
 * @returns The Managers.
 */
export const createManagers = (deps: ManagersDeps): Managers => {
  const identity = createIdentityManager({ ...deps.identity, bus: deps.bus });
  const account = createAccountManager(deps.account);
  subscribeAccountManager(deps.bus, account);
  return { identity, account };
};
