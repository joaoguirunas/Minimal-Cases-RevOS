// src/components/config/EmailInfraPanel.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmailInfra, type EmailStats } from '@/hooks/useEmailInfra';

const SHARES = [0, 10, 25, 50, 75, 100];
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '—');

function StatsRow({ label, s }: { label: string; s?: EmailStats }) {
  const x = s ?? { sent: 0, delivered: 0, opened: 0, bounced: 0, complained: 0, failed: 0, suppressed: 0 };
  return (
    <tr className="border-b border-border/40 tabular-nums">
      <td className="py-1.5 pr-3">{label}</td>
      <td className="py-1.5 text-right">{x.sent}</td>
      <td className="py-1.5 text-right">{pct(x.delivered, x.sent)}</td>
      <td className="py-1.5 text-right">{pct(x.opened, x.sent)}</td>
      <td className={`py-1.5 text-right ${x.sent >= 50 && x.bounced / x.sent >= 0.04 ? 'text-red-500 font-medium' : ''}`}>{pct(x.bounced, x.sent)}</td>
      <td className={`py-1.5 text-right ${x.sent >= 50 && x.complained / x.sent >= 0.001 ? 'text-red-500 font-medium' : ''}`}>{pct(x.complained, x.sent)}</td>
      <td className="py-1.5 text-right">{x.suppressed}</td>
    </tr>
  );
}

function SuppressionSearch({ onResubscribe }: { onResubscribe: (email: string, reason: string) => Promise<{ ok: boolean }> }) {
  const [q, setQ] = useState('');
  const { data, refetch } = useQuery({
    queryKey: ['email-suppressions', q],
    queryFn: async () => {
      // email_contacts ainda não está nos tipos gerados do Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let r = (supabase.from as any)('email_contacts').select('email, status, status_reason, consent_source, status_changed_at')
        .neq('status', 'subscribed').order('status_changed_at', { ascending: false }).limit(20);
      const t = q.trim().toLowerCase().replace(/[%_\\]/g, '');
      if (t) r = r.ilike('email', `%${t}%`);
      return ((await r).data ?? []) as unknown as { email: string; status: string; status_reason: string | null; consent_source: string | null; status_changed_at: string }[];
    },
  });
  const LABEL: Record<string, string> = { unsubscribed: 'Descadastrado', bounced: 'Bounce', complained: 'Marcou spam' };
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium">Supressão</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar e-mail" className="h-8 w-64 text-[12px]" />
      <div className="overflow-x-auto"><table className="w-full text-[12px]"><tbody>
        {(data ?? []).map((c) => (
          <tr key={c.email} className="border-b border-border/40">
            <td className="py-1.5 pr-2">{c.email}</td><td className="py-1.5 pr-2">{LABEL[c.status] ?? c.status}</td>
            <td className="py-1.5 pr-2 text-muted-foreground">{c.status_reason ?? c.consent_source ?? ''}</td>
            <td className="py-1.5 pr-2 text-muted-foreground tabular-nums">{new Date(c.status_changed_at).toLocaleDateString('pt-BR')}</td>
            <td className="py-1.5 text-right">
              <button className="text-[11px] text-primary hover:underline" onClick={async () => {
                const reason = window.prompt(`Reinscrever ${c.email}? Informe o motivo (ex.: cliente pediu por WhatsApp):`);
                if (!reason?.trim()) return;
                const r = await onResubscribe(c.email, reason); if (r.ok) { toast.success('Reinscrito'); refetch(); } else toast.error('Falha');
              }}>Reinscrever</button>
            </td>
          </tr>))}
        {(data ?? []).length === 0 && <tr><td className="py-3 text-muted-foreground">Nenhum contato suprimido{q ? ' com esse e-mail' : ''}.</td></tr>}
      </tbody></table></div>
    </div>
  );
}

