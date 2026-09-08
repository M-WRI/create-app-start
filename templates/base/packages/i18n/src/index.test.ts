import { ERROR_KEYS } from "@repo/contracts";
import { describe, expect, it } from "vitest";
import { createI18n } from "./create-i18n.js";
import { translateApiError, translateErrorKey } from "./translate-error.js";

describe("i18n catalogs", () => {
  it("resolves all contract error keys", async () => {
    const instance = await createI18n({ locale: "en" });
    for (const key of Object.values(ERROR_KEYS)) {
      const value = instance.t(key);
      expect(value).not.toBe(key);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("translates ApiError via errorKey", async () => {
    const instance = await createI18n();
    const message = translateApiError(instance.t.bind(instance), {
      status: 401,
      errorCode: "AUTH_INVALID_CREDENTIALS",
      errorKey: ERROR_KEYS.AUTH_INVALID_CREDENTIALS,
      errorMessage: "dev only",
    });
    expect(message).toBe("Invalid email or password.");
    expect(translateErrorKey(instance.t.bind(instance), "missing.key", "fallback")).toBe(
      "fallback",
    );
  });
});
