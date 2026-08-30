import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import { useLeadFieldDefinitionsByEntity } from '@/hooks/useLeadFieldDefinitions';
import { SECOES_CONTEXTO_PADRAO } from '@/components/agentes-ia/models/dadosEntradaModels';
import { cn } from '@/lib/utils';

interface WhatsappTemplateVariablesModalProps {
  template: WhatsappTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FieldOption {
  key: string;
  label: string;
  example?: string;
}

const DADOS_LABEL_BY_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const sec of SECOES_CONTEXTO_PADRAO) {
    for (const c of sec.campos) {
      map[c.chave] = c.label;
    }
  }
  return map;
})();

const lbl = (key: string, fallback: string): string => DADOS_LABEL_BY_KEY[key] ?? fallback;

const LEAD_FIELDS: FieldOption[] = [
  { key: 'lead_id',                 label: lbl('lead_id', 'Lead ID'),                            example: 'a3f5e8d2-7c9b-4e1f-9a2d-6b8e1c3f5a7d' },
  { key: 'lead_titulo',             label: lbl('lead_titulo', 'Título do lead'),                 example: 'Proposta GrowthSales Pro' },
  { key: 'lead_control',            label: lbl('lead_control', 'Controle do agente'),            example: 'q1' },
  { key: 'lead_status',             label: lbl('lead_status', 'Status do lead'),                 example: 'in_progress' },
  { key: 'lead_valor',              label: lbl('lead_valor', 'Valor do lead'),                   example: 'R$ 1.500,00' },
  { key: 'lead_etapa_nome',         label: lbl('lead_etapa_nome', 'Etapa do lead'),              example: 'Qualificação' },
  { key: 'lead_responsavel_nome',   label: lbl('lead_responsavel_nome', 'Responsável'),          example: 'Erika Crivellari' },
  { key: 'lead_utm_source',         label: lbl('lead_utm_source', 'UTM source'),                 example: 'google' },
  { key: 'lead_temperatura',        label: 'Temperatura do lead',                                example: 'quente' },
  { key: 'lead_prob_fechamento',    label: 'Probabilidade de fechamento',                        example: '70%' },
  { key: 'recomendante',            label: 'Recomendante',                                       example: 'João Silva' },
  { key: 'relacao_recomendante',    label: 'Relação com recomendante',                           example: 'amigo de longa data' },
  { key: 'relacao_corretor',        label: 'Relação com corretor',                               example: 'cliente desde 2023' },
  { key: 'nome_evento',             label: 'Nome do evento',                                     example: 'Workshop de Vendas Digitais' },
];

const PESSOA_FIELDS: FieldOption[] = [
  { key: 'nome',              label: lbl('nome', 'Nome completo'),              example: 'Maria Santos' },
  { key: 'primeiro_nome',     label: 'Primeiro nome',                           example: 'Maria' },
  { key: 'email',             label: lbl('email', 'Email'),                     example: 'maria@empresa.com' },
  { key: 'whatsapp',          label: lbl('whatsapp', 'WhatsApp'),               example: '+55 11 99999-0000' },
  { key: 'telefone',          label: 'Telefone',                                example: '+55 11 3333-4444' },
  { key: 'linkedin_url',      label: 'LinkedIn URL',                            example: 'linkedin.com/in/maria' },
  { key: 'score',             label: lbl('score', 'Score'),                     example: '8' },
  { key: 'origem',            label: lbl('origem', 'Origem'),                   example: 'Indicação' },
  { key: 'instagram_handle',  label: 'Instagram',                               example: '@maria.santos' },
  { key: 'notes',             label: 'Notas',                                   example: 'Cliente VIP' },
  { key: 'disc_summary',      label: 'Resumo DISC',                             example: 'Perfil dominante (D)' },
  { key: 'business_category', label: 'Categoria de negócio',                    example: 'Consultoria' },
];

