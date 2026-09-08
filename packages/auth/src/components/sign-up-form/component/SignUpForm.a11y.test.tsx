import { createI18n } from "@repo/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { createAuthApiClient } from "../../../api/auth-api-client.js";
import { AuthProvider } from "../../auth-provider/index.js";
import { SignUpForm } from "./SignUpForm.js";

async function renderWithProviders(ui: ReactNode) {
  const i18n = await createI18n();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = createAuthApiClient({
    fetch: vi.fn(),
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={client}>
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("SignUpForm a11y", () => {
  it("has no axe violations", async () => {
    const { container } = await renderWithProviders(<SignUpForm />);
    const results = await axe(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
