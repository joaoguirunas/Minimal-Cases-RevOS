/**
 * PG error codes that indicate transient failures safe to retry.
 * Structural errors (already exists, type mismatch, syntax) are NOT transient.
 */
const TRANSIENT_PG_CODES = new Set([
  '40P01', // deadlock_detected
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  '55P03', // lock_not_available
]);

export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message ?? String(err);
  // Check PG error code in message (deno-postgres surfaces as "code: XXXXX")
  for (const code of TRANSIENT_PG_CODES) {
    if (msg.includes(code)) return true;
  }
  // Text patterns for transient conditions
  return (
    msg.includes('deadlock') ||
    msg.includes('connection reset') ||
    msg.includes('too many connections') ||
    msg.includes('connection refused') ||
    msg.includes('cannot connect') ||
    msg.includes('lock not available')
  );
}

/**
 * Execute fn up to maxAttempts times with per-attempt delays.
 * backoffMs[i] is the delay before attempt i+1 (index 0 = no delay before first attempt).
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  backoffMs: number[],
  onRetry?: (attempt: number, err: unknown) => void,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const delay = backoffMs[attempt - 2] ?? backoffMs[backoffMs.length - 1] ?? 0;
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (onRetry) onRetry(attempt, err);
      if (attempt === maxAttempts || !isTransientError(err)) throw err;
    }
  }
  throw lastErr;
}
