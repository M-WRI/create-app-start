import type { LoginRequest, RegisterRequest } from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthApiError } from "../api/auth-api-client.js";
import { AUTH_QUERY_KEYS } from "../constants/auth-constants.js";
import { useAuthClient } from "./use-auth-client.js";

export function useMeQuery() {
  const client = useAuthClient();
  return useQuery({
    queryKey: AUTH_QUERY_KEYS.me,
    queryFn: () => client.me(),
    retry: false,
  });
}

export function useLoginMutation() {
  const client = useAuthClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => client.login(input),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEYS.me, data);
    },
  });
}

export function useRegisterMutation() {
  const client = useAuthClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterRequest) => client.register(input, crypto.randomUUID()),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEYS.me, data);
    },
  });
}

export function useLogoutMutation() {
  const client = useAuthClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEYS.me, null);
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEYS.me });
    },
  });
}

export function useRefreshSessionMutation() {
  const client = useAuthClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.refresh(),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEYS.me, data);
    },
  });
}

export function isAuthApiError(error: unknown): error is AuthApiError {
  return error instanceof AuthApiError;
}
