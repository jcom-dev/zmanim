import { useState } from 'react';
import { WizardProgress } from './WizardProgress';
import { WelcomeStep } from './steps/WelcomeStep';
import { CustomizeZmanimStep } from './steps/CustomizeZmanimStep';
import { CoverageSetupStep } from './steps/CoverageSetupStep';
import { ReviewPublishStep } from './steps/ReviewPublishStep';
import { useApi } from '@/lib/api-client';
import type { LocalitySelection } from '@/types/geography';

// Wizard state (in-memory only, no persistence)
export interface OnboardingState {
  currentStep: number;
  data: {
    customizations?: (ZmanCustomization | SelectedZmanCustomization)[];
    coverage?: LocalitySelection[];
  };
}

export interface ZmanCustomization {
  key: string;
  nameHebrew: string;
  nameEnglish: string;
  formula: string;
  modified: boolean;
}

export interface SelectedZmanCustomization {
  master_zman_id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula: string;
  category: 'everyday' | 'event';
  time_category: string;
  event_category?: string;
  enabled: boolean;
  modified: boolean;
}


interface StepDefinition {
  id: string;
  title: string;
  titleHebrew: string;
}

const STEPS: StepDefinition[] = [
  { id: 'welcome', title: 'Welcome', titleHebrew: 'ברוכים הבאים' },
  { id: 'customize', title: 'Customize Zmanim', titleHebrew: 'התאם זמנים' },
  { id: 'coverage', title: 'Set Coverage', titleHebrew: 'הגדר כיסוי' },
  { id: 'review', title: 'Review & Publish', titleHebrew: 'בדוק ופרסם' },
];

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    data: {},
  });
  const api = useApi();

  const goToStep = (step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const updateData = (updates: Partial<OnboardingState['data']>) => {
    setState(prev => ({ ...prev, data: { ...prev.data, ...updates } }));
  };

  const handleNext = () => {
    if (state.currentStep < STEPS.length - 1) {
      goToStep(state.currentStep + 1);
    }
  };

  const handleBack = () => {
    if (state.currentStep > 0) {
      goToStep(state.currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const handleComplete = async () => {
    try {
      // Send the wizard state (customizations and coverage) to complete onboarding
      await api.post('/publisher/onboarding/complete', {
        body: JSON.stringify({
          customizations: state.data.customizations || [],
          coverage: state.data.coverage || [],
        }),
      });
      // Don't call onComplete here - let the ReviewPublishStep show the success screen
      // The user will click "Go to Dashboard" to navigate away
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error; // Re-throw so ReviewPublishStep knows it failed
    }
  };

  // Called when user clicks "Go to Dashboard" after seeing success screen
  const handleDismissWizard = () => {
    onComplete?.();
  };

  const stepProps = {
    state,
    onUpdate: updateData,
    onNext: handleNext,
    onBack: handleBack,
    onSkip: handleSkip,
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <WizardProgress
        steps={STEPS}
        currentStep={state.currentStep}
      />

      <div className="mt-8 bg-card rounded-lg shadow-lg p-6 min-h-[400px]">
        {state.currentStep === 0 && <WelcomeStep {...stepProps} />}
        {state.currentStep === 1 && <CustomizeZmanimStep {...stepProps} />}
        {state.currentStep === 2 && <CoverageSetupStep {...stepProps} />}
        {state.currentStep === 3 && (
          <ReviewPublishStep {...stepProps} onComplete={handleComplete} onDismiss={handleDismissWizard} />
        )}
      </div>
    </div>
  );
}
