import { createContext, useContext } from "react";
import type { AuthApiClient } from "../api/auth-api-client.js";

export type AuthClientContextValue = {
  client: AuthApiClient;
};

const AuthClientContext = createContext<AuthClientContextValue | null>(null);

export const AuthClientProvider = AuthClientContext.Provider;

export function useAuthClient(): AuthApiClient {
  const value = useContext(AuthClientContext);
  if (!value) {
    throw new Error("useAuthClient must be used within AuthClientProvider");
  }
  return value.client;
}
