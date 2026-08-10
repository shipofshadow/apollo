import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  currentStep: number;
  totalSteps?: number;
  canContinue: boolean;
  isSubmitting?: boolean;
  onBack: () => void;
  onContinue: () => void;
  continueText?: string;
}

export default function WizardNavigation({
  currentStep,
  canContinue,
  isSubmitting = false,
  onBack,
  onContinue,
  continueText = 'Continue',
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-800/80 no-print">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-5 py-3 rounded-xl border border-gray-800 bg-brand-darker hover:border-gray-700 text-gray-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4 text-brand-orange" />
          <span>Back</span>
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || isSubmitting}
        className="px-8 py-3.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing…</span>
          </>
        ) : (
          <>
            <span>{continueText}</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
