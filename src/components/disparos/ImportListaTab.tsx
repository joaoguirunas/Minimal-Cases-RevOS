import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Users, User, CalendarDays, Share2, FileDown, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import FileUploadZone from './FileUploadZone';
import FieldMapper from './FieldMapper';
import ImportPreviewTable from './ImportPreviewTable';
import type { FieldMappingConfig, StagedImportData } from '@/hooks/useImportarLista';
import type { SendChannel } from '@/types/sends';
import { usePipelines } from '@/hooks/usePipelines';
import { useTeams } from '@/hooks/useTeamsNew';
import { useUsersTeams } from '@/hooks/useUsersTeams';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLeadTypes, type LeadType } from '@/hooks/useLeadTypes';

type TabState = 'select_matrix' | 'upload' | 'mapping' | 'confirmed';

const ICON_MAP: Record<string, React.ElementType> = {
  'Recomendação': Users,
  'Pessoal': User,
  'Evento': CalendarDays,
  'Network': Share2,
};
const DEFAULT_ICON = Tag;

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? DEFAULT_ICON;
}

function normalizeHeader(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function buildAutoMapping(tipo: LeadType, headers: string[], channel: SendChannel): FieldMappingConfig {
  const exact = (key: string) => headers.find(h => normalizeHeader(h) === normalizeHeader(key));
  const contains = (key: string) => headers.find(h => normalizeHeader(h).includes(normalizeHeader(key)));

  const m: FieldMappingConfig = {};

  m.name = exact('nome') ?? contains('nome') ?? contains('name') ?? '';
  if (channel === 'email') {
    m.email = exact('email') ?? contains('email') ?? contains('mail') ?? '';
  } else {
    m.whatsapp = exact('whatsapp') ?? contains('whatsapp') ?? contains('celular') ?? contains('telefone') ?? '';
  }

  // Map extra columns defined in lead_type.csv_headers to lead_cols (DB column key → CSV header)
  const skipPatterns = ['nome', 'name', 'whatsapp', 'celular', 'telefone', 'email', 'mail'];
  const isContactField = (col: string) => skipPatterns.some(p => normalizeHeader(col).includes(p));

  const leadCols: Record<string, string> = {};
  for (const col of tipo.csv_headers) {
    if (isContactField(col)) continue;
    const matched = exact(col) ?? contains(col);
    if (matched) leadCols[col] = matched;
  }
  if (Object.keys(leadCols).length > 0) m.lead_cols = leadCols;

  return m;
}

type TemplateFormat = 'csv' | 'xlsx';

function downloadTemplate(tipo: LeadType, format: TemplateFormat = 'csv') {
  const baseName = `template_${tipo.name.toLowerCase().replace(/\s+/g, '_')}`;
  const headers = tipo.csv_headers;
  const example = tipo.csv_example.length > 0 ? tipo.csv_example : [];

  if (format === 'xlsx') {
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${baseName}.xlsx`);
    return;
  }

  const csv = [headers.join(','), example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ImportListaTabProps {
  channel: SendChannel;
  onImportComplete?: (data: StagedImportData) => void;
  onTipoSelected?: (tipo: string, templateId: string | null) => void;
}

export default function ImportListaTab({
  channel,
  onImportComplete,
  onTipoSelected,
}: ImportListaTabProps) {
  const [state, setState] = useState<TabState>('select_matrix');
  const [tipoLista, setTipoLista] = useState<LeadType | null>(null);
  const { leadTypes, isLoading: isLoadingTypes } = useLeadTypes();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMappingConfig>({});
  const [createLeads, setCreateLeads] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { pipelines, stages } = usePipelines();
  const { data: teams = [] } = useTeams();
  const { data: usersTeams = [] } = useUsersTeams();
  const { user } = useAuth();
  const { isUser } = useUserPermissions();

  const currentUserTeamId = useMemo(() => {
    if (!user?.profile?.id) return null;
    const entry = usersTeams.find((ut) => ut.user_id === user.profile!.id);
    return entry?.team_id ?? null;
  }, [usersTeams, user?.profile?.id]);

  const filteredStages = useMemo(
    () => (pipelineId ? stages.filter((s) => s.pipeline_id === pipelineId) : []),
    [stages, pipelineId],
  );

  const usersInSelectedTeam = useMemo(() => {
    if (!selectedTeamId) return [];
    return usersTeams
      .filter((ut) => ut.team_id === selectedTeamId && ut.usuario?.active !== false)
      .map((ut) => ut.usuario!)
      .filter(Boolean);
  }, [usersTeams, selectedTeamId]);

  const effectiveAssignUserId = isUser ? (user?.profile?.id ?? null) : selectedUserId;
  const effectiveAssignTeamId = isUser ? currentUserTeamId : selectedTeamId;

  const handleSelectTipo = useCallback((tipo: LeadType) => {
    setTipoLista(tipo);
    setState('upload');
  }, []);

  const handleFileParsed = useCallback(
    (_rows: Record<string, string>[], _headers: string[]) => {
      if (!tipoLista) return;
      setRows(_rows);
      setHeaders(_headers);
      setMapping(buildAutoMapping(tipoLista, _headers, channel));
      onTipoSelected?.(tipoLista.name, tipoLista.whatsapp_template_id);

      // Auto-fill CRM defaults
      setCreateLeads(true);
      const firstPipeline = pipelines[0] ?? null;
      const pid = firstPipeline?.id ?? null;
      setPipelineId(pid);
      const firstStage = pid
        ? stages.filter(s => s.pipeline_id === pid)[0] ?? null
        : null;
      setStageId(firstStage?.id ?? null);
      if (currentUserTeamId) setSelectedTeamId(currentUserTeamId);
      if (user?.profile?.id) setSelectedUserId(user.profile.id);

      setState('mapping');
    },
    [tipoLista, channel, onTipoSelected, pipelines, stages, currentUserTeamId, user?.profile?.id],
  );

  const handleReset = useCallback(() => {
    setRows([]);
    setHeaders([]);
    setMapping({});
    setTipoLista(null);
    setCreateLeads(false);
    setPipelineId(null);
    setStageId(null);
    setSelectedTeamId(null);
    setSelectedUserId(null);
    setState('select_matrix');
  }, []);

  const handleConfirmMapping = useCallback(() => {
    const staged: StagedImportData = {
      rows,
      field_mapping: mapping,
      channel,
      create_leads: createLeads,
      pipeline_id: createLeads ? pipelineId : null,
      stage_id: createLeads ? stageId : null,
      lead_control: '1',
      assign_user_id: createLeads ? effectiveAssignUserId : null,
      assign_team_id: createLeads ? effectiveAssignTeamId : null,
      origem_lista: tipoLista?.name ?? null,
      total: rows.length,
    };
    if (onImportComplete) onImportComplete(staged);
    setState('confirmed');
  }, [rows, mapping, channel, createLeads, pipelineId, stageId, tipoLista,
      effectiveAssignUserId, effectiveAssignTeamId, onImportComplete]);

  const canConfirm =
    !!mapping.name &&
    (channel === 'email' ? !!mapping.email : !!mapping.whatsapp) &&
    (!createLeads || (!!pipelineId && !!stageId));

  // ── Passo 1: Seleção do tipo ──────────────────────────────────────────────────
  if (state === 'select_matrix') {
    return (
      <div className="space-y-3">
        <div className="space-y-0.5">
          <p className="text-[13px] font-medium">Qual o tipo de lista?</p>
          <p className="text-[11px] text-muted-foreground">
            Selecione o tipo para baixar o template e fazer o upload
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {isLoadingTypes ? (
            <p className="col-span-2 text-center text-[12px] text-muted-foreground py-4">Carregando...</p>
          ) : leadTypes.map((tipo) => {
            const Icon = getIcon(tipo.name);
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => handleSelectTipo(tipo)}
                className={cn(
                  'flex flex-col items-center gap-2.5 rounded-[4px] border border-border p-4',
                  'text-left cursor-pointer transition-all',
                  'hover:border-primary/50 hover:bg-primary/[0.03]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                )}
              >
                <div className="w-9 h-9 rounded-[6px] bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-medium leading-tight">{tipo.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {tipo.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Passo 2: Download + Upload ────────────────────────────────────────────────
  if (state === 'upload' && tipoLista) {
    const Icon = getIcon(tipoLista.name);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
            Trocar tipo
          </button>
        </div>

        {/* Tipo selecionado */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[4px] bg-muted/50 border border-border">
          <div className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[12px] font-medium leading-tight">{tipoLista.name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{tipoLista.description}</p>
          </div>
        </div>

        {/* Download template */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">1. Baixe o template de {tipoLista.name} e preencha com seus contatos</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(tipoLista, 'csv')}
              className="h-[34px] text-[12px] gap-1.5 border-dashed"
            >
              <FileDown className="w-3.5 h-3.5" strokeWidth={1.5} />
              Baixar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(tipoLista, 'xlsx')}
              className="h-[34px] text-[12px] gap-1.5 border-dashed"
            >
              <FileDown className="w-3.5 h-3.5" strokeWidth={1.5} />
              Baixar XLS
            </Button>
          </div>
        </div>

        {/* Upload */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">2. Faça o upload — campos mapeados automaticamente</p>
          <FileUploadZone
            onFileParsed={(r, h) => handleFileParsed(r, h)}
            maxRows={5000}
            maxSizeMb={5}
          />
        </div>
      </div>
    );
  }

  // ── Passo 3: Mapeamento + CRM ─────────────────────────────────────────────────
  if (state === 'mapping') {
    return (
      <div className="space-y-5">
        {/* Auto-map notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-primary/5 border border-primary/20 text-[11px] text-primary">
          <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          Campos mapeados automaticamente — ajuste abaixo se necessário
        </div>

        {/* Lead creation options */}
        <div className="rounded-[4px] border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="create-leads-toggle" className="text-[13px] font-medium">
                Criar negócios no CRM
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Gera um negócio para cada contato importado
              </p>
            </div>
            <Switch
              id="create-leads-toggle"
              checked={createLeads}
              onCheckedChange={setCreateLeads}
            />
          </div>

          {createLeads && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Pipeline de destino</Label>
                  <Select
                    value={pipelineId ?? ''}
                    onValueChange={(v) => { setPipelineId(v || null); setStageId(null); }}
                  >
                    <SelectTrigger className="h-[32px] text-[12px]">
                      <SelectValue placeholder="Selecione um pipeline..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-[12px]">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Etapa inicial</Label>
                  <Select
                    value={stageId ?? ''}
                    onValueChange={(v) => setStageId(v || null)}
                    disabled={!pipelineId || filteredStages.length === 0}
                  >
                    <SelectTrigger className="h-[32px] text-[12px]">
                      <SelectValue placeholder={pipelineId ? 'Selecione a etapa...' : 'Selecione o pipeline'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStages.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-[12px]">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isUser && (
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Atribuição dos negócios</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground/70">Equipe *</Label>
                      <Select
                        value={selectedTeamId ?? ''}
                        onValueChange={(v) => { setSelectedTeamId(v || null); setSelectedUserId(null); }}
                      >
                        <SelectTrigger className="h-[32px] text-[12px]">
                          <SelectValue placeholder="Selecione a equipe..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.filter((t) => t.ativo !== false).map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-[12px]">
                              {t.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground/70">Usuário *</Label>
                      <Select
                        value={selectedUserId ?? ''}
                        onValueChange={(v) => setSelectedUserId(v || null)}
                        disabled={!selectedTeamId || usersInSelectedTeam.length === 0}
                      >
                        <SelectTrigger className="h-[32px] text-[12px]">
                          <SelectValue placeholder={selectedTeamId ? 'Selecione o usuário...' : 'Selecione a equipe'} />
                        </SelectTrigger>
                        <SelectContent>
                          {usersInSelectedTeam.map((u) => (
                            <SelectItem key={u.id} value={u.id} className="text-[12px]">
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Field mapper */}
        <FieldMapper
          headers={headers}
          channel={channel}
          pipelineId={pipelineId}
          createLeads={createLeads}
          mapping={mapping}
          onChange={setMapping}
          rows={rows}
        />

        {/* Preview */}
        <ImportPreviewTable rows={rows} mapping={mapping} />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setState('upload')}
            className="h-[30px] text-[12px] gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmMapping}
            disabled={!canConfirm}
            className="h-[30px] text-[12px] gap-1.5 flex-1"
          >
            Confirmar mapeamento
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    );
  }

  // ── Confirmado ────────────────────────────────────────────────────────────────
  if (state === 'confirmed') {
    return (
      <div className="space-y-3">
        <div className="rounded-[4px] border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[13px] font-medium">{rows.length} contatos prontos</p>
            <p className="text-[11px] text-muted-foreground">
              Serão importados ao salvar o disparo
            </p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
          Trocar planilha
        </button>
      </div>
    );
  }

  return null;
}
