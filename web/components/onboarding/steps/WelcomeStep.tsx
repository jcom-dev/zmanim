import { Button } from '@/components/ui/button';
import type { OnboardingState } from '../OnboardingWizard';

interface WelcomeStepProps {
  state: OnboardingState;
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div className="text-center space-y-8 py-8">
      {/* Welcome illustration */}
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-full bg-linear-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 flex items-center justify-center">
          <SunriseIcon className="w-12 h-12 text-amber-600" />
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to Shtetl Zmanim
        </h1>
        <p className="text-xl text-muted-foreground" dir="rtl">
          ברוכים הבאים לזמנים לאב
        </p>
      </div>

      {/* Description */}
      <div className="max-w-md mx-auto space-y-4">
        <p className="text-muted-foreground">
          This wizard will help you set up your first zmanim algorithm in just a few minutes.
        </p>
        <p className="text-muted-foreground">
          You&apos;ll select your zmanim, customize key times, and set your coverage area.
        </p>
      </div>

      {/* Features list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
        <FeatureCard
          icon={<EditIcon />}
          title="Select & Customize"
          description="Choose zmanim and adjust times to match your minhag"
        />
        <FeatureCard
          icon={<MapIcon />}
          title="Set Coverage"
          description="Define where your times appear"
        />
      </div>

      {/* Time estimate */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <ClockIcon className="w-4 h-4" />
        <span>Estimated time: 5-10 minutes</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <Button size="lg" onClick={onNext} className="px-8">
          Get Started
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="ghost" size="lg" onClick={onSkip}>
          Skip wizard (I know what I&apos;m doing)
        </Button>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted text-center">
      <div className="flex justify-center mb-2 text-primary">{icon}</div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  );
}

// Icon components
function SunriseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v2M12 18v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/>
      <path d="M9 3v15"/>
      <path d="M15 6v15"/>
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}
