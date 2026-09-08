export {
  AuthApiError,
  createAuthApiClient,
  type ApiClientOptions,
  type AuthApiClient,
} from "./api/auth-api-client.js";
export { AUTH_API_BASE_PATH, AUTH_QUERY_KEYS, AUTH_ROUTES } from "./constants/auth-constants.js";
export { AuthProvider, type AuthProviderProps } from "./components/auth-provider/index.js";
export { AuthLayout, type AuthLayoutProps } from "./components/auth-layout/index.js";
export {
  RequireAuth,
  RequireRole,
  type RequireAuthProps,
  type RequireRoleProps,
} from "./components/require-auth/index.js";
export { SignInForm, type SignInFormProps } from "./components/sign-in-form/index.js";
export { SignUpForm, type SignUpFormProps } from "./components/sign-up-form/index.js";
export { SignInPage, type SignInPageProps } from "./pages/sign-in-page/index.js";
export { SignUpPage, type SignUpPageProps } from "./pages/sign-up-page/index.js";
export { AuthClientProvider, useAuthClient } from "./hooks/use-auth-client.js";
export {
  isAuthApiError,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useRefreshSessionMutation,
  useRegisterMutation,
} from "./hooks/use-auth-mutations.js";
export { createCredentialsFetch } from "./utils/create-credentials-fetch.js";
