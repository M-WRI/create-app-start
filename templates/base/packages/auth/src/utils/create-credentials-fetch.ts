import type { AuthApiClient } from "../api/auth-api-client.js";
import { AuthApiError } from "../api/auth-api-client.js";

/**
 * Fetch wrapper: on 401, attempt one refresh via cookies, then retry the request.
 * Tokens never touch JS storage — cookies only.
 */
export function createCredentialsFetch(options: {
  client: AuthApiClient;
  fetch?: typeof fetch;
}): typeof fetch {
  const fetchImpl = options.fetch ?? fetch;
  let refreshPromise: Promise<unknown> | null = null;

  return async (input, init) => {
    const response = await fetchImpl(input, { ...init, credentials: "include" });
    if (response.status !== 401) {
      return response;
    }

    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/v1/auth/refresh") || url.includes("/api/v1/auth/login")) {
      return response;
    }

    try {
      refreshPromise ??= options.client.refresh().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
    } catch (error) {
      if (error instanceof AuthApiError) {
        return response;
      }
      return response;
    }

    return fetchImpl(input, { ...init, credentials: "include" });
  };
}
