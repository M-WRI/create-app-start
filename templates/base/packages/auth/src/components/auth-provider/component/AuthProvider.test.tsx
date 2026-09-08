import { createI18n } from "@repo/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createAuthApiClient } from "../../../api/auth-api-client.js";
import { useAuthClient } from "../../../hooks/use-auth-client.js";
import { renderWithAuth } from "../../../test/render-with-auth.js";
import { AuthProvider } from "./AuthProvider.js";

function Probe() {
  const client = useAuthClient();
  return <p>{typeof client.login === "function" ? "has-client" : "missing"}</p>;
}

describe("AuthProvider", () => {
  it("exposes an injected client to descendants", async () => {
    const client = createAuthApiClient({ fetch: vi.fn() });
    await renderWithAuth(<Probe />, { client });
    expect(screen.getByText("has-client")).toBeTruthy();
  });

  it("builds a client from clientOptions when none is injected", async () => {
    const i18n = await createI18n();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider clientOptions={{ fetch: vi.fn(), baseUrl: "http://localhost" }}>
            <Probe />
          </AuthProvider>
        </QueryClientProvider>
      </I18nextProvider>,
    );

    expect(screen.getByText("has-client")).toBeTruthy();
  });
});
