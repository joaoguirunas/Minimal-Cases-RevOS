import { useMemo, useEffect, useState } from 'react';
import { FlaskConical, Code2, Bot } from 'lucide-react';
import {
  useTestSession, useLiveLeadState, useEnsureTestador, useRenameTestador, useAgentsForLead,
} from '@/hooks/useTestSession';
import { useTestContext } from '@/hooks/useTestContext';
import { TestPipelineStageSelector } from './TestPipelineStageSelector';
import { TestChatPanel } from './TestChatPanel';
import { TestFollowupPanel } from './TestFollowupPanel';
import { TestLeadFieldsPanel } from './TestLeadFieldsPanel';
import { TestDevPanel } from './TestDevPanel';
import { OmniTabNav } from '@/components/conversas/OmniTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export function CentralDeTestes() {
  const {
    selectedPersonId,
    selectedPerson,
    selectedChannel,
    setSelectedChannel,
    selectedAgentId,
    setSelectedAgentId,
    isProcessing,
    selectPerson,
    clearHistory,
    sendMessage,
  } = useTestSession();

  // Auto-load Testador on mount
  const { data: testador } = useEnsureTestador();
  useEffect(() => {
    if (testador && !selectedPersonId) {
      selectPerson(testador);
    }
  }, [testador, selectedPersonId, selectPerson]);

  const liveLeadState = useLiveLeadState(selectedPerson?.lead.id ?? null);

  const effectivePerson = useMemo(() => {
    if (!selectedPerson || !liveLeadState) return selectedPerson;
    return {
      ...selectedPerson,
      lead: {
        ...selectedPerson.lead,
        control: liveLeadState.control,
        stage_name: liveLeadState.stage_name || selectedPerson.lead.stage_name,
        stage_color: liveLeadState.stage_color ?? selectedPerson.lead.stage_color,
        stage_id: liveLeadState.stage_id ?? selectedPerson.lead.stage_id,
        pipeline_id: liveLeadState.pipeline_id ?? selectedPerson.lead.pipeline_id,
      },
    };
  }, [selectedPerson, liveLeadState]);

  const { pipelineId, stageId, setPipelineStage, isUpdating } = useTestContext(effectivePerson);
  const [devMode, setDevMode] = useState(false);

  // Agent override — auto-detect by default, opt-in fixed agent
  const { data: availableAgents = [] } = useAgentsForLead(pipelineId, stageId);

  // Rename Testador (click sidebar header → input)
  const renameTestador = useRenameTestador();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const startEditingName = () => {
    setNameDraft(testador?.name ?? 'Testador');
    setEditingName(true);
  };

  const commitNameEdit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && testador && trimmed !== testador.name) {
      renameTestador.mutate({ id: testador.id, name: trimmed });
    }
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full">
      <OmniTabNav />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Testador + agent + pipeline/stage selector (200px) */}
        <div className="w-[200px] shrink-0 h-full overflow-y-auto border-r border-border bg-card">
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            {editingName ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitNameEdit();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="h-6 text-[11px] px-1.5 flex-1"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingName}
                title="Clique para renomear"
                className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors truncate text-left"
              >
                {testador?.name ?? 'Testador'}
              </button>
            )}
          </div>

          {/* Dev mode button */}
          <div className="px-3 py-2.5 border-b border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevMode(true)}
              className="w-full h-[28px] text-[11px] gap-1.5 justify-start"
            >
              <Code2 className="h-3 w-3 text-muted-foreground/50" />
              Modo Dev
            </Button>
          </div>

          {/* Agent selector — auto-detect por default, override opt-in */}
          {availableAgents.length > 0 && (
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Bot className="h-3 w-3 text-muted-foreground/50" />
                Agente
              </p>
              <Select
                value={selectedAgentId ?? '__auto__'}
                onValueChange={(v) => setSelectedAgentId(v === '__auto__' ? null : v)}
              >
                <SelectTrigger className="h-[28px] w-full text-[11px] border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__" className="text-[11px]">
                    <span className="text-muted-foreground italic">Auto-detectar</span>
                  </SelectItem>
                  {availableAgents.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-[11px]">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground/40 mt-1">
                {selectedAgentId ? 'Agente fixo selecionado' : 'Detectado por pipeline + etapa'}
              </p>
            </div>
          )}

          {effectivePerson && (
            <TestPipelineStageSelector
              pipelineId={pipelineId}
              stageId={stageId}
              isUpdating={isUpdating}
              onChange={setPipelineStage}
            />
          )}
        </div>

        {/* Center — chat panel */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <TestChatPanel
            person={effectivePerson}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            isProcessing={isProcessing}
            onSend={sendMessage}
            onClearHistory={clearHistory}
          />
        </div>

        {/* Right — followups + custom fields (280px) */}
        {effectivePerson && (
          <div className="w-[280px] shrink-0 h-full overflow-y-auto border-l border-border bg-card">
            <TestFollowupPanel
              stageId={stageId}
              leadId={effectivePerson.lead.id}
              personId={effectivePerson.id}
            />
            <TestLeadFieldsPanel
              leadId={effectivePerson.lead.id}
              pipelineId={pipelineId}
            />
          </div>
        )}
      </div>

      <TestDevPanel
        open={devMode}
        onOpenChange={setDevMode}
        peopleId={effectivePerson?.id ?? null}
        leadId={effectivePerson?.lead.id ?? null}
        pipelineId={pipelineId}
      />
    </div>
  );
}
