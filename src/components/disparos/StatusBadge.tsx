import { Badge } from '@/components/ui/badge';
import { Clock, Zap, Check, Pause, Edit, Send, CheckCheck, X, AlertTriangle } from 'lucide-react';
import { SendStatus, ContactStatus } from '@/types/sends';

interface StatusBadgeProps {
  status: SendStatus | ContactStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, { icon: any; className: string; label: string }> = {
  // Send Status
  draft: { icon: Edit, className: 'bg-muted text-muted-foreground border-border', label: 'Rascunho' },
  scheduled: { icon: Clock, className: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20', label: 'Agendado' },
  running: { icon: Zap, className: 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20', label: 'Em andamento' },
  completed: { icon: Check, className: 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20', label: 'Concluído' },
  paused: { icon: Pause, className: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20', label: 'Pausado' },

  // Contact Status
  pending: { icon: Clock, className: 'bg-muted text-muted-foreground border-border', label: 'Pendente' },
  sent: { icon: Send, className: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20', label: 'Enviado' },
  delivered: { icon: Check, className: 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20', label: 'Entregue' },
  read: { icon: CheckCheck, className: 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20', label: 'Lido' },
  failed: { icon: X, className: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20', label: 'Falhou' },
  invalid: { icon: AlertTriangle, className: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20', label: 'Inválido' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;

  const Icon = config.icon;
  const sizeClasses = {
    sm: 'text-xs h-5 gap-1',
    md: 'text-sm h-6 gap-1.5',
    lg: 'text-base h-7 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <Badge className={`inline-flex items-center ${sizeClasses[size]} ${config.className} px-2 rounded-[2px] font-medium border`}>
      <Icon className={iconSizes[size]} />
      {config.label}
    </Badge>
  );
}
