import { translateApiError } from "@repo/i18n";
import type { TFunction } from "i18next";
import type { ZodIssue } from "zod";
import { isAuthApiError } from "../hooks/use-auth-mutations.js";

/** i18n keys stored in state so locale changes re-render with t() at display time. */
export type AuthFieldErrorKey =
  | "errors.validation.email"
  | "errors.validation.password"
  | "errors.validation.failed";

export type AuthFieldErrors = {
  email?: AuthFieldErrorKey;
  password?: AuthFieldErrorKey;
};

export function fieldErrorsFromZodIssues(
  issues: ZodIssue[],
  passwordErrorKey: AuthFieldErrorKey = "errors.validation.password",
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field === "email" && !errors.email) {
      errors.email = "errors.validation.email";
    }
    if (field === "password" && !errors.password) {
      errors.password = passwordErrorKey;
    }
  }
  return errors;
}

export function resolveAuthSubmitError(error: unknown, t: TFunction): string {
  if (isAuthApiError(error)) {
    return translateApiError(t, error.apiError);
  }
  if (error instanceof TypeError) {
    return t("errors.common.network");
  }
  return t("errors.common.internal");
}
