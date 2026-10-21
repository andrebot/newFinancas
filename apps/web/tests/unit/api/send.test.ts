import { describe, expect, it } from 'vitest';
import send from '../../../src/api/send';

// Pure Utility (BDT: unit, nothing mocked).

describe('send', () => {
  it('builds a request with its method, path and body', () => {
    expect(send('PATCH', '/users/me', { firstName: 'Ana' })).toEqual({
      url: '/users/me', method: 'PATCH', body: { firstName: 'Ana' },
    });
  });

  it('leaves the body out when there is none', () => {
    expect(send('DELETE', '/users/me')).toEqual({
      url: '/users/me', method: 'DELETE', body: undefined,
    });
  });
});
