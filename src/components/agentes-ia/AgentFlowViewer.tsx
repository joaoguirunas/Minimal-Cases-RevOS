import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bell, Cpu, MessageSquare, User, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentConversation, type ConversationMessage } from '@/hooks/useAgentConversation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolCallDetail {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

interface LeadMessageNodeData extends Record<string, unknown> {
  content: string;
  timestamp: string;
}

interface ExecutionNodeData extends Record<string, unknown> {
  agentName: string | null;
  executionStatus: string;
  durationMs: number | null;
  tools: ToolCallDetail[];
  errorMessage: string | null;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  timestamp: string;
  isCurrentExec: boolean;
  onClick: () => void;
}

interface AIResponseNodeData extends Record<string, unknown> {
  content: string;
  timestamp: string;
}

interface FollowupNodeData extends Record<string, unknown> {
  status: string;
  sourceType: string;
  message: string | null;
  followupId: string | null;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const fmtDuration = (ms: number | null) => {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

// ── LeadMessageNode ───────────────────────────────────────────────────────────

const LeadMessageNode = ({ data }: NodeProps) => {
  const d = data as LeadMessageNodeData;
  const preview = d.content?.slice(0, 200) ?? '';

  return (
    <div className="w-[360px] rounded-lg overflow-hidden shadow-lg border border-slate-600/50 bg-slate-800/80">
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !border-slate-500" />
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 border-b border-slate-600/40">
        <User className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <span className="text-xs font-semibold text-slate-200">Mensagem do Lead</span>
        <span className="text-[10px] text-slate-400/70 ml-auto shrink-0">{fmtTime(d.timestamp)}</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
          {preview}
          {(d.content?.length ?? 0) > 200 && '…'}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !border-slate-500" />
    </div>
  );
};

// ── ExecutionNode ─────────────────────────────────────────────────────────────

const ExecutionNode = ({ data }: NodeProps) => {
  const d = data as ExecutionNodeData;
  const isError = d.executionStatus === 'error' || !!d.errorMessage;
  const isHighlighted = d.isCurrentExec;

  const borderClass = isHighlighted
    ? 'border-indigo-400 ring-2 ring-indigo-400/30'
    : isError
    ? 'border-red-700/40'
    : 'border-indigo-700/40';

  return (
    <div
      className={cn(
        'w-[360px] rounded-lg overflow-hidden shadow-lg border bg-indigo-950/60 cursor-pointer transition-all duration-150 hover:border-indigo-500/60',
        borderClass
      )}
      onClick={d.onClick as () => void}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-700 !border-indigo-600" />
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 border-b',
        isError ? 'bg-red-900/30 border-red-700/30' : 'bg-indigo-900/40 border-indigo-700/30'
      )}>
        <Cpu className={cn('h-3.5 w-3.5 shrink-0', isError ? 'text-red-400' : 'text-indigo-400')} />
        <span className="text-xs font-semibold text-indigo-200 truncate flex-1">
          {d.agentName ?? 'Execução IA'}
        </span>
        <span className="text-[10px] text-indigo-400/70 ml-auto shrink-0">{fmtTime(d.timestamp)}</span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {d.durationMs != null && <span>{fmtDuration(d.durationMs)}</span>}
          {d.usage && <span>{d.usage.total_tokens} tok</span>}
        </div>
        {d.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {d.tools.slice(0, 5).map((t, i) => (
              <span
                key={i}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/40 text-indigo-300"
              >
                {t.name}
              </span>
            ))}
            {d.tools.length > 5 && (
              <span className="text-[9px] text-indigo-400/60">+{d.tools.length - 5}</span>
            )}
          </div>
        )}
        {d.errorMessage && (
          <p className="text-[10px] text-red-400 font-mono line-clamp-2">{d.errorMessage}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-700 !border-indigo-600" />
    </div>
  );
};

// ── AIResponseNode ────────────────────────────────────────────────────────────

const AIResponseNode = ({ data }: NodeProps) => {
  const d = data as AIResponseNodeData;
  const preview = d.content?.slice(0, 200);

  return (
    <div className="w-[360px] rounded-lg overflow-hidden shadow-lg border border-teal-700/30 bg-teal-950/50">
      <Handle type="target" position={Position.Top} className="!bg-teal-700 !border-teal-600" />
      <div className="flex items-center gap-2 px-3 py-2 bg-teal-900/30 border-b border-teal-700/20">
        <MessageSquare className="h-3.5 w-3.5 text-teal-400 shrink-0" />
        <span className="text-xs font-semibold text-teal-200">Resposta da IA</span>
        <span className="text-[10px] text-teal-400/70 ml-auto shrink-0">{fmtTime(d.timestamp)}</span>
      </div>
      <div className="px-3 py-2.5">
        {d.content ? (
          <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {preview}
            {(d.content?.length ?? 0) > 200 && '…'}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 italic">(resposta silenciosa)</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-700 !border-teal-600" />
    </div>
  );
};

// ── FollowupNode ──────────────────────────────────────────────────────────────

const FollowupNode = ({ data }: NodeProps) => {
  const d = data as FollowupNodeData;

  const statusColor = d.status === 'sent'
    ? 'bg-green-500/10 text-green-400 border-green-500/30'
    : d.status === 'error'
    ? 'bg-red-500/10 text-red-400 border-red-500/30'
    : 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  return (
    <div className="w-[360px] rounded-lg overflow-hidden shadow-lg border border-amber-700/30 bg-amber-950/40">
      <Handle type="target" position={Position.Top} className="!bg-amber-700 !border-amber-600" />
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 border-b border-amber-700/20">
        <Bell className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-200">Followup</span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-semibold ml-1', statusColor)}>
          {d.status}
        </span>
        <span className="text-[10px] text-amber-400/70 ml-auto shrink-0">{fmtTime(d.timestamp)}</span>
      </div>
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-semibold">{d.sourceType}</p>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          {d.message
            ? d.message.slice(0, 160) + (d.message.length > 160 ? '…' : '')
            : d.followupId
            ? `trigger: ${d.followupId}`
            : '(sem mensagem)'}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-700 !border-amber-600" />
    </div>
  );
};

// ── Node types registry ───────────────────────────────────────────────────────

const NODE_TYPES = {
  lead_message: LeadMessageNode,
  ai_response: AIResponseNode,
  execution: ExecutionNode,
  followup: FollowupNode,
};

// ── Height estimation ─────────────────────────────────────────────────────────

const estimateHeight = (item: ConversationMessage): number => {
  switch (item.type) {
    case 'lead_message': return 100;
    case 'ai_response': return 100;
    case 'execution': return 130 + Math.min(item.tool_call_details?.length ?? 0, 5) * 24;
    case 'followup': return 90;
  }
};

// ── AgentFlowViewer ───────────────────────────────────────────────────────────

interface AgentFlowViewerProps {
  peopleId: string | null;
  highlightExecId?: string | null;
}

export const AgentFlowViewer = ({ peopleId, highlightExecId }: AgentFlowViewerProps) => {
  const [selectedExecItem, setSelectedExecItem] = useState<ConversationMessage | null>(null);

  const { items, isLoading } = useAgentConversation(peopleId);

  const handleSelectExec = useCallback((item: ConversationMessage) => {
    setSelectedExecItem(prev => (prev?.id === item.id ? null : item));
  }, []);

  const { nodes, edges } = useMemo(() => {
    const X = 120;
    const GAP = 24;
    const builtNodes: Node[] = [];
    const builtEdges: Edge[] = [];

    let y = 0;

    items.forEach((item, i) => {
      const nodeId = `${item.type}-${item.id}`;

      const edgeDefaults = {
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      } as const;

      const edgeColor = (a: ConversationMessage, b: ConversationMessage): string => {
        if (a.type === 'lead_message' && b.type === 'execution') return '#4f46e5';
        if (a.type === 'execution' && b.type === 'ai_response') return '#0d9488';
        if (a.type === 'ai_response' && b.type === 'followup') return '#d97706';
        return '#334155';
      };

      if (item.type === 'lead_message') {
        builtNodes.push({
          id: nodeId,
          type: 'lead_message',
          position: { x: X, y },
          data: {
            content: item.content ?? '',
            timestamp: item.created_at,
          } satisfies LeadMessageNodeData,
          draggable: false,
          selectable: false,
        });
      } else if (item.type === 'execution') {
        builtNodes.push({
          id: nodeId,
          type: 'execution',
          position: { x: X, y },
          data: {
            agentName: item.agent_name ?? null,
            executionStatus: item.execution_status ?? '',
            durationMs: item.execution_duration_ms ?? null,
            tools: item.tool_call_details ?? [],
            errorMessage: item.error_message ?? null,
            usage: item.usage,
            timestamp: item.created_at,
            isCurrentExec: item.id === highlightExecId,
            onClick: () => handleSelectExec(item),
          } satisfies ExecutionNodeData,
          draggable: false,
          selectable: false,
        });
      } else if (item.type === 'ai_response') {
        builtNodes.push({
          id: nodeId,
          type: 'ai_response',
          position: { x: X, y },
          data: {
            content: item.content ?? '',
            timestamp: item.created_at,
          } satisfies AIResponseNodeData,
          draggable: false,
          selectable: false,
        });
      } else if (item.type === 'followup') {
        builtNodes.push({
          id: nodeId,
          type: 'followup',
          position: { x: X, y },
          data: {
            status: item.followup_status ?? '',
            sourceType: item.followup_source_type ?? '',
            message: item.followup_message ?? null,
            followupId: item.followup_id ?? null,
            timestamp: item.created_at,
          } satisfies FollowupNodeData,
          draggable: false,
          selectable: false,
        });
      }

      if (i > 0) {
        const prevItem = items[i - 1];
        const prevNodeId = `${prevItem.type}-${prevItem.id}`;
        const color = edgeColor(prevItem, item);
        builtEdges.push({
          ...edgeDefaults,
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          style: { stroke: color },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        });
      }

      y += estimateHeight(item) + GAP;
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [items, highlightExecId, handleSelectExec]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0f1a]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/40 text-xs bg-[#0a0f1a]">
        Nenhuma conversa encontrada para este contato.
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#0a0f1a]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnScroll={true}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
      >
        <Background color="#1e293b" gap={20} />
        <Controls
          showInteractive={false}
          className="[&>button]:bg-card [&>button]:border-white/10 [&>button]:text-muted-foreground"
        />
      </ReactFlow>

      {/* Execution detail panel */}
      {selectedExecItem && selectedExecItem.type === 'execution' && (
        <div className="absolute top-0 right-0 h-full w-80 bg-[#0f172a] border-l border-white/10 flex flex-col z-10 shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {selectedExecItem.agent_name ?? 'Execução IA'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                {selectedExecItem.execution_duration_ms != null && (
                  <span>{fmtDuration(selectedExecItem.execution_duration_ms)}</span>
                )}
                {selectedExecItem.usage && (
                  <span>{selectedExecItem.usage.total_tokens} tokens</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedExecItem(null)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedExecItem.error_message && (
              <div className="rounded border border-red-500/20 bg-red-500/5 px-3 py-2">
                <p className="text-[10px] text-slate-400/60 uppercase tracking-wider font-semibold mb-1">Erro</p>
                <pre className="text-[10px] font-mono text-red-400 whitespace-pre-wrap break-all">
                  {selectedExecItem.error_message}
                </pre>
              </div>
            )}

            {(selectedExecItem.tool_call_details?.length ?? 0) > 0 ? (
              selectedExecItem.tool_call_details!.map((tool, i) => {
                const isToolError = tool.result?.startsWith('Error:') || tool.result?.startsWith('Tool execution error:');
                const isSkipped = tool.result?.startsWith('Skipped:');
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded border overflow-hidden',
                      isToolError
                        ? 'border-red-500/30 bg-red-500/5'
                        : isSkipped
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
                      <span className="text-[11px] font-mono font-bold text-foreground flex-1 truncate">
                        {tool.name}
                      </span>
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0',
                        isToolError
                          ? 'bg-red-500/10 text-red-400'
                          : isSkipped
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-green-500/10 text-green-400'
                      )}>
                        {isToolError ? 'erro' : isSkipped ? 'pulado' : 'ok'}
                      </span>
                    </div>
                    {tool.args && Object.keys(tool.args).length > 0 && (
                      <div className="px-3 py-2 border-b border-white/[0.04]">
                        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Args</p>
                        <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="px-3 py-2">
                      <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">Resultado</p>
                      <pre className={cn(
                        'text-[10px] font-mono whitespace-pre-wrap break-all',
                        isToolError ? 'text-red-400' : isSkipped ? 'text-amber-400' : 'text-slate-300'
                      )}>
                        {tool.result || '(vazio)'}
                      </pre>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] text-muted-foreground/40 text-center py-6">
                Nenhuma tool call registrada.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
