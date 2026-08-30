import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, DollarSign, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { NegocioOptimized } from '@/hooks/useNegociosOptimized';
import CursoBadges from '@/components/negocios/CursoBadges';

interface MobileNegocioCardProps {
  negocio: NegocioOptimized & { pipeline_nome?: string; stage_nome?: string; responsavel_nome?: string; last_interaction_at?: string; score?: number };
  onSelect?: (id: string) => void;
}

export const MobileNegocioCard = ({ negocio, onSelect }: MobileNegocioCardProps) => {
  const navigate = useNavigate();

  const formatValue = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTime = (date?: string) => {
    if (!date) return '';
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const getPipelineColor = (pipelineId?: string) => {
    // Você pode customizar cores por pipeline aqui
    return 'hsl(var(--primary))';
  };

  return (
    <button
      onClick={() => onSelect ? onSelect(negocio.id) : navigate('/m/crm/' + negocio.id)}
      className="w-full bg-card border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: getPipelineColor(negocio.leads_pipelines_id)
      }}
    >
      <div className="space-y-3">
        {/* Título e empresa */}
        <div>
          <h3 className="font-semibold text-base mb-1 line-clamp-1">
            {negocio.pessoa?.name || negocio.title || 'Sem nome'}
          </h3>
          {negocio.pessoa?.whatsapp && (
            <a
              href={`https://wa.me/${negocio.pessoa.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-sm text-emerald-500 hover:text-emerald-400 mb-1"
            >
              <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{negocio.pessoa.whatsapp}</span>
            </a>
          )}
          {negocio.empresa && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{negocio.empresa.trade_name}</span>
            </div>
          )}
        </div>

        {/* Pipeline e Etapa */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-micro">
            {negocio.pipeline_nome || 'Pipeline'}
          </Badge>
          <Badge variant="secondary" className="text-micro">
            {negocio.stage_nome || 'Etapa'}
          </Badge>
          {negocio.score && (
            <Badge 
              className={cn(
                "text-micro",
                negocio.score >= 8 ? "bg-success" : 
                negocio.score >= 5 ? "bg-warning" : 
                "bg-destructive"
              )}
            >
              Score: {negocio.score}
            </Badge>
          )}
          <CursoBadges cursos={negocio.pessoa?.cursos} />
        </div>

        {/* Valor e Responsável */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-primary font-semibold">
            <DollarSign className="h-4 w-4" />
            <span className="text-base">{formatValue(negocio.value)}</span>
          </div>
          
          {negocio.responsavel_nome && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/10 text-primary text-micro">
                  {negocio.responsavel_nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                {negocio.responsavel_nome}
              </span>
            </div>
          )}
        </div>

        {/* Última interação */}
        {negocio.last_interaction_at && (
          <div className="text-micro text-muted-foreground pt-2 border-t border-border">
            Última interação: {formatTime(negocio.last_interaction_at)}
          </div>
        )}
      </div>
    </button>
  );
};
