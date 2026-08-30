
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Building2, Phone, Mail, Briefcase, TrendingUp, ExternalLink, StickyNote, Flame, Star } from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";
import { useCriarNegocio } from "@/hooks/useConversasPessoas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PessoaSidebarProps {
  pessoa: {
    id: string;
    nome: string;
    whatsapp?: string;
    email?: string;
    instagram_handle?: string;
    notes?: string;
    empresa?: { nome_fantasia: string };
    total_mensagens: number;
    negocios: Array<{
      id: string;
      valor?: number;
      status: string;
      pre_sale_temperature?: number;
      close_probability?: number;
      pipeline: { nome: string };
      stage: { nome: string };
    }>;
  };
  tenantId: string;
}

const PessoaSidebar = ({ pessoa, tenantId }: PessoaSidebarProps) => {
  const navigate = useNavigate();
  const [showNovoNegocio, setShowNovoNegocio] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [valor, setValor] = useState("");

  const { pipelines: allPipelines, stages } = usePipelines();
  const criarNegocio = useCriarNegocio();
  
  // Filter only active pipelines for selection
  const pipelines = allPipelines.filter(p => p.active || p.ativo);

  const stagesFiltradas = pipelineId 
    ? stages.filter(stage => stage.pipeline_id === pipelineId)
    : [];

  const handleCriarNegocio = async () => {
    if (!pipelineId || !stageId) return;

    try {
      await criarNegocio.mutateAsync({
        pessoa_id: pessoa.id,
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        valor: valor ? parseFloat(valor) : undefined
      });
      
      // Reset form
      setPipelineId("");
      setStageId("");
      setValor("");
      setShowNovoNegocio(false);
    } catch (error) {
      console.error('Erro ao criar negócio:', error);
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-[#B8924B]/10 text-[#7A5C24] dark:text-[#D4B071]';
      case 'won': return 'bg-green-500/10 text-green-700 dark:text-green-300';
      case 'lost': return 'bg-red-500/10 text-red-700 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleNegocioClick = (negocioId: string) => {
    navigate(`/crm/kanban/${negocioId}`);
  };

  return (
    <div className="w-[220px] border-l bg-card p-4 overflow-y-auto">
      {/* Informações de Contato */}
      <Card className="p-4 mb-4">
        <h4 className="font-medium text-sm mb-3">Informações de Contato</h4>
        <div className="space-y-3 text-sm">
          {pessoa.whatsapp && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{pessoa.whatsapp}</span>
            </div>
          )}
          {pessoa.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs break-all">{pessoa.email}</span>
            </div>
          )}
          {pessoa.instagram_handle && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-muted-foreground text-xs font-bold flex items-center justify-center">IG</span>
              <span className="text-xs">@{pessoa.instagram_handle}</span>
            </div>
          )}
          {pessoa.empresa && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>{pessoa.empresa.nome_fantasia}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Estatísticas */}
      <Card className="p-4 mb-4">
        <h4 className="font-medium text-sm mb-3">Estatísticas</h4>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-[2px]">
            <div className="text-lg font-semibold text-primary">{pessoa.total_mensagens}</div>
            <div className="text-xs text-primary/80">Mensagens</div>
          </div>
          <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-[2px]">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{pessoa.negocios.length}</div>
            <div className="text-xs text-green-600 dark:text-green-400">Negócios</div>
          </div>
        </div>
      </Card>

      {/* Negócios */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Negócios
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNovoNegocio(!showNovoNegocio)}
            className="h-7 px-2"
          >
            <Plus className="w-3 h-3 mr-1" />
            Novo
          </Button>
        </div>

        {/* Formulário Novo Negócio */}
        {showNovoNegocio && (
          <div className="mb-4 p-3 bg-card rounded-[2px] space-y-3">
            <Select value={pipelineId} onValueChange={(value) => {
              setPipelineId(value);
              setStageId(""); // Reset stage quando mudar pipeline
            }}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                    {pipeline.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                {stagesFiltradas.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id.toString()}>
                    {stage.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Valor (opcional)"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="h-8"
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCriarNegocio}
                disabled={!pipelineId || !stageId || criarNegocio.isPending}
                className="flex-1 h-7"
              >
                {criarNegocio.isPending ? "Criando..." : "Criar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNovoNegocio(false)}
                className="h-7"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Lista de Negócios */}
        <div className="space-y-3">
          {pessoa.negocios.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Nenhum negócio cadastrado
            </div>
          ) : (
            pessoa.negocios.map((negocio) => (
              <div 
                key={negocio.id} 
                className="p-3 border rounded-[2px] bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => handleNegocioClick(negocio.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getStatusColor(negocio.status)}>
                    {negocio.status}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(negocio.valor)}
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
                {/* Temperature indicators */}
                {(negocio.pre_sale_temperature || negocio.close_probability) && (
                  <div className="flex items-center gap-2 mb-1.5">
                    {negocio.pre_sale_temperature && (
                      <div className="flex items-center gap-0.5" title="Temperatura Pré-Venda">
                        {[1, 2, 3, 4, 5].map(level => (
                          <Flame key={level} className={`w-3 h-3 ${level <= negocio.pre_sale_temperature! ? "text-orange-500 fill-orange-500" : "text-muted-foreground/20"}`} strokeWidth={1.5} />
                        ))}
                      </div>
                    )}
                    {negocio.close_probability && (
                      <div className="flex items-center gap-0.5" title="Probabilidade de Fechamento">
                        {[1, 2, 3, 4, 5].map(level => (
                          <Star key={level} className={`w-3 h-3 ${level <= negocio.close_probability! ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} strokeWidth={1.5} />
                        ))}
                        <span className="text-[10px] text-muted-foreground/60 ml-0.5">{negocio.close_probability * 20}%</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium">{negocio.pipeline.nome}</div>
                  <div>{negocio.stage.nome}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default PessoaSidebar;
