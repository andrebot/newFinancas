import { describe, expect, it } from 'vitest';
import { actorLabel, userIdFromActor } from '../../src/events';

describe('actors (NFR-OBS-2)', () => {
  it.each([
    [{ userId: 'u1' }, 'user:u1'],
    ['system', 'system'],
    ['unauthenticated', 'unauthenticated'],
  ] as const)('labels %j as %s', (actor, label) => {
    expect(actorLabel(actor)).toBe(label);
  });

  it.each([
    ['user:u1', 'u1'],
    ['system', null],
    ['unauthenticated', null],
    [undefined, null],
    [42, null],
  ])('reads the user id of %j as %j', (label, userId) => {
    expect(userIdFromActor(label)).toBe(userId);
  });
});
