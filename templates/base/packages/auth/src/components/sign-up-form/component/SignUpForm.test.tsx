import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthApiError } from "../../../api/auth-api-client.js";
import {
  createMockAuthClient,
  renderWithAuth,
  sessionUser,
} from "../../../test/render-with-auth.js";
import { SignUpForm } from "./SignUpForm.js";

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
}

describe("SignUpForm", () => {
  it("shows field validation for invalid email and short password", async () => {
    await renderWithAuth(<SignUpForm />);
    await fillAndSubmit("bad", "short");

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeTruthy();
  });

  it("calls onSuccess after a successful register mutation", async () => {
    const onSuccess = vi.fn();
    const client = createMockAuthClient({
      register: vi.fn().mockResolvedValue({ user: sessionUser }),
    });
    await renderWithAuth(<SignUpForm onSuccess={onSuccess} />, { client });

    await fillAndSubmit("a@b.co", "password1");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(client.register).toHaveBeenCalledWith(
      { email: "a@b.co", password: "password1" },
      expect.any(String),
    );
  });

  it("shows translated AuthApiError when email is taken", async () => {
    const client = createMockAuthClient({
      register: vi.fn().mockRejectedValue(
        new AuthApiError({
          status: 409,
          errorMessage: "taken",
          errorCode: "AUTH_EMAIL_TAKEN",
          errorKey: "errors.auth.emailTaken",
        }),
      ),
    });
    await renderWithAuth(<SignUpForm />, { client });

    await fillAndSubmit("a@b.co", "password1");

    expect(await screen.findByText("An account with this email already exists.")).toBeTruthy();
  });

  it("shows network copy on TypeError rejection", async () => {
    const client = createMockAuthClient({
      register: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    await renderWithAuth(<SignUpForm />, { client });

    await fillAndSubmit("a@b.co", "password1");

    expect(
      await screen.findByText("Network error. Check your connection and try again."),
    ).toBeTruthy();
  });
});
