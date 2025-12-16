import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  titleHebrew: string;
}

interface WizardProgressProps {
  steps: Step[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <nav aria-label="Wizard progress" className="flex justify-between">
      {steps.map((step, index) => {
        const isCurrent = index === currentStep;
        const isPast = index < currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              'flex flex-col items-center flex-1',
              index !== 0 && 'relative'
            )}
          >
            {/* Connector line */}
            {index !== 0 && (
              <div
                className={cn(
                  'absolute top-4 -left-1/2 w-full h-0.5',
                  isPast || isCurrent ? 'bg-primary' : 'bg-border'
                )}
                style={{ zIndex: -1 }}
              />
            )}

            {/* Step circle */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                isPast && !isCurrent && 'bg-primary text-primary-foreground',
                !isCurrent && !isPast && 'bg-muted text-muted-foreground'
              )}
            >
              {isPast && !isCurrent ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                index + 1
              )}
            </div>

            {/* Step title */}
            <div className="mt-2 text-center">
              <div
                className={cn(
                  'text-xs font-medium',
                  isCurrent && 'text-primary',
                  !isCurrent && 'text-muted-foreground'
                )}
              >
                {step.title}
              </div>
              <div
                className="text-xs text-muted-foreground hidden sm:block"
                dir="rtl"
              >
                {step.titleHebrew}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
