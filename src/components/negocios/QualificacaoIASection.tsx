import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualificacaoIAData {
  // Diagnóstico (Q1-Q8)
  q1_main_bottleneck?: string | null;
  q2_lead_volume_month?: number | null;
  q3_team_size?: number | null;
  q4_crm_maturity?: string | null;
  q5_crm_name?: string | null;
  q6_trigger?: string | null;
  q7_problem_impact?: string | null;
  q8_engagement_level?: string | null;

  // Qualificação (Q9-Q20)
  q9_decision_authority?: string | null;
  q10_stakeholders?: string | null;
  q11_budget_approved?: string | null;
  q12_timeline?: string | null;
  q13_urgency_reason?: string | null;
  q14_data_ready?: string | null;
  q15_minimum_volume?: string | null;
  q16_expected_roi?: string | null;
  q17_objections?: string | null;
  q18_real_fit?: string | null;
  q19_qualification_status?: string | null;
  q20_rejection_reason?: string | null;

  // Análise (Q21-Q24)
  q21_interest_level?: number | null;
  q22_close_probability?: number | null;
  q23_behavioral_tags?: string | null;
  q24_last_update_by_agent?: string | null;

  // DISC (Q25)
  q25_disc_profile?: string | null;
}

interface QualificacaoIASectionProps {
  data: QualificacaoIAData | null | undefined;
}

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
};

// ── Compact label/value row ────────────────────────────────────────────────────
const Row = ({
  label,
  value,
  wide,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
}) => {
  if (!hasValue(value)) return null;
  return (
    <div
      className={cn(
        "flex gap-3 py-2 border-b border-white/[0.04] last:border-0",
        wide ? "flex-col" : "items-start justify-between",
      )}
    >
      <span className="text-[12px] text-muted-foreground/65 shrink-0">{label}</span>
      <span
        className={cn(
          "text-[13px] text-foreground leading-snug",
          wide ? "" : "text-right max-w-[58%]",
        )}
      >
        {String(value)}
      </span>
    </div>
  );
};

