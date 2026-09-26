// src/pages/FluxoEditor.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlow, useFlowCatalog, flowApi, useFlowInvalidate } from '@/hooks/useFlows';
import { newNode, type NodeType, type SummaryCtx } from '@/lib/flows/catalog';
import { FlowNodeCard, type CardData } from '@/components/flows/FlowNodeCard';
import { NodePalette } from '@/components/flows/NodePalette';
import { NodeInspector } from '@/components/flows/NodeInspector';
import { FlowToolbar } from '@/components/flows/FlowToolbar';

type RawNode = { id: string; type: NodeType; position: { x: number; y: number }; data: Record<string, unknown> };
type RawEdge = { id: string; source: string; sourceHandle?: string | null; target: string };
const nodeTypes = { card: FlowNodeCard };

function Editor() {
  const { id } = useParams();
  const { data, isLoading } = useFlow(id);
  const { data: catalog } = useFlowCatalog();
  const invalidate = useFlowInvalidate();
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  const ctx: SummaryCtx = useMemo(() => ({
    waName: (x) => catalog?.wa_templates.find((t) => String(t.id_template) === x)?.name ?? '',
    emailName: (x) => catalog?.email_templates.find((t) => t.id === x)?.name ?? '',
    stageName: (x) => { const s = catalog?.stages.find((t) => t.id === x); return s ? `${s.pipeline} · ${s.name}` : ''; },
  }), [catalog]);

  const toCard = useCallback((n: RawNode): Node => ({ id: n.id, type: 'card', position: n.position ?? { x: 0, y: 0 },
    data: { type: n.type, data: n.data, stats: data?.stats?.[n.id], ctx, error: errors[n.id] } satisfies CardData }), [data, ctx, errors]);

  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    setName(data.flow.name);
    const g = data.flow.draft_graph as { nodes: RawNode[]; edges: RawEdge[] };
    setNodes(g.nodes.map(toCard));
    setEdges(g.edges.map((e) => ({ ...e, sourceHandle: e.sourceHandle ?? 'out', animated: false })));
  }, [data, toCard, setNodes, setEdges]);

  // mantém rótulos/estatísticas/erros atualizados sem perder posição
  useEffect(() => { setNodes((ns) => ns.map((n) => ({ ...n, data: { ...(n.data as CardData), stats: data?.stats?.[n.id], ctx, error: errors[n.id] } }))); }, [data?.stats, ctx, errors, setNodes]);

  const graph = useCallback(() => ({
    nodes: nodes.map((n) => { const d = n.data as CardData; return { id: n.id, type: d.type, position: n.position, data: d.data }; }),
    edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? 'out', target: e.target })),
  }), [nodes, edges]);

  // autosave do rascunho (1,2 s depois da última mudança)
  useEffect(() => {
    if (!loaded.current || !id) return;
    const t = setTimeout(async () => { setSaving(true); try { await flowApi({ action: 'save_draft', id, name, draft_graph: graph() }); } finally { setSaving(false); } }, 1200);
    return () => clearTimeout(t);
  }, [nodes, edges, name, id, graph]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.sourceHandle ?? 'out'}-${c.target}` },
    es.filter((e) => !(e.source === c.source && (e.sourceHandle ?? 'out') === (c.sourceHandle ?? 'out'))))), [setEdges]);

  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    const t = ev.dataTransfer.getData('application/flow-node') as NodeType;
    if (!t) return;
    const pos = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
    const n = newNode(t, pos);
    setNodes((ns) => [...ns, toCard(n as RawNode)]);
    setSelected(n.id);
  }, [rf, setNodes, toCard]);

  const sel = nodes.find((n) => n.id === selected);
  const updateSel = (d: Record<string, unknown>) => setNodes((ns) => ns.map((n) => (n.id === selected ? { ...n, data: { ...(n.data as CardData), data: d } } : n)));
  const deleteSel = () => { setNodes((ns) => ns.filter((n) => n.id !== selected)); setEdges((es) => es.filter((e) => e.source !== selected && e.target !== selected)); setSelected(null); };

  const showErrors = (errs: { nodeId?: string; message: string }[]) => {
    setErrors(Object.fromEntries(errs.filter((e) => e.nodeId).map((e) => [e.nodeId!, e.message])));
    const general = errs.filter((e) => !e.nodeId).map((e) => e.message);
    if (general.length) toast.error(general.join(' · '));
  };
  const validate = async () => {
    await flowApi({ action: 'save_draft', id, name, draft_graph: graph() });
    const r = await flowApi<{ ok: boolean; errors: { nodeId?: string; message: string }[] }>({ action: 'validate', id });
    showErrors(r.errors); r.ok ? toast.success('Fluxo válido') : toast.error(`${r.errors.length} problema(s) no fluxo`);
  };
  const publish = async () => {
    await flowApi({ action: 'save_draft', id, name, draft_graph: graph() });
    const r = await flowApi<{ ok: boolean; version?: number; errors?: { nodeId?: string; message: string }[] }>({ action: 'publish', id });
    if (!r.ok) { showErrors(r.errors ?? []); toast.error('Corrija os nós marcados antes de publicar'); return; }
    setErrors({}); toast.success(`Versão ${r.version} publicada — quem já está no fluxo segue na versão anterior`); invalidate(id);
  };
  const setStatus = async (status: string) => {
    if (status === 'live' && !window.confirm('Ativar o fluxo? Ele passa a enviar mensagens de verdade (se o motor do funil estiver em "fluxos").')) return;
    try { const r = await flowApi<{ ok: boolean; error?: string }>({ action: 'set_status', id, status }); r.ok ? toast.success('Status atualizado') : toast.error(r.error ?? 'Falha'); invalidate(id); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (isLoading || !data) return <div className="p-6"><div className="h-[70vh] rounded-xl bg-muted/50 animate-pulse" /></div>;
  const version = data.versions[0]?.version ?? null;
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <FlowToolbar name={name} status={data.flow.status} saving={saving} version={version} onRename={setName} onValidate={validate} onPublish={publish} onStatus={setStatus} />
      <div className="flex min-h-0 flex-1">
        <NodePalette />
        <div className="relative min-w-0 flex-1" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)} fitView proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep', style: { strokeDasharray: '6 5', strokeWidth: 1.6, opacity: 0.55 } }}>
            <Background gap={20} size={1} /><Controls /><MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </div>
        {sel && <NodeInspector type={(sel.data as CardData).type} data={(sel.data as CardData).data} onChange={updateSel} onDelete={deleteSel} catalog={catalog} />}
      </div>
      <div className="flex h-8 items-center gap-4 border-t border-border bg-card px-4 text-[11px] uppercase tracking-[0.15em] text-muted-foreground" role="status">
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />{nodes.length} nós</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-foreground/50" />{edges.length} ligações</span>
        <span className="ml-auto normal-case tracking-normal">Arraste da paleta · ligue as bolinhas · salvamento automático</span>
      </div>
    </div>
  );
}

export default function FluxoEditor() { return <ReactFlowProvider><Editor /></ReactFlowProvider>; }
