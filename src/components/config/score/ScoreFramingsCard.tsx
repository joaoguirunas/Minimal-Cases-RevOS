import { ScoreBaseCard } from './ScoreBaseCard';
import {
  useScoreFramings,
  useCreateScoreFraming,
  useUpdateScoreFraming,
  useDeleteScoreFraming,
  useReorderScoreFramings,
} from '@/hooks/useScoreFramings';

export const ScoreFramingsCard = () => {
  const { data: items = [], isLoading } = useScoreFramings();
  const { mutate: create, isPending: isCreating } = useCreateScoreFraming();
  const { mutate: update, isPending: isUpdating } = useUpdateScoreFraming();
  const { mutate: remove, isPending: isDeleting } = useDeleteScoreFraming();
  const { mutate: reorder, isPending: isReordering } = useReorderScoreFramings();

  const isPending = isCreating || isUpdating || isDeleting || isReordering;

  return (
    <ScoreBaseCard
      title="Segmentos"
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
