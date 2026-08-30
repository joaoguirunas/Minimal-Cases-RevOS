import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle,
  Check,
  BotMessageSquare,
  AlignLeft,
  BookOpen,
  RotateCcw,
  X,
  ClipboardList,
  Globe,
  MousePointerClick,
  UserCheck,
  Loader2,
} from "lucide-react";
import type { LpFormField, LpFormSettings, LpFormWidget } from "@/hooks/useLpForms";
import { supabase } from "@/integrations/supabase/client";
import { getFormStyle, getAccentBarStyle, getButtonBg, FieldLabel, renderTestInput, evalFieldVisible } from "./formBuilderUtils";
import { cn } from "@/lib/utils";

// ─── BrowserChrome (local, used only by WidgetSimulation) ──────────────────────

function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted border-b border-border shrink-0">
      <div className="w-2 h-2 rounded-full bg-red-400" />
      <div className="w-2 h-2 rounded-full bg-yellow-400" />
      <div className="w-2 h-2 rounded-full bg-green-400" />
      <div className="flex-1 mx-2 h-4 bg-background border border-border rounded-[3px] flex items-center px-2 gap-1">
        <Globe className="w-2.5 h-2.5 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground">seusite.com/landing</span>
      </div>
    </div>
  );
}

// ─── Chatbot Widget Test (inline in right panel) ──────────────────────────────

