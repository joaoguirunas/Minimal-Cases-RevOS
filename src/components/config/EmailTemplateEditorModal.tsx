import {
  Suspense, lazy, useEffect, useMemo, useRef, useState,
} from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  Code2, Loader2, Type, Image as ImageIcon, History, Send, Monitor,
  Smartphone, Eye, RotateCcw, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { FollowupEmailEditor } from '@/components/followups/FollowupEmailEditor';
import { VariablePicker } from '@/components/followups/VariablePicker';
import { AssetPicker } from '@/components/config/AssetPicker';
import {
  EmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from '@/hooks/useEmailTemplates';
import {
  useEmailTemplateVersions,
  type EmailTemplateVersion,
} from '@/hooks/useEmailTemplateVersions';
import { EMAIL_ASSETS_PUBLIC_BASE } from '@/hooks/useEmailAssets';
import { parseYampiCart } from '@/hooks/useEsteiraLead';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// yampi_webhook_events ainda não está nos types gerados (mesmo padrão de useEsteiraLead.ts).
const db = supabase as unknown as SupabaseClient;
import {
  detectVariables, renderPreview, buildPreviewDocument, previewVarsFromLead,
  sampleValueFor, type LeadPreviewInput,
} from '@/lib/emailTemplatePreview';

const HtmlCodeEditor = lazy(() => import('@/components/ui/html-code-editor'));

interface EmailTemplateEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Template being edited, or null to create a new one. */
  template: EmailTemplate | null;
}

const htmlHasContent = (html: string): boolean =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

// ── Busca de lead real (preview com dados de verdade) ─────────────────────────

interface PersonSearchResult {
  id: string;
  name: string;
  email: string | null;
}

// Espelha o MODEL_RE de supabase/functions/_shared/tracked-links.ts (Deno-only,
// não importável no front) — separa "Case ... Azul iPhone 17 Pro Max" em produto + modelo.
const MODEL_RE = /\b((?:iPhone|Galaxy|Samsung|Motorola|Moto|Xiaomi|Redmi|Poco|Pixel)\b[^,/|]*?)\s*$/i;

function splitProductModel(title: string): { produto: string; modelo: string | null } {
  const m = title.match(MODEL_RE);
  if (!m) return { produto: title.trim(), modelo: null };
  const modelo = m[1].trim();
  const produto = title.slice(0, m.index).trim().replace(/[-–—]\s*$/, '').trim();
  return { produto: produto || title.trim(), modelo };
}

const shortSavedBy = (v: string | null): string => {
  if (!v) return '—';
  return v.includes('@') ? v.split('@')[0] : v.split(/\s+/)[0];
};

const formatVersionDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'dd/MM HH:mm', { locale: ptBR }) : '—';
};

interface TestSendResponse {
  success: boolean;
  error?: string;
}

