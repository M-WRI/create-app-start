import type { ReactNode } from "react";
import {
  type ApiClientOptions,
  type AuthApiClient,
  createAuthApiClient,
} from "../../../api/auth-api-client.js";
import { AuthClientProvider } from "../../../hooks/use-auth-client.js";

export type AuthProviderProps = {
  children: ReactNode;
  client?: AuthApiClient;
  clientOptions?: ApiClientOptions;
};

export function AuthProvider({ children, client, clientOptions }: AuthProviderProps) {
  const value = { client: client ?? createAuthApiClient(clientOptions) };
  return <AuthClientProvider value={value}>{children}</AuthClientProvider>;
}
