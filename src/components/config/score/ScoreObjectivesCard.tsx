import { ScoreBaseCard } from './ScoreBaseCard';
import {
  useScoreObjectives,
  useCreateScoreObjective,
  useUpdateScoreObjective,
  useDeleteScoreObjective,
  useReorderScoreObjectives,
} from '@/hooks/useScoreObjectives';

export const ScoreObjectivesCard = () => {
  const { data: items = [], isLoading } = useScoreObjectives();
  const { mutate: create, isPending: isCreating } = useCreateScoreObjective();
  const { mutate: update, isPending: isUpdating } = useUpdateScoreObjective();
  const { mutate: remove, isPending: isDeleting } = useDeleteScoreObjective();
  const { mutate: reorder, isPending: isReordering } = useReorderScoreObjectives();

  const isPending = isCreating || isUpdating || isDeleting || isReordering;

  return (
    <ScoreBaseCard
      title="Objetivos"
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
