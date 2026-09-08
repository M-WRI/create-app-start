import { AuthProvider, createAuthApiClient, createCredentialsFetch } from "@repo/auth";
import { createI18n } from "@repo/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { i18n as I18nInstance } from "i18next";
import { type ReactNode, useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";

type AppProvidersProps = {
  children: ReactNode;
  i18n: I18nInstance;
};

export function AppProviders({ children, i18n }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );

  const authClient = useMemo(() => {
    const baseClient = createAuthApiClient();
    return createAuthApiClient({
      fetch: createCredentialsFetch({ client: baseClient }),
    });
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={authClient}>{children}</AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

export { createI18n };
