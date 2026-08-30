import { useState, useCallback, useEffect, useRef } from "react";
import {
  FlaskConical,
  Monitor,
  Smartphone,
  RotateCcw,
  Sparkles,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LpFormField, LpFormSettings, LpFormStep } from "@/hooks/useLpForms";
import {
  useScoreFramings,
  useScoreInvestments,
  useScoreObjectives,
} from "@/hooks/useLpForms";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_DATA: Record<string, string> = {
  "people.name":         "Maria Silva",
  "people.email":        "maria.silva@exemplo.com",
  "people.whatsapp":     "(11) 98765-4321",
  "people.document":     "123.456.789-00",
  "people.notes":        "Tenho interesse no plano profissional.",
  "people.goal":         "Aumentar vendas online",
  "people.income":       "R$ 15.000/mês",
  "people.moment":       "Buscando crescer",
  "people.source":       "Instagram",
  "company.trade_name":  "Silva Digital LTDA",
  "company.legal_name":  "Silva Digital Serviços LTDA",
  "company.tax_id":      "12.345.678/0001-90",
  "company.email":       "contato@silvadigital.com",
  "company.phone":       "(11) 3456-7890",
  "company.website":     "https://silvadigital.com",
  "company.address":     "Rua das Flores, 123 - São Paulo/SP",
  "lead.title":          "Projeto Website 2026",
  "lead.value":          "25000",
  "lead.description":    "Website institucional + e-commerce",
};

function getTestValue(field: LpFormField): string {
  if (field.system_field && FAKE_DATA[field.system_field]) return FAKE_DATA[field.system_field];
  if (field.type === "email") return "teste@exemplo.com";
  if (field.type === "phone") return "(11) 99999-0000";
  if (field.type === "number") return "1000";
  if (field.type === "date") return "2026-03-15";
  if (field.type === "textarea") return "Texto de exemplo para teste.";
  if (field.type === "select" || field.type === "radio") {
    const first = field.options?.[0];
    return first?.value ?? "";
  }
  if (field.type === "checkbox") return "on";
  return "Dado de teste";
}