export function ChatbotWidgetTest({
  fields,
  settings,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
}) {
  const visible = fields.filter((f) => f.type !== "hidden");
  const botName = settings.bot_name ?? "Assistente";
  const botColor = settings.bot_color ?? "#4f46e5";

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Array<{ role: "bot" | "user"; text: string }>>([]);
  const [typing, setTyping] = useState(false);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [inputVal, setInputVal] = useState("");
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  function startConvo() {
    setMsgs([]);
    setFieldIdx(0);
    setDone(false);
    setInputVal("");
    if (visible.length > 0) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const f = visible[0];
        const text = f.question || f.label || "Sua resposta";
        setMsgs([{ role: "bot", text: f.required ? text + " *" : text }]);
      }, 700);
    } else {
      setMsgs([{ role: "bot", text: "Nenhum campo configurado ainda." }]);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (msgs.length === 0) startConvo();
  }

  function handleSubmit() {
    const curField = visible[fieldIdx];
    if (curField?.required && !inputVal.trim()) return;
    const userText = inputVal.trim() || "(em branco)";
    const next = fieldIdx + 1;
    setMsgs((m) => [...m, { role: "user", text: userText }]);
    setInputVal("");
    if (next >= visible.length) {
      setDone(true);
      setFieldIdx(next);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMsgs((m) => [
          ...m,
          { role: "bot", text: settings.success_message || "Obrigado! Entraremos em contato em breve." },
        ]);
      }, 800);
    } else {
      setTyping(true);
      setFieldIdx(next);
      setTimeout(() => {
        setTyping(false);
        const f = visible[next];
        const text = f.question || f.label || "Próxima pergunta";
        setMsgs((m) => [...m, { role: "bot", text: f.required ? text + " *" : text }]);
      }, 600);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function resetChat() {
    setOpen(false);
    setMsgs([]);
    setFieldIdx(0);
    setDone(false);
    setInputVal("");
    setTyping(false);
  }

  const currentField = !done && visible.length > 0 ? visible[Math.min(fieldIdx, visible.length - 1)] : null;

  return (
    <div className="flex-1 relative overflow-hidden bg-muted" style={{ minHeight: 400 }}>
      {/* Page mockup background */}
      <div className="absolute inset-0 p-6 pointer-events-none select-none">
        <div className="space-y-2 opacity-15">
          <div className="h-4 bg-foreground rounded w-1/2" />
          <div className="h-2 bg-muted-foreground rounded w-full mt-3" />
          <div className="h-2 bg-muted-foreground rounded w-5/6" />
          <div className="h-2 bg-muted-foreground rounded w-4/5" />
          <div className="h-24 bg-muted border border-border rounded-[4px] mt-6" />
          <div className="h-2 bg-muted-foreground rounded w-3/4 mt-3" />
          <div className="h-2 bg-muted-foreground rounded w-full" />
        </div>
      </div>

      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          style={{ background: botColor }}
          className="absolute bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-bold z-10 hover:opacity-90 active:scale-95 transition-all"
        >
          <BotMessageSquare className="w-4 h-4" />
          {botName}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="absolute inset-0 flex flex-col bg-card">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: botColor }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <BotMessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{botName}</p>
              <p className="text-white/60 text-[10px]">Online agora</p>
            </div>
            <button
              onClick={resetChat}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {msgs.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "bot" && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: botColor }}
                  >
                    <BotMessageSquare className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[78%] px-3 py-2 rounded-[2px] text-sm leading-snug",
                    msg.role === "bot"
                      ? "bg-muted text-foreground rounded-tl-sm"
                      : "text-white rounded-tr-sm"
                  )}
                  style={msg.role === "user" ? { background: botColor } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: botColor }}>
                  <BotMessageSquare className="w-3 h-3 text-white" />
                </div>
                <div className="bg-muted px-3 py-2.5 rounded-[2px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          {!done && currentField && (
            <div className="p-3 border-t border-border shrink-0 space-y-2">
              {renderTestInput(currentField, inputVal, setInputVal)}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  onKeyDown={handleKeyDown}
                  disabled={!!currentField.required && !inputVal.trim()}
                  style={{ background: botColor }}
                  className={cn(
                    "flex-1 py-2 rounded-[4px] text-white text-sm font-semibold transition-opacity",
                    currentField.required && !inputVal.trim() ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"
                  )}
                >
                  {fieldIdx >= visible.length - 1 ? "Enviar ✓" : "Próximo →"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Pressione Enter para avançar</p>
            </div>
          )}

          {done && (
            <div className="p-3 border-t border-border shrink-0">
              <button
                onClick={resetChat}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-[4px] transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Testar novamente
              </button>
            </div>
          )}

          {visible.length === 0 && !typing && msgs.length > 0 && (
            <div className="p-3 border-t border-border shrink-0 text-center">
              <p className="text-xs text-muted-foreground">Adicione campos para testar o chatbot.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Simulation utilities ─────────────────────────────────────────────────────

/** crm_field value → clients_people DB column */
const SIM_CRM_COL: Record<string, string> = {
  'pessoa.email':     'email',
  'pessoa.whatsapp':  'whatsapp',
  'pessoa.instagram': 'instagram_handle',
  'pessoa.telefone':  'telefone',
  'pessoa.documento': 'document',
};

/** field.type → clients_people DB column (fallback when crm_field not set) */
const SIM_TYPE_COL: Record<string, string> = {
  'email': 'email',
  'phone': 'whatsapp',
};

function simNormalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return '55' + (digits.startsWith('0') ? digits.slice(1) : digits);
}

type SimCheckResult = {
  found: boolean;
  person: { name: string; email?: string | null; whatsapp?: string | null } | null;
  matchedLabel?: string;
  existingLead?: boolean;
};

async function checkPersonExists(
  fields: LpFormField[],
  values: Record<string, string>,
): Promise<SimCheckResult> {
  const checks: Array<{ col: string; val: string; label: string }> = [];

  for (const field of fields) {
    const raw = values[field.id]?.trim();
    if (!raw) continue;
    const col = field.crm_field ? SIM_CRM_COL[field.crm_field] : SIM_TYPE_COL[field.type];
    if (!col) continue;
    const val = col === 'whatsapp' ? simNormalizePhone(raw) : raw;
    if (!val) continue;
    checks.push({ col, val, label: field.label || col });
  }

  if (checks.length === 0) return { found: false, person: null };

  const orFilter = checks.map((c) => `${c.col}.eq.${c.val}`).join(',');
  const { data } = await supabase
    .from('clients_people')
    .select('id, name, email, whatsapp')
    .or(orFilter)
    .maybeSingle();

  if (!data) return { found: false, person: null };

  const matched = checks.find((c) => {
    const d = data as Record<string, unknown>;
    return d[c.col] === c.val;
  });

  return { found: true, person: data as SimCheckResult['person'], matchedLabel: matched?.label };
}

/** Call lp-submit edge function with simulation values (creates real CRM data) */
async function simInvokeSubmit(formId: string, values: Record<string, string>): Promise<{ existing?: boolean }> {
  const payload: Record<string, string> = { _form_id: formId };
  for (const [id, val] of Object.entries(values)) {
    payload[id] = val;
  }
  const { data } = await supabase.functions.invoke('lp-submit', { body: payload });
  return (data as { existing?: boolean }) ?? {};
}

/** Shared success screen used by Classic and Steps simulations */
function SimulationSuccessView({
  result,
  settings,
  onReset,
}: {
  result: SimCheckResult | null;
  settings: LpFormSettings;
  onReset: () => void;
}) {
  const existingLead = result?.existingLead;
  const existingPerson = result?.found && !existingLead;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      <div className={cn(
        "w-14 h-14 rounded-full flex items-center justify-center ring-4",
        existingLead
          ? "bg-orange-100 dark:bg-orange-900/30 ring-orange-200/50 dark:ring-orange-900/20"
          : existingPerson
          ? "bg-blue-100 dark:bg-blue-900/30 ring-blue-200/50 dark:ring-blue-900/20"
          : "bg-green-100 dark:bg-green-900/30 ring-green-200/50 dark:ring-green-900/20"
      )}>
        {existingLead
          ? <UserCheck className="w-7 h-7 text-orange-500" />
          : existingPerson
          ? <UserCheck className="w-7 h-7 text-blue-500" />
          : <CheckCircle className="w-7 h-7 text-green-500" />}
      </div>
      <div className="space-y-1.5">
        {existingLead ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-semibold">
              <UserCheck className="w-3 h-3" /> Atendimento em andamento
            </div>
            <p className="font-bold text-foreground">{result?.person?.name}</p>
            <p className="text-sm text-muted-foreground mt-1">Seu atendimento já foi iniciado. Nossa equipe está acompanhando o seu caso.</p>
          </>
        ) : existingPerson ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <UserCheck className="w-3 h-3" /> Cadastro já existente
            </div>
            <p className="font-bold text-foreground">{result?.person?.name}</p>
            {result?.matchedLabel && (
              <p className="text-[11px] text-muted-foreground">Identificado via: {result?.matchedLabel}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{settings.success_message || "Obrigado!"}</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold">
              <CheckCircle className="w-3 h-3" /> Novo cadastro
            </div>
            <p className="font-bold text-foreground">{settings.success_message || "Obrigado! Entraremos em contato em breve."}</p>
          </>
        )}
        {settings.redirect_url && (
          <p className="text-[11px] text-muted-foreground mt-1">Redirecionando para {settings.redirect_url}</p>
        )}
      </div>
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[4px] border border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCcw className="w-3 h-3" /> Simular novamente
      </button>
    </div>
  );
}

