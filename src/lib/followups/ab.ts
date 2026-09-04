/** Lógica pura de split A/B — espelho do bucket determinístico calculado no SQL (md5(lead_id||variant_salt)). */

/** parseInt(hex.slice(0,6),16) % 10000 — mesmo bucket [0, 9999] calculado no SQL a partir do md5. */
export function bucketFromMd5Hex(hex: string): number {
  return parseInt(hex.slice(0, 6), 16) % 10000;
}

/**
 * Escolhe a variante cujo intervalo cumulativo de peso (weight em %, 0-100)
 * contém o bucket (0-9999). Retorna null para lista vazia.
 */
export function pickVariant<T extends { weight: number }>(bucket: number, variants: T[]): T | null {
  if (variants.length === 0) return null;
  let acc = 0;
  for (const v of variants) {
    acc += v.weight * 100;
    if (bucket < acc) return v;
  }
  return variants[variants.length - 1];
}

export function expectedSplit(variants: Array<{ key: string; weight: number }>): string {
  return variants.map((v) => `${v.key} ${v.weight}%`).join(' · ');
}

/** comum = neutro · A = sky (info) · B = violet · C = amber (warning). */
export function variantTone(key: string | null): 'neutral' | 'info' | 'violet' | 'warning' {
  if (key === 'A') return 'info';
  if (key === 'B') return 'violet';
  if (key === 'C') return 'warning';
  return 'neutral';
}

export type AbStatus = 'draft' | 'running' | 'paused' | 'finished';

const AB_STATUS_LABELS: Record<AbStatus, string> = {
  draft: 'Rascunho',
  running: 'Em andamento',
  paused: 'Pausado',
  finished: 'Encerrado',
};

export function abStatusLabel(s: AbStatus): string {
  return AB_STATUS_LABELS[s];
}
