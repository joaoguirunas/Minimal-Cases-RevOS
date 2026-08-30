/**
 * Adversarial tests for FIX-AGENT-DUP-03: buffer claim prematuro silencia o agente.
 *
 * Run: deno test --allow-net --allow-env \
 *   supabase/functions/ai-agent-execute/index.test.ts
 *
 * The fix lives inline in index.ts (no _shared helper, by design), so these tests model
 * the exact decision sequence the buffer branch performs — CAS lock on clients_people,
 * SELECT on message_buffer, and the processed=true transition that must only happen at
 * step 11 (after the reply is persisted) — against an in-memory fake Supabase client.
 *
 * What is being proven (the contract, not the literal lines):
 *   1. cron path (lock_preacquired=true): CAS is skipped; a failure before step 11 leaves
 *      the buffer processed=false (retryable) — never silently discarded.
 *   2. inbound path (lock_preacquired absent): CAS acquires the lock; on success the buffer
 *      is marked processed=true only at step 11.
 *   3. concurrency (two inbound triggers): the first acquires the CAS lock; the second sees
 *      0 rows → lock_not_acquired → returns without touching the buffer (exactly 1 reply).
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ── In-memory fake of the two rows the buffer branch touches ─────────────────
// Single-threaded JS applies each update atomically per call, which is exactly how
// Postgres row-locking serializes the real concurrent CAS UPDATEs.

interface PersonRow {
  id: string;
  ai_processing_lock: boolean;
}

interface BufferRow {
  id: string;
  people_id: string;
  processed: boolean;
}

class FakeDb {
  person: PersonRow;
  buffers: BufferRow[];

  constructor(lockHeld: boolean, buffers: BufferRow[]) {
    this.person = { id: 'p1', ai_processing_lock: lockHeld };
    this.buffers = buffers;
  }

  /** Models: UPDATE clients_people SET ai_processing_lock=true WHERE id=$1 AND ai_processing_lock=false RETURNING id */
  casAcquire(): { rows: { id: string }[] } {
    if (this.person.ai_processing_lock === false) {
      this.person.ai_processing_lock = true;
      return { rows: [{ id: this.person.id }] };
    }
    return { rows: [] };
  }

  releaseLock() {
    this.person.ai_processing_lock = false;
  }

  /** Models: SELECT ... FROM message_buffer WHERE people_id=$1 AND processed=false */
  selectUnprocessed(): BufferRow[] {
    return this.buffers.filter((b) => b.people_id === this.person.id && !b.processed);
  }

  markProcessed(ids: string[]) {
    for (const b of this.buffers) {
      if (ids.includes(b.id)) b.processed = true;
    }
  }
}

// ── The inline decision sequence under test (mirrors index.ts buffer branch) ──
// Returns the HTTP status string the branch would emit, after mutating the fake.
// `runLlm` throws to simulate a transient failure (LLM/network) before step 11.

interface RunResult {
  status: string;
}

function runBufferBranch(
  db: FakeDb,
  opts: {
    lockPreacquired: boolean;
    runLlm: () => void;
    /** Observes the in-between state after step 11 (processed=true) but before step 12 (lock released). */
    onAfterMarkProcessed?: (db: FakeDb) => void;
    /** Simulates the step-11 mark-processed UPDATE throwing (e.g. network drop). */
    failMarkProcessed?: boolean;
  },
): RunResult {
  // Step: CAS lock (skipped when the cron pre-acquired it).
  if (!opts.lockPreacquired) {
    const { rows } = db.casAcquire();
    if (rows.length === 0) {
      // lock_not_acquired — never acquired, so never release; never touch the buffer.
      return { status: 'lock_not_acquired' };
    }
  }

  try {
    const unprocessed = db.selectUnprocessed();
    const bufferIds = unprocessed.map((b) => b.id);
    if (bufferIds.length === 0) {
      db.releaseLock();
      return { status: 'nothing_to_process' };
    }

    // LLM runs here — may throw (transient failure before the buffer is marked processed).
    opts.runLlm();

    // Step 11: mark buffer processed ONLY after the reply is persisted, and BEFORE releasing
    // the lock — closing the TOCTOU window where {lock=false, processed=false} would let a
    // concurrent execution re-read the same buffer.
    if (opts.failMarkProcessed) {
      // The UPDATE threw — buffer stays processed=false; control falls to the catch below.
      throw new Error('mark-processed UPDATE failed');
    }
    db.markProcessed(bufferIds);
    opts.onAfterMarkProcessed?.(db);
    // Step 12: release the lock after the buffer is marked processed.
    db.releaseLock();
    return { status: 'ok' };
  } catch (_err) {
    // Catch global: release the lock but DO NOT mark the buffer processed — keep it retryable.
    // This is exactly what guarantees the lock is freed even if step 11 throws.
    db.releaseLock();
    return { status: 'error' };
  }
}

const ok = () => {};
const boom = () => {
  throw new Error('LLM timeout');
};

// ── Scenario 1: cron path (lock_preacquired=true), failure before step 11 ─────

Deno.test('cron path: CAS skipped; transient failure leaves buffer processed=false (retryable)', () => {
  const db = new FakeDb(true, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: true, runLlm: boom });

  assertEquals(res.status, 'error');
  // The cron held the lock; the failure must NOT silence the message.
  assertEquals(db.buffers[0].processed, false, 'buffer must stay retryable after a transient failure');
  // Lock released so the next cron tick / inbound can re-acquire and retry.
  assertEquals(db.person.ai_processing_lock, false, 'lock must be released on failure');
});

Deno.test('cron path: success marks buffer processed=true only at step 11', () => {
  const db = new FakeDb(true, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: true, runLlm: ok });

  assertEquals(res.status, 'ok');
  assertEquals(db.buffers[0].processed, true);
  assertEquals(db.person.ai_processing_lock, false);
});

