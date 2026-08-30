import { useRef, useMemo } from 'react';

export const useMessageStabilizer = <T extends { id: number | string; media_metadata?: unknown }>(messages: T[]): T[] => {
  const prevRef = useRef<T[]>([]);

  return useMemo(() => {
    const prevIds = prevRef.current.map(m => m.id);
    const newIds = messages.map(m => m.id);
    const sameIds = JSON.stringify(newIds) === JSON.stringify(prevIds);

    if (sameIds) {
      // Same IDs — check if any media_metadata changed (e.g. liked toggle)
      const metaChanged = messages.some((msg, i) => {
        const prev = prevRef.current[i];
        return prev && JSON.stringify(msg.media_metadata) !== JSON.stringify(prev.media_metadata);
      });
      if (!metaChanged) return prevRef.current;
    }

    prevRef.current = messages;
    return messages;
  }, [messages]);
};
