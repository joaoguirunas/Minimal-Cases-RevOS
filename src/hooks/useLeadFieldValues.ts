import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// ─── Types from generated schema ─────────────────────────────────────────────

export type LeadFieldValue =
  Database['public']['Tables']['lead_field_values']['Row'];

export type LeadFieldEntityType = 'negocio' | 'pessoa' | 'empresa';

export type LeadFieldValueType =
  | 'text'
  | 'number'
  | 'single_select'
  | 'select'
  | 'boolean'
  | 'date'
  | 'textarea';

// ─── Helper ───────────────────────────────────────────────────────────────────

export function getTypedLeadValue(
  row: LeadFieldValue | undefined,
  fieldType: string,
): string | number | boolean | null {
  if (!row) return null;
  switch (fieldType) {
    case 'number': return row.value_number ?? null;
    case 'boolean': return row.value_boolean ?? null;
    case 'date': return row.value_date ?? null;
    default: return row.value_text ?? null;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Values for a lead (negocio) — with Realtime subscription */
export function useLeadFieldValues(leadId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`lead-field-values-negocio-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_field_values',
          filter: `entity_id=eq.${leadId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['lead_field_values', 'negocio', leadId],
          });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ lead_field_values realtime ${status} for ${leadId}`, err?.message ?? '');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [leadId, queryClient]);

  return useQuery({
    queryKey: ['lead_field_values', 'negocio', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_field_values')
        .select('*')
        .eq('entity_type', 'negocio')
        .eq('entity_id', leadId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(leadId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/** Values for any entity (pessoa, empresa, negocio) — with Realtime subscription */
export function useLeadFieldValuesByEntity(
  entityType: LeadFieldEntityType,
  entityId: string,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!entityId) return;
    const channel = supabase
      .channel(`lead-field-values-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_field_values',
          filter: `entity_id=eq.${entityId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['lead_field_values', entityType, entityId],
          });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ lead_field_values realtime ${status} for ${entityId}`, err?.message ?? '');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [entityType, entityId, queryClient]);

  return useQuery({
    queryKey: ['lead_field_values', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_field_values')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(entityId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

interface UpsertPayload {
  entityType: LeadFieldEntityType;
  entityId: string;
  fieldDefinitionId: string;
  fieldType: LeadFieldValueType;
  value: string | number | boolean | null;
}

/** Upsert a field value — works for negocio, pessoa, and empresa */
export function useUpsertLeadFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      fieldDefinitionId,
      fieldType,
      value,
    }: UpsertPayload) => {
      const row: Database['public']['Tables']['lead_field_values']['Insert'] = {
        entity_type: entityType,
        entity_id: entityId,
        field_definition_id: fieldDefinitionId,
        lead_id: entityType === 'negocio' ? entityId : null,
        value_text: null,
        value_number: null,
        value_boolean: null,
        value_date: null,
        updated_at: new Date().toISOString(),
      };

      switch (fieldType) {
        case 'text':
        case 'single_select':
        case 'select':
        case 'textarea':
          row.value_text = value as string | null;
          break;
        case 'number':
          row.value_number =
            value !== null && value !== '' ? Number(value) : null;
          break;
        case 'boolean':
          row.value_boolean = value as boolean | null;
          break;
        case 'date':
          row.value_date = value as string | null;
          break;
      }

      const { data, error } = await supabase
        .from('lead_field_values')
        .upsert(row, {
          onConflict: 'entity_type,entity_id,field_definition_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['lead_field_values', variables.entityType, variables.entityId],
      });
    },
  });
}
