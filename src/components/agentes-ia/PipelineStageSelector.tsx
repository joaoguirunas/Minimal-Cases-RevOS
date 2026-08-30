import { Label } from "@/components/ui/label";
import { usePipelines } from "@/hooks/usePipelines";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface PipelineStageSelectorProps {
  pipelineId: string;
  stageId: string;
  onPipelineChange: (pipelineId: string) => void;
  onStageChange: (stageId: string) => void;
  disabled?: boolean;
}

export const PipelineStageSelector = ({
  pipelineId,
  stageId,
  onPipelineChange,
  onStageChange,
  disabled = false
}: PipelineStageSelectorProps) => {
  
  const { pipelines = [], stages: allStages = [] } = usePipelines();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedPipeline = pipelines.find(p => String(p.id) === String(pipelineId));
  const stages = allStages.filter(s => s.pipeline_id === pipelineId) || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePipelineSelect = (selectedPipelineId: string) => {
    onPipelineChange(selectedPipelineId);
    onStageChange('');
    setIsOpen(false);
  };

  const handleToggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Select */}
      <div className="relative" ref={dropdownRef}>
        <Label className="text-sm font-medium">Pipeline *</Label>
        
        <div
          className={`
            mt-1 w-full px-3 py-2 border border-border rounded-[4px] 
            bg-background cursor-pointer flex items-center justify-between
            transition-colors hover:border-primary/50
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${isOpen ? 'border-primary ring-1 ring-primary/20' : ''}
          `}
          onClick={handleToggleDropdown}
        >
          <span className={`text-sm ${selectedPipeline ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selectedPipeline ? selectedPipeline.nome : "Selecione um pipeline"}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-[4px] z-50 max-h-60 overflow-y-auto">
            {pipelines.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum pipeline encontrado
              </div>
            ) : (
              pipelines.map((pipeline, index) => (
                <div
                  key={pipeline.id}
                  className={`
                    flex items-center px-3 py-2 cursor-pointer transition-colors text-sm
                    ${String(pipeline.id) === String(pipelineId) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}
                    ${index < pipelines.length - 1 ? 'border-b border-border' : ''}
                  `}
                  onClick={() => handlePipelineSelect(pipeline.id)}
                >
                  <Check className={`mr-2 w-4 h-4 ${String(pipeline.id) === String(pipelineId) ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="font-medium">{pipeline.nome}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Timeline das Etapas */}
      {pipelineId && stages.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Etapa do Pipeline *</Label>
          <div className="mt-3 space-y-2">
            <div className="text-sm text-muted-foreground mb-4">
              Clique na etapa desejada para selecioná-la
            </div>
            <div className="relative">
              {/* Linha de conexão */}
              <div className="absolute left-4 top-6 bottom-0 w-0.5 bg-border"></div>
              
              {/* Etapas */}
              <div className="space-y-3">
                {stages
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((stage, index) => {
                    const isSelected = stage.id === stageId;
                    const isClickable = !disabled && pipelineId;
                    
                    return (
                      <div 
                        key={stage.id}
                        className={`relative flex items-center gap-3 p-3 rounded-[4px] border transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : isClickable 
                              ? 'border-border hover:border-primary/50 hover:bg-muted'
                              : 'border-border opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (isClickable) {
                            onStageChange(stage.id);
                          }
                        }}
                      >
                        {/* Círculo da timeline */}
                        <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                          isSelected 
                            ? 'border-primary bg-primary text-primary-foreground' 
                            : 'border-border bg-background text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        
                        {/* Conteúdo da etapa */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${
                              isSelected ? 'text-primary' : 'text-foreground'
                            }`}>
                              {stage.nome}
                            </span>
                            {isSelected && (
                              <Badge variant="default" className="text-xs">
                                Selecionada
                              </Badge>
                            )}
                          </div>
                          {stage.cor && (
                            <div className="flex items-center gap-2 mt-1">
                              <div 
                                className="w-3 h-3 rounded-full border" 
                                style={{ backgroundColor: stage.cor }}
                              />
                              <span className="text-xs text-muted-foreground">
                                Cor da etapa
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {!stageId && (
              <div className="text-sm text-destructive mt-2">
                ⚠️ Selecione uma etapa do pipeline
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensagem quando não há pipeline selecionado */}
      {!pipelineId && (
        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-[4px] text-center">
          {disabled ? (
            'Clique em "Editar" para configurar o pipeline'
          ) : (
            'Selecione um pipeline para ver as etapas disponíveis'
          )}
        </div>
      )}
    </div>
  );
};