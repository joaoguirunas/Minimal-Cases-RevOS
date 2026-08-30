// TODO: implementar com React Query (ver useDashboardNegociosOptimized como referência).
// Placeholder: nenhum caller atual. Se for chamado, alerta no console em DEV para evitar regressão silenciosa.
import type { DashboardFiltersType, DashboardNegociosDataType } from './useStubsAll';

export const useDashboardNegocios = (
  _filters: DashboardFiltersType = {},
  _enabled = true
): { data: DashboardNegociosDataType | null; isLoading: boolean; isError: boolean } => {
  if (import.meta.env.DEV) {
    console.warn('[useDashboardNegocios] Stub hook chamado — retorna data null. Use useDashboardNegociosOptimized.');
  }
  return {
    data: null,
    isLoading: false,
    isError: false,
  };
};
