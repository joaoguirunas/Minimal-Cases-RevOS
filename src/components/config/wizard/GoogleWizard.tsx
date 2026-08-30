import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CalendarConnectionHealth } from "@/hooks/useCalendarConnectionsHealth";
import WizardStepper, { WizardStep, StepStatus } from "./WizardStepper";
import Step1Project from "./steps/Step1Project";
import Step2EnableApi from "./steps/Step2EnableApi";
import Step3Consent from "./steps/Step3Consent";
import Step4Credentials from "./steps/Step4Credentials";
import Step5Connect from "./steps/Step5Connect";
import GoogleSuccessView from "./GoogleSuccessView";

const STEP_LABELS = ['Projeto Google', 'Habilitar API', 'Consentimento', 'Credenciais', 'Conectar'];
const TOTAL_STEPS = 5;

export type WizardState = 'unconfigured' | 'returning' | 'configured' | 'healthy' | 'error';

interface GoogleWizardProps {
  wizardState: WizardState;
  isIdSaved: boolean;
  isSecretSaved: boolean;
  connections: CalendarConnectionHealth[];
  onDisconnectAll: () => void;
}

function getStorageKey(tenantId: string | undefined): string {
  return `gcal-wizard-step-${tenantId ?? 'default'}`;
}

function getInitialStep(
  wizardState: WizardState,
  isIdSaved: boolean,
  isSecretSaved: boolean,
  savedStep: number | null
): number {
  if (wizardState === 'configured' || wizardState === 'error') return 4;
  if (wizardState === 'returning') return 3;
  if (savedStep !== null) return savedStep;
  return 0; // step 1
}

export default function GoogleWizard({
  wizardState,
  isIdSaved,
  isSecretSaved,
  connections,
  onDisconnectAll,
}: GoogleWizardProps) {
  const { currentTenantId } = useAuth();
  const storageKey = getStorageKey(currentTenantId);

  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    const savedNum = saved && saved !== 'done' ? parseInt(saved, 10) : null;
    return getInitialStep(wizardState, isIdSaved, isSecretSaved, Number.isFinite(savedNum) ? savedNum : null);
  });

  const [maxReached, setMaxReached] = useState<number>(currentStep);
  const [announcement, setAnnouncement] = useState<string>('');

  // Persist step to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, String(currentStep));
  }, [currentStep, storageKey]);

  const goToStep = useCallback((step: number) => {
    setAnnouncement(`Avançando para Step ${step + 1}: ${STEP_LABELS[step]}`);
    setCurrentStep(step);
    if (step > maxReached) setMaxReached(step);
  }, [maxReached]);

  const handleNext = useCallback(() => {
    const next = Math.min(currentStep + 1, TOTAL_STEPS - 1);
    goToStep(next);
  }, [currentStep, goToStep]);

  const handleFinish = useCallback(() => {
    localStorage.setItem(storageKey, 'done');
  }, [storageKey]);

  const handleReset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStep(0);
    setMaxReached(0);
    setAnnouncement('Wizard reiniciado. Step 1: Projeto Google.');
  }, [storageKey]);

  const handleAddAccount = useCallback(() => goToStep(4), [goToStep]);
  const handleReconfigure = useCallback(() => goToStep(3), [goToStep]);

  if (wizardState === 'healthy') {
    return (
      <div className="space-y-4">
        <GoogleSuccessView
          connections={connections}
          onAddAccount={handleAddAccount}
          onReconfigure={handleReconfigure}
          onDisconnectAll={onDisconnectAll}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-[28px] text-[11px] text-muted-foreground gap-1.5 rounded-[4px]"
            onClick={handleReset}
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            Reiniciar wizard
          </Button>
        </div>
      </div>
    );
  }

  const stepStatuses: StepStatus[] = STEP_LABELS.map((_, i) => {
    if (i < currentStep) return 'done';
    if (i === currentStep) return 'current';
    return 'disabled';
  });

  const wizardSteps: WizardStep[] = STEP_LABELS.map((label, i) => ({
    id: String(i),
    label,
    status: stepStatuses[i],
  }));

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="border border-border rounded-[4px] bg-card px-4 py-3">
        <WizardStepper
          steps={wizardSteps}
          onStepClick={goToStep}
          announcement={announcement}
        />
      </div>

      {/* Active step */}
      {currentStep === 0 && (
        <Step1Project isFocused={true} onNext={handleNext} />
      )}
      {currentStep === 1 && (
        <Step2EnableApi isFocused={true} onNext={handleNext} />
      )}
      {currentStep === 2 && (
        <Step3Consent isFocused={true} onNext={handleNext} />
      )}
      {currentStep === 3 && (
        <Step4Credentials isFocused={true} onNext={handleNext} />
      )}
      {currentStep === 4 && (
        <Step5Connect
          isFocused={true}
          connections={connections}
          onFinish={handleFinish}
          onSkip={handleFinish}
        />
      )}

      {/* Reset */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-[28px] text-[11px] text-muted-foreground gap-1.5 rounded-[4px]"
          onClick={handleReset}
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          Reiniciar wizard
        </Button>
      </div>
    </div>
  );
}
