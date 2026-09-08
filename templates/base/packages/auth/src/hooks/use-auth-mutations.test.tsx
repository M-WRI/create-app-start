import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthApiError } from "../api/auth-api-client.js";
import { AuthProvider } from "../components/auth-provider/index.js";
import { AUTH_QUERY_KEYS } from "../constants/auth-constants.js";
import { createMockAuthClient, sessionUser } from "../test/render-with-auth.js";
import { useAuthClient } from "./use-auth-client.js";
import { useLogoutMutation, useMeQuery, useRefreshSessionMutation } from "./use-auth-mutations.js";

function wrapperFor(client: ReturnType<typeof createMockAuthClient>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={client}>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}

describe("useAuthClient", () => {
  it("throws outside AuthProvider", () => {
    expect(() => renderHook(() => useAuthClient())).toThrow(
      /useAuthClient must be used within AuthClientProvider/,
    );
  });
});

describe("auth mutations", () => {
  it("clears me cache on logout success", async () => {
    const client = createMockAuthClient({
      logout: vi.fn().mockResolvedValue(undefined),
    });
    const { Wrapper, queryClient } = wrapperFor(client);
    queryClient.setQueryData(AUTH_QUERY_KEYS.me, { user: sessionUser });

    const { result } = renderHook(() => useLogoutMutation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(queryClient.getQueryData(AUTH_QUERY_KEYS.me)).toBeUndefined();
  });

  it("surfaces logout failure on the mutation", async () => {
    const client = createMockAuthClient({
      logout: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    const { Wrapper } = wrapperFor(client);
    const { result } = renderHook(() => useLogoutMutation(), { wrapper: Wrapper });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(TypeError);
  });

  it("updates me cache after refresh success", async () => {
    const refreshed = {
      user: { ...sessionUser, email: "refreshed@b.co" },
    };
    const client = createMockAuthClient({
      refresh: vi.fn().mockResolvedValue(refreshed),
    });
    const { Wrapper, queryClient } = wrapperFor(client);
    const { result } = renderHook(() => useRefreshSessionMutation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(queryClient.getQueryData(AUTH_QUERY_KEYS.me)).toEqual(refreshed);
  });

  it("keeps me cache when refresh fails", async () => {
    const failure = new AuthApiError({
      status: 401,
      errorMessage: "expired",
      errorCode: "AUTH_UNAUTHORIZED",
      errorKey: "errors.auth.unauthorized",
    });
    const client = createMockAuthClient({
      refresh: vi.fn().mockRejectedValue(failure),
    });
    const { Wrapper, queryClient } = wrapperFor(client);
    queryClient.setQueryData(AUTH_QUERY_KEYS.me, { user: sessionUser });

    const { result } = renderHook(() => useRefreshSessionMutation(), { wrapper: Wrapper });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(AuthApiError);
    expect(caught).toMatchObject({
      apiError: { errorKey: "errors.auth.unauthorized" },
    });
    expect(queryClient.getQueryData(AUTH_QUERY_KEYS.me)).toEqual({ user: sessionUser });
  });

  it("loads me through useMeQuery", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockResolvedValue({ user: sessionUser }),
    });
    const { Wrapper } = wrapperFor(client);
    const { result } = renderHook(() => useMeQuery(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.user.email).toBe("a@b.co");
  });
});