// ── Scenario 2: inbound path (lock_preacquired absent), CAS acquires ──────────

Deno.test('inbound path: CAS acquires the lock, then success marks processed at step 11', () => {
  const db = new FakeDb(false, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: false, runLlm: ok });

  assertEquals(res.status, 'ok');
  assertEquals(db.buffers[0].processed, true);
  assertEquals(db.person.ai_processing_lock, false);
});

Deno.test('inbound path: transient failure after CAS leaves buffer processed=false (retryable)', () => {
  const db = new FakeDb(false, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: false, runLlm: boom });

  assertEquals(res.status, 'error');
  assertEquals(db.buffers[0].processed, false, 'buffer must stay retryable after a transient failure');
  assertEquals(db.person.ai_processing_lock, false);
});

// ── Scenario 3: two concurrent inbound triggers → exactly 1 reply ─────────────

Deno.test('concurrency: second inbound trigger gets lock_not_acquired and never touches the buffer', () => {
  const db = new FakeDb(false, [{ id: 'b1', people_id: 'p1', processed: false }]);

  // First trigger acquires the lock and runs the full cycle.
  const first = runBufferBranch(db, { lockPreacquired: false, runLlm: ok });
  // While the first is conceptually in-flight the lock is held; model the second arriving
  // before release by re-holding the lock for the second call.
  db.person.ai_processing_lock = true;
  const second = runBufferBranch(db, { lockPreacquired: false, runLlm: ok });

  assertEquals(first.status, 'ok');
  assertEquals(second.status, 'lock_not_acquired');
  // The buffer was processed exactly once by the winner; the loser left it untouched.
  assertEquals(db.buffers.filter((b) => b.processed).length, 1, 'exactly one reply path ran');
});

Deno.test('concurrency: loser does not release a lock it never acquired', () => {
  const db = new FakeDb(true, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: false, runLlm: ok });

  assertEquals(res.status, 'lock_not_acquired');
  // The holder's lock must remain held — the loser must not free it.
  assertEquals(db.person.ai_processing_lock, true, 'loser must not release the holder lock');
  assertEquals(db.buffers[0].processed, false);
});

// ── Scenario 4: TOCTOU window between mark-processed (step 11) and release-lock (12) ──
// Regression guard: the buffer must be marked processed BEFORE the lock is released, so a
// concurrent execution B that runs in the gap finds nothing to process (no duplicate reply).

Deno.test('TOCTOU: buffer is already processed before the lock is released', () => {
  const db = new FakeDb(false, [{ id: 'b1', people_id: 'p1', processed: false }]);

  let lockStillHeldWhenProcessed = false;
  let bufferAlreadyProcessed = false;

  runBufferBranch(db, {
    lockPreacquired: false,
    runLlm: ok,
    onAfterMarkProcessed: (d) => {
      // At this instant: buffer marked processed, lock NOT yet released.
      lockStillHeldWhenProcessed = d.person.ai_processing_lock === true;
      bufferAlreadyProcessed = d.buffers[0].processed === true;
    },
  });

  assertEquals(bufferAlreadyProcessed, true, 'buffer must be processed=true before lock release');
  assertEquals(lockStillHeldWhenProcessed, true, 'lock must still be held when processed is set');
});

Deno.test('TOCTOU: execution B in the gap (lock free, buffer processed) re-reads nothing', () => {
  const db = new FakeDb(false, [{ id: 'b1', people_id: 'p1', processed: false }]);

  let bResult: RunResult | null = null;

  // Execution A runs; at the instant it has marked processed=true but not yet released the
  // lock, we force the gap state (lock free + processed true) and let execution B try.
  runBufferBranch(db, {
    lockPreacquired: false,
    runLlm: ok,
    onAfterMarkProcessed: (d) => {
      d.releaseLock(); // simulate A having released early (worst case for the window)
      bResult = runBufferBranch(d, { lockPreacquired: false, runLlm: ok });
    },
  });

  // B acquired the now-free lock but the buffer is already processed → nothing_to_process.
  assertEquals(bResult!.status, 'nothing_to_process');
  // Exactly one reply path ran (A's); B produced none.
  assertEquals(db.buffers.filter((b) => b.processed).length, 1, 'no duplicate reprocessing in the gap');
});

// ── Scenario 5: mark-processed (step 11) throws → lock must still be released ──
// QA requirement: if the mark-processed UPDATE fails, the global catch must still free the
// lock (and must NOT mark the buffer processed — it stays retryable). The reorder must not
// trade the TOCTOU window for a stuck-lock-on-mark-failure.

Deno.test('mark-processed failure: lock is still released and buffer stays retryable', () => {
  const db = new FakeDb(false, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: false, runLlm: ok, failMarkProcessed: true });

  assertEquals(res.status, 'error');
  // (a) catch must NOT mark processed — message stays retryable.
  assertEquals(db.buffers[0].processed, false, 'buffer must stay processed=false when mark fails');
  // (b) lock must be released even though mark-processed threw.
  assertEquals(db.person.ai_processing_lock, false, 'lock must be released even if mark-processed throws');
});

Deno.test('mark-processed failure on cron path: lock released, buffer retryable', () => {
  // lock_preacquired=true (cron held it); mark fails → catch must still release it.
  const db = new FakeDb(true, [{ id: 'b1', people_id: 'p1', processed: false }]);

  const res = runBufferBranch(db, { lockPreacquired: true, runLlm: ok, failMarkProcessed: true });

  assertEquals(res.status, 'error');
  assertEquals(db.buffers[0].processed, false);
  assertEquals(db.person.ai_processing_lock, false, 'cron-held lock must be released on mark failure');
});
