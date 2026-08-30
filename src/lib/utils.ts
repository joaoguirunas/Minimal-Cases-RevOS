import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte string de data (YYYY-MM-DD) para Date no timezone local.
 * Resolve o problema de datas sendo interpretadas como UTC e exibindo o dia anterior.
 */
export function parseDateString(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  // Adicionar T00:00:00 força interpretação como horário local, não UTC
  return new Date(dateStr + 'T00:00:00');
}
