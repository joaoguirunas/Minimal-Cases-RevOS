import * as React from 'react';
import { cn } from '@/lib/utils';
import { Layers, ListChecks, Target, Users, Check } from 'lucide-react';

interface Step {
  id: number;
  name: string;
  icon: React.ElementType;
  description: string;
}

const steps: Step[] = [
  { id: 1, name: 'Pipeline', icon: Layers, description: 'Selecione o pipeline' },
  { id: 2, name: 'Etapas', icon: ListChecks, description: 'Escolha as etapas' },
  { id: 3, name: 'Lead', icon: Target, description: 'Filtros de negócio' },
  { id: 4, name: 'Pessoa', icon: Users, description: 'Filtros detalhados' }
];

interface FilterWizardStepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (stepId: number) => void;
}

export default function FilterWizardStepper({ 
  currentStep, 
  completedSteps,
  onStepClick 
}: FilterWizardStepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = completedSteps.includes(step.id);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => onStepClick(step.id)}
                disabled={!isCompleted && currentStep < step.id}
                className={cn(
                  'flex flex-col items-center gap-2 transition-all duration-200 group',
                  (isCompleted || currentStep >= step.id) && 'cursor-pointer',
                  (!isCompleted && currentStep < step.id) && 'cursor-not-allowed opacity-40'
                )}
              >
                {/* Círculo */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-200',
                    isActive && 'border-foreground bg-foreground',
                    isCompleted && !isActive && 'border-muted-foreground bg-muted-foreground',
                    !isActive && !isCompleted && 'border-border bg-card'
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className={cn(
                      'w-5 h-5 transition-colors',
                      isActive && 'text-primary-foreground',
                      isCompleted && 'text-primary-foreground',
                      !isActive && !isCompleted && 'text-muted-foreground'
                    )} />
                  )}
                </div>

                {/* Texto */}
                <div className="text-center">
                  <div className={cn(
                    'text-[13px] font-medium',
                    isActive && 'text-foreground',
                    isCompleted && !isActive && 'text-foreground',
                    !isActive && !isCompleted && 'text-muted-foreground'
                  )}>
                    {step.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1">
                    {step.description}
                  </div>
                </div>
              </button>

              {/* Linha conectora */}
              {idx < steps.length - 1 && (
                <div className="flex-1 h-[1px] mx-4 relative">
                  <div className="absolute inset-0 bg-border" />
                  <div
                    className={cn(
                      'absolute inset-0 transition-all duration-300',
                      completedSteps.includes(step.id) && 'bg-muted-foreground'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
