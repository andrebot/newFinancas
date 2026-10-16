import type {
  AuthTokens,
  ConfirmMfaEnrollmentData,
  ConfirmPasswordResetData,
  LoginData,
  LoginResponse,
  RecoverWithMfaCodeData,
  RequestPasswordResetData,
  VerifyMfaData,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';

// The Authenticate Experience's endpoints (X1, OQ-157): two-step sign-in
// (OQ-145), resuming an unconfirmed MFA enrollment (OQ-149), sign-out and
// password reset (OQ-147). Every one is a mutation: nothing here is cached,
// and the session's start or end resets the API cache anyway.

/** A token pair; the contract always answers both on these endpoints. */
type SessionTokens = Required<AuthTokens>;

/**
 * Builds a JSON `POST`.
 *
 * @param url - The path, relative to the API's base URL.
 * @returns The request builder for that path.
 */
const post = (url: string) => (body?: object) => ({ url, method: 'POST', body });

/** Authenticate's slice of the backend API. */
export const authenticateApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginData['body']>({
      query: post('/auth/login'),
    }),
    verifyMfa: build.mutation<SessionTokens, VerifyMfaData['body']>({
      query: post('/auth/mfa/verify'),
    }),
    recoverWithMfaCode: build.mutation<SessionTokens, RecoverWithMfaCodeData['body']>({
      query: post('/auth/mfa/recover'),
    }),
    confirmMfaEnrollment: build.mutation<SessionTokens, ConfirmMfaEnrollmentData['body']>({
      query: post('/auth/mfa/enrollment/confirm'),
    }),
    logout: build.mutation<void, void>({
      query: () => post('/auth/logout')(),
    }),
    requestPasswordReset: build.mutation<void, RequestPasswordResetData['body']>({
      query: post('/auth/password-reset/request'),
    }),
    confirmPasswordReset: build.mutation<void, ConfirmPasswordResetData['body']>({
      query: post('/auth/password-reset/confirm'),
    }),
  }),
});

export const {
  useLoginMutation,
  useVerifyMfaMutation,
  useRecoverWithMfaCodeMutation,
  useConfirmMfaEnrollmentMutation,
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
} = authenticateApi;
