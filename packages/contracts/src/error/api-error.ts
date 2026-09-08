import { z } from "zod";

export const apiErrorSchema = z
  .object({
    status: z.number().int().min(400).max(599),
    errorMessage: z.string().min(1),
    errorCode: z.string().min(1),
    errorKey: z.string().min(1),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;

export function isApiError(value: unknown): value is ApiError {
  return apiErrorSchema.safeParse(value).success;
}

export function parseApiError(value: unknown): ApiError {
  return apiErrorSchema.parse(value);
}
