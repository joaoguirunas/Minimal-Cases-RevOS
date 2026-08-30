import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase, CONTROL_PLANE_URL, CONTROL_PLANE_ANON_KEY } from '@/integrations/supabase/client';

const EDGE_FN_URL = `${CONTROL_PLANE_URL}/functions/v1/data-deletion`;
const ANON_KEY = CONTROL_PLANE_ANON_KEY;

export default function DataDeletionPage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ protocol: string; deleted_count: number; status?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_public_settings').then(({ data }) => {
      const rows = data as Array<{ company_name: string | null; logo_url: string | null }> | null;
      if (rows && rows.length > 0 && rows[0].company_name) {
        setCompanyName(rows[0].company_name);
      }
    });
  }, []);

  const canSubmit = email.trim() && fullName.trim() && confirmed && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          reason: reason.trim() || null,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erro ao processar solicitação');

      setResult({ protocol: data.protocol, deleted_count: data.deleted_count, status: data.status });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-2">
            <ShieldCheck className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Solicitação de Exclusão de Dados</h1>
          <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
            Preencha o formulário abaixo para solicitar a exclusão dos seus dados pessoais da nossa plataforma.
          </p>
        </div>

        {result ? (
          /* ── Success state ──────────────────────────────────────── */
          <div className="border border-border rounded-[2px] bg-card p-6 space-y-4 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-foreground">Solicitação registrada</p>
              <p className="text-[12px] text-muted-foreground/60">
                Sua solicitação de exclusão foi registrada e será analisada pela nossa equipe em até 15 dias úteis, conforme a LGPD.
              </p>
            </div>
            <div className="border border-white/[0.06] rounded-[2px] bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest mb-1">Protocolo</p>
              <p className="text-sm font-mono font-semibold text-foreground">{result.protocol}</p>
            </div>
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
              Guarde este número como comprovante. A exclusão será processada conforme a LGPD (Lei Geral de Proteção de Dados — Lei nº 13.709/2018).
            </p>
          </div>
        ) : (
          /* ── Form ───────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="border border-border rounded-[2px] bg-card overflow-hidden">
            <div className="p-5 space-y-4">

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  E-mail <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-[30px] text-[13px] border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  Nome completo <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="h-[30px] text-[13px] border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  Motivo <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Conte-nos o motivo da solicitação..."
                  rows={3}
                  className="text-[13px] resize-none border-border"
                />
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <Checkbox
                  id="confirm"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="confirm" className="text-[12px] text-muted-foreground leading-relaxed cursor-pointer">
                  Confirmo que desejo solicitar a exclusão dos meus dados pessoais. Entendo que minha solicitação será analisada pela equipe em até 15 dias úteis.
                </label>
              </div>

              {error && (
                <div className="rounded-[2px] bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-[12px] text-destructive">{error}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border px-5 py-3 bg-card">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-[30px] text-xs rounded-[4px] gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? 'Processando...' : 'Enviar solicitação de exclusão'}
              </Button>
            </div>
          </form>
        )}

        {/* Legal footer */}
        <div className="text-center space-y-2">
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Seus dados serão excluídos conforme a LGPD
            (Lei Geral de Proteção de Dados — Lei nº 13.709/2018).
          </p>
          <p className="text-[11px] text-muted-foreground/30">
            {companyName ?? 'Growth Sales'} &middot; Plataforma de CRM
          </p>
        </div>
      </div>
    </div>
  );
}
