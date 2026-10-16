import type {
  AuthTokens,
  ConfirmMfaEnrollmentData,
  CreateHouseholdData,
  CreateHouseholdResponse,
  RegisterUserData,
  RegisterUserResponse,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';

// The Onboard Experience's endpoints (X2, OQ-158): registration (OQ-148),
// confirming the MFA enrollment it starts (OQ-149) — Authenticate reaches
// that one through the enrollment step it hosts — and creating a household
// (OQ-150). Every one is a mutation: nothing here is cached. A new household
// becomes the active one, which resets the API cache, so the households list
// is fetched again without a tag.

/**
 * Builds a JSON `POST`.
 *
 * @param url - The path, relative to the API's base URL.
 * @returns The request builder for that path.
 */
const post = (url: string) => (body: object) => ({ url, method: 'POST', body });

/** Onboard's slice of the backend API. */
export const onboardApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    registerUser: build.mutation<RegisterUserResponse, RegisterUserData['body']>({
      query: post('/auth/register'),
    }),
    confirmMfaEnrollment: build.mutation<Required<AuthTokens>, ConfirmMfaEnrollmentData['body']>({
      query: post('/auth/mfa/enrollment/confirm'),
    }),
    createHousehold: build.mutation<CreateHouseholdResponse, CreateHouseholdData['body']>({
      query: post('/households'),
    }),
  }),
});

export const {
  useRegisterUserMutation,
  useConfirmMfaEnrollmentMutation,
  useCreateHouseholdMutation,
} = onboardApi;
