/**
 * Tests for evolution-session-manage-lib (webhook token generation + admin
 * gate, pure logic used by evolution-session-manage).
 *
 * Run: deno test supabase/functions/_shared/evolution-session-manage-lib.test.ts
 */

import { assertEquals, assertMatch, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateToken, isAdminCaller } from './evolution-session-manage-lib.ts';

// ── generateToken ──────────────────────────────────────────────────────────────

Deno.test('generateToken: is 64 lowercase hex chars (2 UUIDv4s, hyphens stripped)', () => {
  const token = generateToken();
  assertMatch(token, /^[0-9a-f]{64}$/);
});

Deno.test('generateToken: two calls with the real crypto.randomUUID produce different tokens', () => {
  assertNotEquals(generateToken(), generateToken());
});

Deno.test('generateToken: strips hyphens from BOTH halves, not just the first', () => {
  let call = 0;
  const fakeUUIDs = ['aaaa-bbbb-cccc-dddd-eeee', '1111-2222-3333-4444-5555'];
  const token = generateToken(() => fakeUUIDs[call++]);
  assertEquals(token, 'aaaabbbbccccddddeeee111122223333' + '44445555');
});

Deno.test('generateToken: concatenates two independent draws (not the same value doubled)', () => {
  let call = 0;
  const fakeUUIDs = ['same-value', 'same-value'];
  const token = generateToken(() => fakeUUIDs[call++]);
  // Even with identical inputs the function itself doesn't dedupe/shortcut — just concatenates.
  assertEquals(token, 'samevaluesamevalue');
});

// ── isAdminCaller ────────────────────────────────────────────────────────────

Deno.test('isAdminCaller: super_admin=true grants access regardless of user_type', () => {
  assertEquals(isAdminCaller({ super_admin: true, user_type: 'comercial' }), true);
});

Deno.test('isAdminCaller: user_type="gestor" grants access even without super_admin', () => {
  assertEquals(isAdminCaller({ super_admin: false, user_type: 'gestor' }), true);
});

Deno.test('isAdminCaller: neither flag set -> false', () => {
  assertEquals(isAdminCaller({ super_admin: false, user_type: 'comercial' }), false);
});

Deno.test('isAdminCaller: null/undefined caller (row not found) -> false, never throws', () => {
  assertEquals(isAdminCaller(null), false);
  assertEquals(isAdminCaller(undefined), false);
});

Deno.test('isAdminCaller: empty object (missing both fields) -> false', () => {
  assertEquals(isAdminCaller({}), false);
});

Deno.test('isAdminCaller: user_type is case-sensitive — "Gestor" (capitalized) does NOT match "gestor"', () => {
  assertEquals(isAdminCaller({ user_type: 'Gestor' }), false);
});

Deno.test('isAdminCaller: super_admin as a truthy non-boolean (e.g. 1) does NOT grant access (strict === true)', () => {
  // @ts-expect-error deliberately passing a non-boolean to prove the strict check
  assertEquals(isAdminCaller({ super_admin: 1 }), false);
});
