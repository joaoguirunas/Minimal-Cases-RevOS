import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';
import {
  SECOES_CONTEXTO_PADRAO,
  gerarContextoPorSecoes,
  PRESETS,
} from './models/dadosEntradaModels';
import { cn } from '@/lib/utils';

interface DadosEntradaEditorProps {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
}

export const DadosEntradaEditor = ({
  value,
  onChange,
  isEditing,
}: DadosEntradaEditorProps) => {
  const [showSections, setShowSections] = useState(false);

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Dados de Entrada
        </span>
        {value ? (
          <div className="p-2.5 bg-card rounded-[4px] text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
            {value}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nenhum dado de entrada definido</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Dados de Entrada
        </span>
        {value && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-all duration-300"
            title="Copiar"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(gerarContextoPorSecoes(PRESETS.SO_BASICOS()))}
          className="h-6 text-[10px] px-2 flex-1"
        >
          Básicos
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(gerarContextoPorSecoes(PRESETS.PADRAO_COMPLETO()))}
          className="h-6 text-[10px] px-2 flex-1"
        >
          Completo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="h-6 text-[10px] px-2 text-muted-foreground"
        >
          Limpar
        </Button>
      </div>

      {/* Textarea — always visible, always the source of truth */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Selecione um preset acima ou escreva o contexto manualmente..."
        rows={7}
        className="text-[11px] font-mono resize-none leading-relaxed"
      />

      {/* Sections quick-insert */}
      <div>
        <button
          onClick={() => setShowSections(!showSections)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-all duration-300"
        >
          {showSections
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
          Inserir seção
        </button>

        {showSections && (
          <div className="mt-1.5 flex flex-col gap-0.5 pl-1">
            {SECOES_CONTEXTO_PADRAO.map(secao => (
              <button
                key={secao.id}
                onClick={() => {
                  const secaoText = gerarContextoPorSecoes([{ ...secao, ativo: true, campos: secao.campos.map(c => ({ ...c, ativo: true })) }]);
                  const sep = value && !value.endsWith('\n') ? '\n\n' : value ? '\n' : '';
                  onChange(value + sep + secaoText);
                }}
                className={cn(
                  'text-left text-[10px] px-2 py-1 rounded-[4px] transition-all duration-300',
                  'text-muted-foreground hover:text-foreground hover:bg-card'
                )}
              >
                + {secao.titulo}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
