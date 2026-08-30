import { useRef, useState, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
}

interface UsePullToRefreshReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 60,
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef(0);
  const isTracking = useRef(false);
  const currentPullDistance = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      touchStartY.current = e.touches[0].clientY;
      isTracking.current = true;
      currentPullDistance.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking.current) return;
      if (el.scrollTop > 0) {
        isTracking.current = false;
        currentPullDistance.current = 0;
        setPullDistance(0);
        return;
      }

      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 0) {
        if (deltaY > 10) e.preventDefault();
        const clamped = Math.min(deltaY, threshold * 1.5);
        currentPullDistance.current = clamped;
        setPullDistance(clamped);
      }
    };

    const handleTouchEnd = async () => {
      if (!isTracking.current) return;
      isTracking.current = false;

      const dist = currentPullDistance.current;
      currentPullDistance.current = 0;
      setPullDistance(0);

      if (dist >= threshold) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold]);

  return {
    containerRef,
    isPulling: pullDistance >= threshold,
    isRefreshing,
    pullDistance,
  };
};
