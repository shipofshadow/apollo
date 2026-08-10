import React from 'react';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number;
  maxReachedStep: number;
  onStepClick: (step: number) => void;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Customer', shortName: 'Customer' },
  { id: 2, title: 'Vehicle', shortName: 'Vehicle' },
  { id: 3, title: 'Service & Model', shortName: 'Service' },
  { id: 4, title: 'Technician', shortName: 'Tech' },
  { id: 5, title: 'Before Checklist', shortName: 'Before' },
  { id: 6, title: 'After Checklist', shortName: 'After' },
  { id: 7, title: 'Sign & Submit', shortName: 'Submit' },
];

export default function WizardProgress({ currentStep, maxReachedStep, onStepClick }: Props) {
  const activeStepObj = WIZARD_STEPS.find(s => s.id === currentStep) || WIZARD_STEPS[0];
  const progressPercent = Math.round((currentStep / WIZARD_STEPS.length) * 100);

  return (
    <div className="w-full space-y-4 no-print font-sans">
      {/* Mobile Compact Progress Indicator */}
      <div className="block lg:hidden bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-lg space-y-2">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-brand-orange font-bold uppercase tracking-wider">
            STEP {currentStep} OF {WIZARD_STEPS.length}
          </span>
          <span className="text-gray-300 font-bold">{activeStepObj.title}</span>
        </div>
        <div className="w-full h-2 bg-brand-darker border border-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-orange to-amber-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Desktop Horizontal Stepper */}
      <div className="hidden lg:block bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between relative">
          {WIZARD_STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const isClickable = step.id <= maxReachedStep;

            return (
              <React.Fragment key={step.id}>
                {/* Step Node */}
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(step.id)}
                  className={`flex flex-col items-center gap-1.5 group transition-all ${
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all shadow-md ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                        : isCurrent
                        ? 'bg-brand-orange text-white ring-4 ring-brand-orange/20 shadow-brand-orange/30 scale-105'
                        : 'bg-brand-darker border border-gray-800 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider text-center ${
                      isCurrent
                        ? 'text-brand-orange'
                        : isCompleted
                        ? 'text-gray-300'
                        : 'text-gray-600'
                    }`}
                  >
                    {step.shortName}
                  </span>
                </button>

                {/* Connecting Line */}
                {idx < WIZARD_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                      step.id < currentStep ? 'bg-emerald-500/80' : 'bg-gray-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
