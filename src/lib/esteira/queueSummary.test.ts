import { describe, expect, it } from 'vitest';
import { summarizeQueue } from './queueSummary';

const rows = [
  { lead_id: 'a', channel: 'email', status: 'sent', scheduled_for: '2026-09-01T10:00:00Z', subject: 'E1' },
  { lead_id: 'a', channel: 'sms', status: 'queued', scheduled_for: '2026-09-01T12:00:00Z', subject: 'SMS-01' },
  { lead_id: 'a', channel: 'email', status: 'pending', scheduled_for: '2026-09-03T10:00:00Z', subject: 'E3 · Eu ia te mandar' },
  { lead_id: 'a', channel: 'email', status: 'pending', scheduled_for: '2026-09-02T10:00:00Z', subject: 'E2 · Celular voando' },
  { lead_id: 'a', channel: 'whatsapp_template', status: 'cancelled', scheduled_for: null, subject: 'WA-01' },
  { lead_id: 'b', channel: 'email', status: 'failed', scheduled_for: '2026-09-01T10:00:00Z', subject: 'E1' },
];

describe('summarizeQueue', () => {
  it('conta enviados por canal (sent e queued contam como enviados)', () => {
    const s = summarizeQueue(rows)['a'];
    expect(s.sent).toEqual({ email: 1, whatsapp: 0, sms: 1, total: 2 });
  });
  it('acha o próximo pendente pelo menor scheduled_for', () => {
    const s = summarizeQueue(rows)['a'];
    expect(s.pending).toBe(2);
    expect(s.nextAt).toBe('2026-09-02T10:00:00Z');
    expect(s.nextChannel).toBe('email');
    expect(s.nextLabel).toBe('E2 · Celular voando');
  });
  it('cancelados não entram no total; falhos entram', () => {
    expect(summarizeQueue(rows)['a'].total).toBe(4);
    expect(summarizeQueue(rows)['b']).toMatchObject({ failed: 1, total: 1, nextAt: null });
  });
});
