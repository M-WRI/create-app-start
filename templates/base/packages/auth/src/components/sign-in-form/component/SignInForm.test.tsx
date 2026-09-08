import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthApiError } from "../../../api/auth-api-client.js";
import {
  createMockAuthClient,
  renderWithAuth,
  sessionUser,
} from "../../../test/render-with-auth.js";
import { SignInForm } from "./SignInForm.js";

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  it("shows field validation messages for invalid input", async () => {
    await renderWithAuth(<SignInForm />);
    await fillAndSubmit("not-an-email", "");

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Please check the form and try again.")).toBeTruthy();
  });

  it("calls onSuccess after a successful login mutation", async () => {
    const onSuccess = vi.fn();
    const client = createMockAuthClient({
      login: vi.fn().mockResolvedValue({ user: sessionUser }),
    });
    await renderWithAuth(<SignInForm onSuccess={onSuccess} />, { client });

    await fillAndSubmit("a@b.co", "password1");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(client.login).toHaveBeenCalledWith({ email: "a@b.co", password: "password1" });
  });

  it("shows translated AuthApiError from the server", async () => {
    const client = createMockAuthClient({
      login: vi.fn().mockRejectedValue(
        new AuthApiError({
          status: 401,
          errorMessage: "bad",
          errorCode: "AUTH_INVALID_CREDENTIALS",
          errorKey: "errors.auth.invalidCredentials",
        }),
      ),
    });
    await renderWithAuth(<SignInForm />, { client });

    await fillAndSubmit("a@b.co", "password1");

    expect(await screen.findByText("Invalid email or password.")).toBeTruthy();
  });

  it("shows network copy when fetch rejects with TypeError", async () => {
    const client = createMockAuthClient({
      login: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    await renderWithAuth(<SignInForm />, { client });

    await fillAndSubmit("a@b.co", "password1");

    expect(
      await screen.findByText("Network error. Check your connection and try again."),
    ).toBeTruthy();
  });

  it("shows internal copy for unexpected non-API rejections", async () => {
    const client = createMockAuthClient({
      login: vi.fn().mockRejectedValue(new Error("boom")),
    });
    await renderWithAuth(<SignInForm />, { client });

    await fillAndSubmit("a@b.co", "password1");

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
  });
});
