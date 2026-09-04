// supabase/functions/_shared/click-nudge.test.ts
// Run: deno test --allow-env supabase/functions/_shared/click-nudge.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideNudge, parseClickNudgeSettings } from './click-nudge.ts';

Deno.test('parseClickNudgeSettings: padrão desligado, 30 min, sem template', () => {
  assertEquals(parseClickNudgeSettings(null), { enabled: false, delayMinutes: 30, templateName: null });
  assertEquals(parseClickNudgeSettings({ click_nudge_enabled: 'true', click_nudge_delay_minutes: '45', click_nudge_template_name: ' mc_clicou ' }),
    { enabled: true, delayMinutes: 45, templateName: 'mc_clicou' });
  assertEquals(parseClickNudgeSettings({ click_nudge_enabled: true, click_nudge_delay_minutes: 1 }).delayMinutes, 30); // < 5 min cai no default
});

const base = { settings: { enabled: true, delayMinutes: 30, templateName: null }, leadId: 'l', peopleId: 'p', leadStatus: 'open', stageName: 'Engajou', agentActive: true, lastNudgeAt: null, now: new Date('2026-09-04T01:00:00Z') };

Deno.test('decideNudge: ok no caso feliz', () => assertEquals(decideNudge(base), { ok: true }));
Deno.test('decideNudge: bloqueios', () => {
  assertEquals(decideNudge({ ...base, settings: { ...base.settings, enabled: false } }).ok, false);
  assertEquals(decideNudge({ ...base, leadId: null }).ok, false);
  assertEquals(decideNudge({ ...base, leadStatus: 'won' }).ok, false);
  assertEquals(decideNudge({ ...base, stageName: 'Pagamento pendente' }).ok, false);
  assertEquals(decideNudge({ ...base, stageName: 'Recuperado' }).ok, false);
  assertEquals(decideNudge({ ...base, agentActive: false }).ok, false);
  assertEquals(decideNudge({ ...base, lastNudgeAt: '2026-09-03T20:00:00Z' }).ok, false);   // < 24h
  assertEquals(decideNudge({ ...base, lastNudgeAt: '2026-09-02T20:00:00Z' }).ok, true);    // > 24h
});
