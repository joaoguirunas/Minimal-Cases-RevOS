import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { GitMerge, Search, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DuplicatePair {
  person_a_id: string;
  person_a_name: string;
  person_b_id: string;
  person_b_name: string;
  match_field: string;
  match_value: string;
}

export default function OmniDedupHealthConfig() {
  const qc = useQueryClient();
  const [mergingPair, setMergingPair] = useState<string | null>(null);

  const { data: duplicates = [], isLoading, refetch } = useQuery({
    queryKey: ['omni-dedup-health'],
    queryFn: async () => {
      // Find pairs sharing identity keys where neither is merged
      const pairs: DuplicatePair[] = [];

      // Check each identity field for duplicates
      const fields = ['whatsapp', 'email', 'document', 'instagram_user_id', 'instagram_handle'] as const;

      for (const field of fields) {
        const { data, error } = await supabase
          .from('clients_people')
          .select(`id, name, ${field}`)
          .neq('status', 'merged')
          .not(field, 'is', null)
          .order(field);

        if (error || !data) continue;

        // Group by field value to find duplicates
        const grouped = new Map<string, Array<{ id: string; name: string }>>();
        for (const row of data) {
          const val = String((row as Record<string, unknown>)[field]).toLowerCase();
          if (!grouped.has(val)) grouped.set(val, []);
          grouped.get(val)!.push({ id: row.id, name: row.name || 'Sem nome' });
        }

        for (const [val, persons] of grouped) {
          if (persons.length < 2) continue;
          // Create pairs from the group (first person vs each other)
          for (let i = 1; i < persons.length; i++) {
            pairs.push({
              person_a_id: persons[0].id,
              person_a_name: persons[0].name,
              person_b_id: persons[i].id,
              person_b_name: persons[i].name,
              match_field: field,
              match_value: val,
            });
          }
        }
      }

      return pairs;
    },
    staleTime: 60 * 1000,
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ canonical_id, duplicate_id }: { canonical_id: string; duplicate_id: string }) => {
      const { data, error } = await supabase.rpc('merge_persons', {
        p_canonical_id: canonical_id,
        p_duplicate_id: duplicate_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['omni-dedup-health'] });
      toast.success('Contatos unificados com sucesso');
      setMergingPair(null);
    },
    onError: (e) => {
      toast.error(`Erro ao unificar: ${(e as Error).message}`);
      setMergingPair(null);
    },
  });

  const fieldLabels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    document: 'CPF/CNPJ',
    instagram_user_id: 'Instagram ID',
    instagram_handle: 'Instagram @',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Dedup Health</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Detecta contatos duplicados que compartilham a mesma chave de identidade mas ainda nao foram unificados.
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => refetch()}
        disabled={isLoading}
        className="h-8 text-sm rounded-[4px] gap-2"
      >
        <Search className="w-3.5 h-3.5" />
        Verificar duplicatas
      </Button>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && duplicates.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-[4px]">
          <CheckCircle2 className="w-8 h-8 text-green-500/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma duplicata encontrada.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Todos os contatos estao unificados corretamente.
          </p>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium text-foreground">
              {duplicates.length} duplicata{duplicates.length > 1 ? 's' : ''} encontrada{duplicates.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-2">
            {duplicates.map((pair) => {
              const pairKey = `${pair.person_a_id}-${pair.person_b_id}`;
              return (
                <div
                  key={pairKey}
                  className="border border-border rounded-[4px] bg-card px-4 py-3 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground truncate">{pair.person_a_name}</span>
                      <span className="text-muted-foreground/40">&harr;</span>
                      <span className="font-medium text-foreground truncate">{pair.person_b_name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {fieldLabels[pair.match_field] || pair.match_field}: <span className="font-mono">{pair.match_value}</span>
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMergingPair(pairKey);
                      mergeMutation.mutate({
                        canonical_id: pair.person_a_id,
                        duplicate_id: pair.person_b_id,
                      });
                    }}
                    disabled={mergeMutation.isPending && mergingPair === pairKey}
                    className="h-7 text-xs rounded-[4px] gap-1.5 shrink-0"
                  >
                    {mergeMutation.isPending && mergingPair === pairKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <GitMerge className="w-3 h-3" />
                    )}
                    Unificar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
