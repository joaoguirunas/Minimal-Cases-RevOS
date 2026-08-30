// Shared types for ADR-SP-01 (capability tokens) and ADR-SP-02 (action tokens).
// Single source of truth — import from here, never redefine.

// ── Booking tokens (ADR-SP-01) ────────────────────────────────────────────────

export type BookingCapability =
  | 'booking:read'
  | 'booking:create'
  | 'booking:manage';

export type ValidationFailureReason =
  | 'expired'           // exp < now
  | 'revoked'           // jti present in booking_token_denylist
  | 'invalid_signature' // HMAC invalid or header malformed
  | 'invalid_format'    // not base64url(h).base64url(p).base64url(s)
  | 'insufficient_scope'// cap !== required_capability
  | 'unknown_kid'       // kid in header does not resolve to an active key
  | 'missing_secret';   // Vault did not return a key (operational, 500)

export type ValidationResult =
  | { valid: true;  lead_id: string; tenant_id: string; capability: BookingCapability; jti: string; exp: number }
  | { valid: false; reason: ValidationFailureReason };

export interface MintBookingTokenInput {
  lead_id: string;
  tenant_id: string;
  capability: BookingCapability;
  ttl_days?: number; // default 30, range [1, 90]
}

// ── Action tokens (ADR-SP-02) ─────────────────────────────────────────────────

export type ActionName =
  | 'gcal_sync'
  | 'wa_confirm';
  // Future extensions (email_send, cal_reminder) go here — never open string

export type ActionTokenFailureReason =
  | 'expired'           // exp < now (TTL 60s exceeded)
  | 'invalid_signature' // HMAC invalid or header malformed
  | 'invalid_format'    // not base64url(h).base64url(p).base64url(s)
  | 'wrong_action'      // act in payload !== expected_action
  | 'already_consumed'  // jti already in action_token_consumed (replay)
  | 'unknown_kid'       // kid in header does not resolve to an active key
  | 'missing_secret';   // Vault did not return a key (operational, 500)

export type ActionTokenResult =
  | { valid: true;  action: ActionName; resource_id: string; tenant_id: string; jti: string; exp: number }
  | { valid: false; reason: ActionTokenFailureReason };

export interface IssueActionTokenInput {
  action: ActionName;
  resource_id: string;  // UUID of target resource (e.g. meeting_id)
  tenant_id: string;    // server-verified, never from request body
  issuer: string;       // name of the issuing edge function (audit trail)
  ttl_seconds?: number; // default 60, range [10, 120]
}
