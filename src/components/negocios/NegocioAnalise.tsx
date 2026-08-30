
import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Target } from 'lucide-react';

interface NegocioAnaliseProps {
  negocioId: string;
  tenantId: string;
}

const NegocioAnalise = ({ negocioId, tenantId }: NegocioAnaliseProps) => {
  // Mock data for analytics
  const analytics = {
    tempoNoFunil: '15 dias',
    probabilidadeConversao: '75%',
    valorEstimado: 'R$ 25.000,00',
    proximaAcao: 'Enviar proposta comercial'
  };

  return (
    <Card className="p-6 rounded-[2px]">
      <h3 className="font-semibold mb-6 text-[14px]">Análise do Negócio</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-[2px] transition-all duration-300">
            <Clock className="w-8 h-8 text-[#3B82F6]" />
            <div>
              <p className="text-sm text-muted-foreground">Tempo no Funil</p>
              <p className="font-semibold text-lg">{analytics.tempoNoFunil}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-[#00D26A]/10 border border-[#00D26A]/20 rounded-[2px] transition-all duration-300">
            <TrendingUp className="w-8 h-8 text-[#00D26A]" />
            <div>
              <p className="text-sm text-muted-foreground">Probabilidade de Conversão</p>
              <p className="font-semibold text-lg">{analytics.probabilidadeConversao}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#B8924B]/10 border border-[#B8924B]/20 rounded-[2px] transition-all duration-300">
            <DollarSign className="w-8 h-8 text-[#B8924B]" />
            <div>
              <p className="text-sm text-muted-foreground">Valor Estimado</p>
              <p className="font-semibold text-lg">{analytics.valorEstimado}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-[#F59E0B]/10 rounded-[2px] border border-[#F59E0B]/20">
            <Target className="w-8 h-8 text-[#F59E0B]" />
            <div>
              <p className="text-sm text-muted-foreground">Próxima Ação</p>
              <p className="font-semibold text-lg">{analytics.proximaAcao}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t">
        <h4 className="text-[13px] font-medium mb-4 text-muted-foreground/70 uppercase tracking-widest text-[11px] font-mono">Histórico de Mudanças de Estágio</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 px-3 bg-card border border-border rounded-[2px]">
            <span className="text-sm">Qualificação → Proposta</span>
            <span className="text-xs text-muted-foreground">2 dias atrás</span>
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-card border border-border rounded-[2px]">
            <span className="text-sm">Contato Inicial → Qualificação</span>
            <span className="text-xs text-muted-foreground">5 dias atrás</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default NegocioAnalise;
