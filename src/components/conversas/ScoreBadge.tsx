interface ScoreBadgeProps {
  score?: number;
}

const ScoreBadge = ({ score }: ScoreBadgeProps) => {
  if (!score) return null;

  const getColor = (s: number) => {
    if (s >= 8) return 'text-green-600 dark:text-green-400';
    if (s >= 6) return 'text-yellow-600 dark:text-yellow-400';
    if (s >= 4) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-500 dark:text-red-400';
  };

  return (
    <span className={`text-[11px] font-medium tabular-nums ${getColor(score)}`}>
      {score}/10
    </span>
  );
};

export default ScoreBadge;
