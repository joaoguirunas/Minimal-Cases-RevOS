import { useState, useEffect, useCallback, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// ── LocalStorage keys ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'bipro-insights-conversations';
const ACTIVE_KEY = 'bipro-insights-active';

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Conversation & { createdAt: string; messages: Array<Message & { createdAt: string }> }>;
    return parsed.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt),
      messages: c.messages.map(m => ({ ...m, createdAt: new Date(m.createdAt) })),
    }));
  } catch { return []; }
}

function saveConversations(convs: Conversation[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)); } catch { /* quota */ }
}

function loadActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* noop */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInsightsConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(loadActiveId);

  // Persist on change
  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => { saveActiveId(activeConvId); }, [activeConvId]);

  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );

  const createConversation = useCallback((): string => {
    const id = crypto.randomUUID();
    const conv: Conversation = { id, title: 'Nova Conversa', messages: [], createdAt: new Date() };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(id);
    return id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    setActiveConvId(prev => (prev === id ? null : prev));
  }, []);

  const appendMessage = useCallback((convId: string, msg: Message) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, msg] } : c
    ));
  }, []);

  const updateTitle = useCallback((convId: string, title: string) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, title } : c
    ));
  }, []);

  return {
    conversations,
    activeConversation,
    activeConvId,
    setActiveConvId,
    createConversation,
    deleteConversation,
    appendMessage,
    updateTitle,
  };
}
