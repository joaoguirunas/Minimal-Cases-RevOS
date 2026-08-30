import type { ScoreMatrix } from './useScoreMatrix';

export interface ScoreMatrixLabels {
  [categoryName: string]: string[];
}

/**
 * Resolves display labels for a ScoreMatrix from its pre-resolved categories.
 * ScoreMatrix.resolved_categories is populated by useScoreMatrix queryFn.
 * Returns empty object if matrix is null/undefined or has no resolved categories.
 */
export function useScoreMatrixLabels(matrix: ScoreMatrix | null | undefined): ScoreMatrixLabels {
  if (!matrix?.resolved_categories) return {};
  return Object.fromEntries(
    matrix.resolved_categories.map(c => [c.categoryName, c.itemNames])
  );
}