const EMPRESA_FIELDS: FieldOption[] = [
  { key: 'empresa_nome',         label: lbl('empresa_nome', 'Nome da empresa'),     example: 'GrowthSales Ltda' },
  { key: 'empresa_razao_social', label: 'Razão social',                             example: 'GrowthSales Tecnologia LTDA' },
  { key: 'empresa_website',      label: lbl('empresa_website', 'Website'),          example: 'growthsales.ai' },
  { key: 'empresa_cnpj',         label: lbl('empresa_cnpj', 'CNPJ'),                example: '12.345.678/0001-90' },
];

const AGENDAMENTO_FIELDS: FieldOption[] = [
  { key: 'reuniao_ultima_data',   label: lbl('reuniao_ultima_data', 'Data da última reunião'),     example: '20/03/2026 14:00' },
  { key: 'reuniao_ultima_status', label: lbl('reuniao_ultima_status', 'Status da última reunião'), example: 'agendado' },
  { key: 'link_reuniao',          label: 'Link da reunião (Meet)',                                  example: 'https://meet.google.com/abc-def-ghi' },
];

export function extractBody(jsonData: WhatsappTemplate['json_data']): string {
  if (!jsonData) return '';
  const components = (jsonData as Record<string, unknown>).components as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(components)) {
    const body = components.find(c => (c?.type as string)?.toUpperCase() === 'BODY');
    if (body && typeof body.text === 'string') return body.text;
    const first = components[0];
    if (first && typeof first.text === 'string') return first.text;
  }
  if (typeof jsonData.data === 'string') return jsonData.data;
  return '';
}

export function detectPositions(body: string): number[] {
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)];
  const positions = new Set<number>();
  for (const m of matches) positions.add(parseInt(m[1], 10));
  return [...positions].sort((a, b) => a - b);
}

export function getVariablesMappingStatus(template: WhatsappTemplate): 'none' | 'complete' | 'pending' {
  const body = extractBody(template.json_data);
  const positions = detectPositions(body);
  if (positions.length === 0) return 'none';
  const variablesMap = (template.json_data as Record<string, unknown> | null)?.variables_map as Record<string, string> | undefined;
  if (!variablesMap) return 'pending';
  for (const pos of positions) {
    if (!variablesMap[String(pos)]) return 'pending';
  }
  return 'complete';
}

type PreviewMode = 'label' | 'example';

