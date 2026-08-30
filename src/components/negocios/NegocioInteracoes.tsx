
import React from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, Phone, Mail, MessageSquare } from 'lucide-react';

interface NegocioInteracoesProps {
  negocioId: string;
  tenantId: string;
}

const NegocioInteracoes = ({ negocioId, tenantId }: NegocioInteracoesProps) => {
  // Mock data for now - replace with real data later
  const interacoes = [
    {
      id: '1',
      tipo: 'email',
      titulo: 'Email enviado',
      descricao: 'Proposta comercial enviada para o cliente',
      data: new Date().toISOString(),
      usuario: 'João Silva'
    },
    {
      id: '2',
      tipo: 'telefone',
      titulo: 'Ligação realizada',
      descricao: 'Conversa sobre detalhes do projeto',
      data: new Date(Date.now() - 86400000).toISOString(),
      usuario: 'Maria Santos'
    }
  ];

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'email':
        return <Mail className="w-4 h-4 text-[#3B82F6]" />;
      case 'telefone':
        return <Phone className="w-4 h-4 text-[#00D26A]" />;
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-[#00D26A]" />;
      default:
        return <Calendar className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="p-6 rounded-[2px]">
      <h3 className="font-semibold mb-4">Histórico de Interações</h3>
      
      {interacoes.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma interação registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {interacoes.map((interacao) => (
            <div
              key={interacao.id}
              className="flex gap-4 p-4 border border-border rounded-[2px] hover:bg-white/[0.035] transition-all duration-300"
            >
              <div className="flex-shrink-0 mt-1">
                {getIcon(interacao.tipo)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium">{interacao.titulo}</h4>
                  <span className="text-sm text-muted-foreground">
                    {new Date(interacao.data).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {interacao.descricao}
                </p>
                <p className="text-xs text-muted-foreground">
                  Por: {interacao.usuario}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default NegocioInteracoes;
