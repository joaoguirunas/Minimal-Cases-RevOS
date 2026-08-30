import { AlertTriangle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cardVariants, SECTION_CARD } from "./bipro-shared";
import type { FunnelStageMetrics } from "@/hooks/useBIProFunnel";

interface BottleneckAlertProps {
  bottleneckStageId: string | null;
  bottleneckDropRate: number;
  stages: FunnelStageMetrics[];
}

const DROP_THRESHOLD = 30;

export default function BottleneckAlert({
  bottleneckStageId,
  bottleneckDropRate,
  stages,
}: BottleneckAlertProps) {
  const shouldReduce = useReducedMotion();

  if (!bottleneckStageId || bottleneckDropRate < DROP_THRESHOLD) return null;

  const stage = stages.find(s => s.stageId === bottleneckStageId);
  if (!stage) return null;

  return (
    <motion.div
      className={cn(
        SECTION_CARD,
        "border-red-500 bg-red-500/5 p-4 flex items-start gap-3",
      )}
      variants={shouldReduce ? undefined : cardVariants}
      initial={shouldReduce ? false : "hidden"}
      animate={shouldReduce ? false : "show"}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-[2px] bg-red-500/15 shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4 text-red-500" />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-[13px] font-semibold text-red-600">
          Gargalo detectado em {stage.stageName}: {bottleneckDropRate.toFixed(0)}% de perda
          {stage.lostLeads > 0 && ` (${stage.lostLeads} leads perdidos)`}
        </p>
        <p className="text-[12px] text-muted-foreground">
          Revise o processo de qualificacao e acompanhamento nesta etapa para reduzir a taxa de perda.
        </p>
      </div>
    </motion.div>
  );
}