export const WhatsappTemplateVariablesModal: React.FC<WhatsappTemplateVariablesModalProps> = ({
  template,
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();
  const { data: customPeopleFields } = useLeadFieldDefinitionsByEntity('pessoa');
  const { data: customLeadFields } = useLeadFieldDefinitionsByEntity('lead');

  const body = useMemo(() => extractBody(template?.json_data ?? null), [template]);
  const positions = useMemo(() => detectPositions(body), [body]);

  const [variablesMap, setVariablesMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('example');

  useEffect(() => {
    if (!template) return;
    const existing = (template.json_data as Record<string, unknown> | null)?.variables_map as Record<string, string> | undefined;
    setVariablesMap(existing ?? {});
  }, [template]);

  const customFieldOptions: FieldOption[] = useMemo(() => {
    const merged = [
      ...(customPeopleFields ?? []),
      ...(customLeadFields ?? []),
    ];
    const seen = new Set<string>();
    const result: FieldOption[] = [];
    for (const f of merged) {
      const key = (f.key as string).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ key, label: (f.label as string) || key });
    }
    return result;
  }, [customPeopleFields, customLeadFields]);

  const optionByKey = useMemo(() => {
    const map = new Map<string, FieldOption>();
    for (const f of [...LEAD_FIELDS, ...PESSOA_FIELDS, ...EMPRESA_FIELDS, ...AGENDAMENTO_FIELDS, ...customFieldOptions]) {
      map.set(f.key, f);
    }
    return map;
  }, [customFieldOptions]);

  const handleChange = (pos: number, value: string) => {
    setVariablesMap(prev => {
      const next = { ...prev };
      if (value) next[String(pos)] = value;
      else delete next[String(pos)];
      return next;
    });
  };

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const cleanedMap: Record<string, string> = {};
      for (const pos of positions) {
        const v = variablesMap[String(pos)];
        if (v) cleanedMap[String(pos)] = v;
      }
      const nextJsonData = {
        ...(template.json_data ?? {}),
        variables_map: cleanedMap,
      };
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ json_data: nextJsonData })
        .eq('id', template.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Variáveis salvas');
      onOpenChange(false);
    } catch (err) {
      console.error('[WhatsappTemplateVariablesModal] save error:', err);
      toast.error((err as Error)?.message || 'Erro ao salvar variáveis');
    } finally {
      setSaving(false);
    }
  };

  const previewBody = useMemo(() => {
    if (!body) return '';
    return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
      const key = variablesMap[n];
      if (!key) return `{{${n}}}`;
      const opt = optionByKey.get(key);
      if (previewMode === 'example' && opt?.example) return opt.example;
      return `(${opt?.label ?? key})`;
    });
  }, [body, variablesMap, optionByKey, previewMode]);

  const renderItem = (f: FieldOption) => (
    <SelectItem key={f.key} value={f.key} className="text-[13px]">
      <span className="flex items-center gap-2">
        <span>{f.label}</span>
        <span className="text-muted-foreground/40 font-mono text-[11px]">{f.key}</span>
      </span>
    </SelectItem>
  );

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Editar variáveis — {template.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* ── Mapping ───────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <p className="text-[13px] font-medium text-foreground">Mapeamento de variáveis</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Vincule cada variável <code className="font-mono">{'{{N}}'}</code> a um campo do CRM.
              </p>
            </div>

            {positions.length === 0 ? (
              <div className="border border-border rounded-[2px] p-4 text-center">
                <p className="text-[12px] text-muted-foreground/70">
                  Este template não possui variáveis <code className="font-mono">{'{{N}}'}</code> no corpo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map(pos => (
                  <div key={pos} className="flex items-center gap-3">
                    <code className="font-mono text-[12px] bg-muted px-2 py-1 rounded text-foreground/80 shrink-0 min-w-[42px] text-center">
                      {`{{${pos}}}`}
                    </code>
                    <span className="text-muted-foreground/50 text-[13px]">→</span>
                    <Select
                      value={variablesMap[String(pos)] ?? ''}
                      onValueChange={v => handleChange(pos, v)}
                    >
                      <SelectTrigger className="h-[30px] text-[13px] flex-1">
                        <SelectValue placeholder="Selecione um campo" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[360px]">
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
                            Lead
                          </SelectLabel>
                          {LEAD_FIELDS.map(renderItem)}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
                            Pessoa
                          </SelectLabel>
                          {PESSOA_FIELDS.map(renderItem)}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
                            Empresa
                          </SelectLabel>
                          {EMPRESA_FIELDS.map(renderItem)}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
                            Agendamento
                          </SelectLabel>
                          {AGENDAMENTO_FIELDS.map(renderItem)}
                        </SelectGroup>
                        {customFieldOptions.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
                              Custom
                            </SelectLabel>
                            {customFieldOptions.map(renderItem)}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Preview ───────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-foreground">Preview</p>
              <div className="flex gap-1">
                {(['example', 'label'] as PreviewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                      previewMode === mode
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                    )}
                  >
                    {mode === 'example' ? 'Exemplo' : 'Rótulo'}
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-border rounded-[2px] bg-muted/40 p-3 min-h-[160px]">
              <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-foreground/90">
                {previewBody || (
                  <span className="text-muted-foreground/50">Sem corpo de mensagem.</span>
                )}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              {previewMode === 'example'
                ? 'Visualização com valores fictícios — apenas para conferência.'
                : 'Os trechos entre parênteses serão substituídos pelo valor real do campo no envio.'}
            </p>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="pt-3 border-t border-border flex justify-end gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-[30px] text-[13px]"
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            className="h-[30px] text-[13px]"
            disabled={saving || positions.length === 0}
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Salvando...</>
            ) : (
              'Salvar variáveis'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