function evaluateConditions(
  field: LpFormField,
  allFields: LpFormField[],
  values: Record<string, string>,
): boolean {
  if (!field.conditions || field.conditions.length === 0) return true;
  return field.conditions.every((cond) => {
    if (!cond.trigger_field_id || !cond.trigger_value) return true;
    const triggerField = allFields.find((f) => f.id === cond.trigger_field_id);
    if (!triggerField) return true;
    const val = values[triggerField.id] ?? "";
    const match = val.toLowerCase() === cond.trigger_value.toLowerCase();
    return cond.action === "show" ? match : !match;
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LpFormTestProps {
  fields: LpFormField[];
  settings: LpFormSettings;
}

type ViewMode = "desktop" | "mobile";

// ─── Component ────────────────────────────────────────────────────────────────

export function LpFormTest({ fields, settings }: LpFormTestProps) {
  const formMode = settings.form_mode ?? "standard";
  const steps = settings.steps ?? [];

  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [typeformIdx, setTypeformIdx] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  // Score data from DB
  const { data: framings = [] } = useScoreFramings();
  const { data: investments = [] } = useScoreInvestments();
  const { data: objectives = [] } = useScoreObjectives();

  const typeformRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  // Visible fields (respecting conditions + not hidden)
  const visibleFields = fields.filter(
    (f) => f.type !== "hidden" && evaluateConditions(f, fields, values),
  );

  // Group fields by step for paginated mode
  const fieldsByStep = useCallback(() => {
    if (steps.length === 0) return [visibleFields];
    const groups: LpFormField[][] = [];
    const generalFields = visibleFields.filter((f) => !f.step_id);
    steps.forEach((step) => {
      groups.push(visibleFields.filter((f) => f.step_id === step.id));
    });
    if (generalFields.length > 0) groups.push(generalFields);
    return groups.filter((g) => g.length > 0);
  }, [visibleFields, steps]);

  // Typeform visible fields list
  const typeformFields = visibleFields;

  function setValue(fieldId: string, val: string) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function validate(fieldsToCheck: LpFormField[]): boolean {
    const errs: Record<string, string> = {};
    fieldsToCheck.forEach((f) => {
      if (f.required && !values[f.id]?.trim()) {
        errs[f.id] = "Campo obrigatório";
      }
      if (f.type === "email" && values[f.id] && !/\S+@\S+\.\S+/.test(values[f.id])) {
        errs[f.id] = "E-mail inválido";
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate(visibleFields)) return;
    setSubmitted(true);
  }

  function handleAutoFill() {
    const newValues: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.type === "hidden") return;
      // Score fields: pick first option from DB data
      if (f.type === "score_framing" && framings.length > 0) {
        newValues[f.id] = framings[0].id;
      } else if (f.type === "score_investment" && investments.length > 0) {
        newValues[f.id] = investments[0].id;
      } else if (f.type === "score_objective" && objectives.length > 0) {
        newValues[f.id] = objectives[0].id;
      } else {
        newValues[f.id] = getTestValue(f);
      }
    });
    setValues(newValues);
    setErrors({});
  }

  function handleReset() {
    setValues({});
    setErrors({});
    setSubmitted(false);
    setCurrentStep(0);
    setTypeformIdx(0);
  }

  // Paginated navigation
  function nextStep() {
    const groups = fieldsByStep();
    const stepFields = groups[currentStep] ?? [];
    if (!validate(stepFields)) return;
    if (currentStep < groups.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  // Typeform navigation
  function typeformNext() {
    const field = typeformFields[typeformIdx];
    if (field && field.required && !values[field.id]?.trim()) {
      setErrors({ [field.id]: "Campo obrigatório" });
      return;
    }
    setErrors({});
    if (typeformIdx < typeformFields.length - 1) {
      setAnimDir("forward");
      setTypeformIdx((i) => i + 1);
    } else {
      handleSubmit();
    }
  }

  function typeformPrev() {
    if (typeformIdx > 0) {
      setAnimDir("back");
      setTypeformIdx((i) => i - 1);
    }
  }

  // Keyboard for typeform
  useEffect(() => {
    if (formMode !== "typeform" || submitted) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        typeformNext();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [formMode, typeformIdx, submitted, values, typeformFields]);

  // Auto-focus typeform input
  useEffect(() => {
    if (formMode === "typeform" && typeformRef.current) {
      typeformRef.current.focus();
    }
  }, [typeformIdx, formMode]);

  // ── Score field render helper ──────────────────────────────────────────────

  function getScoreOptions(type: string) {
    if (type === "score_framing") return framings;
    if (type === "score_investment") return investments;
    if (type === "score_objective") return objectives;
    return [];
  }

  // ── Field renderer ─────────────────────────────────────────────────────────

  function renderField(field: LpFormField, isTypeform = false) {
    const error = errors[field.id];
    const val = values[field.id] ?? "";
    const baseInput = cn(
      "w-full border rounded-[4px] px-3 py-2 text-sm transition-colors bg-background",
      error ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-primary",
      isTypeform ? "text-base py-3" : "text-sm",
    );

    const label = (
      <label className={cn("font-semibold text-foreground block mb-1.5", isTypeform ? "text-lg" : "text-xs")}>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    );

    // Score fields: button grid
    if (["score_framing", "score_investment", "score_objective"].includes(field.type)) {
      const options = getScoreOptions(field.type);
      return (
        <div key={field.id} className={cn(isTypeform && "max-w-md mx-auto")}>
          {label}
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma opção cadastrada no Score PRO.</p>
          ) : (
            <div className={cn("grid gap-2", isTypeform ? "grid-cols-1" : "grid-cols-2")}>
              {options.map((opt) => (
                <button key={opt.id} type="button"
                  onClick={() => setValue(field.id, opt.id)}
                  className={cn(
                    "border rounded-[4px] px-3 py-2.5 text-sm text-left transition-all",
                    val === opt.id
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    // Select
    if (field.type === "select") {
      return (
        <div key={field.id}>
          {label}
          <div className="relative">
            <select
              value={val}
              onChange={(e) => setValue(field.id, e.target.value)}
              className={cn(baseInput, "appearance-none pr-8")}
              ref={isTypeform ? (typeformRef as React.Ref<HTMLSelectElement>) : undefined}
            >
              <option value="">Selecione...</option>
              {(field.options ?? []).map((o, i) => (
                <option key={i} value={o.value}>{o.label || `Opção ${i + 1}`}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    // Radio
    if (field.type === "radio") {
      return (
        <div key={field.id}>
          {label}
          <div className="space-y-1.5">
            {(field.options ?? []).map((o, i) => (
              <label key={i} className={cn(
                "flex items-center gap-2.5 border rounded-[4px] px-3 py-2 cursor-pointer transition-all",
                val === o.value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}>
                <input type="radio" name={field.id} value={o.value} checked={val === o.value}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  className="w-3.5 h-3.5 accent-primary" />
                <span className="text-sm">{o.label || `Opção ${i + 1}`}</span>
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    // Checkbox
    if (field.type === "checkbox") {
      if (field.options && field.options.length > 0) {
        return (
          <div key={field.id}>
            {label}
            <div className="space-y-1.5">
              {field.options.map((o, i) => (
                <label key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-primary rounded" />
                  {o.label || `Opção ${i + 1}`}
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        );
      }
      return (
        <div key={field.id}>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={val === "on"}
              onChange={(e) => setValue(field.id, e.target.checked ? "on" : "")}
              className="w-4 h-4 accent-primary rounded" />
            <span className={cn("font-medium text-foreground", isTypeform ? "text-base" : "text-xs")}>
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
          </label>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    // Textarea
    if (field.type === "textarea") {
      return (
        <div key={field.id}>
          {label}
          <textarea
            value={val}
            onChange={(e) => setValue(field.id, e.target.value)}
            placeholder={field.placeholder ?? ""}
            rows={isTypeform ? 4 : 3}
            className={cn(baseInput, "resize-none")}
            ref={isTypeform ? (typeformRef as React.Ref<HTMLTextAreaElement>) : undefined}
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      );
    }

    // Default: text, email, phone, number, date
    return (
      <div key={field.id}>
        {label}
        <input
          type={field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
          value={val}
          onChange={(e) => setValue(field.id, e.target.value)}
          placeholder={field.placeholder ?? ""}
          className={baseInput}
          ref={isTypeform ? (typeformRef as React.Ref<HTMLInputElement>) : undefined}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  function renderSuccess() {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {settings.success_message || "Obrigado!"}
          </p>
          {settings.redirect_url && (
            <p className="text-xs text-muted-foreground mt-2">
              Redirecionando para: <span className="font-mono">{settings.redirect_url}</span>
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground bg-muted rounded-[4px] px-3 py-1.5 border border-border">
          Simulação — nenhum dado foi enviado
        </p>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 mt-2">
          <RotateCcw className="w-3.5 h-3.5" /> Testar novamente
        </Button>
      </div>
    );
  }

  // ── Standard mode ──────────────────────────────────────────────────────────

  function renderStandard() {
    return (
      <div className="space-y-4">
        {visibleFields.map((f) => renderField(f))}
        <button type="button" onClick={handleSubmit}
          className="w-full py-2.5 rounded-[4px] text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors">
          {settings.submit_text || "Enviar"}
        </button>
      </div>
    );
  }

  // ── Paginated mode ─────────────────────────────────────────────────────────

  function renderPaginated() {
    const groups = fieldsByStep();
    const totalSteps = groups.length;
    const currentFields = groups[currentStep] ?? [];
    const isLast = currentStep === totalSteps - 1;
    const stepTitle = steps[currentStep]?.title;
    const progress = totalSteps > 1 ? ((currentStep + 1) / totalSteps) * 100 : 100;

    return (
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{stepTitle || `Etapa ${currentStep + 1}`}</span>
            <span>{currentStep + 1} / {totalSteps}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Fields for current step */}
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
          {currentFields.map((f) => renderField(f))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-2">
          {currentStep > 0 && (
            <Button variant="outline" size="sm" onClick={prevStep} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </Button>
          )}
          <Button size="sm" onClick={isLast ? handleSubmit : nextStep} className="gap-1.5 ml-auto">
            {isLast ? (settings.submit_text || "Enviar") : "Próximo"}
            {isLast ? <Send className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    );
  }

  // ── Typeform mode ──────────────────────────────────────────────────────────

  function renderTypeform() {
    if (typeformFields.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">Nenhum campo visível</p>;
    }

    const field = typeformFields[typeformIdx];
    const isLast = typeformIdx === typeformFields.length - 1;
    const progress = ((typeformIdx + 1) / typeformFields.length) * 100;

    return (
      <div className="flex flex-col h-full">
        {/* Dot progress */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {typeformFields.map((_, i) => (
            <div key={i} className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === typeformIdx ? "w-6 bg-primary" : i < typeformIdx ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted-foreground/20",
            )} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-6">
          <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }} />
        </div>

        {/* Single field — animated */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div
            key={typeformIdx}
            className={cn(
              "w-full max-w-sm animate-in fade-in duration-200",
              animDir === "forward" ? "slide-in-from-right-8" : "slide-in-from-left-8",
            )}
          >
            <div className="text-xs text-muted-foreground mb-3">
              {typeformIdx + 1} / {typeformFields.length}
            </div>
            {renderField(field, true)}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <Button variant="ghost" size="sm" onClick={typeformPrev} disabled={typeformIdx === 0} className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Pressione <kbd className="font-mono bg-muted px-1 py-0.5 rounded text-[9px] border border-border">Enter ↵</kbd> para avançar
          </p>
          <Button size="sm" onClick={isLast ? handleSubmit : typeformNext} className="gap-1.5">
            {isLast ? (settings.submit_text || "Enviar") : "OK"}
            {isLast ? <Send className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <FlaskConical className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Adicione campos ao formulário para testar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FlaskConical className="w-4 h-4 text-muted-foreground" />
          Teste interativo
        </div>

        <div className="flex items-center rounded-[4px] bg-muted p-0.5 gap-0.5 ml-2">
          <button onClick={() => setViewMode("desktop")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-[3px] transition-colors",
              viewMode === "desktop" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}>
            <Monitor className="w-3 h-3" /> Desktop
          </button>
          <button onClick={() => setViewMode("mobile")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-[3px] transition-colors",
              viewMode === "mobile" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}>
            <Smartphone className="w-3 h-3" /> Mobile
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleAutoFill} className="gap-1.5 h-[30px] text-xs rounded-[4px]">
            <Sparkles className="w-3 h-3" /> Preencher teste
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 h-[30px] text-xs rounded-[4px]">
            <RotateCcw className="w-3 h-3" /> Limpar
          </Button>
        </div>
      </div>

      {/* Mode badge */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Modo:
        </span>
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-[2px]",
          formMode === "standard" ? "bg-blue-500/10 text-blue-600" :
          formMode === "paginated" ? "bg-amber-500/10 text-amber-600" :
          "bg-purple-500/10 text-purple-600",
        )}>
          {formMode === "standard" ? "Padrão" : formMode === "paginated" ? "Paginado" : "Typeform"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {visibleFields.length} campo{visibleFields.length !== 1 ? "s" : ""} visíve{visibleFields.length !== 1 ? "is" : "l"}
        </span>
      </div>

      {/* Form container */}
      <div className="flex-1 flex items-start justify-center overflow-y-auto pb-4">
        <div className={cn(
          "bg-card border border-border rounded-[4px] transition-all duration-300",
          viewMode === "desktop"
            ? "w-full max-w-xl p-6"
            : "w-[375px] p-5 rounded-[20px] border-[3px] border-foreground/10",
          formMode === "typeform" && "min-h-[400px] flex flex-col",
        )}>
          {/* Mobile notch decoration */}
          {viewMode === "mobile" && (
            <div className="flex justify-center mb-4">
              <div className="w-24 h-5 bg-foreground/10 rounded-full" />
            </div>
          )}

          {submitted ? renderSuccess() : (
            formMode === "typeform" ? renderTypeform() :
            formMode === "paginated" ? renderPaginated() :
            renderStandard()
          )}
        </div>
      </div>
    </div>
  );
}