// ── Progress row ──────────────────────────────────────────────────────────────
const ProgressRow = ({
  label,
  value,
  max = 10,
  suffix = "",
}: {
  label: string;
  value: number | null | undefined;
  max?: number;
  suffix?: string;
}) => {
  if (!hasValue(value)) return null;
  const pct = Math.min(100, ((value ?? 0) / max) * 100);
  const color =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="py-2 border-b border-white/[0.04] last:border-0 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground/65">{label}</span>
        <span className="text-[13px] font-semibold text-foreground tabular-nums">
          {value}{suffix}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Status badge ──────────────────────────────────────────────────────────────
const QualificationStatusBadge = ({ status }: { status: string | null | undefined }) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("aprovado") || s.includes("qualified") || s.includes("yes")) {
    return (
      <Badge className="bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20 gap-1 text-[11px] rounded-[2px]">
        <CheckCircle className="w-3 h-3" />{status}
      </Badge>
    );
  }
  if (s.includes("nurturing") || s.includes("pendente") || s.includes("maybe")) {
    return (
      <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 gap-1 text-[11px] rounded-[2px]">
        <Clock className="w-3 h-3" />{status}
      </Badge>
    );
  }
  if (s.includes("descartado") || s.includes("rejected") || s.includes("no")) {
    return (
      <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 gap-1 text-[11px] rounded-[2px]">
        <XCircle className="w-3 h-3" />{status}
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
};

// ── DISC badge ────────────────────────────────────────────────────────────────
const DiscBadge = ({ profile }: { profile: string | null | undefined }) => {
  if (!profile) return null;
  const letter = profile.toUpperCase().charAt(0);
  const map: Record<string, { cls: string; label: string }> = {
    D: { cls: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",     label: "Dominância" },
    I: { cls: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20", label: "Influência" },
    S: { cls: "bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20", label: "Estabilidade" },
    C: { cls: "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20", label: "Conformidade" },
  };
  const entry = map[letter];
  return (
    <Badge className={cn("gap-1.5 px-2.5 py-1 text-[13px] font-semibold", entry?.cls ?? "bg-muted")}>
      {letter}{entry && <span className="text-[11px] font-normal opacity-80">— {entry.label}</span>}
    </Badge>
  );
};

// ── Behavioral tags ───────────────────────────────────────────────────────────
const TagList = ({ tags }: { tags: string | null | undefined }) => {
  if (!tags) return null;
  const list = tags.split(",").map((t) => t.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5 pt-0.5">
      {list.map((tag, i) => (
        <Badge key={i} variant="secondary" className="text-[11px] font-normal px-2 py-0.5">
          {tag}
        </Badge>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const QualificacaoIASection = ({ data }: QualificacaoIASectionProps) => {
  const [activeTab, setActiveTab] = useState("diagnostico");

  const hasDiagnostico = [
    data?.q1_main_bottleneck, data?.q2_lead_volume_month, data?.q3_team_size,
    data?.q4_crm_maturity, data?.q5_crm_name, data?.q6_trigger,
    data?.q7_problem_impact, data?.q8_engagement_level,
  ].some(hasValue);

  const hasQualificacao = [
    data?.q9_decision_authority, data?.q10_stakeholders, data?.q11_budget_approved,
    data?.q12_timeline, data?.q13_urgency_reason, data?.q14_data_ready,
    data?.q15_minimum_volume, data?.q16_expected_roi, data?.q17_objections,
    data?.q18_real_fit, data?.q19_qualification_status, data?.q20_rejection_reason,
  ].some(hasValue);

  const hasAnalise = [
    data?.q21_interest_level, data?.q22_close_probability,
    data?.q23_behavioral_tags, data?.q24_last_update_by_agent,
  ].some(hasValue);

  const hasDisc = [data?.q25_disc_profile].some(hasValue);
  const hasAnyData = hasDiagnostico || hasQualificacao || hasAnalise || hasDisc;

  // ── Empty state ──
  if (!hasAnyData) {
    return (
      <section className="border border-border rounded-[2px] bg-card">
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Qualificação IA
          </p>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-muted-foreground/40">
            Aguardando qualificação pelo agente IA
          </p>
        </div>
      </section>
    );
  }

  const tabs = [
    { id: "diagnostico", label: "Diagnóstico", has: hasDiagnostico },
    { id: "qualificacao", label: "Qualificação", has: hasQualificacao },
    { id: "analise", label: "Análise", has: hasAnalise },
    { id: "disc", label: "DISC", has: hasDisc },
  ];

  return (
    <section className="border border-border rounded-[2px] bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Qualificação IA
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground/35 tabular-nums">
          {tabs.filter((t) => t.has).length}/{tabs.length} seções
        </span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-3">
          <TabsList className="h-7 p-0.5 gap-0.5 bg-muted w-full grid grid-cols-4">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={cn(
                  "h-6 text-[11px] px-2 rounded-[2px] relative transition-all duration-300",
                  !t.has && "opacity-45",
                )}
              >
                {t.label}
                {t.has && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary/60" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Diagnóstico ── */}
        <TabsContent value="diagnostico" className="px-4 pb-4 mt-3">
          {hasDiagnostico ? (
            <div>
              <Row label="Gargalo principal"   value={data?.q1_main_bottleneck}  wide />
              <Row label="Volume leads/mês"    value={data?.q2_lead_volume_month} />
              <Row label="Tamanho da equipe"   value={data?.q3_team_size} />
              <Row label="Maturidade CRM"      value={data?.q4_crm_maturity} />
              <Row label="CRM utilizado"       value={data?.q5_crm_name} />
              <Row label="Gatilho da busca"    value={data?.q6_trigger}  wide />
              <Row label="Impacto do problema" value={data?.q7_problem_impact} wide />
              {hasValue(data?.q8_engagement_level) && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-[12px] text-muted-foreground/65">Engajamento</span>
                  <Badge
                    className={cn(
                      "text-[11px]",
                      data?.q8_engagement_level?.toLowerCase().includes("alto")
                        ? "bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20 rounded-[2px]"
                        : data?.q8_engagement_level?.toLowerCase().includes("médio")
                          ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 rounded-[2px]"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {data?.q8_engagement_level}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/40 py-4 text-center">Sem dados</p>
          )}
        </TabsContent>

        {/* ── Qualificação ── */}
        <TabsContent value="qualificacao" className="px-4 pb-4 mt-3">
          {hasQualificacao ? (
            <div>
              {hasValue(data?.q19_qualification_status) && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-[12px] text-muted-foreground/65">Status</span>
                  <div className="flex flex-col items-end gap-1">
                    <QualificationStatusBadge status={data?.q19_qualification_status} />
                    {hasValue(data?.q20_rejection_reason) && (
                      <span className="text-[11px] text-muted-foreground/55 text-right max-w-[60%]">
                        {data?.q20_rejection_reason}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Row label="Autoridade de decisão" value={data?.q9_decision_authority} />
              <Row label="Stakeholders"           value={data?.q10_stakeholders}       wide />
              <Row label="Budget aprovado"        value={data?.q11_budget_approved} />
              <Row label="Timeline"               value={data?.q12_timeline} />
              <Row label="Razão da urgência"      value={data?.q13_urgency_reason}     wide />
              <Row label="Dados organizados"      value={data?.q14_data_ready} />
              <Row label="Volume mínimo"          value={data?.q15_minimum_volume} />
              <Row label="ROI esperado"           value={data?.q16_expected_roi} />
              <Row label="Objeções"               value={data?.q17_objections}         wide />
              <Row label="Fit real"               value={data?.q18_real_fit} />
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/40 py-4 text-center">Sem dados</p>
          )}
        </TabsContent>

        {/* ── Análise ── */}
        <TabsContent value="analise" className="px-4 pb-4 mt-3">
          {hasAnalise ? (
            <div>
              <ProgressRow
                label="Nível de interesse"
                value={data?.q21_interest_level}
                max={10}
                suffix="/10"
              />
              <ProgressRow
                label="Probabilidade de fechar"
                value={data?.q22_close_probability}
                max={100}
                suffix="%"
              />
              {hasValue(data?.q23_behavioral_tags) && (
                <div className="py-2 border-b border-white/[0.04] last:border-0 space-y-1.5">
                  <span className="text-[12px] text-muted-foreground/65">Tags comportamentais</span>
                  <TagList tags={data?.q23_behavioral_tags} />
                </div>
              )}
              <Row label="Última atualização por" value={data?.q24_last_update_by_agent} />
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/40 py-4 text-center">Sem dados</p>
          )}
        </TabsContent>

        {/* ── DISC ── */}
        <TabsContent value="disc" className="px-4 pb-4 mt-3">
          {hasDisc ? (
            <div>
              {hasValue(data?.q25_disc_profile) && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-[12px] text-muted-foreground/65">Perfil DISC</span>
                  <DiscBadge profile={data?.q25_disc_profile} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/40 py-4 text-center">Sem dados</p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default QualificacaoIASection;
