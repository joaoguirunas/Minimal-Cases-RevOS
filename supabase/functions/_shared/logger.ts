/**
 * Structured Logger — Growthsales Edge Functions
 *
 * Emits JSON-structured logs to stdout/stderr so Supabase captures them
 * with queryable fields (level, fn, rid, msg, ctx).
 *
 * Usage:
 *   import { createLogger } from '../_shared/logger.ts';
 *   const log = createLogger('my-function');
 *
 *   log.info('started', { people_id });
 *   log.warn('retrying', { attempt: 2 });
 *   log.error('db failed', { error: err.message });
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  readonly fn: string;
  readonly rid: string; // request id — correlates all logs from one invocation

  constructor(fn: string, requestId?: string) {
    this.fn = fn;
    this.rid = requestId ?? crypto.randomUUID().slice(0, 8);
  }

  private emit(level: LogLevel, msg: string, ctx?: LogContext): void {
    const entry: Record<string, unknown> = {
      ts:  new Date().toISOString(),
      lvl: level,
      fn:  this.fn,
      rid: this.rid,
      msg,
    };

    if (ctx && Object.keys(ctx).length > 0) {
      entry.ctx = ctx;
    }

    const line = JSON.stringify(entry);

    if (level === 'ERROR' || level === 'WARN') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  debug(msg: string, ctx?: LogContext): void { this.emit('DEBUG', msg, ctx); }
  info(msg: string,  ctx?: LogContext): void { this.emit('INFO',  msg, ctx); }
  warn(msg: string,  ctx?: LogContext): void { this.emit('WARN',  msg, ctx); }
  error(msg: string, ctx?: LogContext): void { this.emit('ERROR', msg, ctx); }

  /** Log a non-blocking failure (fire-and-forget ops that errored silently before). */
  silent(msg: string, ctx?: LogContext): void { this.emit('WARN', `[silent] ${msg}`, ctx); }

  /** Returns elapsed ms since this logger was created — useful for duration logging. */
  elapsed(since: number): number { return Date.now() - since; }
}

export function createLogger(fn: string, requestId?: string): Logger {
  return new Logger(fn, requestId);
}
