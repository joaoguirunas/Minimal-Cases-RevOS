import { ScoreBaseCard } from './ScoreBaseCard';
import {
  useScoreInvestments,
  useCreateScoreInvestment,
  useUpdateScoreInvestment,
  useDeleteScoreInvestment,
  useReorderScoreInvestments,
} from '@/hooks/useScoreInvestments';

export const ScoreInvestmentsCard = () => {
  const { data: items = [], isLoading } = useScoreInvestments();
  const { mutate: create, isPending: isCreating } = useCreateScoreInvestment();
  const { mutate: update, isPending: isUpdating } = useUpdateScoreInvestment();
  const { mutate: remove, isPending: isDeleting } = useDeleteScoreInvestment();
  const { mutate: reorder, isPending: isReordering } = useReorderScoreInvestments();

  const isPending = isCreating || isUpdating || isDeleting || isReordering;

  return (
    <ScoreBaseCard
      title="Faixas de Investimento"
      items={items}
      isLoading={isLoading}
      onCreate={create}
      onUpdate={update}
      onDelete={remove}
      onReorder={reorder}
      isPending={isPending}
    />
  );
};
