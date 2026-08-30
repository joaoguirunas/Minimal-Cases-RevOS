import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWhatsappTemplates, WhatsappTemplate } from "@/hooks/useWhatsappTemplates";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, MessageSquare, Search,
  CornerDownLeft, ExternalLink, Phone,
  MessageCircle,
} from "lucide-react";
import StandardPageLoader from "@/components/loading/StandardPageLoader";
import { cn } from "@/lib/utils";

// ── Component extraction (handles both Meta API formats) ─────────────────────

interface RawComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ text: string; type: string; url?: string }>;
  [key: string]: unknown;
}

function extractComponents(template: WhatsappTemplate): RawComponent[] {
  const jd = template.json_data;
  if (!jd) return [];

  // New format: direct `components` array (Meta Cloud API)
  if (Array.isArray((jd as Record<string, unknown>).components)) {
    return (jd as Record<string, unknown>).components as RawComponent[];
  }

  // Old format: Gupshup containerMeta
  const comps: RawComponent[] = [];
  let meta: Record<string, unknown> = {};
  try {
    const cm = (jd as Record<string, unknown>).containerMeta;
    if (cm) meta = JSON.parse(cm as string);
  } catch { /* ignore */ }

  const header = meta.header as string | undefined;
  const body = (meta.data as string) || ((jd as Record<string, unknown>).data as string);
  const footer = meta.footer as string | undefined;
  const buttons = meta.buttons as Array<{ text: string; type: string }> | undefined;

  if (header) comps.push({ type: 'HEADER', format: 'TEXT', text: header });
  if (body)   comps.push({ type: 'BODY', text: body });
  if (footer) comps.push({ type: 'FOOTER', text: footer });
  if (buttons?.length) comps.push({ type: 'BUTTONS', buttons });

  return comps;
}

function getBodyText(t: WhatsappTemplate): string {
  const c = extractComponents(t).find(c => c.type.toUpperCase() === 'BODY');
  return c?.text ?? '';
}

function getHeaderText(t: WhatsappTemplate): string {
  const c = extractComponents(t).find(
    c => c.type.toUpperCase() === 'HEADER' && c.format?.toUpperCase() === 'TEXT',
  );
  return c?.text ?? '';
}

function getButtons(t: WhatsappTemplate) {
  const c = extractComponents(t).find(c => c.type.toUpperCase() === 'BUTTONS');
  return c?.buttons ?? [];
}

function getFooter(t: WhatsappTemplate): string {
  const c = extractComponents(t).find(c => c.type.toUpperCase() === 'FOOTER');
  return c?.text ?? '';
}

// ── Meta labels ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing', UTILITY: 'Utilitário', AUTHENTICATION: 'Autenticação',
};
const LANG_LABELS: Record<string, string> = {
  pt_BR: 'PT-BR', en_US: 'EN', es: 'ES',
};

// ── WhatsApp phone-frame preview ─────────────────────────────────────────────

