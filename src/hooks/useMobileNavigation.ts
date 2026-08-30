import { create } from 'zustand';

interface NegociosFilters {
  searchTerm: string;
  pipelineId: string;
  stageId: string;
  status: string;
  userId: string;
  teamId: string;
  dataInicio: string;
  dataFim: string;
  utmSource: string;
  utmCampaign: string;
}

interface MobileNavigationState {
  negociosFilters: NegociosFilters;
  setNegociosFilter: <K extends keyof NegociosFilters>(key: K, value: NegociosFilters[K]) => void;
  clearNegociosFilters: () => void;
}

const DEFAULT_NEGOCIOS_FILTERS: NegociosFilters = {
  searchTerm: '',
  pipelineId: '',
  stageId: '',
  status: 'all',
  userId: '',
  teamId: '',
  dataInicio: '',
  dataFim: '',
  utmSource: '',
  utmCampaign: '',
};

export const useMobileNavigation = create<MobileNavigationState>((set) => ({
  negociosFilters: { ...DEFAULT_NEGOCIOS_FILTERS },
  setNegociosFilter: (key, value) =>
    set((state) => ({ negociosFilters: { ...state.negociosFilters, [key]: value } })),
  clearNegociosFilters: () =>
    set({ negociosFilters: { ...DEFAULT_NEGOCIOS_FILTERS } }),
}));
