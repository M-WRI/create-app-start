import { z } from "zod";

export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const userRoleSchema = z.enum([USER_ROLES.USER, USER_ROLES.ADMIN]);

export function hasRequiredRole(userRole: UserRole, required: UserRole | UserRole[]): boolean {
  const requiredRoles = Array.isArray(required) ? required : [required];
  if (requiredRoles.includes(userRole)) {
    return true;
  }
  // admin satisfies any single-role gate that lists admin, and also user-only gates
  if (userRole === USER_ROLES.ADMIN) {
    return true;
  }
  return false;
}
