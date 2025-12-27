'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronRight, Lightbulb } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DSL_PRIMITIVES,
  DSL_FUNCTIONS,
  DSL_PROPORTIONAL_BASES,
  DSL_DIRECTIONS,
  DSL_OPERATORS,
  DSL_CONDITIONALS,
  DSL_CONDITION_VARIABLES,
  DSL_DATE_LITERALS,
  EXAMPLE_PATTERNS,
  createZmanimReferences,
  isTermInFormula,
  type ReferenceItem,
  type ExamplePattern,
} from '@/lib/dsl-reference-data';

interface DSLReferencePanelProps {
  onInsert: (text: string) => void;
  onSetFormula: (formula: string) => void;
  currentFormula: string;
  zmanimKeys: string[];
  className?: string;
}

interface CategoryProps {
  title: string;
  items: ReferenceItem[];
  currentFormula: string;
  onInsert: (text: string) => void;
  defaultOpen?: boolean;
  searchQuery: string;
}

function Category({
  title,
  items,
  currentFormula,
  onInsert,
  defaultOpen = false,
  searchQuery,
}: CategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.signature?.toLowerCase().includes(query) ?? false)
    );
  }, [items, searchQuery]);

  if (filteredItems.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full py-2 hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-90'
          )}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground/60">({filteredItems.length})</span>
      </button>

      {isOpen && (
        <div className="pl-1 space-y-1">
          {filteredItems.map((item) => {
            const inUse = isTermInFormula(item.name, currentFormula);
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => onInsert(item.snippet)}
                className={cn(
                  'flex items-start gap-3 w-full p-2.5 rounded-lg text-left transition-all',
                  'hover:bg-accent/50',
                  inUse && 'bg-primary/10 border border-primary/20'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    item.category === 'primitive' && 'bg-green-500',
                    item.category === 'function' && 'bg-blue-500',
                    item.category === 'operator' && 'bg-purple-500',
                    item.category === 'reference' && 'bg-pink-500'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {item.signature || item.name}
                    </span>
                    {inUse && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                        in use
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ExampleCardProps {
  example: ExamplePattern;
  onSelect: () => void;
}

function ExampleCard({ example, onSelect }: ExampleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full p-3 text-left rounded-lg border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
    >
      <code className="text-sm font-mono font-medium text-foreground">
        {example.formula}
      </code>
      <p className="text-xs text-muted-foreground mt-1">{example.description}</p>
    </button>
  );
}

export function DSLReferencePanel({
  onInsert,
  onSetFormula,
  currentFormula,
  zmanimKeys,
  className,
}: DSLReferencePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Create reference items from zmanim keys
  const zmanimReferences = useMemo(
    () => createZmanimReferences(zmanimKeys),
    [zmanimKeys]
  );

  // Handle example selection with confirmation
  const handleExampleSelect = (formula: string) => {
    if (currentFormula.trim() && currentFormula.trim() !== formula) {
      if (!window.confirm('Replace current formula with this example?')) {
        return;
      }
    }
    onSetFormula(formula);
  };

  // Filter examples based on search
  const filteredExamples = useMemo(() => {
    if (!searchQuery) return EXAMPLE_PATTERNS;
    const query = searchQuery.toLowerCase();
    return EXAMPLE_PATTERNS.filter(
      (ex) =>
        ex.formula.toLowerCase().includes(query) ||
        ex.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className={cn('flex flex-col h-full bg-muted/30', className)}>
      {/* Search Header */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search functions, primitives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Primitives */}
        <Category
          title="Primitives"
          count={DSL_PRIMITIVES.length}
          items={DSL_PRIMITIVES}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Functions */}
        <Category
          title="Functions"
          count={DSL_FUNCTIONS.length}
          items={DSL_FUNCTIONS}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Day Boundary Systems */}
        <Category
          title="Day Boundaries"
          count={DSL_PROPORTIONAL_BASES.length}
          items={DSL_PROPORTIONAL_BASES}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Solar Directions */}
        <Category
          title="Solar Directions"
          count={DSL_DIRECTIONS.length}
          items={DSL_DIRECTIONS}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Operators */}
        <Category
          title="Operators"
          count={DSL_OPERATORS.length}
          items={DSL_OPERATORS}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Conditionals */}
        <Category
          title="Conditionals"
          count={DSL_CONDITIONALS.length}
          items={DSL_CONDITIONALS}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Condition Variables */}
        <Category
          title="Condition Variables"
          count={DSL_CONDITION_VARIABLES.length}
          items={DSL_CONDITION_VARIABLES}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Date Literals */}
        <Category
          title="Date Literals"
          count={DSL_DATE_LITERALS.length}
          items={DSL_DATE_LITERALS}
          currentFormula={currentFormula}
          onInsert={onInsert}
          searchQuery={searchQuery}
        />

        {/* Zmanim References */}
        {zmanimReferences.length > 0 && (
          <Category
            title="Your Zmanim"
            count={zmanimReferences.length}
            items={zmanimReferences}
            currentFormula={currentFormula}
            onInsert={onInsert}
            searchQuery={searchQuery}
          />
        )}

        {/* Examples Section */}
        {filteredExamples.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Common Patterns</span>
            </div>
            <div className="space-y-2">
              {filteredExamples.map((example) => (
                <ExampleCard
                  key={example.formula}
                  example={example}
                  onSelect={() => handleExampleSelect(example.formula)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DSLReferencePanel;
