// supabase/functions/_shared/email-split.ts
/** Divisão estável Resend × Klaviyo durante o aquecimento: mesma pessoa, mesmo lado. */
export function emailBucket(email: string): number {
  let h = 0x811c9dc5;
  for (const ch of email.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export function chooseProvider(email: string, sharePct: number): 'resend' | 'klaviyo' {
  return emailBucket(email) < Math.max(0, Math.min(100, sharePct)) ? 'resend' : 'klaviyo';
}
