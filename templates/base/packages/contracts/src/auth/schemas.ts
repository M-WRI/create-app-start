import { z } from "zod";
import { userRoleSchema } from "../rbac/role.js";

export const emailSchema = z.string().trim().email().max(320);
export const passwordSchema = z.string().min(8).max(128);

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z
  .object({
    id: z.string().uuid(),
    email: emailSchema,
    role: userRoleSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionResponseSchema = z
  .object({
    user: authUserSchema,
  })
  .strict();

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const meResponseSchema = authSessionResponseSchema;
export type MeResponse = AuthSessionResponse;
