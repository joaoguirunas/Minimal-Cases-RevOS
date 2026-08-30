import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePipelines } from "@/hooks/usePipelines";
import { useUpdateNegocioStage } from "@/hooks/useUpdateNegocioStage";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp } from "lucide-react";

interface AlterarEtapaNegocioProps {
  negocio: {
    id: string;
    stage?: { id: string; nome: string };
    pipeline?: { id: string; nome: string };
  };
}

const AlterarEtapaNegocio = ({ negocio }: AlterarEtapaNegocioProps) => {
  const { stages } = usePipelines();
  const updateNegocioStage = useUpdateNegocioStage();
  const { toast } = useToast();

  // Filtrar etapas do pipeline atual do negócio
  const stagesDisponiveis = stages.filter(stage => 
    stage.pipeline_id === negocio.pipeline?.id
  );

  const handleMudarEtapa = async (novaEtapaId: string) => {
    if (novaEtapaId === negocio.stage?.id) return; // Se é a mesma etapa, não faz nada

    try {
      console.log('=== ALTERANDO ETAPA DO NEGÓCIO ===');
      console.log('Negócio ID:', negocio.id);
      console.log('Nova etapa ID:', novaEtapaId);

      await updateNegocioStage.mutateAsync({
        negocioId: negocio.id,
        stageId: novaEtapaId
      });
    } catch (error: any) {
      console.error('=== ERRO AO ALTERAR ETAPA ===');
      console.error('Erro completo:', error);
      
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível alterar a etapa",
        variant: "destructive",
      });
    }
  };

  if (!negocio.stage || !negocio.pipeline) {
    return (
      <div className="text-xs text-muted-foreground">
        Negócio sem etapa definida
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Alterar Etapa
      </h4>
      
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Pipeline:</div>
        <Badge variant="outline" className="text-xs">
          {negocio.pipeline.nome}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Etapa atual:</div>
        <Select
          value={negocio.stage.id}
          onValueChange={handleMudarEtapa}
          disabled={updateNegocioStage.isPending || stagesDisponiveis.length === 0}
        >
          <SelectTrigger className="h-8 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stagesDisponiveis.length > 0 ? (
              stagesDisponiveis.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.nome}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__no_stages__" disabled>
                Nenhuma etapa disponível
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
};

export default AlterarEtapaNegocio;