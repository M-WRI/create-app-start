export const AUTH_API_BASE_PATH = "/api/v1/auth" as const;

export const AUTH_ROUTES = {
  register: `${AUTH_API_BASE_PATH}/register`,
  login: `${AUTH_API_BASE_PATH}/login`,
  logout: `${AUTH_API_BASE_PATH}/logout`,
  refresh: `${AUTH_API_BASE_PATH}/refresh`,
  me: `${AUTH_API_BASE_PATH}/me`,
} as const;

export const AUTH_QUERY_KEYS = {
  me: ["auth", "me"] as const,
} as const;
