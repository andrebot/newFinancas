import { describe, expect, it } from 'vitest';
import { actorLabel, actorUserId } from '../../src/events';

describe('actors (NFR-OBS-2)', () => {
  it.each([
    [{ userId: 'u1' }, 'user:u1', 'u1'],
    ['system', 'system', null],
    ['unauthenticated', 'unauthenticated', null],
  ] as const)('%j → label %s, audit actor %s', (actor, label, userId) => {
    expect(actorLabel(actor)).toBe(label);
    expect(actorUserId(actor)).toBe(userId);
  });
});
