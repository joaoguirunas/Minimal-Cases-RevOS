import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Check } from 'lucide-react';
import { IDENTIDADE_MODELOS } from './models/identidadeModels';
import { cn } from '@/lib/utils';

interface IdentidadeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
}

export const IdentidadeSelector = ({
  value,
  onChange,
  isEditing,
}: IdentidadeSelectorProps) => {
  const [showEditor, setShowEditor] = useState(false);

  const selectedModelo = IDENTIDADE_MODELOS.find(m => m.template === value);
  const isCustom = value && !selectedModelo;

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Identidade
          </span>
          {selectedModelo && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {selectedModelo.icone} {selectedModelo.nome}
            </Badge>
          )}
          {isCustom && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              Personalizado
            </Badge>
          )}
        </div>
        {value ? (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {value}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nenhuma identidade definida</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Identidade
        </span>
        {(selectedModelo || isCustom) && (
          <Badge
            variant={isCustom ? 'outline' : 'secondary'}
            className="text-[10px] h-4 px-1.5"
          >
            {isCustom ? 'Personalizado' : `${selectedModelo!.icone} ${selectedModelo!.nome}`}
          </Badge>
        )}
      </div>

      {/* Persona grid */}
      <div className="grid grid-cols-3 gap-1 shrink-0">
        {IDENTIDADE_MODELOS.map((modelo) => {
          const isSelected = value === modelo.template;
          return (
            <button
              key={modelo.id}
              onClick={() => {
                onChange(modelo.template);
                setShowEditor(false);
              }}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] text-left text-xs border transition-all',
                isSelected
                  ? 'bg-primary/10 border-primary/50 text-primary font-medium'
                  : 'border-white/[0.06] text-muted-foreground hover:border-border hover:text-foreground hover:bg-card'
              )}
            >
              <span className="text-base leading-none">{modelo.icone}</span>
              <span className="truncate leading-tight">{modelo.nome}</span>
              {isSelected && <Check className="h-3 w-3 ml-auto shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Text preview (read mode) — fills remaining height */}
      {value && !showEditor && (
        <div className="relative group flex-1 min-h-0">
          <div className="w-full h-full resize-none text-xs font-mono leading-relaxed bg-transparent border border-border rounded-[4px] px-3 py-2.5 text-foreground overflow-y-auto whitespace-pre-wrap">
            {value}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditor(true)}
            className="absolute top-1.5 right-1.5 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Textarea editor — fills remaining height */}
      {showEditor && (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva a identidade do seu agente..."
            autoFocus
            className={cn(
              'flex-1 w-full resize-none text-xs font-mono leading-relaxed',
              'bg-transparent border border-border rounded-[4px] px-3 py-2.5',
              'text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
              'transition-all duration-300'
            )}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditor(false)}
            className="h-6 text-xs text-muted-foreground shrink-0"
          >
            Fechar editor
          </Button>
        </div>
      )}

      {!value && (
        <p className="text-[10px] text-muted-foreground shrink-0">
          Selecione um modelo acima ou escreva uma identidade personalizada
        </p>
      )}
    </div>
  );
};
