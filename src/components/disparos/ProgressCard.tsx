import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ProgressCardProps {
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  successRate: number;
  delay?: number;
}

export function ProgressCard({ 
  totalContacts, 
  sentCount, 
  failedCount, 
  successRate,
  delay = 0 
}: ProgressCardProps) {
  const pendingCount = totalContacts - sentCount - failedCount;
  const progress = totalContacts > 0 ? ((sentCount + failedCount) / totalContacts) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <h3 className="text-[18px] font-['Outfit'] font-semibold mb-6 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Progresso do Disparo
        </h3>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso Total</span>
              <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="relative overflow-hidden rounded-full h-3 bg-secondary">
              <motion.div
                className="absolute inset-0 bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center justify-center p-4 rounded-[2px] bg-[#00D26A]/10 border border-[#00D26A]/20">
              <CheckCircle2 className="w-5 h-5 text-[#00D26A] mb-2" />
              <span className="text-2xl font-bold text-[#00D26A]">{sentCount}</span>
              <span className="text-xs text-[#00D26A]">Enviados</span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-[2px] bg-[#EF4444]/10 border border-[#EF4444]/20">
              <XCircle className="w-5 h-5 text-[#EF4444] mb-2" />
              <span className="text-2xl font-bold text-[#EF4444]">{failedCount}</span>
              <span className="text-xs text-[#EF4444]">Falhas</span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-[2px] bg-[#3B82F6]/10 border border-[#3B82F6]/20">
              <Clock className="w-5 h-5 text-[#3B82F6] mb-2" />
              <span className="text-2xl font-bold text-[#3B82F6]">{pendingCount}</span>
              <span className="text-xs text-[#3B82F6]">Pendentes</span>
            </div>
          </div>

          {/* Success Rate */}
          <div className="flex items-center justify-between p-4 rounded-[2px] bg-card border border-border">
            <span className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</span>
            <Badge className={`text-base font-bold px-3 py-1 rounded-[2px] ${
              successRate >= 90
                ? 'bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20'
                : successRate >= 70
                ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
            }`}>
              {successRate.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
