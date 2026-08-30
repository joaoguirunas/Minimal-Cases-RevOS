import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdAccount {
  id: string;
  platform: 'meta' | 'google';
  account_id: string;
  account_name: string;
  is_active: boolean;
  last_sync_at: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export interface CreateAdAccountInput {
  platform: 'meta' | 'google';
  account_id: string;
  account_name: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
}

export interface SyncAccountInput {
  ad_account_id: string;
  date_from: string;
  date_to: string;
}

export function useBIProAdAccounts() {
  const queryClient = useQueryClient();
  const QUERY_KEY = ['bi-pro-ad-accounts'];

  // Fetch all ad accounts for the current tenant
  const { data: accounts, isLoading, error } = useQuery<AdAccount[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await  
      supabase
        .from('bi_ad_accounts')
        .select('id, platform, account_id, account_name, is_active, last_sync_at, token_expires_at, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Create/connect new ad account
  const createAccount = useMutation({
    mutationFn: async (input: CreateAdAccountInput) => {
      const { data, error } = await  
      supabase
        .from('bi_ad_accounts')
        .insert({
          platform: input.platform,
          account_id: input.account_id,
          account_name: input.account_name,
          access_token: input.access_token,
          refresh_token: input.refresh_token ?? null,
          token_expires_at: input.token_expires_at ?? null,
          is_active: true,
        })
        .select('id, platform, account_id, account_name, is_active, last_sync_at, created_at')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Conta de Ads conectada com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao conectar conta: ${err.message}`);
    },
  });

  // Toggle active state
  const toggleAccount = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await  
      supabase
        .from('bi_ad_accounts')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  // Delete account
  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await  
      supabase
        .from('bi_ad_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Conta removida');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover conta: ${err.message}`);
    },
  });

  // Sync account data (calls edge function)
  const syncAccount = useMutation({
    mutationFn: async (input: SyncAccountInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const account = accounts?.find(a => a.id === input.ad_account_id);
      if (!account) throw new Error('Account not found');

      const functionName = account.platform === 'meta'
        ? 'bi-sync-meta-ads'
        : 'bi-sync-google-ads';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: input,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? 'Sync failed');

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['bi-pro-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['bi-pro-attribution'] });
      toast.success(`Sincronizado: ${data.synced} registros, R$ ${data.total_spend?.toFixed(2) ?? '0'} importados`);
    },
    onError: (err: Error) => {
      // Developer Token not approved for production accounts
      if (err.message.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
        toast.error('Developer Token sem acesso a contas reais.', {
          description:
            'No Google Ads API Center, solicite o "Nível de acesso às Análises" — funciona com contas de produção e é o nível ideal para sincronização de dados.',
          action: {
            label: 'Abrir API Center →',
            onClick: () => window.open('https://ads.google.com/aw/apicenter', '_blank'),
          },
          duration: 15000,
        });
        return;
      }

      // Google Ads API not enabled in Cloud Console
      const cloudUrlMatch = err.message.match(/https:\/\/console\.developers\.google\.com\/[^\s"']+/);
      if (cloudUrlMatch) {
        const enableUrl = cloudUrlMatch[0].replace(/[)\].,;]+$/, '');
        toast.error('Google Ads API não ativada neste projeto do Cloud Console.', {
          description: 'É necessário ativar a API antes de sincronizar.',
          action: {
            label: 'Ativar API →',
            onClick: () => window.open(enableUrl, '_blank'),
          },
          duration: 12000,
        });
        return;
      }

      toast.error(`Erro na sincronização: ${err.message}`);
    },
  });

  const metaAccounts = accounts?.filter(a => a.platform === 'meta') ?? [];
  const googleAccounts = accounts?.filter(a => a.platform === 'google') ?? [];

  return {
    accounts: accounts ?? [],
    metaAccounts,
    googleAccounts,
    isLoading,
    error: error as Error | null,
    createAccount,
    toggleAccount,
    deleteAccount,
    syncAccount,
  };
}
