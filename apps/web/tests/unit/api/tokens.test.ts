import { describe, expect, it } from 'vitest';
import { createTokenStore } from '../../../src/api/tokens';
import { memoryStorage } from './fakes';

// Token store (BDT: API client → unit). Mocked: only storage.

describe('createTokenStore', () => {
  it('starts with no access token and the remembered refresh token', () => {
    const tokens = createTokenStore(memoryStorage('refresh-1'));

    expect(tokens.accessToken()).toBeUndefined();
    expect(tokens.refreshToken()).toBe('refresh-1');
  });

  it('has no refresh token when nothing (or an empty value) is remembered', () => {
    expect(createTokenStore(memoryStorage()).refreshToken()).toBeUndefined();
    expect(createTokenStore(memoryStorage('')).refreshToken()).toBeUndefined();
  });

  it('keeps the access token in memory and the refresh token in storage', () => {
    const storage = memoryStorage();
    const tokens = createTokenStore(storage);
    tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    expect(tokens.accessToken()).toBe('access-1');
    expect(storage.value).toBe('refresh-1');
  });

  it('reads the refresh token from storage on every use (another tab may rotate it)', () => {
    const storage = memoryStorage('refresh-1');
    const tokens = createTokenStore(storage);
    storage.value = 'refresh-2';

    expect(tokens.refreshToken()).toBe('refresh-2');
  });

  it('forgets both tokens on clear', () => {
    const storage = memoryStorage();
    const tokens = createTokenStore(storage);
    tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    tokens.clear();

    expect(tokens.accessToken()).toBeUndefined();
    expect(storage.value).toBeNull();
  });
});
