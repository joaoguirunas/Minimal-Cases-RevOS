import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PerformanceCardProps {
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  intervalSeconds?: number;
  delay?: number;
}

export function PerformanceCard({ 
  createdAt, 
  startedAt, 
  completedAt,
  intervalSeconds = 60,
  delay = 0 
}: PerformanceCardProps) {
  const calculateDuration = () => {
    if (!startedAt) return null;
    const end = completedAt ? new Date(completedAt) : new Date();
    const start = new Date(startedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}min`;
    }
    return `${diffMins}min`;
  };

  const duration = calculateDuration();
  const sendingRate = intervalSeconds > 0 ? (60 / intervalSeconds).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <h3 className="text-[18px] font-['Outfit'] font-semibold mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Performance e Timeline
        </h3>

        <div className="space-y-6">
          {/* Velocity Metric */}
          <div className="flex items-center justify-between p-4 rounded-[2px] bg-[#B8924B]/5 border border-[#B8924B]/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[4px] bg-[#B8924B]/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Velocidade de Envio</p>
                <p className="text-xl font-bold text-foreground">{sendingRate} envios/min</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Timeline de Eventos</h4>
            
            <div className="relative space-y-4 pl-6">
              {/* Vertical Line */}
              <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-border" />

              {/* Created Event */}
              <div className="relative flex items-start gap-3">
                <div className="absolute -left-5 w-3 h-3 rounded-full bg-blue-500 border-2 border-background" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">Criado</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Started Event */}
              {startedAt && (
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">Iniciado</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Completed Event */}
              {completedAt && (
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-5 w-3 h-3 rounded-full bg-purple-500 border-2 border-background" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">Concluído</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Duration */}
          {duration && (
            <div className="flex items-center justify-between p-3 rounded-[2px] bg-card border border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Duração Total</span>
              </div>
              <span className="font-semibold text-foreground">{duration}</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
