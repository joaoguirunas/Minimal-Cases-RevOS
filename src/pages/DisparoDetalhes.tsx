import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useSend } from '@/hooks/useSends';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { DisparoHeroSection } from '@/components/disparos/DisparoHeroSection';
import { StatCard } from '@/components/disparos/StatCard';
import { ProgressCard } from '@/components/disparos/ProgressCard';
import { PerformanceCard } from '@/components/disparos/PerformanceCard';
import { ConfigurationSection } from '@/components/disparos/ConfigurationSection';
import DisparoControls from '@/components/disparos/DisparoControls';
import TabelaContatos from '@/components/disparos/TabelaContatos';
import { Users, Send, XCircle, Clock } from 'lucide-react';

export default function DisparoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isManager, currentUserId } = useUserPermissions();

  // Poll every 15s while running so progress updates without browser loop
  const { data: send, isLoading, isError, error } = useSend(id!, {
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status === 'running' ? 15000 : false;
    },
  });

  useEffect(() => {
    if (!isLoading && send && !isManager && currentUserId) {
      if (send.created_by !== currentUserId) {
        navigate('/send', { replace: true });
      }
    }
  }, [isLoading, send, isManager, currentUserId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <StandardPageLoader size="large" message="Carregando detalhes do disparo..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold">Erro ao carregar disparo</h2>
          <p className="text-muted-foreground text-sm font-mono break-all">
            {(error as Error)?.message ?? 'Erro desconhecido'}
          </p>
        </div>
      </div>
    );
  }

  if (!send) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Disparo não encontrado</h2>
          <p className="text-muted-foreground">O disparo solicitado não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const successRate = send.sent_count > 0
    ? (send.sent_count / (send.sent_count + send.failed_count)) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <DisparoHeroSection
        name={send.name}
        type={send.type}
        status={send.status}
        createdAt={send.created_at}
        createdByEmail={send.created_by_user?.name}
        nextSendIn={0}
        isRunning={send.status === 'running'}
        intervalSeconds={send.send_interval_seconds || 5}
      />

      <div className="max-w-7xl mx-auto p-6 pb-20 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total de Contatos"
            value={send.total_contacts || 0}
            icon={Users}
            iconColor="bg-blue-500/10 text-blue-600 border border-blue-200/20"
            delay={0.1}
          />
          <StatCard
            title="Enviados com Sucesso"
            value={send.sent_count || 0}
            icon={Send}
            iconColor="bg-green-500/10 text-green-600 border border-green-200/20"
            subtitle={`${successRate.toFixed(1)}% de sucesso`}
            delay={0.2}
          />
          <StatCard
            title="Falhas no Envio"
            value={send.failed_count || 0}
            icon={XCircle}
            iconColor="bg-red-500/10 text-red-600 border border-red-200/20"
            delay={0.3}
          />
          <StatCard
            title="Pendentes"
            value={(send.total_contacts || 0) - (send.sent_count || 0) - (send.failed_count || 0)}
            icon={Clock}
            iconColor="bg-yellow-500/10 text-yellow-600 border border-yellow-200/20"
            delay={0.4}
          />
        </div>

        <DisparoControls send={send} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProgressCard
            totalContacts={send.total_contacts || 0}
            sentCount={send.sent_count || 0}
            failedCount={send.failed_count || 0}
            successRate={successRate}
            delay={0.5}
          />
          <PerformanceCard
            createdAt={send.created_at}
            startedAt={send.started_at}
            completedAt={send.completed_at}
            intervalSeconds={send.send_interval_seconds || 5}
            delay={0.6}
          />
        </div>

        <ConfigurationSection
          pipeline={send.pipeline}
          webhook={send.webhook}
          delay={0.7}
        />

        <TabelaContatos
          sendId={send.id}
          sendStatus={send.status}
          channel={send.channel || 'whatsapp'}
        />
      </div>
    </div>
  );
}
