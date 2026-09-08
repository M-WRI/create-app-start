import {
  type ApiError,
  type AuthSessionResponse,
  IDEMPOTENCY_KEY_HEADER,
  type LoginRequest,
  type RegisterRequest,
  authSessionResponseSchema,
  loginRequestSchema,
  normalizeApiError,
  registerRequestSchema,
} from "@repo/contracts";

export type ApiClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class AuthApiError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.errorMessage);
    this.name = "AuthApiError";
    this.apiError = apiError;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function createAuthApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetch ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit & { schema?: { parse: (value: unknown) => T } } = {},
  ): Promise<T> {
    const { schema, ...requestInit } = init;
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...requestInit,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(requestInit.headers ?? {}),
      },
    });

    const body = await parseJson(response);

    if (!response.ok) {
      throw new AuthApiError(
        normalizeApiError({
          status: response.status,
          body,
          fallbackMessage: response.statusText || "Request failed",
        }),
      );
    }

    if (!schema) {
      return undefined as T;
    }

    return schema.parse(body);
  }

  return {
    register(input: RegisterRequest, idempotencyKey: string) {
      const payload = registerRequestSchema.parse(input);
      return request("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        schema: authSessionResponseSchema,
      });
    },
    login(input: LoginRequest) {
      const payload = loginRequestSchema.parse(input);
      return request("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
        schema: authSessionResponseSchema,
      });
    },
    logout() {
      return request<void>("/api/v1/auth/logout", { method: "POST" });
    },
    refresh() {
      return request<AuthSessionResponse | undefined>("/api/v1/auth/refresh", {
        method: "POST",
        schema: authSessionResponseSchema,
      });
    },
    me() {
      return request("/api/v1/auth/me", {
        method: "GET",
        schema: authSessionResponseSchema,
      });
    },
  };
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>;
