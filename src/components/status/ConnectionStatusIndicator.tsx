import React from 'react';
import { Signal, SignalLow, SignalZero, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUnifiedSessionManager } from '@/hooks/useUnifiedSessionManager';

type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

interface ConnectionStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
  showButton?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  className = '',
  showLabel = true,
  showButton = true,
}) => {
  const { isConnected, sessionValid, retryAttempts, ping } = useUnifiedSessionManager();
  const [status, setStatus] = React.useState<ConnectionStatus>('online');

  // Atualiza o status com base no UnifiedSessionManager
  React.useEffect(() => {
    if (isConnected && sessionValid) {
      setStatus('online');
    } else if (retryAttempts > 0) {
      setStatus('reconnecting');
    } else {
      setStatus('offline');
    }
  }, [isConnected, sessionValid, retryAttempts]);

  // Exibe toast quando o status muda
  React.useEffect(() => {
    if (status === 'online' && retryAttempts > 0) {
      toast.success('Conexão restaurada', {
        description: 'Sua conexão com o servidor foi restabelecida.',
        duration: 3000,
      });
    } else if (status === 'offline') {
      toast.error('Conexão perdida', {
        description: 'Não foi possível conectar ao servidor.',
        duration: 5000,
        action: {
          label: 'Reconectar',
          onClick: handleReconnect,
        },
      });
    } else if (status === 'reconnecting') {
      toast.loading('Reconectando...', {
        description: `Tentativa ${retryAttempts}/3 de reconexão`,
        id: 'reconnecting-toast',
        duration: 10000,
      });
    }
  }, [status, retryAttempts]);

  const handleReconnect = () => {
    toast.loading('Tentando reconectar...', {
      id: 'reconnect-toast',
      duration: 5000,
    });
    
    ping();
    
    setTimeout(() => {
      toast.dismiss('reconnect-toast');
    }, 3000);
  };

  // Determina ícone, cor e texto com base no status
  const getStatusInfo = () => {
    switch (status) {
      case 'online':
        return {
          icon: <Signal className="h-4 w-4 text-emerald-500" />,
          label: 'Conectado',
          buttonText: 'Testar Conexão',
          buttonIcon: <RefreshCw className="h-3.5 w-3.5 mr-1" />,
          buttonVariant: 'outline' as const,
          className: 'text-emerald-500'
        };
      case 'reconnecting':
        return {
          icon: <SignalLow className="h-4 w-4 text-amber-500 animate-pulse" />,
          label: `Reconectando (${retryAttempts}/3)`,
          buttonText: 'Reconectar agora',
          buttonIcon: <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />,
          buttonVariant: 'outline' as const,
          className: 'text-amber-500'
        };
      case 'offline':
        return {
          icon: <SignalZero className="h-4 w-4 text-rose-500" />,
          label: 'Desconectado',
          buttonText: 'Reconectar',
          buttonIcon: <RefreshCw className="h-3.5 w-3.5 mr-1" />,
          buttonVariant: 'default' as const,
          className: 'text-rose-500'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5">
        {statusInfo.icon}
        {showLabel && (
          <span className={`text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        )}
      </div>
      
      {showButton && (
        <Button 
          variant={statusInfo.buttonVariant} 
          size="xs" 
          onClick={handleReconnect}
          className="h-7 px-2 text-xs rounded-md"
        >
          {statusInfo.buttonIcon}
          {statusInfo.buttonText}
        </Button>
      )}
    </div>
  );
};

export default ConnectionStatusIndicator;