// ─── Chatbot inline simulation (no FAB — embedded) ────────────────────────────

function ChatbotInlineSimulation({ fields, settings, formId }: { fields: LpFormField[]; settings: LpFormSettings; formId?: string }) {
  const botColor = settings.bot_color ?? "#4f46e5";
  const botName  = settings.bot_name  ?? "Assistente";
  const visible  = fields.filter((f) => f.type !== "hidden");
  const fs = getFormStyle(settings);

  const [msgs, setMsgs]         = useState<{ role: "bot" | "user"; text: string }[]>([]);
  const [typing, setTyping]     = useState(false);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [inputVal, setInputVal] = useState("");
  const [done, setDone]         = useState(false);
  const [values, setValues]     = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  useEffect(() => {
    if (visible.length === 0) { setMsgs([{ role: "bot", text: "Adicione campos ao formulário." }]); return; }
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      const f = visible[0];
      const text = f.question || f.label || "Sua resposta";
      setMsgs([{ role: "bot", text: f.required ? `${text} *` : text }]);
    }, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function sendValue(val: string) {
    const curField = visible[fieldIdx];
    if (curField?.required && !val.trim()) return;
    const userText = val.trim() || "(em branco)";
    const nextIdx = fieldIdx + 1;
    const newValues = { ...values, [curField.id]: val.trim() };
    setValues(newValues);
    setMsgs((m) => [...m, { role: "user", text: userText }]);
    setInputVal("");
    if (nextIdx >= visible.length) {
      setFieldIdx(nextIdx);
      setTyping(true);
      setTyping(false);
      setDone(true);
      const base = `✅ ${settings.success_message || "Obrigado! Entraremos em contato em breve. 🙌"}`;
      setMsgs((m) => [...m, { role: "bot", text: base }]);
    } else {
      setFieldIdx(nextIdx); setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const f = visible[nextIdx];
        const text = f.question || f.label || "Próxima pergunta";
        setMsgs((m) => [...m, { role: "bot", text: f.required ? `${text} *` : text }]);
      }, 600);
    }
  }

  function handleSend() { sendValue(inputVal); }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function reset() {
    setMsgs([]); setFieldIdx(0); setDone(false); setInputVal(""); setTyping(false); setValues({});
    if (visible.length > 0) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const f = visible[0];
        const text = f.question || f.label || "Sua resposta";
        setMsgs([{ role: "bot", text: f.required ? `${text} *` : text }]);
      }, 600);
    }
  }

  const currentField = !done && visible.length > 0 ? visible[Math.min(fieldIdx, visible.length - 1)] : null;

  const totalFields = visible.length;
  const answeredCount = Math.min(fieldIdx, totalFields);
  const chatProgress = totalFields > 0 ? Math.round((answeredCount / totalFields) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: botColor }}>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <BotMessageSquare className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{botName}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-300" />
            <p className="text-white/70 text-[10px]">Online agora</p>
          </div>
        </div>
        {/* Progress in header */}
        {totalFields > 0 && (
          <div className="flex flex-col items-end shrink-0">
            <span className="text-white/90 text-[10px] font-bold">{chatProgress}%</span>
            <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
              <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${chatProgress}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {msgs.map((msg, i) => (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "bot" && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: botColor }}>
                <BotMessageSquare className="w-3 h-3 text-white" />
              </div>
            )}
            <div
              className={cn("max-w-[80%] px-3 py-2 rounded-[2px] text-sm leading-snug", msg.role === "bot" ? "bg-muted text-foreground" : "text-white")}
              style={msg.role === "user" ? { background: botColor } : {}}
            >{msg.text}</div>
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: botColor }}>
              <BotMessageSquare className="w-3 h-3 text-white" />
            </div>
            <div className="bg-muted px-3 py-2.5 rounded-[2px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {!done && currentField && (
        <div className="px-3 pb-3 pt-2 border-t border-border shrink-0 space-y-2">
          {/* Quick reply chips for select / radio */}
          {(currentField.type === "select" || currentField.type === "radio") && (currentField.options ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(currentField.options ?? []).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => sendValue(opt.value)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background text-foreground hover:text-white transition-all"
                  style={{ ["--hover-bg" as string]: botColor }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = botColor; (e.currentTarget as HTMLElement).style.borderColor = botColor; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.borderColor = ""; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            renderTestInput(currentField, inputVal, setInputVal, fs.inputRadius)
          )}
          <button onClick={handleSend} onKeyDown={handleKeyDown}
            disabled={!!currentField.required && !inputVal.trim() && (currentField.type !== "select" && currentField.type !== "radio")}
            style={{ backgroundColor: fs.buttonBg || botColor, color: fs.buttonTextColor, borderRadius: fs.buttonRadius }}
            className={cn("w-full py-2 text-sm font-semibold transition-opacity",
              (!!currentField.required && !inputVal.trim() && currentField.type !== "select" && currentField.type !== "radio")
                ? "opacity-40 cursor-not-allowed" : "hover:opacity-90")}
          >
            {fieldIdx >= visible.length - 1 ? "Enviar ✓" : "Próximo →"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            {currentField.type === "textarea" ? "Shift+Enter para quebra de linha, Enter para avançar" : "Enter para avançar"}
          </p>
        </div>
      )}
      {done && (
        <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
          <button onClick={reset} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-[4px] transition-colors">
            <RotateCcw className="w-3 h-3" /> Simular novamente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Floating panel simulation (FAB → opens form panel) ───────────────────────

function FloatingPanelSimulation({ fields, settings, formId }: { fields: LpFormField[]; settings: LpFormSettings; formId?: string }) {
  const widget: LpFormWidget = settings.widget ?? {
    enabled: true, position: "bottom-right", button_color: "#4f46e5",
    button_icon: "📋", button_shape: "round", button_size: "md", button_shadow: true, destination: "form",
  };
  const formMode = settings.mode ?? "classic";
  const isRight = widget.position !== "bottom-left";
  const btnSize = { sm: 48, md: 56, lg: 64 }[widget.button_size ?? "md"];
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fake page background */}
      <div className="absolute inset-0 p-4 space-y-2 pointer-events-none select-none opacity-[0.13]">
        <div className="h-4 bg-foreground rounded w-1/2" />
        <div className="h-2 bg-muted-foreground rounded w-full mt-3" />
        <div className="h-2 bg-muted-foreground rounded w-5/6" />
        <div className="h-2 bg-muted-foreground rounded w-4/5" />
        <div className="h-20 bg-muted border border-border rounded mt-4" />
        <div className="h-2 bg-muted-foreground rounded w-3/4 mt-3" />
        <div className="h-2 bg-muted-foreground rounded w-full" />
      </div>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: widget.button_color,
            boxShadow: widget.button_shadow !== false ? "0 4px 20px rgba(0,0,0,.3)" : "none",
            width: widget.button_shape !== "pill" ? btnSize : undefined,
            height: widget.button_shape !== "pill" ? btnSize : undefined,
          }}
          className={cn(
            "absolute bottom-5 z-10 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 text-white",
            isRight ? "right-5" : "left-5",
            widget.button_shape === "pill" ? "px-4 py-2.5 rounded-full gap-2 text-sm font-bold" : "rounded-full"
          )}
        >
          <span style={{ fontSize: widget.button_shape === "pill" ? 16 : { sm: 20, md: 24, lg: 28 }[widget.button_size ?? "md"] }}>
            {widget.button_icon ?? "📋"}
          </span>
          {widget.button_shape === "pill" && <span>{widget.button_label ?? "Fale conosco"}</span>}
        </button>
      )}
      {/* Form panel */}
      {open && (
        <div className="absolute bottom-0 right-0 w-full h-full flex flex-col bg-card animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-border bg-muted">
            <p className="flex-1 text-sm font-semibold text-foreground">Formulário</p>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {formMode === "steps"
              ? <StepsInlineSimulation fields={fields} settings={settings} formId={formId} />
              : <ClassicInlineSimulation fields={fields} settings={settings} formId={formId} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen (modal) simulation ────────────────────────────────────────────

function FullscreenSimulation({ fields, settings, formId }: { fields: LpFormField[]; settings: LpFormSettings; formId?: string }) {
  const formMode = settings.mode ?? "classic";
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Dimmed page background */}
      <div className="absolute inset-0 p-4 space-y-2 pointer-events-none select-none opacity-[0.08]">
        <div className="h-4 bg-foreground rounded w-1/2" />
        <div className="h-2 bg-muted-foreground rounded w-full mt-3" />
        <div className="h-2 bg-muted-foreground rounded w-5/6" />
        <div className="h-20 bg-muted border border-border rounded mt-4" />
        <div className="h-2 bg-muted-foreground rounded w-3/4 mt-3" />
      </div>
      <div className="absolute inset-0 bg-black/40" />
      {!dismissed ? (
        <div className="absolute inset-2 bg-card rounded-[2px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-end px-3 py-2 border-b border-border shrink-0">
            <button onClick={() => setDismissed(true)} className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {formMode === "chatbot"
              ? <ChatbotInlineSimulation fields={fields} settings={settings} formId={formId} />
              : formMode === "steps"
              ? <StepsInlineSimulation fields={fields} settings={settings} formId={formId} />
              : <ClassicInlineSimulation fields={fields} settings={settings} formId={formId} />}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <button onClick={() => setDismissed(false)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-[4px] bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> Abrir modal novamente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Widget simulation (adaptive by mode + display style) ─────────────────────

export function WidgetSimulation({
  fields,
  settings,
  onModeChange,
  formId,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
  onModeChange: (mode: "classic" | "steps" | "chatbot") => void;
  formId?: string;
}) {
  const formMode = settings.mode ?? "classic";
  const displayStyle = settings.display_style ?? "static";

  const modes = [
    { key: "classic" as const, icon: <AlignLeft className="w-3 h-3" />, label: "Padrão" },
    { key: "steps"   as const, icon: <BookOpen className="w-3 h-3" />,  label: "Etapas" },
    { key: "chatbot" as const, icon: <BotMessageSquare className="w-3 h-3" />, label: "Chatbot" },
  ];

  function renderContent() {
    if (displayStyle === "floating") {
      return formMode === "chatbot"
        ? <ChatbotSimulation fields={fields} settings={settings} formId={formId} />
        : <FloatingPanelSimulation fields={fields} settings={settings} formId={formId} />;
    }
    if (displayStyle === "fullscreen") {
      return <FullscreenSimulation fields={fields} settings={settings} formId={formId} />;
    }
    // static
    if (formMode === "chatbot") return <ChatbotInlineSimulation fields={fields} settings={settings} formId={formId} />;
    if (formMode === "steps")   return <StepsInlineSimulation fields={fields} settings={settings} formId={formId} />;
    return <ClassicInlineSimulation fields={fields} settings={settings} formId={formId} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with live mode switcher */}
      <div className="px-3 py-2 border-b border-border bg-muted shrink-0 flex items-center gap-2">
        <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground shrink-0">Simular</span>
        <div className="flex-1" />
        <div className="flex items-center bg-muted rounded-[4px] p-0.5 gap-0.5">
          {modes.map(({ key, icon: mIcon, label: mLabel }) => (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-semibold transition-all",
                formMode === key ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mIcon}
              {mLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Browser chrome + simulation */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <BrowserChrome />
        <div className="flex-1 relative overflow-hidden bg-background">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// ─── Classic inline simulation ────────────────────────────────────────────────

function ClassicInlineSimulation({
  fields,
  settings,
  formId,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
  formId?: string;
}) {
  const fs = getFormStyle(settings);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [simResult, setSimResult] = useState<SimCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Visible fields: exclude hidden + apply conditional logic based on current values
  const visible = fields.filter((f) => f.type !== "hidden" && evalFieldVisible(f, values));

  function validate() {
    const errs: Record<string, string> = {};
    visible.forEach((f) => {
      if (f.required && !values[f.id]?.trim()) errs[f.id] = "Campo obrigatório";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (formId) await simInvokeSubmit(formId, values).catch(() => {});
      setSimResult({ found: false, person: null, existingLead: false });
    } catch {
      setSimResult({ found: false, person: null });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setValues({});
    setErrors({});
    setSimResult(null);
  }

  if (simResult !== null) {
    return <SimulationSuccessView result={simResult} settings={settings} onReset={reset} />;
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center opacity-50">
        <ClipboardList className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Adicione campos para simular.</p>
      </div>
    );
  }

  const inputExtraStyle: React.CSSProperties = {
    backgroundColor: fs.inputBgColor || fs.inputBg || undefined,
    borderColor: fs.inputBorderColor || fs.inputBorder || undefined,
    borderWidth: fs.inputBorderColor ? fs.inputBorderWidth : undefined,
    color: fs.inputTextColor || fs.bodyColor || undefined,
    padding: `${fs.inputSize.py} ${fs.inputSize.px}`,
    fontSize: fs.inputSize.fs,
  };

  return (
    <div
      className="overflow-y-auto h-full p-4"
      style={{ background: fs.glass ? 'linear-gradient(135deg,#667eea,#764ba2)' : undefined }}
    >
      {/* Fake page context above form */}
      <div className="space-y-1.5 mb-4 opacity-20 pointer-events-none select-none">
        <div className="h-3 bg-foreground rounded w-2/3" />
        <div className="h-2 bg-muted-foreground rounded w-full" />
        <div className="h-2 bg-muted-foreground rounded w-4/5" />
      </div>

      {/* The embedded form */}
      <div
        className="border border-border rounded-[2px] p-4 space-y-3 overflow-hidden"
        style={{
          backgroundColor: fs.glass ? 'rgba(255,255,255,0.12)' : (fs.bg || undefined),
          backdropFilter: fs.glass ? 'blur(12px)' : undefined,
          boxShadow: fs.noShadow ? 'none' : '0 2px 12px rgba(0,0,0,.08)',
        }}
      >
        {/* Accent bar — top */}
        {(() => { const abs = getAccentBarStyle(fs); return abs && fs.accentPosition !== 'bottom' ? <div style={{ ...abs, margin: '-16px -16px 8px' }} /> : null; })()}

        {/* Badge */}
        {fs.badgeEnabled && (
          <div className="flex justify-end -mt-1 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-[2px] border border-border bg-card">
              <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: fs.badgeColor }} />
              {fs.badgeText}
            </span>
          </div>
        )}

        {/* Title / Subtitle */}
        {fs.title && (
          <div style={{ textAlign: fs.titleAlign, marginBottom: '0.25rem' }}>
            <p style={{ fontFamily: fs.titleFont, fontSize: fs.titleSize, color: fs.titleColor, fontWeight: fs.titleWeight, lineHeight: 1.2 }}>
              {fs.title}
            </p>
            {fs.subtitle && (
              <p style={{ color: fs.subtitleColor, fontSize: fs.subtitleSize, marginTop: '0.25rem', lineHeight: 1.4 }}>
                {fs.subtitle}
              </p>
            )}
          </div>
        )}

        {visible.map((field) => (
          <div key={field.id} className="space-y-1">
            <label
              className="text-xs font-semibold"
              style={{
                color: fs.labelColor || undefined,
                textTransform: fs.labelUppercase ? 'uppercase' : undefined,
                letterSpacing: fs.labelUppercase ? '0.05em' : undefined,
                fontSize: fs.labelUppercase ? '11px' : undefined,
              }}
            >
              <FieldLabel field={field} required={field.required} color={fs.labelColor || undefined} />
            </label>
            {renderTestInput(field, values[field.id] ?? "", (v) => {
              setValues((p) => ({ ...p, [field.id]: v }));
              if (errors[field.id]) setErrors((e) => { const n = { ...e }; delete n[field.id]; return n; });
            }, fs.inputRadius, inputExtraStyle)}
            {errors[field.id] && (
              <p className="text-[10px] text-red-500">{errors[field.id]}</p>
            )}
          </div>
        ))}
        <button
          onClick={() => { void handleSubmit(); }}
          disabled={submitting}
          style={{
            background: getButtonBg(fs),
            color: fs.buttonTextColor,
            borderRadius: fs.buttonRadius,
            width: fs.buttonFullWidth ? '100%' : 'auto',
            paddingTop: fs.buttonSize.py,
            paddingBottom: fs.buttonSize.py,
            paddingLeft: '1rem',
            paddingRight: '1rem',
            fontSize: fs.buttonSize.fs,
          }}
          className="font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting
            ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            : (settings.submit_text || "Enviar")}
        </button>

        {/* Accent bar — bottom */}
        {(() => { const abs = getAccentBarStyle(fs); return abs && fs.accentPosition === 'bottom' ? <div style={{ ...abs, margin: '8px -16px -16px' }} /> : null; })()}
      </div>

      {/* Fake page context below form */}
      <div className="space-y-1.5 mt-4 opacity-20 pointer-events-none select-none">
        <div className="h-2 bg-muted-foreground rounded w-3/4" />
        <div className="h-2 bg-muted-foreground rounded w-full" />
      </div>
    </div>
  );
}

// ─── Steps inline simulation ──────────────────────────────────────────────────

function StepsInlineSimulation({
  fields,
  settings,
  formId,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
  formId?: string;
}) {
  const steps = settings.steps ?? [];
  const fs = getFormStyle(settings);
  const color = fs.buttonBg || '#4f46e5';
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [simResult, setSimResult] = useState<SimCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Visible fields: exclude hidden + apply conditional logic based on current values
  const visible = fields.filter((f) => f.type !== "hidden" && evalFieldVisible(f, values));

  // If no steps configured, fall back to classic inline
  if (steps.length === 0) {
    return <ClassicInlineSimulation fields={fields} settings={settings} formId={formId} />;
  }

  const currentStep = steps[stepIdx];
  const stepFields = currentStep ? visible.filter((f) => f.step_id === currentStep.id) : [];
  // Show filled progress for current step: 1/N → 100%
  const progress = Math.round(((stepIdx + 1) / steps.length) * 100);

  function validateStep() {
    const errs: Record<string, string> = {};
    stepFields.forEach((f) => {
      if (f.required && !values[f.id]?.trim()) errs[f.id] = "Campo obrigatório";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function next() {
    if (!validateStep()) return;
    setErrors({});
    if (stepIdx < steps.length - 1) {
      setStepIdx((s) => s + 1);
    } else {
      setSubmitting(true);
      try {
        if (formId) await simInvokeSubmit(formId, values).catch(() => {});
        setSimResult({ found: false, person: null, existingLead: false });
      } catch {
        setSimResult({ found: false, person: null });
      } finally {
        setSubmitting(false);
      }
    }
  }

  function back() {
    setErrors({});
    setStepIdx((s) => s - 1);
  }

  function reset() {
    setStepIdx(0);
    setValues({});
    setErrors({});
    setSimResult(null);
  }

  if (simResult !== null) {
    return <SimulationSuccessView result={simResult} settings={settings} onReset={reset} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Progress bar */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Passo {stepIdx + 1} de {steps.length}
          </span>
          <span className="text-[10px] font-semibold" style={{ color }}>{progress}%</span>
        </div>
        <div className="h-1.5 bg-muted mx-4 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: color }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-3">
        {/* Fake page content above */}
        <div className="space-y-1.5 mb-4 opacity-20 pointer-events-none select-none">
          <div className="h-3 bg-foreground rounded w-2/3" />
          <div className="h-2 bg-muted-foreground rounded w-full" />
        </div>

        {/* Step card */}
        <div
          className="border border-border rounded-[2px] overflow-hidden"
          style={{
            backgroundColor: fs.glass ? undefined : (fs.bg || undefined),
            background: fs.glass ? (fs.bg || 'rgba(255,255,255,0.12)') : undefined,
            backdropFilter: fs.glass ? 'blur(12px)' : undefined,
            boxShadow: fs.noShadow ? 'none' : '0 2px 12px rgba(0,0,0,.08)',
          }}
        >
          {/* Accent bar — top */}
          {(() => { const abs = getAccentBarStyle(fs); return abs && fs.accentPosition !== 'bottom' ? <div style={abs} /> : null; })()}

          <div className="px-4 pt-4 pb-2">
            {/* Badge — step 1 only */}
            {stepIdx === 0 && fs.badgeEnabled && (
              <div className="flex justify-end mb-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-[2px] border border-border bg-card">
                  <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: fs.badgeColor }} />
                  {fs.badgeText}
                </span>
              </div>
            )}

            {/* Title / Subtitle — step 1 only */}
            {stepIdx === 0 && fs.title && (
              <div style={{ textAlign: fs.titleAlign, marginBottom: '0.75rem' }}>
                <p style={{ fontFamily: fs.titleFont, fontSize: fs.titleSize, color: fs.titleColor, fontWeight: fs.titleWeight, lineHeight: 1.2 }}>
                  {fs.title}
                </p>
                {fs.subtitle && (
                  <p style={{ color: fs.subtitleColor, fontSize: fs.subtitleSize, marginTop: '0.25rem', lineHeight: 1.4 }}>
                    {fs.subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Step dot indicators */}
            <div className="flex items-center gap-2 mb-3">
              {steps.map((step, i) => {
                const isCompleted = i < stepIdx;
                const isCurrent = i === stepIdx;
                return (
                  <React.Fragment key={i}>
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all duration-300",
                        isCompleted ? "text-white" : isCurrent ? "text-white" : "text-muted-foreground bg-muted"
                      )}
                      style={isCompleted || isCurrent ? { background: color } : {}}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="flex-1 h-0.5 rounded-full transition-all duration-500"
                        style={{ background: isCompleted ? color : "var(--muted)" }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {currentStep?.title && (
              <p className="text-sm font-semibold" style={{ color: fs.titleColor || undefined }}>{currentStep.title}</p>
            )}
          </div>

          {/* Fields */}
          {(() => {
            const stepInputExtraStyle: React.CSSProperties = {
              backgroundColor: fs.inputBgColor || fs.inputBg || undefined,
              borderColor: fs.inputBorderColor || fs.inputBorder || undefined,
              borderWidth: fs.inputBorderColor ? fs.inputBorderWidth : undefined,
              color: fs.inputTextColor || fs.bodyColor || undefined,
              padding: `${fs.inputSize.py} ${fs.inputSize.px}`,
              fontSize: fs.inputSize.fs,
            };
            return (
              <div className="px-4 pb-4 space-y-3">
                {stepFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">Nenhum campo neste passo.</p>
                ) : (
                  stepFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-semibold" style={{ color: fs.labelColor || undefined, textTransform: fs.labelUppercase ? 'uppercase' : undefined }}>
                        <FieldLabel field={field} required={field.required} color={fs.labelColor || undefined} />
                      </label>
                      {renderTestInput(field, values[field.id] ?? "", (v) => {
                        setValues((p) => ({ ...p, [field.id]: v }));
                        if (errors[field.id]) setErrors((e) => { const n = { ...e }; delete n[field.id]; return n; });
                      }, fs.inputRadius, stepInputExtraStyle)}
                      {errors[field.id] && (
                        <p className="text-[10px] text-red-500">{errors[field.id]}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })()}

          {/* Navigation */}
          <div className="flex items-center gap-2 px-4 pb-4">
            {stepIdx > 0 && (
              <button onClick={back}
                className="px-4 py-2 rounded-[4px] text-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
                style={{ borderRadius: fs.buttonRadius }}
              >
                ← Voltar
              </button>
            )}
            <button
              onClick={() => { void next(); }}
              disabled={submitting}
              style={{
                background: getButtonBg(fs),
                color: fs.buttonTextColor,
                borderRadius: fs.buttonRadius,
                paddingTop: fs.buttonSize.py,
                paddingBottom: fs.buttonSize.py,
                fontSize: fs.buttonSize.fs,
              }}
              className="flex-1 font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                : (stepIdx < steps.length - 1 ? "Próximo →" : settings.submit_text || "Enviar")}
            </button>
          </div>

          {/* Accent bar — bottom */}
          {(() => { const abs = getAccentBarStyle(fs); return abs && fs.accentPosition === 'bottom' ? <div style={abs} /> : null; })()}
        </div>
      </div>
    </div>
  );
}

// ─── Chatbot simulation (FAB icon + chat window) ──────────────────────────────

function ChatbotSimulation({
  fields,
  settings,
  formId,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
  formId?: string;
}) {
  const botColor = settings.bot_color ?? "#4f46e5";
  const botName  = settings.bot_name  ?? "Assistente";
  const visible  = fields.filter((f) => f.type !== "hidden");
  const fs = getFormStyle(settings);

  const [open, setOpen]         = useState(false);
  const [msgs, setMsgs]         = useState<{ role: "bot" | "user"; text: string }[]>([]);
  const [typing, setTyping]     = useState(false);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [inputVal, setInputVal] = useState("");
  const [done, setDone]         = useState(false);
  const [values, setValues]     = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  function startConvo() {
    setMsgs([]);
    setFieldIdx(0);
    setDone(false);
    setInputVal("");
    setValues({});
    if (visible.length === 0) {
      setMsgs([{ role: "bot", text: "Adicione campos ao formulário para iniciar a conversa." }]);
      return;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const f = visible[0];
      const text = f.question || f.label || "Sua resposta";
      setMsgs([{ role: "bot", text: f.required ? `${text} *` : text }]);
    }, 600);
  }

  function handleOpen() {
    setOpen(true);
    if (msgs.length === 0) startConvo();
  }

  function handleSend() {
    const curField = visible[fieldIdx];
    if (curField?.required && !inputVal.trim()) return;
    const userText = inputVal.trim() || "(em branco)";
    const nextIdx = fieldIdx + 1;
    const newValues = { ...values, [curField.id]: inputVal.trim() };
    setValues(newValues);
    setMsgs((m) => [...m, { role: "user", text: userText }]);
    setInputVal("");

    if (nextIdx >= visible.length) {
      setFieldIdx(nextIdx);
      setTyping(true);
      setTyping(false);
      setDone(true);
      const base = `✅ ${settings.success_message || "Obrigado! Entraremos em contato em breve. 🙌"}`;
      setMsgs((m) => [...m, { role: "bot", text: base }]);
    } else {
      setFieldIdx(nextIdx);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const f = visible[nextIdx];
        const text = f.question || f.label || "Próxima pergunta";
        setMsgs((m) => [...m, { role: "bot", text: f.required ? `${text} *` : text }]);
      }, 600);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function closeAndReset() {
    setOpen(false);
    setMsgs([]);
    setFieldIdx(0);
    setDone(false);
    setInputVal("");
    setTyping(false);
    setValues({});
  }

  const currentField = !done && visible.length > 0 ? visible[Math.min(fieldIdx, visible.length - 1)] : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fake page background */}
      <div className="absolute inset-0 p-4 space-y-2 pointer-events-none select-none opacity-[0.13]">
        <div className="h-4 bg-foreground rounded w-1/2" />
        <div className="h-2 bg-muted-foreground rounded w-full mt-3" />
        <div className="h-2 bg-muted-foreground rounded w-5/6" />
        <div className="h-2 bg-muted-foreground rounded w-4/5" />
        <div className="h-20 bg-muted border border-border rounded mt-4" />
        <div className="h-2 bg-muted-foreground rounded w-3/4 mt-3" />
        <div className="h-2 bg-muted-foreground rounded w-full" />
      </div>

      {/* FAB chat button */}
      {!open && (
        <button
          onClick={handleOpen}
          style={{ background: botColor, boxShadow: "0 4px 20px rgba(0,0,0,.3)" }}
          className="absolute bottom-5 right-5 z-10 flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          <BotMessageSquare className="w-4 h-4" />
          {botName}
        </button>
      )}

      {/* Chat window — slides in from bottom-right */}
      {open && (
        <div className="absolute bottom-0 right-0 w-full h-full flex flex-col bg-card animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: botColor }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <BotMessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{botName}</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-300" />
                <p className="text-white/70 text-[10px]">Online agora</p>
              </div>
            </div>
            <button onClick={closeAndReset}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {msgs.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "bot" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: botColor }}>
                    <BotMessageSquare className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] px-3 py-2 rounded-[2px] text-sm leading-snug",
                    msg.role === "bot" ? "bg-muted text-foreground" : "text-white"
                  )}
                  style={msg.role === "user" ? { background: botColor } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: botColor }}>
                  <BotMessageSquare className="w-3 h-3 text-white" />
                </div>
                <div className="bg-muted px-3 py-2.5 rounded-[2px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          {!done && currentField && (
            <div className="px-3 pb-3 pt-2 border-t border-border shrink-0 space-y-2">
              {renderTestInput(currentField, inputVal, setInputVal, fs.inputRadius)}
              <button
                onClick={handleSend}
                disabled={!!currentField.required && !inputVal.trim()}
                style={{
                  backgroundColor: fs.buttonBg || botColor,
                  color: fs.buttonTextColor,
                  borderRadius: fs.buttonRadius,
                }}
                className={cn(
                  "w-full py-2 text-sm font-semibold transition-opacity",
                  currentField.required && !inputVal.trim() ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"
                )}
              >
                {fieldIdx >= visible.length - 1 ? "Enviar ✓" : "Próximo →"}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">Enter para avançar</p>
            </div>
          )}

          {done && (
            <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
              <button onClick={closeAndReset}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-[4px] transition-colors">
                <RotateCcw className="w-3 h-3" /> Simular novamente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
