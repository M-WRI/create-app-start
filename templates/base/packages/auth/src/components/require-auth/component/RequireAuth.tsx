import { type UserRole, hasRequiredRole } from "@repo/contracts";
import type { ReactNode } from "react";
import { useMeQuery } from "../../../hooks/use-auth-mutations.js";

export type RequireAuthProps = {
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
};

export function RequireAuth({ children, fallback = null, loading = null }: RequireAuthProps) {
  const meQuery = useMeQuery();
  if (meQuery.isLoading) {
    return loading;
  }
  if (!meQuery.data?.user) {
    return fallback;
  }
  return children;
}

export type RequireRoleProps = RequireAuthProps & {
  roles: UserRole | UserRole[];
};

export function RequireRole({
  roles,
  children,
  fallback = null,
  loading = null,
}: RequireRoleProps) {
  const meQuery = useMeQuery();
  if (meQuery.isLoading) {
    return loading;
  }
  const user = meQuery.data?.user;
  if (!user || !hasRequiredRole(user.role, roles)) {
    return fallback;
  }
  return children;
}
