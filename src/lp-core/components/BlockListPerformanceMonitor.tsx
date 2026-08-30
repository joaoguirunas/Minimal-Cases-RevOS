/**
 * Block List Performance Monitor
 * Phase 3 Task #14: Performance visibility
 *
 * Monitors and displays performance metrics for block lists.
 * Helps identify when virtualization or other optimizations are needed.
 *
 * Shows:
 * - Render time
 * - Memory usage
 * - Block count
 * - Performance warnings
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { measureBlockRenderTime, estimateBlockListMemory } from '@/lp-core/utils/block-optimization';
import type { LpBlock } from '@/hooks/useLpTemplates';

interface BlockListPerformanceMonitorProps {
  blocks: LpBlock[];
  enabled?: boolean; // Can be disabled in production
}

export function BlockListPerformanceMonitor({
  blocks,
  enabled = process.env.NODE_ENV === 'development',
}: BlockListPerformanceMonitorProps) {
  const [renderTime, setRenderTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const startTime = performance.now();
    setIsRendering(true);

    // Measure render time after next paint
    requestAnimationFrame(() => {
      const endTime = performance.now();
      setRenderTime(endTime - startTime);
      setIsRendering(false);
    });
  }, [blocks.length, enabled]);

  if (!enabled) return null;

  const estimatedRender = measureBlockRenderTime(blocks.length);
  const memoryUsage = estimateBlockListMemory(blocks);

  return (
    <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted rounded border border-muted">
      <div className="flex items-center justify-between">
        <span>Blocks: {blocks.length}</span>
        {estimatedRender.warning && (
          <div className="flex items-center gap-1 text-yellow-600">
            <AlertCircle className="w-3 h-3" />
            <span>Consider virtualization</span>
          </div>
        )}
      </div>

      <div className="text-xs space-y-0.5">
        <div>Render: {renderTime.toFixed(1)}ms {isRendering ? '(measuring...)' : ''}</div>
        <div>Est.: {estimatedRender.estimatedMs}ms</div>
        <div>Memory: {memoryUsage.mb.toFixed(1)}MB</div>

        {memoryUsage.warning && (
          <div className="text-red-600">⚠ Large memory footprint</div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to measure block rendering performance
 */
export function useBlockRenderMetrics(blocks: LpBlock[]) {
  const [metrics, setMetrics] = useState({
    startTime: 0,
    endTime: 0,
    duration: 0,
  });

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      setMetrics({
        startTime,
        endTime,
        duration: endTime - startTime,
      });
    };
  }, [blocks.length]);

  return metrics;
}