export function EmailInfraPanel() {
  const { data, isLoading, setShare, testSend, resubscribe } = useEmailInfra();
  const [to, setTo] = useState('');
  const [tpl, setTpl] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: templates } = useQuery({
    queryKey: ['email-templates-min'],
    queryFn: async () => ((await supabase.from('email_templates').select('id, name').eq('active', true).order('name')).data ?? []) as { id: string; name: string }[],
  });
  if (isLoading || !data) return <div className="h-40 rounded-xl bg-muted/50 animate-pulse" />;
  const verified = data.domain?.status === 'verified';
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Envio próprio · Resend</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Remetente {'contato@minimalcases.com.br'} · descadastro de um clique · supressão automática</p>
        </div>
        {!data.has_key ? <span className="text-[12px] text-amber-600">Chave do Resend não configurada</span>
          : verified ? <span className="flex items-center gap-1 text-[12px] text-emerald-600"><CheckCircle2 className="size-3.5" />Domínio verificado</span>
          : <span className="flex items-center gap-1 text-[12px] text-amber-600"><Clock className="size-3.5" />Domínio {data.domain ? 'pendente' : 'não cadastrado'}</span>}
      </div>

      {data.guard && data.share_pct === 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-600">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Freio acionado em {new Date(data.guard.tripped_at).toLocaleString('pt-BR')}: {data.guard.reason}. Envio voltou 100% para o Klaviyo.
        </div>)}

      {data.domain && !verified && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium">Registros para adicionar no DNS (Hostinger)</p>
          <div className="overflow-x-auto"><table className="w-full text-[11.5px] font-mono">
            <tbody>{data.domain.records.map((r) => (
              <tr key={`${r.type}-${r.name}`} className="border-b border-border/40">
                <td className="py-1 pr-2">{r.type}</td><td className="py-1 pr-2">{r.name}</td>
                <td className="py-1 pr-2 max-w-[340px] truncate" title={r.value}>{r.value}</td>
                <td className={`py-1 ${r.status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}`}>{r.status}</td>
              </tr>))}</tbody>
          </table></div>
        </div>)}

      <div className="space-y-2">
        <p className="text-[12px] font-medium">Aquecimento — parte da esteira que sai pelo Resend</p>
        <div className="flex flex-wrap gap-1.5">
          {SHARES.map((p) => (
            <button key={p} disabled={busy || (p > 0 && (!data.has_key || !verified))}
              onClick={async () => { setBusy(true); const r = await setShare(p); setBusy(false); r.ok ? toast.success(`Resend em ${p}%`) : toast.error(r.error ?? 'Falha'); }}
              className={`rounded-full border px-3 py-1 text-[12px] tabular-nums disabled:opacity-40 ${data.share_pct === p ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted'}`}>
              {p}%
            </button>))}
        </div>
        <p className="text-[11px] text-muted-foreground">Suba um degrau a cada 2–3 dias se bounce &lt; 4% e spam &lt; 0,1%. O freio volta para 0% sozinho se passar disso.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="py-1.5 text-left font-medium">Últimas 24 h / 7 dias</th><th className="py-1.5 text-right font-medium">Enviados</th>
            <th className="py-1.5 text-right font-medium">Entregues</th><th className="py-1.5 text-right font-medium">Abertos</th>
            <th className="py-1.5 text-right font-medium">Bounce</th><th className="py-1.5 text-right font-medium">Spam</th><th className="py-1.5 text-right font-medium">Suprimidos</th>
          </tr></thead>
          <tbody>
            <StatsRow label="Resend · 24 h" s={data.stats24.resend} /><StatsRow label="Klaviyo · 24 h" s={data.stats24.klaviyo} />
            <StatsRow label="Resend · 7 dias" s={data.stats7d.resend} /><StatsRow label="Klaviyo · 7 dias" s={data.stats7d.klaviyo} />
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="e-mail para teste" className="h-8 w-56 text-[12px]" />
        <Select value={tpl} onValueChange={setTpl}>
          <SelectTrigger className="h-8 w-64 text-[12px]"><SelectValue placeholder="template" /></SelectTrigger>
          <SelectContent>{(templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        <button disabled={busy || !to || !tpl || !data.has_key}
          onClick={async () => { setBusy(true); try { const r = await testSend(to, tpl); r.ok ? toast.success('Teste enviado pelo Resend') : toast.error(r.error ?? r.status); } finally { setBusy(false); } }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] hover:bg-muted disabled:opacity-40">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}Enviar teste
        </button>
      </div>

      <SuppressionSearch onResubscribe={resubscribe} />
    </div>
  );
}
