import type { ApiError } from "@repo/contracts";
import type { TFunction } from "i18next";

export function translateErrorKey(t: TFunction, errorKey: string, fallback?: string): string {
  const translated = t(errorKey, { defaultValue: "" });
  if (translated && translated !== errorKey) {
    return translated;
  }
  return fallback ?? errorKey;
}

export function translateApiError(t: TFunction, error: ApiError): string {
  return translateErrorKey(t, error.errorKey, error.errorMessage);
}
