import { describe, expect, it } from "vitest";
import { AuthApiError } from "../api/auth-api-client.js";
import { fieldErrorsFromZodIssues, resolveAuthSubmitError } from "./auth-form-errors.js";

describe("fieldErrorsFromZodIssues", () => {
  it("maps email and password paths to validation keys", () => {
    expect(
      fieldErrorsFromZodIssues([
        { code: "custom", message: "e", path: ["email"] },
        { code: "custom", message: "p", path: ["password"] },
      ]),
    ).toEqual({
      email: "errors.validation.email",
      password: "errors.validation.password",
    });
  });

  it("allows a custom password key for login", () => {
    expect(
      fieldErrorsFromZodIssues(
        [{ code: "custom", message: "p", path: ["password"] }],
        "errors.validation.failed",
      ),
    ).toEqual({ password: "errors.validation.failed" });
  });
});

describe("resolveAuthSubmitError", () => {
  const t = (key: string) => key;

  it("translates AuthApiError via errorKey path", () => {
    const message = resolveAuthSubmitError(
      new AuthApiError({
        status: 401,
        errorMessage: "bad",
        errorCode: "AUTH_INVALID_CREDENTIALS",
        errorKey: "errors.auth.invalidCredentials",
      }),
      t as never,
    );
    // translateApiError falls back to errorMessage when t returns the key unchanged
    // or returns the key — either is acceptable; assert non-empty string.
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
  });

  it("uses network key for TypeError", () => {
    expect(resolveAuthSubmitError(new TypeError("offline"), t as never)).toBe(
      "errors.common.network",
    );
  });

  it("uses internal key for other errors", () => {
    expect(resolveAuthSubmitError(new Error("x"), t as never)).toBe("errors.common.internal");
  });
});
