import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { authentication } from '../../../../src/config/constants';
import {
  hashOpaqueToken, issueOpaqueToken, signAccessToken, signChallengeToken, signEnrollmentToken,
  verifyAccessToken, verifyChallengeToken, verifyEnrollmentToken,
} from '../../../../src/utilities/authentication/tokens';

const KEY = new TextEncoder().encode('k'.repeat(32));
const OTHER_KEY = new TextEncoder().encode('x'.repeat(32));
const T0 = new Date('2026-10-08T12:00:00Z');
const CLAIMS = { userId: 'user-1', sessionId: 'session-1', systemRole: 'USER' } as const;
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe('access tokens (JWT, HS256)', () => {
  it('verify within 15 minutes and return the user, session and system role', async () => {
    const token = await signAccessToken(KEY, CLAIMS, T0);

    expect(authentication.accessToken.ttlSeconds).toBe(900);
    expect(await verifyAccessToken(KEY, token, after(899))).toEqual(CLAIMS);
  });

  /**
   * Signs a valid token with hand-picked claims.
   *
   * @param claims - The payload besides the subject.
   * @returns The compact JWT.
   */
  const signWith = (claims: Record<string, unknown>) => new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer('financas-api')
    .setAudience('financas-web')
    .setIssuedAt(Math.floor(T0.getTime() / 1000))
    .setExpirationTime(Math.floor(T0.getTime() / 1000) + 60)
    .sign(KEY);

  it.each([
    ['the session claim', { role: 'USER' }],
    ['the system role', { sid: 'session-1' }],
    ['a known system role', { sid: 'session-1', role: 'ROOT' }],
  ])('reject a validly signed token that lacks %s', async (_missing, claims) => {
    expect(await verifyAccessToken(KEY, await signWith(claims), T0)).toBeUndefined();
  });

  it('carry an ADMIN role', async () => {
    const admin = { ...CLAIMS, systemRole: 'ADMIN' } as const;

    expect(await verifyAccessToken(KEY, await signAccessToken(KEY, admin, T0), T0)).toEqual(admin);
  });

  it('expire after 15 minutes', async () => {
    const token = await signAccessToken(KEY, CLAIMS, T0);

    expect(await verifyAccessToken(KEY, token, after(901))).toBeUndefined();
  });

  it('are rejected with another key, when tampered with, or unsigned', async () => {
    const token = await signAccessToken(KEY, CLAIMS, T0);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9_999_999_999 }))
      .toString('base64url');
    const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${forgedPayload}.`;

    expect(await verifyAccessToken(OTHER_KEY, token, T0)).toBeUndefined();
    const forged = `${header}.${forgedPayload}.${signature}`;

    expect(await verifyAccessToken(KEY, forged, T0)).toBeUndefined();
    expect(await verifyAccessToken(KEY, unsigned, T0)).toBeUndefined();
    expect(await verifyAccessToken(KEY, 'garbage', T0)).toBeUndefined();
  });
});

describe('MFA challenge tokens (JWT, HS256, OQ-145)', () => {
  const CHALLENGE = { userId: 'user-1', email: 'ana@example.com' };

  it('verify within 5 minutes and return the user and address', async () => {
    const token = await signChallengeToken(KEY, CHALLENGE, T0);

    expect(authentication.challengeToken.ttlSeconds).toBe(300);
    expect(await verifyChallengeToken(KEY, token, after(299))).toEqual(CHALLENGE);
  });

  it('expire after 5 minutes', async () => {
    const token = await signChallengeToken(KEY, CHALLENGE, T0);

    expect(await verifyChallengeToken(KEY, token, after(301))).toBeUndefined();
  });

  it('never pass as access tokens, nor access tokens as challenges', async () => {
    const challenge = await signChallengeToken(KEY, CHALLENGE, T0);
    const access = await signAccessToken(KEY, CLAIMS, T0);

    expect(await verifyAccessToken(KEY, challenge, T0)).toBeUndefined();
    expect(await verifyChallengeToken(KEY, access, T0)).toBeUndefined();
  });

  it('are rejected with another key, without the address, or when garbage', async () => {
    const token = await signChallengeToken(KEY, CHALLENGE, T0);
    const noEmail = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('financas-api')
      .setAudience('financas-mfa-challenge')
      .setExpirationTime(Math.floor(T0.getTime() / 1000) + 60)
      .sign(KEY);

    expect(await verifyChallengeToken(OTHER_KEY, token, T0)).toBeUndefined();
    expect(await verifyChallengeToken(KEY, noEmail, T0)).toBeUndefined();
    expect(await verifyChallengeToken(KEY, 'garbage', T0)).toBeUndefined();
  });
});

describe('MFA enrollment tokens (JWT, HS256, OQ-149)', () => {
  const ENROLLMENT = { userId: 'user-1', email: 'ana@example.com' };

  it('verify within 15 minutes and return the user and address', async () => {
    const token = await signEnrollmentToken(KEY, ENROLLMENT, T0);

    expect(authentication.enrollmentToken.ttlSeconds).toBe(900);
    expect(await verifyEnrollmentToken(KEY, token, after(899))).toEqual(ENROLLMENT);
  });

  it('expire after 15 minutes', async () => {
    const token = await signEnrollmentToken(KEY, ENROLLMENT, T0);

    expect(await verifyEnrollmentToken(KEY, token, after(901))).toBeUndefined();
  });

  it('never pass as challenge or access tokens, nor those as enrollments', async () => {
    const enrollment = await signEnrollmentToken(KEY, ENROLLMENT, T0);
    const challenge = await signChallengeToken(KEY, ENROLLMENT, T0);
    const access = await signAccessToken(KEY, CLAIMS, T0);

    expect(await verifyChallengeToken(KEY, enrollment, T0)).toBeUndefined();
    expect(await verifyAccessToken(KEY, enrollment, T0)).toBeUndefined();
    expect(await verifyEnrollmentToken(KEY, challenge, T0)).toBeUndefined();
    expect(await verifyEnrollmentToken(KEY, access, T0)).toBeUndefined();
  });

  it('are rejected with another key or when garbage', async () => {
    const token = await signEnrollmentToken(KEY, ENROLLMENT, T0);

    expect(await verifyEnrollmentToken(OTHER_KEY, token, T0)).toBeUndefined();
    expect(await verifyEnrollmentToken(KEY, 'garbage', T0)).toBeUndefined();
  });
});

describe('opaque tokens', () => {
  it('are 256 random bits, given once, stored only as a SHA-256 hash', () => {
    const { token, tokenHash } = issueOpaqueToken((size) => Buffer.alloc(size, 9));

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokenHash).toBe(hashOpaqueToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
  });
});
