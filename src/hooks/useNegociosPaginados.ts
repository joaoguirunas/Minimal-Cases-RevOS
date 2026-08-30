// TODO: implementar com React Query + paginação cursor/offset.
// Placeholder: nenhum caller atual. Se for chamado, alerta no console em DEV para evitar regressão silenciosa.
export const useNegociosPaginados = (
  _filters: Record<string, unknown> = {},
  _page = 1,
  _perPage = 20
) => {
  if (import.meta.env.DEV) {
    console.warn('[useNegociosPaginados] Stub hook chamado — retorna dados vazios. Implementar com React Query antes de usar em produção.');
  }
  return {
    data: [] as unknown[],
    totalCount: 0,
    isLoading: false,
    isError: false,
    refetch: () => Promise.resolve(),
  };
};
