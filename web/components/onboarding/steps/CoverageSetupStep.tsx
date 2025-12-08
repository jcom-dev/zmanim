import { Button } from '@/components/ui/button';
import type { LocationSelection } from '@/types/geography';
import { CoverageSearchPanel } from '@/components/shared/CoverageSearchPanel';
import type { OnboardingState } from '../OnboardingWizard';
import { MapPin, Globe, Map as MapIcon, Globe2, Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoverageSetupStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState['data']>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function CoverageSetupStep({ state, onUpdate, onNext, onBack }: CoverageSetupStepProps) {
  const currentCoverage = state.data.coverage || [];

  const handleAdd = (items: LocationSelection[]) => {
    const newItems = [...currentCoverage, ...items];
    onUpdate({ coverage: newItems });
  };

  const handleRemove = (item: LocationSelection) => {
    const newItems = currentCoverage.filter(
      (c) => !(c.type === item.type && c.id === item.id)
    );
    onUpdate({ coverage: newItems });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Set Your Coverage</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose where your zmanim will be available. Add countries, regions, or specific cities.
        </p>
      </div>

      {/* Display current coverage */}
      {currentCoverage.length > 0 && (
        <div className="space-y-3 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Current Coverage ({currentCoverage.length}):
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentCoverage.map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                  getTypeBadgeColor(item.type)
                )}
              >
                {getTypeIcon(item.type)}
                {item.name}
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  className="hover:opacity-70 transition-opacity ml-0.5"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <CoverageSearchPanel
        onAdd={handleAdd}
        existingCoverage={currentCoverage}
        showQuickSelect={true}
      />

      {/* Note about adding more */}
      <p className="text-sm text-muted-foreground text-center">
        You can add more coverage areas from your dashboard at any time.
      </p>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={currentCoverage.length === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// Helper functions
function getTypeIcon(type: LocationSelection['type']) {
  switch (type) {
    case 'continent': return <Globe2 className="w-4 h-4" />;
    case 'country': return <Globe className="w-4 h-4" />;
    case 'region': return <MapIcon className="w-4 h-4" />;
    case 'district': return <Layers className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4" />;
  }
}

function getTypeBadgeColor(type: LocationSelection['type']) {
  switch (type) {
    case 'continent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'country': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'region': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'district': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default: return 'bg-primary/10 text-primary';
  }
}
