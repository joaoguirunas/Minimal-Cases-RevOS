import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CountdownCircular } from './CountdownCircular';

interface DisparoHeroSectionProps {
  name: string;
  type: string;
  status: string;
  createdAt: string;
  createdByEmail?: string;
  nextSendIn: number;
  isRunning: boolean;
  intervalSeconds?: number;
}

const statusConfig = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground border-border' },
  scheduled: { label: 'Agendado', color: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20' },
  running: { label: 'Em Execução', color: 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20' },
  paused: { label: 'Pausado', color: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' },
  completed: { label: 'Concluído', color: 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20' },
  failed: { label: 'Falhou', color: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' },
};

export function DisparoHeroSection({
  name,
  type,
  status,
  createdAt,
  createdByEmail,
  nextSendIn,
  isRunning,
  intervalSeconds = 60
}: DisparoHeroSectionProps) {
  const navigate = useNavigate();
  const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card border-b border-border sticky top-0 z-10"
    >
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/send')}
            className="gap-2 h-[30px] px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Disparos
          </Button>
          <span>/</span>
          <span className="text-foreground font-medium">{name}</span>
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Title & Info */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[32px] font-bold font-['Outfit'] tracking-[-0.025em] text-foreground">
                {name}
              </h1>
              <Badge className={`${statusInfo.color} border rounded-[2px] px-3 py-1 ${
                status === 'running' ? 'animate-pulse' : ''
              }`}>
                {statusInfo.label}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Criado em {format(new Date(createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              {createdByEmail && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{createdByEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Countdown (only when running) */}
          {isRunning && nextSendIn > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <CountdownCircular seconds={nextSendIn} totalSeconds={intervalSeconds} />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
