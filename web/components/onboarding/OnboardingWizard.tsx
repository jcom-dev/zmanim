import { useState, useEffect, useCallback } from 'react';
import { WizardProgress } from './WizardProgress';
import { WelcomeStep } from './steps/WelcomeStep';
import { CustomizeZmanimStep } from './steps/CustomizeZmanimStep';
import { CoverageSetupStep } from './steps/CoverageSetupStep';
import { ReviewPublishStep } from './steps/ReviewPublishStep';
import { useApi } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';
import type { CoverageSelection } from '@/components/shared/CoverageSelector';

// API response uses snake_case
interface OnboardingStateAPI {
  current_step?: number;
  completed_steps?: number[];
  data?: {
    customizations?: (ZmanCustomization | SelectedZmanCustomization)[];
    coverage?: CoverageSelection[];
  };
  started_at?: string;
  last_updated_at?: string;
  skipped?: boolean;
}

// Frontend uses camelCase
export interface OnboardingState {
  currentStep: number;
  completedSteps: number[];
  data: {
    customizations?: (ZmanCustomization | SelectedZmanCustomization)[];
    coverage?: CoverageSelection[];
  };
  startedAt: string;
  lastUpdatedAt: string;
}

// Convert API response to frontend format
function apiToState(api: OnboardingStateAPI | null, defaults: OnboardingState): OnboardingState {
  if (!api) return defaults;
  return {
    currentStep: api.current_step ?? defaults.currentStep,
    completedSteps: api.completed_steps ?? defaults.completedSteps,
    data: api.data ?? defaults.data,
    startedAt: api.started_at ?? defaults.startedAt,
    lastUpdatedAt: api.last_updated_at ?? defaults.lastUpdatedAt,
  };
}

// Convert frontend format to API format for saving
function stateToApi(state: OnboardingState): OnboardingStateAPI {
  return {
    current_step: state.currentStep,
    completed_steps: state.completedSteps,
    data: state.data,
    started_at: state.startedAt,
    last_updated_at: state.lastUpdatedAt,
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

export type { CoverageSelection } from '@/components/shared/CoverageSelector';

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
    completedSteps: [],
    data: {},
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const api = useApi();
  const { selectedPublisher, isLoading: publisherLoading } = usePublisherContext();

  const fetchOnboardingState = useCallback(async () => {
    // Don't fetch if no publisher selected yet
    if (!selectedPublisher?.id) {
      return;
    }

    try {
      const apiData = await api.get<OnboardingStateAPI | null>('/publisher/onboarding');
      // Convert API response (snake_case) to frontend format (camelCase)
      setState(prev => apiToState(apiData, prev));
    } catch (error) {
      console.error('Failed to fetch onboarding state:', error);
    } finally {
      setLoading(false);
    }
  }, [api, selectedPublisher?.id]);

  // Load saved state when publisher is available
  useEffect(() => {
    if (!publisherLoading && selectedPublisher?.id) {
      fetchOnboardingState();
    }
  }, [fetchOnboardingState, publisherLoading, selectedPublisher?.id]);

  const saveState = async (newState: OnboardingState) => {
    setState(newState);
    try {
      // Convert frontend format (camelCase) to API format (snake_case)
      await api.put('/publisher/onboarding', {
        body: JSON.stringify(stateToApi(newState)),
      });
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  };

  const goToStep = (step: number) => {
    const newState = {
      ...state,
      currentStep: step,
      lastUpdatedAt: new Date().toISOString(),
    };
    saveState(newState);
  };

  const updateData = (updates: Partial<OnboardingState['data']>) => {
    const newState = {
      ...state,
      data: { ...state.data, ...updates },
      lastUpdatedAt: new Date().toISOString(),
    };
    saveState(newState);
  };

  const markStepComplete = (step: number) => {
    if (!state.completedSteps.includes(step)) {
      const newState = {
        ...state,
        completedSteps: [...state.completedSteps, step],
        lastUpdatedAt: new Date().toISOString(),
      };
      saveState(newState);
    }
  };

  const handleNext = () => {
    markStepComplete(state.currentStep);
    if (state.currentStep < STEPS.length - 1) {
      goToStep(state.currentStep + 1);
    }
  };

  const handleBack = () => {
    if (state.currentStep > 0) {
      goToStep(state.currentStep - 1);
    }
  };

  const handleSkip = async () => {
    try {
      await api.post('/publisher/onboarding/skip');
      onSkip?.();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  };

  const handleComplete = async () => {
    try {
      await api.post('/publisher/onboarding/complete');
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

  // Show loading state while publisher context is loading or onboarding state is loading
  if (publisherLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
        currentStep={state.currentStep ?? 0}
        completedSteps={state.completedSteps ?? []}
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
