import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { safeStorage } from '../../../src/utilities/safeStorage';

// Never-throwing storage (BDT: Utility → unit). jsdom's own localStorage;
// only its failures are simulated.

describe('safeStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('reads and writes the given key', () => {
    const storage = safeStorage(() => localStorage, 'test.key');

    expect(storage.read()).toBeNull();
    storage.write('light');
    expect(storage.read()).toBe('light');
    expect(localStorage.getItem('test.key')).toBe('light');
  });

  it('forgets the value on remove', () => {
    const storage = safeStorage(() => localStorage, 'test.key');
    storage.write('light');

    storage.remove();

    expect(storage.read()).toBeNull();
  });

  it('reads nothing and writes nothing when storage cannot be reached', () => {
    const unreachable = (): Storage => {
      throw new Error('SecurityError');
    };
    const storage = safeStorage(unreachable, 'test.key');

    expect(storage.read()).toBeNull();
    expect(() => storage.write('light')).not.toThrow();
    expect(() => storage.remove()).not.toThrow();
  });

  it('swallows a failing write (quota, private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const storage = safeStorage(() => localStorage, 'test.key');

    expect(() => storage.write('light')).not.toThrow();
  });
});
