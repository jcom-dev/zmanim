'use client';
import { useApi } from '@/lib/api-client';

import { useState, useCallback } from 'react';
import { Code2, Wand2, AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FormulaBuilder } from '@/components/formula-builder';
import { DSLEditor } from './DSLEditor';
import { CalculationPreview } from '@/components/formula-builder/preview/CalculationPreview';
import { BilingualInput } from '@/components/shared/BilingualInput';
import { HalachicNotesEditor } from './HalachicNotesEditor';

type EditorMode = 'guided' | 'advanced';

interface ZmanDefinition {
  key: string;
  nameHebrew: string;
  nameEnglish: string;
  transliteration?: string;
  formula: string;
  halachicNotes?: string;
}

interface FormulaEditorPageProps {
  initialZman?: ZmanDefinition;
  zmanimKeys?: string[];
  latitude?: number;
  longitude?: number;
  locationName?: string;
  onSave?: (zman: ZmanDefinition) => Promise<void>;
  className?: string;
}

export function FormulaEditorPage({
  initialZman,
  zmanimKeys = [],
  latitude,
  longitude,
  locationName,
  onSave,
  className,
}: FormulaEditorPageProps) {
  const api = useApi();
  const [mode, setMode] = useState<EditorMode>('guided');
  const [showModeWarning, setShowModeWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [key] = useState(initialZman?.key || '');
  const [nameHebrew, setNameHebrew] = useState(initialZman?.nameHebrew || '');
  const [nameEnglish, setNameEnglish] = useState(initialZman?.nameEnglish || '');
  const [transliteration, setTransliteration] = useState(initialZman?.transliteration || '');
  const [formula, setFormula] = useState(initialZman?.formula || 'sunrise');
  const [halachicNotes, setHalachicNotes] = useState(initialZman?.halachicNotes || '');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Handle mode toggle
  const handleModeToggle = useCallback((newMode: EditorMode) => {
    if (newMode === mode) return;

    // Check if switching from advanced to guided might lose data
    if (mode === 'advanced' && newMode === 'guided') {
      // Check for complex formulas that can't be represented in guided mode
      const complexPatterns = ['if', 'else', 'midpoint', 'custom('];
      const hasComplexFormula = complexPatterns.some((p) => formula.toLowerCase().includes(p));

      if (hasComplexFormula) {
        setPendingMode(newMode);
        setShowModeWarning(true);
        return;
      }
    }

    setMode(newMode);
  }, [mode, formula]);

  const confirmModeSwitch = useCallback(() => {
    if (pendingMode) {
      setMode(pendingMode);
      setPendingMode(null);
    }
    setShowModeWarning(false);
  }, [pendingMode]);

  // Validate formula via API
  const validateFormula = useCallback(async (formulaText: string) => {
    try {
      const data = await api.public.post<{ valid: boolean; errors: Array<{ message: string }> }>('/dsl/validate', {
        body: JSON.stringify({ formula: formulaText }),
      });
      return {
        valid: data?.valid ?? true,
        errors: data?.errors || [],
      };
    } catch {
      return { valid: false, errors: [{ message: 'Validation service unavailable' }] };
    }
  }, [api]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!nameHebrew) errors.name_hebrew = 'Hebrew name is required';
    if (!nameEnglish) errors.name_english = 'English name is required';
    if (!key) errors.key = 'Key is required';

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        key,
        nameHebrew,
        nameEnglish,
        transliteration,
        formula,
        halachicNotes,
      });
    } finally {
      setSaving(false);
    }
  }, [onSave, key, nameHebrew, nameEnglish, transliteration, formula, halachicNotes]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {initialZman ? 'Edit Zman Definition' : 'New Zman Definition'}
        </h1>
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant={mode === 'guided' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleModeToggle('guided')}
          >
            <Wand2 className="h-4 w-4 mr-1" />
            Guided
          </Button>
          <Button
            variant={mode === 'advanced' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleModeToggle('advanced')}
          >
            <Code2 className="h-4 w-4 mr-1" />
            Advanced
          </Button>
        </div>
      </div>

      {/* Bilingual naming section */}
      <div className="rounded-lg border p-4">
        <BilingualInput
          nameHebrew={nameHebrew}
          nameEnglish={nameEnglish}
          transliteration={transliteration}
          onHebrewChange={setNameHebrew}
          onEnglishChange={setNameEnglish}
          onTransliterationChange={setTransliteration}
          errors={validationErrors}
        />
      </div>

      {/* Formula editor section */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Editor panel */}
          <div className="flex-1">
            {mode === 'guided' ? (
              <FormulaBuilder
                initialFormula={formula}
                onChange={setFormula}
              />
            ) : (
              <DSLEditor
                value={formula}
                onChange={setFormula}
                onValidate={validateFormula}
                zmanimKeys={zmanimKeys}
              />
            )}
          </div>

          {/* Preview panel (for advanced mode) */}
          {mode === 'advanced' && (
            <div className="lg:w-80">
              <CalculationPreview
                formula={formula}
                isValid={true} // Basic check
                latitude={latitude}
                longitude={longitude}
                locationName={locationName}
              />
            </div>
          )}
        </div>
      </div>

      {/* Halachic notes section */}
      <div className="rounded-lg border p-4">
        <HalachicNotesEditor
          value={halachicNotes}
          onChange={setHalachicNotes}
        />
      </div>

      {/* Save button */}
      {onSave && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Zman'}
          </Button>
        </div>
      )}

      {/* Mode switch warning dialog */}
      {showModeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Switch to Guided Mode?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your formula contains advanced features (conditionals, midpoint, custom references)
                  that cannot be represented in Guided Mode. Some settings may be lost.
                </p>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setShowModeWarning(false)}>
                    Cancel
                  </Button>
                  <Button onClick={confirmModeSwitch}>
                    Switch Anyway
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormulaEditorPage;
