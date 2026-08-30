import { useQuery } from '@tanstack/react-query';

export interface SystemVersion {
  version: string;
  major: number;
  minor: number;
  build: number;
  updated_at: string;
}

export const useSystemVersion = () => {
  return useQuery<SystemVersion>({
    queryKey: ['system-version'],
    queryFn: async () => {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('version.json not found');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};
