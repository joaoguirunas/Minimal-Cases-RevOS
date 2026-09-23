/** Mantém a aba ativa se ela estiver entre as permitidas; senão, a primeira permitida. */
export function firstAllowedTab<T extends string>(active: T, allowed: T[]): T {
  return allowed.includes(active) ? active : (allowed[0] ?? active);
}
