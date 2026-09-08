/**
 * Idempotency convention for critical POSTs (e.g. POST /api/v1/auth/register).
 * Clients SHOULD send this header with a unique key per logical operation.
 * Servers MUST treat replays with the same key as the original outcome (or conflict).
 */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;

export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export function isValidIdempotencyKey(value: string | undefined | null): boolean {
  if (value == null) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= IDEMPOTENCY_KEY_MAX_LENGTH;
}
