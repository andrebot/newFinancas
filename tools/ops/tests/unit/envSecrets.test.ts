import { describe, expect, it } from 'vitest';
import { envValue, fillSecrets, SECRET_PLACEHOLDERS } from '../../src/envSecrets';

const generate = (key: string) => `new-${key}`;

describe('envValue', () => {
  it('reads a variable and returns undefined when absent', () => {
    expect(envValue('A=1\nJWT_SECRET=abc=def\n', 'JWT_SECRET')).toBe('abc=def');
    expect(envValue('A=1', 'JWT_SECRET')).toBeUndefined();
  });
});

describe('fillSecrets', () => {
  it('replaces the public placeholders in place', () => {
    const text = [
      'PORT=3000',
      `JWT_SECRET=${SECRET_PLACEHOLDERS.JWT_SECRET}`,
      `MFA_ENCRYPTION_KEY=${SECRET_PLACEHOLDERS.MFA_ENCRYPTION_KEY}`,
      'X=1',
      '',
    ].join('\n');

    const result = fillSecrets(text, generate);

    expect(result.text).toBe(
      'PORT=3000\nJWT_SECRET=new-JWT_SECRET\nMFA_ENCRYPTION_KEY=new-MFA_ENCRYPTION_KEY\nX=1\n',
    );
    expect(result.filled).toEqual(['JWT_SECRET', 'MFA_ENCRYPTION_KEY']);
  });

  it('never touches a value that is already real', () => {
    const text = 'JWT_SECRET=my-real-secret\nMFA_ENCRYPTION_KEY=real-key\n';

    const result = fillSecrets(text, generate);

    expect(result.text).toBe(text);
    expect(result.kept).toEqual(['JWT_SECRET', 'MFA_ENCRYPTION_KEY']);
  });

  it('fills empty values and appends missing ones', () => {
    const result = fillSecrets('JWT_SECRET=\nPORT=3000', generate);

    expect(result.text).toBe(
      'JWT_SECRET=new-JWT_SECRET\nPORT=3000\nMFA_ENCRYPTION_KEY=new-MFA_ENCRYPTION_KEY\n',
    );
  });
});
