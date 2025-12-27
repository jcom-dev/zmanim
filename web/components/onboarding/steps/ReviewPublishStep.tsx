import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OnboardingState, ZmanCustomization, SelectedZmanCustomization } from '../OnboardingWizard';

interface ReviewPublishStepProps {
  state: OnboardingState;
  onBack: () => void;
  onComplete: () => void;
  onDismiss?: () => void;
}

// Helper to get zman key/name regardless of format
function getZmanKey(z: ZmanCustomization | SelectedZmanCustomization): string {
  return 'key' in z ? z.key : z.zman_key;
}

function getZmanEnglishName(z: ZmanCustomization | SelectedZmanCustomization): string {
  return 'nameEnglish' in z ? z.nameEnglish : z.english_name;
}

function isZmanModified(z: ZmanCustomization | SelectedZmanCustomization): boolean {
  return z.modified;
}

function isZmanEnabled(z: ZmanCustomization | SelectedZmanCustomization): boolean {
  if ('enabled' in z) return z.enabled;
  return true;
}

export function ReviewPublishStep({ state, onBack, onComplete, onDismiss }: ReviewPublishStepProps) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const customizations = state.data.customizations || [];
  const coverage = state.data.coverage || [];

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onComplete();
      setPublished(true);
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  if (published) {
    return (
      <div className="text-center space-y-6 py-8">
        {/* Success animation */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce">
            <CheckIcon className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Setup Complete!</h2>
          <p className="text-lg text-muted-foreground">
            Your zmanim have been saved as drafts.
          </p>
          <p className="text-muted-foreground" dir="rtl">
            מזל טוב! הזמנים שלך נשמרו כטיוטות
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-w-md mx-auto">
          <h3 className="font-medium mb-2 text-amber-800 dark:text-amber-200">Important: Publish Your Zmanim</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            Your zmanim are currently in draft mode and not visible to users.
            Go to the Algorithm Editor to publish individual zmanim when you&apos;re ready.
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4 max-w-md mx-auto">
          <h3 className="font-medium mb-2">What&apos;s next?</h3>
          <ul className="text-sm text-muted-foreground text-left space-y-1">
            <li>• <strong>Publish zmanim</strong> from the Algorithm Editor</li>
            <li>• Add more zmanim to your algorithm</li>
            <li>• Expand your coverage to more localities</li>
            <li>• Customize names and descriptions</li>
          </ul>
        </div>

        <Button
          size="lg"
          onClick={() => {
            onDismiss?.();
            window.location.href = '/publisher/algorithm';
          }}
        >
          Go to Algorithm Editor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Review & Finish</h2>
        <p className="text-muted-foreground">
          Review your settings before completing setup.
        </p>
      </div>

      {/* Summary sections */}
      <div className="space-y-4">
        {/* Zmanim */}
        <SummarySection title="Zmanim">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {customizations.filter(isZmanEnabled).slice(0, 6).map((z) => (
              <div key={getZmanKey(z)} className="flex justify-between">
                <span>{getZmanEnglishName(z)}</span>
                {isZmanModified(z) && (
                  <span className="text-xs text-amber-600">(customized)</span>
                )}
              </div>
            ))}
            {customizations.filter(isZmanEnabled).length > 6 && (
              <div className="text-muted-foreground">
                +{customizations.filter(isZmanEnabled).length - 6} more
              </div>
            )}
          </div>
        </SummarySection>

        {/* Coverage */}
        <SummarySection title="Coverage">
          <div className="flex flex-wrap gap-2">
            {coverage.map((c) => (
              <span
                key={c.id}
                className="px-2 py-1 text-sm bg-muted rounded"
              >
                {c.name}
              </span>
            ))}
          </div>
        </SummarySection>
      </div>

      {/* Preview note */}
      <div className="bg-primary/10 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-2">
          <InfoIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">
              Ready to finish setup?
            </p>
            <p className="text-muted-foreground">
              Your zmanim will be saved but not published yet. You can preview and publish
              individual times from your Algorithm Editor whenever you&apos;re ready.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handlePublish}
          disabled={publishing}
          className="px-8 bg-green-600 hover:bg-green-700"
        >
          {publishing ? (
            <>
              <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              Finishing...
            </>
          ) : (
            <>
              <CheckIcon className="mr-2 h-4 w-4" />
              Finish Setup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

