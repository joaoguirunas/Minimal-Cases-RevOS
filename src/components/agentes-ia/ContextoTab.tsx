import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, FileText, Variable } from 'lucide-react';
import {
  SECOES_CONTEXTO_PADRAO,
  gerarContextoPorSecoes,
  PRESETS,
} from './models/dadosEntradaModels';
import { IdentidadeSelector } from './IdentidadeSelector';
import { cn } from '@/lib/utils';
import type { AgenteIA } from '@/hooks/useAgentesIA';
import { useAllLeadFieldDefinitions } from '@/hooks/useLeadFieldDefinitions';

interface ContextoTabProps {
  agente: AgenteIA;
  onAgentChange: (data: Partial<AgenteIA>) => void;
}

export const ContextoTab = ({ agente, onAgentChange }: ContextoTabProps) => {
  const [localInputData, setLocalInputData] = useState(agente.input_data || '');
  const [openSection, setOpenSection] = useState<string | null>(null);

  const { data: allFieldDefs = [] } = useAllLeadFieldDefinitions();

  const camposPersonalizados = useMemo(() => {
    const active = allFieldDefs.filter(d => d.active);
    const groups: { id: string; titulo: string; campos: typeof active }[] = [];
    const negocio = active.filter(d => d.entity_type === 'negocio' || d.entity_type === 'lead');
    const pessoa = active.filter(d => d.entity_type === 'pessoa');
    const empresa = active.filter(d => d.entity_type === 'empresa');
    if (negocio.length) groups.push({ id: 'cp_negocio', titulo: 'CAMPOS DO NEGÓCIO', campos: negocio });
    if (pessoa.length) groups.push({ id: 'cp_pessoa', titulo: 'CAMPOS DA PESSOA', campos: pessoa });
    if (empresa.length) groups.push({ id: 'cp_empresa', titulo: 'CAMPOS DA EMPRESA', campos: empresa });
    return groups;
  }, [allFieldDefs]);

  useEffect(() => {
    setLocalInputData(agente.input_data || '');
  }, [agente.input_data]);

  const handleInputDataChange = (newValue: string) => {
    setLocalInputData(newValue);
    onAgentChange({ input_data: newValue });
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    let text = gerarContextoPorSecoes(PRESETS[preset]());

    if (preset === 'PADRAO_COMPLETO' && camposPersonalizados.length > 0) {
      const partes: string[] = [text];
      for (const grupo of camposPersonalizados) {
        partes.push('');
        partes.push('## ====================================');
        partes.push(`## ${grupo.titulo}`);
        partes.push('## ====================================');
        for (const def of grupo.campos) {
          partes.push(`${def.name}: {{lead.${def.key}}}`);
        }
      }
      text = partes.join('\n').trim();
    }

    setLocalInputData(text);
    onAgentChange({ input_data: text });
  };

  const insertVariable = (label: string, chave: string) => {
    const line = `${label}: {{${chave}}}`;
    const newValue = localInputData ? `${localInputData.trimEnd()}\n${line}` : line;
    setLocalInputData(newValue);
    onAgentChange({ input_data: newValue });
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT PANEL: Identidade ───────────────────────────────── */}
      <div className="w-[42%] shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">

        {/* Panel header */}
        <div className="px-5 py-3 border-b border-white/[0.06] shrink-0 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div>
            <h3 className="text-xs font-semibold text-foreground">Identidade</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              Persona base do agente — carregada em todas as execuções
            </p>
          </div>
        </div>

        {/* Full-height content */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          <IdentidadeSelector
            value={agente.identidade || ''}
            onChange={(v) => onAgentChange({ identidade: v })}
            isEditing={true}
          />
        </div>
      </div>

      {/* ── RIGHT PANEL: Dados de Entrada ───────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Panel header */}
        <div className="px-5 py-3 border-b border-white/[0.06] shrink-0 flex items-center gap-2">
          <Variable className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div>
            <h3 className="text-xs font-semibold text-foreground">Dados de Entrada</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              Contexto injetado no prompt — use{' '}
              <code className="font-mono text-primary/80 bg-muted px-0.5 rounded-[2px] text-[9px]">
                {'{{variavel}}'}
              </code>{' '}
              para dados dinâmicos do lead
            </p>
          </div>
        </div>

        {/* Preset bar */}
        <div className="px-5 py-2 border-b border-white/[0.06] shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Preencher com:</span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('SO_BASICOS')}
              className="h-[30px] text-xs px-2.5"
            >
              Básicos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('PADRAO_COMPLETO')}
              className="h-[30px] text-xs px-2.5"
            >
              Completo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyPreset('LIMPAR')}
              className="h-[30px] text-xs px-2 text-muted-foreground hover:text-destructive"
            >
              Limpar
            </Button>
          </div>
          {localInputData && (
            <span className="ml-auto text-[9px] text-muted-foreground/60 tabular-nums shrink-0">
              {localInputData.split('\n').length} linhas
            </span>
          )}
        </div>

        {/* Editor + Variable browser */}
        <div className="flex flex-1 overflow-hidden">

          {/* Template textarea */}
          <div className="flex-1 overflow-hidden p-4">
            <textarea
              value={localInputData}
              onChange={(e) => handleInputDataChange(e.target.value)}
              placeholder="Cole ou escreva o contexto que o agente deve receber em cada execução...&#10;&#10;Dica: use os presets acima ou clique nas variáveis à direita para inserir."
              className={cn(
                'w-full h-full resize-none text-xs font-mono leading-relaxed',
                'bg-transparent border border-border rounded-[4px] px-3 py-2.5',
                'text-foreground placeholder:text-muted-foreground/50',
                'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                'transition-all duration-300'
              )}
            />
          </div>

          {/* Variable browser */}
          <div className="w-[210px] shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06] bg-card shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Variáveis
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {SECOES_CONTEXTO_PADRAO.map((secao) => {
                const isOpen = openSection === secao.id;
                return (
                  <div key={secao.id} className="border-b border-white/[0.06] last:border-0">
                    <button
                      onClick={() => setOpenSection(isOpen ? null : secao.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-300 text-left"
                    >
                      <span className="truncate">{secao.titulo}</span>
                      {isOpen
                        ? <ChevronUp className="h-3 w-3 shrink-0 ml-1 opacity-60" />
                        : <ChevronDown className="h-3 w-3 shrink-0 ml-1 opacity-60" />}
                    </button>

                    {isOpen && (
                      <div className="px-2 pb-2 pt-0.5 flex flex-col gap-0.5 bg-muted">
                        {secao.campos.map((campo) => (
                          <button
                            key={campo.id}
                            onClick={() => insertVariable(campo.label, campo.chave)}
                            title={`Inserir: ${campo.label}: {{${campo.chave}}}\n${campo.descricao}`}
                            className={cn(
                              'group text-left px-2 py-1.5 rounded-[4px] transition-all duration-300 w-full',
                              'hover:bg-primary/8 hover:text-primary',
                              'border border-transparent hover:border-primary/20'
                            )}
                          >
                            <span className="font-mono text-[9px] text-primary/70 group-hover:text-primary block leading-tight">
                              {`{{${campo.chave}}}`}
                            </span>
                            <span className="text-[8px] text-muted-foreground/60 group-hover:text-muted-foreground block mt-0.5 truncate leading-tight">
                              {campo.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {camposPersonalizados.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-muted/30 border-t border-white/[0.06]">
                    <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                      Campos Personalizados
                    </span>
                  </div>
                  {camposPersonalizados.map((grupo) => {
                    const isOpen = openSection === grupo.id;
                    return (
                      <div key={grupo.id} className="border-b border-white/[0.06] last:border-0">
                        <button
                          onClick={() => setOpenSection(isOpen ? null : grupo.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-300 text-left"
                        >
                          <span className="truncate">{grupo.titulo}</span>
                          {isOpen
                            ? <ChevronUp className="h-3 w-3 shrink-0 ml-1 opacity-60" />
                            : <ChevronDown className="h-3 w-3 shrink-0 ml-1 opacity-60" />}
                        </button>

                        {isOpen && (
                          <div className="px-2 pb-2 pt-0.5 flex flex-col gap-0.5 bg-muted">
                            {grupo.campos.map((def) => {
                              const chave = `lead.${def.key}`;
                              return (
                                <button
                                  key={def.id}
                                  onClick={() => insertVariable(def.name, chave)}
                                  title={`Inserir: ${def.name}: {{${chave}}}`}
                                  className={cn(
                                    'group text-left px-2 py-1.5 rounded-[4px] transition-all duration-300 w-full',
                                    'hover:bg-primary/8 hover:text-primary',
                                    'border border-transparent hover:border-primary/20'
                                  )}
                                >
                                  <span className="font-mono text-[9px] text-primary/70 group-hover:text-primary block leading-tight">
                                    {`{{${chave}}}`}
                                  </span>
                                  <span className="text-[8px] text-muted-foreground/60 group-hover:text-muted-foreground block mt-0.5 truncate leading-tight">
                                    {def.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