export const EmailTemplateEditorModal = ({
  open, onOpenChange, template,
}: EmailTemplateEditorModalProps) => {
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();
  const versionsQuery = useEmailTemplateVersions(template?.id);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [htmlBody, setHtmlBody] = useState('');
  const [rawMode, setRawMode] = useState(false);

  // ── Preview: dispositivo + dados de exemplo ────────────────────────────────
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewMode, setPreviewMode] = useState<'padrao' | 'lead'>('padrao');
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadResults, setLeadResults] = useState<PersonSearchResult[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PersonSearchResult | null>(null);
  const [leadLoadingCart, setLeadLoadingCart] = useState(false);
  const [leadOverrides, setLeadOverrides] = useState<Record<string, string> | null>(null);

  // ── Imagens ─────────────────────────────────────────────────────────────────
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  // ── Enviar teste ────────────────────────────────────────────────────────────
  const [testPopoverOpen, setTestPopoverOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // ── Histórico de versões ────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<EmailTemplateVersion | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const insertIntoCodeRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setSubject(template?.subject ?? '');
    setCategory(template?.category ?? '');
    setActive(template?.active ?? true);
    setHtmlBody(template?.html_body ?? '');
    setRawMode(false);
    setDevice('desktop');
    setPreviewMode('padrao');
    setSelectedLead(null);
    setLeadOverrides(null);
    setLeadQuery('');
    setLeadResults([]);
    setLeadPopoverOpen(false);
    setViewingVersion(null);
    setHistoryOpen(false);
    setTestEmail(localStorage.getItem('email-test-to') ?? '');
  }, [open, template]);

  // Busca leads (clients_people) por nome ou e-mail — debounced.
  useEffect(() => {
    if (!leadPopoverOpen) return;
    const q = leadQuery.trim();
    if (q.length < 2) { setLeadResults([]); setLeadSearching(false); return; }
    let cancelled = false;
    setLeadSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('clients_people')
        .select('id, name, email')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      if (cancelled) return;
      setLeadResults(error ? [] : ((data ?? []) as PersonSearchResult[]));
      setLeadSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [leadQuery, leadPopoverOpen]);

  const handleLeadPopoverChange = (o: boolean) => {
    setLeadPopoverOpen(o);
    if (!o && previewMode !== 'lead') { setLeadQuery(''); setLeadResults([]); }
  };

  const handleSelectMode = (v: string) => {
    if (v === 'lead') {
      setLeadPopoverOpen(true);
    } else {
      setPreviewMode('padrao');
      setSelectedLead(null);
      setLeadOverrides(null);
      setLeadPopoverOpen(false);
    }
  };

  const handleSelectLead = async (person: PersonSearchResult) => {
    setSelectedLead(person);
    setPreviewMode('lead');
    setLeadPopoverOpen(false);
    setLeadLoadingCart(true);
    try {
      const { data: events, error } = await db
        .from('yampi_webhook_events')
        .select('raw_payload')
        .eq('people_id', person.id)
        .in('trigger', ['carrinho_abandonado', 'checkout_iniciado'])
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;

      let cart: LeadPreviewInput['cart'] = null;
      for (const ev of (events ?? []) as Array<{ raw_payload: unknown }>) {
        const parsed = parseYampiCart((ev.raw_payload ?? {}) as Record<string, unknown>);
        if (parsed.items.length === 0 && !parsed.url) continue;
        const firstTitle = parsed.items[0]?.title ?? null;
        const split = firstTitle ? splitProductModel(firstTitle) : null;
        cart = {
          produto: split?.produto ?? null,
          modelo: split?.modelo ?? null,
          modeloCurto: split?.modelo ? split.modelo.split(/\s+/).slice(0, 2).join(' ') : null,
          imagem: parsed.image,
          total: parsed.total,
          url: parsed.url,
        };
        break;
      }
      setLeadOverrides(previewVarsFromLead({ name: person.name, cart }));
    } catch (err) {
      toast.error('Erro ao buscar carrinho do lead.');
      setLeadOverrides(previewVarsFromLead({ name: person.name, cart: null }));
    } finally {
      setLeadLoadingCart(false);
    }
  };

  const handleAssetSelect = (url: string) => {
    const path = url.startsWith(`${EMAIL_ASSETS_PUBLIC_BASE}/`)
      ? url.slice(EMAIL_ASSETS_PUBLIC_BASE.length + 1)
      : url;
    const tag = `<img src="{{asset_base}}/${path}" width="600" alt="" style="width:100%;max-width:600px;height:auto;">`;
    if (rawMode) {
      if (insertIntoCodeRef.current) insertIntoCodeRef.current(tag);
      else setHtmlBody((h) => h + tag);
    } else {
      toast.info('Disponível no modo Código HTML.');
    }
  };

  const insertIntoSubject = (variable: string) => {
    const el = subjectRef.current;
    if (!el) { setSubject(s => s + variable); return; }
    const start = el.selectionStart ?? subject.length;
    const end = el.selectionEnd ?? subject.length;
    const next = subject.slice(0, start) + variable + subject.slice(end);
    setSubject(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + variable.length;
    }, 0);
  };

  const insertIntoCode = (variable: string) => {
    if (insertIntoCodeRef.current) insertIntoCodeRef.current(variable);
    else setHtmlBody((h) => h + variable);
  };

  const overrides = useMemo(
    () => (previewMode === 'lead' && leadOverrides ? leadOverrides : {}),
    [previewMode, leadOverrides],
  );
  const previewWidth = device === 'mobile' ? 375 : 600;
  const previewSubjectSource = viewingVersion ? viewingVersion.subject : subject;
  const previewBodySource = viewingVersion ? viewingVersion.html_body : htmlBody;

  const subjectPreview = useMemo(
    () => renderPreview(previewSubjectSource, overrides),
    [previewSubjectSource, overrides],
  );
  const bodyPreviewDoc = useMemo(
    () => buildPreviewDocument(renderPreview(previewBodySource, overrides), { width: previewWidth }),
    [previewBodySource, overrides, previewWidth],
  );
  const detectedVars = useMemo(
    () => detectVariables(previewSubjectSource, previewBodySource),
    [previewSubjectSource, previewBodySource],
  );

  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do template.'); return; }
    if (!subject.trim()) { toast.error('Informe o assunto do e-mail.'); return; }
    if (!htmlHasContent(htmlBody)) { toast.error('O corpo do e-mail não pode ficar vazio.'); return; }

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      html_body: htmlBody,
      variables: detectVariables(subject, htmlBody),
      category: category.trim() || null,
      active,
    };

    try {
      if (template) {
        await update.mutateAsync({ id: template.id, ...payload });
        toast.success('Template atualizado.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Template criado.');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao salvar template.');
    }
  };

  const handleSendTest = async () => {
    const email = testEmail.trim();
    if (!email) { toast.error('Informe o e-mail de teste.'); return; }
    setSendingTest(true);
    try {
      const vars = Object.fromEntries(
        detectVariables(subject, htmlBody).map((v) => [v, overrides[v] ?? sampleValueFor(v)]),
      );
      const { data, error } = await supabase.functions.invoke('email-template-test-send', {
        body: { to: email, subject, html: htmlBody, vars },
      });
      if (error) throw error;
      const result = data as TestSendResponse;
      if (!result?.success) { toast.error(result?.error || 'Erro ao enviar teste.'); return; }
      localStorage.setItem('email-test-to', email);
      toast.success(`Teste enviado para ${email}.`);
      setTestPopoverOpen(false);
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao enviar teste.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRestoreVersion = (v: EmailTemplateVersion) => {
    setSubject(v.subject);
    setHtmlBody(v.html_body);
    if (v.name) setName(v.name);
    setViewingVersion(null);
    setHistoryOpen(false);
    toast.success('Versão carregada no editor — salve para aplicar.');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[92vw] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="text-[15px]">
              {template ? 'Editar template de e-mail' : 'Novo template de e-mail'}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Monte o corpo HTML e veja a pré-visualização com variáveis de exemplo ao lado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 flex-1 min-h-0 overflow-hidden">
            {/* ── Editor column ── */}
            <div className="flex flex-col min-h-0 overflow-y-auto px-6 py-4 space-y-4 border-r border-border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Nome</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Compra Aprovada"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Categoria</Label>
                  <Input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="pos-venda"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px]">Assunto</Label>
                  <VariablePicker onInsert={insertIntoSubject} size="xs" />
                </div>
                <Input
                  ref={subjectRef}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Sua compra foi aprovada 🎉"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px]">Corpo do e-mail</Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAssetPickerOpen(true)}
                      className="h-7 gap-1.5 text-[11px]"
                    >
                      <ImageIcon className="w-3 h-3" strokeWidth={1.5} /> Inserir imagem
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRawMode(m => !m)}
                      className="h-7 gap-1.5 text-[11px]"
                    >
                      {rawMode
                        ? <><Type className="w-3 h-3" strokeWidth={1.5} /> Editor</>
                        : <><Code2 className="w-3 h-3" strokeWidth={1.5} /> Código HTML</>}
                    </Button>
                  </div>
                </div>

                {rawMode ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-end">
                      <VariablePicker onInsert={insertIntoCode} size="xs" />
                    </div>
                    <Suspense fallback={
                      <Textarea
                        value={htmlBody}
                        readOnly
                        className="font-mono text-[12px] min-h-[240px] resize-y opacity-60"
                      />
                    }>
                      <HtmlCodeEditor
                        value={htmlBody}
                        onChange={setHtmlBody}
                        minHeight="240px"
                        onInsertRef={(fn) => { insertIntoCodeRef.current = fn; }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <FollowupEmailEditor content={htmlBody} onChange={setHtmlBody} />
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium">Ativo</p>
                  <p className="text-[11px] text-muted-foreground">Templates inativos ficam ocultos nos seletores.</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>

            {/* ── Preview column ── */}
            <div className="flex flex-col min-h-0 overflow-hidden bg-muted/30">
              <div className="px-6 py-3 border-b border-border space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Pré-visualização
                    </p>
                    <p className="text-[13px] font-medium text-foreground mt-1 truncate" title={subjectPreview}>
                      {subjectPreview || <span className="text-muted-foreground/50">Assunto…</span>}
                    </p>
                  </div>
                  {template && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-[11px] shrink-0"
                      onClick={() => setHistoryOpen(true)}
                    >
                      <History className="w-3.5 h-3.5" strokeWidth={1.5} /> Histórico
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={device}
                    onValueChange={(v) => { if (v) setDevice(v as 'desktop' | 'mobile'); }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="desktop" className="h-7 px-2.5 text-[11px] gap-1">
                      <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} /> Desktop
                    </ToggleGroupItem>
                    <ToggleGroupItem value="mobile" className="h-7 px-2.5 text-[11px] gap-1">
                      <Smartphone className="w-3.5 h-3.5" strokeWidth={1.5} /> Mobile
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Select value={previewMode} onValueChange={handleSelectMode}>
                    <Popover open={leadPopoverOpen} onOpenChange={handleLeadPopoverChange}>
                      <PopoverPrimitive.Anchor asChild>
                        <SelectTrigger className="h-7 w-[160px] text-[11px]">
                          <SelectValue>
                            {previewMode === 'lead' && selectedLead ? selectedLead.name : 'Padrão'}
                          </SelectValue>
                        </SelectTrigger>
                      </PopoverPrimitive.Anchor>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Buscar lead
                          </Label>
                          <Input
                            value={leadQuery}
                            onChange={(e) => setLeadQuery(e.target.value)}
                            placeholder="Nome ou e-mail…"
                            className="h-8 text-[12px]"
                            autoFocus
                          />
                          <div className="max-h-56 overflow-y-auto space-y-0.5">
                            {leadSearching ? (
                              <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-3 justify-center">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…
                              </div>
                            ) : leadQuery.trim().length < 2 ? (
                              <p className="text-[11px] text-muted-foreground py-3 text-center">
                                Digite ao menos 2 letras.
                              </p>
                            ) : leadResults.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground py-3 text-center">
                                Nenhum lead encontrado.
                              </p>
                            ) : leadResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectLead(p)}
                                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
                              >
                                <p className="text-[12px] font-medium text-foreground truncate">{p.name}</p>
                                {p.email && (
                                  <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <SelectContent>
                      <SelectItem value="padrao" className="text-[12px]">Padrão</SelectItem>
                      <SelectItem value="lead" className="text-[12px]">Lead real…</SelectItem>
                    </SelectContent>
                  </Select>

                  {leadLoadingCart && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>

                {viewingVersion && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Vendo versão de {formatVersionDate(viewingVersion.created_at)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1"
                      onClick={() => setViewingVersion(null)}
                    >
                      <ArrowLeft className="w-3 h-3" strokeWidth={1.5} /> Voltar
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 flex justify-center bg-muted/30 overflow-auto py-4">
                <iframe
                  title="Pré-visualização do e-mail"
                  sandbox=""
                  srcDoc={bodyPreviewDoc}
                  style={{ width: previewWidth }}
                  className="h-full bg-white border-0 shadow-sm"
                />
              </div>

              <div className="px-6 py-2.5 border-t border-border flex items-center justify-between gap-2">
                {detectedVars.length > 0 ? (
                  <p className="text-[10px] text-muted-foreground/60 truncate">
                    {detectedVars.length} variáve{detectedVars.length === 1 ? 'l' : 'is'}: {detectedVars.join(', ')}
                  </p>
                ) : <span />}

                <Popover open={testPopoverOpen} onOpenChange={setTestPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-[11px] shrink-0">
                      <Send className="w-3.5 h-3.5" strokeWidth={1.5} /> Enviar teste
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="end">
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        E-mail de teste
                      </Label>
                      <Input
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="voce@empresa.com"
                        className="h-8 text-[12px]"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendTest(); } }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="w-full h-8 gap-1.5 text-[12px]"
                        disabled={sendingTest}
                        onClick={handleSendTest}
                      >
                        {sendingTest && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
                        {sendingTest ? 'Enviando...' : 'Enviar'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-w-[120px]">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
              {saving ? 'Salvando...' : 'Salvar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetPicker
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        onSelect={handleAssetSelect}
        prefix=""
      />

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b border-border">
            <SheetTitle className="text-[14px]">Histórico de versões</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {versionsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-6 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
              </div>
            ) : (versionsQuery.data ?? []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground py-6 text-center">
                Ainda não há versões anteriores.
              </p>
            ) : (versionsQuery.data ?? []).map((v) => (
              <div key={v.id} className="rounded-xl border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-foreground">{formatVersionDate(v.created_at)}</p>
                  <p
                    className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]"
                    title={v.saved_by ?? undefined}
                  >
                    {shortSavedBy(v.saved_by)}
                  </p>
                </div>
                <p className="text-[12px] text-muted-foreground truncate" title={v.subject}>{v.subject}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-[11px]"
                    onClick={() => { setViewingVersion(v); setHistoryOpen(false); }}
                  >
                    <Eye className="w-3.5 h-3.5" strokeWidth={1.5} /> Ver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-[11px]"
                    onClick={() => handleRestoreVersion(v)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} /> Restaurar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