function WaPreview({ template }: { template: WhatsappTemplate }) {
  const header  = getHeaderText(template);
  const body    = getBodyText(template);
  const footer  = getFooter(template);
  const buttons = getButtons(template);
  const now     = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const hasContent = header || body || buttons.length > 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame */}
      <div
        className="relative rounded-[32px] border-[3px] border-border bg-[#0b141a] overflow-hidden"
        style={{ width: 260, minHeight: 380 }}
      >
        {/* Status bar */}
        <div className="bg-[#0b141a] px-4 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[10px] text-white/60 font-medium">9:41</span>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>

        {/* WA top bar */}
        <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-muted-foreground/40 flex items-center justify-center shrink-0">
            <MessageCircle size={12} className="text-foreground/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white leading-tight truncate">
              {template.nome}
            </p>
            <p className="text-[9px] text-white/40">online</p>
          </div>
        </div>

        {/* Chat background */}
        <div className="px-3 py-4 min-h-[260px]" style={{
          background: '#0b141a',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M50 50h200v200H50z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}>
          {hasContent ? (
            <div className="ml-auto" style={{ maxWidth: 210 }}>
              {/* Message bubble */}
              <div
                className="rounded-[7px] rounded-tr-[2px] relative"
                style={{ backgroundColor: '#005c4b' }}
              >
                {/* Tail */}
                <div className="absolute -right-[7px] top-0">
                  <svg viewBox="0 0 8 13" width="8" height="13">
                    <path fill="#005c4b" d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z"/>
                  </svg>
                </div>

                <div className="px-[9px] pt-[6px] pb-[4px]">
                  {header && (
                    <p className="text-[12.5px] font-semibold text-white leading-[17px] mb-[3px] whitespace-pre-wrap">
                      {header}
                    </p>
                  )}
                  {body && (
                    <p className="text-[12.5px] text-white/90 leading-[17px] whitespace-pre-wrap break-words">
                      {body}
                    </p>
                  )}
                  {footer && (
                    <p className="text-[10px] text-white/45 mt-[3px] leading-[14px]">
                      {footer}
                    </p>
                  )}
                  {/* Time + ticks */}
                  <div className="flex justify-end items-center gap-[3px] mt-[3px]">
                    <span className="text-[9px] text-white/50">{now}</span>
                    <svg width="14" height="10" viewBox="0 0 16 11">
                      <path fill="#53BDEB" d="M11.071.653a.5.5 0 0 0-.707 0L5.5 5.518 2.636 2.653a.5.5 0 1 0-.707.707l3.218 3.218a.5.5 0 0 0 .707 0l5.217-5.218a.5.5 0 0 0 0-.707zm4.243 0a.5.5 0 0 0-.707 0L9.743 5.518 8.925 4.7a.5.5 0 1 0-.707.707l1.525 1.525a.5.5 0 0 0 .707 0l5.217-5.218a.5.5 0 0 0 0-.707z"/>
                    </svg>
                  </div>
                </div>

                {/* Buttons */}
                {buttons.length > 0 && (
                  <div className="border-t border-white/10">
                    {buttons.map((btn, i) => (
                      <div key={i}>
                        {i > 0 && <div className="border-t border-white/10" />}
                        <div className="flex items-center justify-center gap-1.5 py-[8px] px-[9px]">
                          {btn.type === 'URL' ? (
                            <ExternalLink size={11} className="text-[#53BDEB] shrink-0" />
                          ) : btn.type === 'PHONE_NUMBER' ? (
                            <Phone size={11} className="text-[#53BDEB] shrink-0" />
                          ) : (
                            <CornerDownLeft size={11} className="text-[#53BDEB] shrink-0" />
                          )}
                          <span className="text-[11px] font-medium text-[#53BDEB]">{btn.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-[11px] text-white/25">Nenhum conteúdo</p>
            </div>
          )}
        </div>
      </div>

      {/* Meta info below phone */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {template.json_data && (
          <>
            {(() => {
              const cat = (template.json_data as Record<string, unknown>).category as string;
              return cat ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-muted text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ) : null;
            })()}
            {(() => {
              const lang = (template.json_data as Record<string, unknown>).language as string;
              return lang ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-muted text-muted-foreground">
                  {LANG_LABELS[lang] ?? lang}
                </span>
              ) : null;
            })()}
            {buttons.length > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-muted text-muted-foreground">
                {buttons.length} botão{buttons.length !== 1 ? 'ões' : ''}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface WhatsappTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WhatsappTemplate) => void;
}

export const WhatsappTemplateModal = ({
  open,
  onClose,
  onSelectTemplate,
}: WhatsappTemplateModalProps) => {
  const { data: allTemplates = [], isLoading } = useWhatsappTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<'all' | 'retomada'>('all');

  const templates = allTemplates.filter(
    t => t.status?.toLowerCase() === 'approved' && t.system_enabled === true,
  );

  const retomadaCount = templates.filter(t => t.purpose === 'retomada').length;

  const filtered = templates.filter(t => {
    if (purposeFilter === 'retomada' && t.purpose !== 'retomada') return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.nome?.toLowerCase().includes(q) ||
      getBodyText(t).toLowerCase().includes(q) ||
      getHeaderText(t).toLowerCase().includes(q)
    );
  });

  const selected = filtered.find(t => t.id === selectedId) ?? filtered[0] ?? null;

  // Auto-select first on open / filter change
  useEffect(() => {
    if (open && filtered.length > 0) {
      setSelectedId(prev => {
        const stillExists = filtered.find(t => t.id === prev);
        return stillExists ? prev : filtered[0].id;
      });
    }
  }, [open, filtered.length, search]);

  // Reset on close
  useEffect(() => {
    if (!open) { setSelectedId(null); setSearch(''); setPurposeFilter('all'); }
  }, [open]);

  const handleSend = () => {
    if (selected) { onSelectTemplate(selected); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shrink-0">
          <div>
            <p className="text-[14px] font-semibold text-foreground leading-tight">Enviar Template WhatsApp</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Selecione um template aprovado para iniciar a conversa</p>
          </div>
          {/* X nativo do DialogContent (shadcn) já fecha o modal */}
        </div>

        {/* ── Body ── */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <StandardPageLoader message="Carregando templates..." />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
            <MessageSquare size={36} className="opacity-30" />
            <div className="text-center">
              <p className="text-[13px] font-medium">Nenhum template aprovado</p>
              <p className="text-[12px] mt-0.5 opacity-70">Configure templates em Configurações → WhatsApp</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* ── Left: template list ── */}
            <div className="w-[260px] border-r border-border flex flex-col shrink-0 bg-card">
              {/* Search */}
              <div className="px-3 py-2.5 border-b border-border">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-7 h-[30px] text-[12px] bg-background"
                    placeholder="Buscar template…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Purpose filter */}
              {retomadaCount > 0 && (
                <div className="px-3 py-2 border-b border-border flex gap-1.5">
                  {([
                    ['all', 'Todos'],
                    ['retomada', 'Retomada'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPurposeFilter(key)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
                        purposeFilter === key
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30',
                      )}
                    >
                      {label} ({key === 'all' ? templates.length : retomadaCount})
                    </button>
                  ))}
                </div>
              )}

              {/* Count */}
              <div className="px-3 py-1.5 border-b border-border">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {filtered.length} template{filtered.length !== 1 ? 's' : ''}
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-0.5">
                  {filtered.map(t => {
                    const isActive = t.id === selected?.id;
                    const body = getBodyText(t);
                    const header = getHeaderText(t);
                    const snippet = header || body;
                    const btnCount = getButtons(t).length;
                    const cat = (t.json_data as Record<string, unknown>)?.category as string;

                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          'w-full text-left rounded-[4px] px-2.5 py-2 transition-colors',
                          isActive
                            ? 'bg-foreground text-background'
                            : 'hover:bg-accent/50 text-foreground',
                        )}
                      >
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <p className={cn(
                            'text-[12px] font-medium leading-tight truncate flex-1',
                            isActive ? 'text-background' : 'text-foreground',
                          )}>
                            {t.nome}
                          </p>
                          {cat && (
                            <span className={cn(
                              'text-[9px] font-semibold px-1 py-0.5 rounded-[2px] shrink-0 uppercase tracking-wide',
                              isActive
                                ? 'bg-background/20 text-background/70'
                                : 'bg-muted text-muted-foreground',
                            )}>
                              {CATEGORY_LABELS[cat]?.slice(0, 3) ?? cat.slice(0, 3)}
                            </span>
                          )}
                        </div>
                        {snippet && (
                          <p className={cn(
                            'text-[11px] line-clamp-2 leading-[14px]',
                            isActive ? 'text-background/65' : 'text-muted-foreground',
                          )}>
                            {snippet}
                          </p>
                        )}
                        {btnCount > 0 && (
                          <p className={cn(
                            'text-[10px] mt-0.5',
                            isActive ? 'text-background/50' : 'text-muted-foreground/60',
                          )}>
                            {btnCount} botão{btnCount !== 1 ? 'ões' : ''}
                          </p>
                        )}
                      </button>
                    );
                  })}

                  {filtered.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[12px] text-muted-foreground">Nenhum resultado</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* ── Right: preview ── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              {selected ? (
                <>
                  {/* Template name header */}
                  <div className="px-6 py-3 border-b border-border bg-card shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <p className="text-[13px] font-semibold text-foreground">{selected.nome}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">
                      Template aprovado • {
                        (() => {
                          const lang = (selected.json_data as Record<string, unknown>)?.language as string;
                          return LANG_LABELS[lang] ?? lang ?? '—';
                        })()
                      }
                    </p>
                  </div>

                  {/* Scrollable preview area */}
                  <ScrollArea className="flex-1">
                    <div className="flex items-start justify-center px-6 py-8">
                      <WaPreview template={selected} />
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-[13px]">
                  Selecione um template
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-card shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {selected ? `Template: ${selected.nome}` : 'Nenhum template selecionado'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-[30px] text-[12px]">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!selected}
              className="h-[30px] text-[12px] gap-1.5"
            >
              <Send size={12} />
              Enviar Template
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
