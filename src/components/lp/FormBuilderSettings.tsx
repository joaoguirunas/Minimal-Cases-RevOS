import React, { useState, useEffect } from "react";
import {
  Zap,
  GitBranch,
  Link2,
  MessageSquare,
  Plus,
  Trash2,
  BotMessageSquare,
  CalendarDays,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsappChannels } from "@/hooks/useWhatsappChannels";
import { useWhatsappTemplates } from "@/hooks/useWhatsappTemplates";
import { useBookingRuleSets } from "@/hooks/useBookingRuleSets";
import { useScoreMatrix } from "@/hooks/useScoreMatrix";
import type {
  LpFormField,
  LpFormSettings,
  LpFormWidget,
  LpFormPostSubmitAction,
  LpFormSuccessRoute,
} from "@/hooks/useLpForms";
import { cn } from "@/lib/utils";
import { EmbedPanel } from "./FormBuilderPreview";

export function SettingsPanel({
  settings,
  setSettings,
  pipelineId,
  setPipelineId,
  pipelines,
  stages,
  fields,
  formId,
}: {
  settings: LpFormSettings;
  setSettings: React.Dispatch<React.SetStateAction<LpFormSettings>>;
  pipelineId: string;
  setPipelineId: (v: string) => void;
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; leads_pipelines_id: string; order_index: number }[];
  fields: LpFormField[];
  formId?: string;
}) {
  const { data: channels = [] } = useWhatsappChannels();
  const { data: allTemplates = [] } = useWhatsappTemplates();
  const { data: bookingRuleSets = [] } = useBookingRuleSets();
  const { data: scoreMatrices = [] } = useScoreMatrix();
  const [section, setSection] = useState<"general" | "actions" | "success" | "embed">("general");
  const [outboundWebhooks, setOutboundWebhooks] = useState<{ id: string; name: string; channel: string }[]>([]);

  const templates = allTemplates.filter(
    (t) => t.status === "approved" || t.status === "active"
  );

  const widget: LpFormWidget = settings.widget ?? {
    enabled: false,
    position: "bottom-right",
    button_color: "#4f46e5",
    button_label: "Fale conosco",
    button_shape: "round",
    button_size: "md",
    button_shadow: true,
    button_icon: "📋",
    destination: "form",
  };

  function patchWidget(partial: Partial<LpFormWidget>) {
    setSettings((s) => ({ ...s, widget: { ...widget, ...partial } }));
  }

  const postSubmitActions: LpFormPostSubmitAction[] = settings.post_submit_actions ?? [];

  function setPostSubmitActions(actions: LpFormPostSubmitAction[]) {
    setSettings((s) => ({ ...s, post_submit_actions: actions }));
  }

  function addPostSubmitAction() {
    const newAction: LpFormPostSubmitAction = {
      id: crypto.randomUUID(),
      enabled: true,
      channel: "whatsapp",
      delay_minutes: 0,
      wa_channel_id: "",
      wa_template_id: "",
      wa_variable_map: {},
    };
    setPostSubmitActions([...postSubmitActions, newAction]);
  }

  function removePostSubmitAction(id: string) {
    setPostSubmitActions(postSubmitActions.filter((a) => a.id !== id));
  }

  function patchPostSubmitAction(id: string, partial: Partial<LpFormPostSubmitAction>) {
    setPostSubmitActions(
      postSubmitActions.map((a) => (a.id === id ? { ...a, ...partial } : a))
    );
  }

  const mappableFields = fields.filter((f) => f.type !== "hidden" && f.crm_field);

  // Auto-migrate whatsapp_auto → post_submit_actions (legacy compat)
  useEffect(() => {
    const wAuto = settings.whatsapp_auto;
    if (wAuto?.enabled && !settings.post_submit_actions?.length) {
      const migrated: LpFormPostSubmitAction = {
        id: crypto.randomUUID(),
        enabled: true,
        channel: "whatsapp",
        delay_minutes: 0,
        wa_channel_id: wAuto.channel_id,
        wa_template_id: wAuto.template_id,
        wa_variable_map: wAuto.variable_map,
      };
      setSettings((s) => ({
        ...s,
        post_submit_actions: [migrated],
        whatsapp_auto: { ...wAuto, enabled: false },
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load outbound webhooks for email/SMS actions
  useEffect(() => {
    supabase
      .from("omni_outbound_webhooks")
      .select("id,name,channel")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setOutboundWebhooks(data as { id: string; name: string; channel: string }[]);
      });
  }, []);

  const PRESET_COLORS = [
    "#4f46e5",
    "#16a34a",
    "#dc2626",
    "#ea580c",
    "#0891b2",
    "#7c3aed",
    "#db2777",
    "#1d4ed8",
  ];

  const pipelineStages = pipelineId
    ? stages.filter((s) => s.leads_pipelines_id === pipelineId).sort((a, b) => a.order_index - b.order_index)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-section tabs — padrão underline do app */}
      <div className="flex border-b border-border shrink-0 px-4">
        {(
          [
            { key: "general" as const, label: "Geral" },
            { key: "actions" as const, label: "Envios" },
            { key: "success" as const, label: "Sucesso" },
            { key: "embed" as const, label: "Embed" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              section === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── General ── */}
        {section === "general" && (
          <>
            {/* Chatbot bot config (only when mode=chatbot) */}
            {settings.mode === "chatbot" && (
              <div className="border border-purple-400/30 rounded-lg bg-purple-500/5 overflow-hidden">
                <div className="px-3 py-2 border-b border-purple-400/20">
                  <label className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wide">
                    <BotMessageSquare className="w-3.5 h-3.5" />
                    Configuração do chatbot
                  </label>
                </div>
                <div className="px-3 py-3 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Nome do bot</label>
                    <Input
                      value={settings.bot_name ?? ""}
                      onChange={(e) => setSettings((s) => ({ ...s, bot_name: e.target.value }))}
                      placeholder="Assistente"
                      className="h-[30px] text-sm rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Cor do bot</label>
                    <div className="flex items-center gap-2">
                      {["#4f46e5", "#16a34a", "#dc2626", "#ea580c", "#0891b2", "#7c3aed"].map((c) => (
                        <button
                          key={c}
                          onClick={() => setSettings((s) => ({ ...s, bot_color: c }))}
                          style={{ background: c }}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-all",
                            settings.bot_color === c ? "border-foreground scale-110" : "border-transparent"
                          )}
                        />
                      ))}
                      <input
                        type="color"
                        value={settings.bot_color ?? "#4f46e5"}
                        onChange={(e) => setSettings((s) => ({ ...s, bot_color: e.target.value }))}
                        className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Configure a{" "}
                    <span className="text-purple-400 font-semibold">"Pergunta do chatbot"</span>{" "}
                    em cada campo para personalizar o texto exibido.
                  </p>
                </div>
              </div>
            )}

            {/* Pipeline + Etapa */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-muted">
                <label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                  CRM — Entrada do lead
                </label>
              </div>
              <div className="px-3 py-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Pipeline de vendas</label>
                  <Select
                    value={pipelineId || "__none__"}
                    onValueChange={(v) => {
                      const newId = v === "__none__" ? "" : v;
                      setPipelineId(newId);
                      // reset etapa ao trocar pipeline
                      setSettings((s) => ({ ...s, initial_stage_id: undefined }));
                    }}
                  >
                    <SelectTrigger className="h-[30px] text-sm rounded-lg">
                      <SelectValue placeholder="— sem pipeline —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— sem pipeline —</SelectItem>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-sm">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {pipelineId && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Etapa inicial</label>
                    <Select
                      value={settings.initial_stage_id || "__first__"}
                      onValueChange={(v) =>
                        setSettings((s) => ({
                          ...s,
                          initial_stage_id: v === "__first__" ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-[30px] text-sm rounded-lg">
                        <SelectValue placeholder="Primeira etapa (padrão)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__first__">
                          <span className="text-muted-foreground">Primeira etapa (padrão)</span>
                        </SelectItem>
                        {pipelineStages.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-sm">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Leads criados por este formulário serão inseridos nesta etapa.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* UTMs */}
            <div className="border border-border rounded-lg p-3 space-y-1.5 bg-muted">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Link2 className="w-3.5 h-3.5 text-blue-500" />
                UTMs automáticas
              </label>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Parâmetros UTM da URL são capturados automaticamente.
              </p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[
                  "utm_source",
                  "utm_medium",
                  "utm_campaign",
                  "utm_content",
                  "utm_term",
                ].map((u) => (
                  <span
                    key={u}
                    className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground font-mono"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>

            {/* Post-submit */}
            <div className="border-t border-border pt-4 space-y-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <GitBranch className="w-3.5 h-3.5 text-emerald-500" />
                Após o envio
              </label>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Texto do botão
                </label>
                <Input
                  value={settings.submit_text}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      submit_text: e.target.value,
                    }))
                  }
                  className="h-[30px] text-sm rounded-lg"
                  placeholder="Enviar"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Configure a página de sucesso na aba <span className="font-semibold text-foreground">Sucesso</span>.
              </p>
            </div>
          </>
        )}

        {/* ── Ações Pós-Envio ── */}
        {/* ── Sucesso ── */}
        {section === "success" && (() => {
          const successRoutes: LpFormSuccessRoute[] = settings.success_routes ?? [];
          const setSuccessRoutes = (routes: LpFormSuccessRoute[]) =>
            setSettings((s) => ({ ...s, success_routes: routes }));

          const addRoute = () => {
            setSuccessRoutes([
              ...successRoutes,
              {
                id: crypto.randomUUID(),
                matrix_ids: [],
                action: "message",
                title: "",
                message: "",
              },
            ]);
          };

          const removeRoute = (id: string) =>
            setSuccessRoutes(successRoutes.filter((r) => r.id !== id));

          const patchRoute = (id: string, partial: Partial<LpFormSuccessRoute>) =>
            setSuccessRoutes(successRoutes.map((r) => (r.id === id ? { ...r, ...partial } : r)));

          const scoreColor = (n: number) =>
            n >= 8
              ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
              : n >= 5
              ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
              : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";

          return (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Rotas de Sucesso</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Defina diferentes páginas de sucesso por entrada da matriz score.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-[30px] text-xs gap-1 rounded-lg" onClick={addRoute}>
                  <Plus className="w-3 h-3" /> Rota
                </Button>
              </div>

              {/* Default (fallback — no score or no matching route) */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    Padrão (fallback)
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Usado quando nenhuma rota por score corresponder.
                  </p>
                </div>
                <div className="px-3 py-3 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Título</label>
                    <Input
                      value={settings.success_title ?? ""}
                      onChange={(e) => setSettings((s) => ({ ...s, success_title: e.target.value }))}
                      className="h-[30px] text-sm rounded-lg"
                      placeholder="Enviado com sucesso!"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Mensagem</label>
                    <Textarea
                      value={settings.success_message}
                      onChange={(e) => setSettings((s) => ({ ...s, success_message: e.target.value }))}
                      className="text-sm rounded-lg resize-none"
                      rows={2}
                      placeholder="Obrigado! Entraremos em contato."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Redirecionar (opcional)</label>
                    <Input
                      value={settings.redirect_url ?? ""}
                      onChange={(e) => setSettings((s) => ({ ...s, redirect_url: e.target.value }))}
                      placeholder="https://..."
                      className="h-[30px] text-sm rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Score-based routes */}
              {successRoutes.map((route) => (
                <div key={route.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-muted flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Matriz Score</p>
                      <div className="flex flex-wrap gap-1">
                        {scoreMatrices.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">Nenhuma entrada. Configure em Score PRO.</p>
                        ) : scoreMatrices.map((m) => {
                          const selected = route.matrix_ids?.includes(m.id) ?? false;
                          const n = m.score_number;
                          const label = m.name || m.resolved_categories?.map((c) => c.itemNames.join(", ")).join(" · ") || `Score ${n}`;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              title={label}
                              onClick={() => {
                                const current = route.matrix_ids ?? [];
                                const next = selected ? current.filter((id) => id !== m.id) : [...current, m.id];
                                patchRoute(route.id, { matrix_ids: next });
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border max-w-[140px] truncate",
                                selected ? scoreColor(n) : "bg-muted text-muted-foreground border-border opacity-40 hover:opacity-70"
                              )}
                            >
                              <span className="font-bold mr-0.5">{n}</span>
                              {label.length > 16 ? label.slice(0, 16) + "…" : label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRoute(route.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-3 py-3 space-y-3">
                    {/* Action type */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Ação</label>
                      <Select
                        value={route.action}
                        onValueChange={(v) => patchRoute(route.id, { action: v as LpFormSuccessRoute["action"] })}
                      >
                        <SelectTrigger className="h-[30px] text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="message" className="text-xs">Mensagem personalizada</SelectItem>
                          <SelectItem value="redirect" className="text-xs">Redirecionar para URL</SelectItem>
                          <SelectItem value="booking" className="text-xs">Agendamento inline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Message fields */}
                    {route.action === "message" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Título</label>
                          <Input
                            value={route.title ?? ""}
                            onChange={(e) => patchRoute(route.id, { title: e.target.value })}
                            placeholder="Parabéns! Você se qualificou."
                            className="h-[30px] text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Mensagem</label>
                          <textarea
                            value={route.message ?? ""}
                            onChange={(e) => patchRoute(route.id, { message: e.target.value })}
                            placeholder="Entraremos em contato em breve..."
                            rows={2}
                            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </>
                    )}

                    {/* Redirect fields */}
                    {route.action === "redirect" && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">URL de redirecionamento</label>
                        <Input
                          value={route.redirect_url ?? ""}
                          onChange={(e) => patchRoute(route.id, { redirect_url: e.target.value })}
                          placeholder="https://..."
                          className="h-[30px] text-xs rounded-lg"
                        />
                      </div>
                    )}

                    {/* Booking fields */}
                    {route.action === "booking" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" /> Regra de agendamento
                          </label>
                          {bookingRuleSets.length > 0 ? (
                            <Select
                              value={route.booking_rule_set_id || "__none__"}
                              onValueChange={(v) =>
                                patchRoute(route.id, { booking_rule_set_id: v === "__none__" ? undefined : v })
                              }
                            >
                              <SelectTrigger className="h-[30px] text-xs rounded-lg">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs">— selecione —</SelectItem>
                                {bookingRuleSets.map((rs) => (
                                  <SelectItem key={rs.id} value={rs.id} className="text-xs">
                                    {rs.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-[10px] text-muted-foreground bg-muted border border-border rounded-lg px-2 py-1.5">
                              Nenhuma regra configurada. Acesse Schedule PRO para criar.
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Título (opcional)</label>
                          <Input
                            value={route.title ?? ""}
                            onChange={(e) => patchRoute(route.id, { title: e.target.value })}
                            placeholder="Agende sua conversa!"
                            className="h-[30px] text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Mensagem (opcional)</label>
                          <textarea
                            value={route.message ?? ""}
                            onChange={(e) => patchRoute(route.id, { message: e.target.value })}
                            placeholder="Escolha o melhor horário para conversarmos."
                            rows={2}
                            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1.5 pt-2 border-t border-border">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> WhatsApp pós-booking
                          </label>
                          <Input
                            value={route.wa_confirm_template ?? ""}
                            onChange={(e) => patchRoute(route.id, { wa_confirm_template: e.target.value || undefined })}
                            placeholder="confirmacao_reuniao"
                            className="h-[30px] text-xs rounded-lg"
                          />
                          <p className="text-[9px] text-muted-foreground leading-relaxed">
                            Nome do template Meta para enviar após o agendamento. Variáveis: {"{{1}}"} nome, {"{{2}}"} data, {"{{3}}"} hora, {"{{4}}"} link Meet.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {successRoutes.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Nenhuma rota por score configurada.</p>
                  <p className="text-[10px] mt-1">O padrão acima será usado para todos os envios.</p>
                </div>
              )}
            </>
          );
        })()}

        {section === "actions" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">Ações Pós-Envio</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Envios automáticos após o formulário ser preenchido.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addPostSubmitAction}
                className="h-[30px] text-xs rounded-lg gap-1"
              >
                <Plus className="w-3 h-3" />
                Ação
              </Button>
            </div>

            {postSubmitActions.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground opacity-20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma ação configurada. Clique em "+ Ação" para adicionar.
                </p>
              </div>
            )}

            {postSubmitActions.map((action, idx) => (
              <div key={action.id} className="border border-border rounded-lg bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    {/* Visual channel selector */}
                    <div className="flex gap-1">
                      {(
                        [
                          { v: "whatsapp" as const, emoji: "💬", label: "WhatsApp" },
                          { v: "email" as const, emoji: "✉️", label: "Email" },
                          { v: "sms" as const, emoji: "📱", label: "SMS" },
                        ] as const
                      ).map(({ v, emoji, label }) => (
                        <button
                          key={v}
                          title={label}
                          onClick={() =>
                            patchPostSubmitAction(action.id, {
                              channel: v,
                              wa_channel_id: "",
                              wa_template_id: "",
                              wa_variable_map: {},
                              webhook_id: "",
                              message_template: "",
                            })
                          }
                          className={cn(
                            "flex items-center gap-0.5 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-colors",
                            action.channel === v
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          {emoji} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={action.enabled}
                      onCheckedChange={(v) => patchPostSubmitAction(action.id, { enabled: v })}
                      className="scale-[0.65]"
                    />
                    <button
                      onClick={() => removePostSubmitAction(action.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="px-3 py-3 space-y-3">
                  {/* Delay */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground shrink-0 font-semibold">Enviar após</label>
                    <Select
                      value={String(action.delay_minutes)}
                      onValueChange={(v) => patchPostSubmitAction(action.id, { delay_minutes: Number(v) })}
                    >
                      <SelectTrigger className="h-6 text-[10px] rounded-lg flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" className="text-xs">Imediato</SelectItem>
                        <SelectItem value="5" className="text-xs">5 minutos</SelectItem>
                        <SelectItem value="15" className="text-xs">15 minutos</SelectItem>
                        <SelectItem value="30" className="text-xs">30 minutos</SelectItem>
                        <SelectItem value="60" className="text-xs">1 hora</SelectItem>
                        <SelectItem value="1440" className="text-xs">1 dia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trigger step (steps mode only) */}
                  {settings.mode === 'steps' && (settings.steps ?? []).length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground shrink-0 font-semibold">Na etapa</label>
                      <Select
                        value={action.trigger_step !== undefined ? String(action.trigger_step) : 'last'}
                        onValueChange={(v) => patchPostSubmitAction(action.id, { trigger_step: v === 'last' ? 'last' : Number(v) })}
                      >
                        <SelectTrigger className="h-6 text-[10px] rounded-lg flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="last" className="text-xs">✅ Envio final</SelectItem>
                          {(settings.steps ?? []).map((step, i) => (
                            <SelectItem key={step.id} value={String(i + 1)} className="text-xs">
                              Etapa {i + 1}{step.title ? ` — ${step.title}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* WhatsApp fields */}
                  {action.channel === "whatsapp" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Canal WA</label>
                        <Select
                          value={action.wa_channel_id || "__none__"}
                          onValueChange={(v) =>
                            patchPostSubmitAction(action.id, {
                              wa_channel_id: v === "__none__" ? "" : v,
                              wa_template_id: "",
                              wa_variable_map: {},
                            })
                          }
                        >
                          <SelectTrigger className="h-[30px] text-xs rounded-lg">
                            <SelectValue placeholder="Selecione canal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-xs">— selecione —</SelectItem>
                            {channels.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.label} {c.is_default ? "(padrão)" : ""} {c.provider === "evolution" ? "· não-oficial" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {action.wa_channel_id && (() => {
                        // Filtra pelo provider do canal escolhido — sem isso dava pra selecionar
                        // um template Meta pra um canal Evolution (ou vice-versa), mistura que
                        // não faz sentido já que o disparo real segue o provider do canal.
                        const selectedProvider = channels.find((c) => c.id === action.wa_channel_id)?.provider ?? "meta";
                        const templatesForChannel = templates.filter((t) => (t.provider ?? "meta") === selectedProvider);
                        return (
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                              {selectedProvider === "evolution" ? "Template" : "Template aprovado"}
                            </label>
                            <Select
                              value={action.wa_template_id || "__none__"}
                              onValueChange={(v) =>
                                patchPostSubmitAction(action.id, {
                                  wa_template_id: v === "__none__" ? "" : v,
                                  wa_variable_map: {},
                                })
                              }
                            >
                              <SelectTrigger className="h-[30px] text-xs rounded-lg">
                                <SelectValue placeholder="Selecione template" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs">— selecione —</SelectItem>
                                {templatesForChannel.map((t) => (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}

                      {/* Variable mapping for WA template */}
                      {action.channel === "whatsapp" && action.wa_template_id && (() => {
                        const tpl = allTemplates.find((t) => t.id === action.wa_template_id);
                        const bodyText = tpl?.json_data?.data ?? "";
                        const varMatches = [...new Set(
                          [...(bodyText.matchAll(/\{\{(\d+)\}\}/g))].map((m) => m[1])
                        )].sort((a, b) => Number(a) - Number(b));
                        if (varMatches.length === 0) return null;
                        return (
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Variáveis do template</label>
                            <div className="space-y-1.5">
                              {varMatches.map((varIdx) => {
                                const spec = action.wa_variable_map?.[varIdx] ?? "";
                                const isFixed = spec.startsWith("fixed:") || (!spec.startsWith("field:") && spec !== "");
                                const fixedVal = spec.startsWith("fixed:") ? spec.slice(6) : (!spec.startsWith("field:") ? spec : "");
                                const fieldVal = spec.startsWith("field:") ? spec.slice(6) : "";
                                return (
                                  <div key={varIdx} className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-lg shrink-0">{"{{"}{varIdx}{"}}"}</span>
                                    <Select
                                      value={fieldVal ? `field:${fieldVal}` : (isFixed ? "__fixed__" : "__none__")}
                                      onValueChange={(v) => {
                                        if (v === "__none__") {
                                          patchPostSubmitAction(action.id, { wa_variable_map: { ...action.wa_variable_map, [varIdx]: "" } });
                                        } else if (v === "__fixed__") {
                                          patchPostSubmitAction(action.id, { wa_variable_map: { ...action.wa_variable_map, [varIdx]: "fixed:" } });
                                        } else {
                                          patchPostSubmitAction(action.id, { wa_variable_map: { ...action.wa_variable_map, [varIdx]: v } });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-[10px] rounded-lg flex-1">
                                        <SelectValue placeholder="— selecione —" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__" className="text-xs">— vazio —</SelectItem>
                                        <SelectItem value="field:pessoa.nome" className="text-xs">👤 Nome</SelectItem>
                                        <SelectItem value="field:pessoa.email" className="text-xs">✉️ Email</SelectItem>
                                        <SelectItem value="field:pessoa.whatsapp" className="text-xs">📱 WhatsApp</SelectItem>
                                        <SelectItem value="field:empresa.nome" className="text-xs">🏢 Empresa</SelectItem>
                                        {mappableFields.map((f) => (
                                          <SelectItem key={f.id} value={`field:custom.${f.crm_field}`} className="text-xs">
                                            📝 {f.label}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="__fixed__" className="text-xs">✏️ Texto fixo...</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {(isFixed) && (
                                      <input
                                        type="text"
                                        value={fixedVal}
                                        onChange={(e) => patchPostSubmitAction(action.id, { wa_variable_map: { ...action.wa_variable_map, [varIdx]: `fixed:${e.target.value}` } })}
                                        placeholder="Texto fixo"
                                        className="h-6 text-[10px] flex-1 border border-border rounded-lg px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* Email / SMS fields */}
                  {(action.channel === "email" || action.channel === "sms") && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Webhook de saída</label>
                        {outboundWebhooks.filter((w) => w.channel === action.channel).length > 0 ? (
                          <Select
                            value={action.webhook_id || "__none__"}
                            onValueChange={(v) =>
                              patchPostSubmitAction(action.id, { webhook_id: v === "__none__" ? "" : v })
                            }
                          >
                            <SelectTrigger className="h-[30px] text-xs rounded-lg">
                              <SelectValue placeholder="Selecione um webhook" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">— selecione —</SelectItem>
                              {outboundWebhooks
                                .filter((w) => w.channel === action.channel)
                                .map((w) => (
                                  <SelectItem key={w.id} value={w.id} className="text-xs">
                                    {w.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-[10px] text-muted-foreground bg-muted border border-border rounded-lg px-2 py-1.5">
                            Nenhum webhook {action.channel === "email" ? "de email" : "de SMS"} configurado.{" "}
                            <span className="text-primary">Configurações → OMNI PRO → Webhooks.</span>
                          </p>
                        )}
                      </div>
                      {action.channel === "email" && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Assunto</label>
                          <Input
                            value={action.subject ?? ""}
                            onChange={(e) => patchPostSubmitAction(action.id, { subject: e.target.value })}
                            placeholder="Assunto do e-mail"
                            className="h-[30px] text-xs rounded-lg"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Mensagem</label>
                        <textarea
                          value={action.message_template ?? ""}
                          onChange={(e) => patchPostSubmitAction(action.id, { message_template: e.target.value })}
                          placeholder="Use {{pessoa.nome}}, {{pessoa.email}} etc."
                          rows={3}
                          className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </>
                  )}

                  {/* Score filter — by matrix entry */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Filtro por Score</label>
                      <Select
                        value={action.score_filter?.mode ?? "all"}
                        onValueChange={(v) => {
                          const mode = v as "all" | "include" | "exclude";
                          patchPostSubmitAction(action.id, {
                            score_filter: mode === "all"
                              ? { mode: "all", matrix_ids: [] }
                              : { mode, matrix_ids: action.score_filter?.matrix_ids ?? [] },
                          });
                        }}
                      >
                        <SelectTrigger className="h-6 text-[10px] rounded-lg w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">Todos os scores</SelectItem>
                          <SelectItem value="include" className="text-xs">Somente estes</SelectItem>
                          <SelectItem value="exclude" className="text-xs">Exceto estes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {action.score_filter?.mode && action.score_filter.mode !== "all" && (
                      <div className="flex flex-wrap gap-1">
                        {scoreMatrices.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">Nenhuma entrada na matriz score. Configure em Score PRO.</p>
                        ) : scoreMatrices.map((m) => {
                          const selected = action.score_filter?.matrix_ids?.includes(m.id) ?? false;
                          const n = m.score_number;
                          const color = n >= 8 ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                            : n >= 5 ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                            : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
                          const label = m.name || m.resolved_categories?.map((c) => c.itemNames.join(", ")).join(" · ") || `Score ${n}`;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              title={label}
                              onClick={() => {
                                const current = action.score_filter?.matrix_ids ?? [];
                                const next = selected ? current.filter((id) => id !== m.id) : [...current, m.id];
                                patchPostSubmitAction(action.id, {
                                  score_filter: { mode: action.score_filter!.mode, matrix_ids: next },
                                });
                              }}
                              className={cn(
                                "px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all max-w-[160px] truncate",
                                selected ? color : "bg-muted text-muted-foreground border-border opacity-40 hover:opacity-70"
                              )}
                            >
                              <span className="font-bold mr-1">{n}</span>
                              {label.length > 20 ? label.slice(0, 20) + "…" : label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Embed ── */}
        {section === "embed" && (
          <div className="-m-4 flex-1 min-h-0">
            <EmbedPanel formId={formId} settings={settings} />
          </div>
        )}

      </div>
    </div>
  );
}
