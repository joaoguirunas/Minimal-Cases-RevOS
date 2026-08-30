/**
 * Editor History Hook — Undo/Redo with Replay Pattern
 * Manages state snapshots and history traversal
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  label?: string;
}

export interface HistoryState<T> {
  past: HistoryEntry<T>[];
  present: T;
  future: HistoryEntry<T>[];
}

const DEFAULT_MAX_HISTORY = 50;

/**
 * useEditorHistory Hook
 * Provides undo/redo functionality with full state snapshots
 *
 * @param initialState Initial state
 * @param maxHistorySize Max number of undo steps (default 50)
 * @returns History object with state and actions
 */
export function useEditorHistory<T>(
  initialState: T,
  maxHistorySize: number = DEFAULT_MAX_HISTORY
) {
  // Track present state and history
  const [present, setPresent] = useState<T>(initialState);
  const [past, setPast] = useState<HistoryEntry<T>[]>([]);
  const [future, setFuture] = useState<HistoryEntry<T>[]>([]);

  // Debounce timer for rapid changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<T>(initialState);

  /**
   * Push current state to history (with debounce)
   * Debounce prevents saving every keystroke
   */
  const push = useCallback(
    (newState: T, label?: string, debounceMs: number = 300) => {
      // Clear future when making new changes
      setFuture([]);

      // Debounce: don't save if user is still typing
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        // Don't push if state hasn't actually changed
        if (JSON.stringify(present) === JSON.stringify(lastSavedRef.current)) {
          return;
        }

        setPast((p) => [
          ...p.slice(-(maxHistorySize - 1)),
          {
            state: present,
            timestamp: Date.now(),
            label,
          },
        ]);
        setPresent(newState);
        lastSavedRef.current = newState;
      }, debounceMs);
    },
    [present, maxHistorySize]
  );

  /**
   * Undo to previous state
   */
  const undo = useCallback(() => {
    if (past.length === 0) return;

    const newPast = past.slice(0, -1);
    const entry = past[past.length - 1];

    setPast(newPast);
    setFuture((f) => [
      ...f,
      {
        state: present,
        timestamp: Date.now(),
      },
    ]);
    setPresent(entry.state);
    lastSavedRef.current = entry.state;
  }, [past, present]);

  /**
   * Redo to next state
   */
  const redo = useCallback(() => {
    if (future.length === 0) return;

    const newFuture = future.slice(0, -1);
    const entry = future[future.length - 1];

    setFuture(newFuture);
    setPast((p) => [
      ...p,
      {
        state: present,
        timestamp: Date.now(),
      },
    ]);
    setPresent(entry.state);
    lastSavedRef.current = entry.state;
  }, [future, present]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
    lastSavedRef.current = present;
  }, [present]);

  /**
   * Replay from specific point in history
   * Jump to specific undo point
   */
  const replayTo = useCallback(
    (index: number) => {
      if (index < 0 || index > past.length) return;

      const targetPast = past.slice(0, index);
      const targetState = targetPast.length > 0 ? targetPast[index - 1].state : initialState;
      const targetFuture = [
        ...past.slice(index).map((entry) => ({ state: entry.state, timestamp: entry.timestamp })),
        {
          state: present,
          timestamp: Date.now(),
        },
        ...future,
      ];

      setPast(targetPast);
      setPresent(targetState);
      setFuture(targetFuture);
      lastSavedRef.current = targetState;
    },
    [past, future, present, initialState]
  );

  /**
   * Get current state
   */
  const getState = useCallback(() => present, [present]);

  /**
   * Check if can undo/redo
   */
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    state: present,
    push,
    undo,
    redo,
    clear,
    replayTo,
    getState,
    canUndo,
    canRedo,
    historySize: {
      past: past.length,
      future: future.length,
      total: past.length + future.length,
    },
    history: {
      past,
      present,
      future,
    },
  };
}

/**
 * Hook to integrate editor history with state
 * Usage:
 * ```
 * const { state, push, undo, redo, canUndo, canRedo } = useEditorHistory(blocks);
 *
 * // When updating blocks:
 * const handleUpdateBlock = (updated) => {
 *   const newBlocks = blocks.map(b => b.id === updated.id ? updated : b);
 *   push(newBlocks, 'Update block');
 * };
 * ```
 */
