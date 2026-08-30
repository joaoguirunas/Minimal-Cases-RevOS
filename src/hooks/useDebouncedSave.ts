import { useCallback, useEffect, useRef, useState } from 'react';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface UseDebouncedSaveOptions<T> {
  delay?: number;
  onSave: (value: T) => Promise<void> | void;
}

export function useDebouncedSave<T>({ delay = 800, onSave }: UseDebouncedSaveOptions<T>) {
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<T | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (latestRef.current === null) return;
    setState('saving');
    try {
      await onSave(latestRef.current);
      setState('saved');
      setSavedAt(Date.now());
    } catch {
      setState('error');
    }
  }, [onSave]);

  const trigger = useCallback((value: T) => {
    latestRef.current = value;
    setState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, delay);
  }, [delay, flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { state, savedAt, trigger, flush };
}

export function formatSavedAgo(savedAt: number | null, now: number = Date.now()): string {
  if (!savedAt) return '';
  const diff = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (diff < 5) return 'agora mesmo';
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  return `há ${Math.floor(diff / 3600)}h`;
}
