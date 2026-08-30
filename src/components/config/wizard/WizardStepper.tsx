import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = 'done' | 'current' | 'disabled';

export interface WizardStep {
  id: string;
  label: string;
  status: StepStatus;
}

interface WizardStepperProps {
  steps: WizardStep[];
  onStepClick: (index: number) => void;
  announcement?: string;
}

export default function WizardStepper({ steps, onStepClick, announcement }: WizardStepperProps) {
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <nav aria-label="Progresso de configuração">
        <ol role="list" className="flex items-center">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                aria-current={step.status === 'current' ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${step.label}${step.status === 'done' ? ' (concluído)' : ''}`}
                disabled={step.status === 'disabled'}
                onClick={() => step.status === 'done' && onStepClick(i)}
                className={cn(
                  "flex flex-col items-center gap-1.5 group focus:outline-none",
                  step.status === 'disabled' && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors",
                    step.status === 'done' && "bg-emerald-500 text-white",
                    step.status === 'current' && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    step.status === 'disabled' && "bg-muted text-muted-foreground"
                  )}
                >
                  {step.status === 'done'
                    ? <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    : i + 1}
                </span>
                <span className={cn(
                  "text-[10px] leading-tight text-center hidden sm:block max-w-[60px]",
                  step.status === 'current' ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </button>

              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex-1 h-px mx-2 mb-4",
                    steps[i].status === 'done' ? "bg-emerald-500" : "bg-border"
                  )}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
