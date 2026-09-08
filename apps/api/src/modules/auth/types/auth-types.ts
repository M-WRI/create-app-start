import type { User, UserRole } from "@prisma/client";
import type { AuthUser } from "@repo/contracts";

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  passwordHash: string;
};
