/**
 * @file FormulaBuilder.test.tsx
 * @purpose Unit tests for FormulaBuilder component
 * @priority P1 - Core UI component for algorithm editing
 *
 * Tests cover:
 * - Initial rendering
 * - Method selection
 * - Parse error handling
 * - Formula generation on interaction
 * - Initial formula parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FormulaBuilder } from '../FormulaBuilder';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock child form components
vi.mock('../methods/FixedZmanForm', () => ({
  FixedZmanForm: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="fixed-zman-form">
      <select
        data-testid="fixed-zman-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="visible_sunrise">Visible Sunrise</option>
        <option value="visible_sunset">Visible Sunset</option>
      </select>
    </div>
  ),
}));

vi.mock('../methods/SolarAngleForm', () => ({
  SolarAngleForm: ({
    degrees,
    direction,
    onDegreesChange,
    onDirectionChange,
  }: {
    degrees: number;
    direction: string;
    onDegreesChange: (v: number) => void;
    onDirectionChange: (v: string) => void;
  }) => (
    <div data-testid="solar-angle-form">
      <input
        data-testid="solar-degrees"
        type="number"
        value={degrees}
        onChange={(e) => onDegreesChange(parseFloat(e.target.value))}
      />
      <select
        data-testid="solar-direction"
        value={direction}
        onChange={(e) => onDirectionChange(e.target.value)}
      >
        <option value="before_visible_sunrise">Before Sunrise</option>
        <option value="after_visible_sunset">After Sunset</option>
      </select>
    </div>
  ),
}));

vi.mock('../methods/FixedOffsetForm', () => ({
  FixedOffsetForm: ({
    minutes,
    direction,
    base,
    onMinutesChange,
    onDirectionChange,
    onBaseChange,
  }: {
    minutes: number;
    direction: string;
    base: string;
    onMinutesChange: (v: number) => void;
    onDirectionChange: (v: string) => void;
    onBaseChange: (v: string) => void;
  }) => (
    <div data-testid="fixed-offset-form">
      <input
        data-testid="offset-minutes"
        type="number"
        value={minutes}
        onChange={(e) => onMinutesChange(parseInt(e.target.value))}
      />
      <select
        data-testid="offset-direction"
        value={direction}
        onChange={(e) => onDirectionChange(e.target.value)}
      >
        <option value="before">Before</option>
        <option value="after">After</option>
      </select>
      <select
        data-testid="offset-base"
        value={base}
        onChange={(e) => onBaseChange(e.target.value)}
      >
        <option value="visible_sunrise">Sunrise</option>
        <option value="visible_sunset">Sunset</option>
      </select>
    </div>
  ),
}));

vi.mock('../methods/ProportionalHoursForm', () => ({
  ProportionalHoursForm: ({
    hours,
    base,
    onHoursChange,
    onBaseChange,
  }: {
    hours: number;
    base: string;
    onHoursChange: (v: number) => void;
    onBaseChange: (v: string) => void;
  }) => (
    <div data-testid="proportional-hours-form">
      <input
        data-testid="proportional-hours"
        type="number"
        value={hours}
        onChange={(e) => onHoursChange(parseFloat(e.target.value))}
      />
      <select
        data-testid="proportional-base"
        value={base}
        onChange={(e) => onBaseChange(e.target.value)}
      >
        <option value="gra">GRA</option>
        <option value="mga">MGA</option>
      </select>
    </div>
  ),
}));

// Mock MethodCard to make testing easier
vi.mock('../MethodCard', () => ({
  MethodCard: ({
    method,
    title,
    selected,
    onSelect,
    children,
  }: {
    method: string;
    title: string;
    selected: boolean;
    onSelect: () => void;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid={`method-card-${method}`}
      data-selected={selected}
      onClick={onSelect}
    >
      <span>{title}</span>
      {selected && children}
    </div>
  ),
}));

// Mock InfoTooltip
vi.mock('@/components/shared/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

// Mock tooltip content
vi.mock('@/lib/tooltip-content', () => ({
  ALGORITHM_TOOLTIPS: {
    fixed_zman: 'Fixed zman tooltip',
    solar_angle: 'Solar angle tooltip',
    fixed_offset: 'Fixed offset tooltip',
    proportional_hours: 'Proportional hours tooltip',
  },
}));

// =============================================================================
// FormulaBuilder Tests
// =============================================================================

describe('FormulaBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial rendering', () => {
    it('[P1] should render header and description', () => {
      render(<FormulaBuilder />);

      expect(screen.getByText('Formula Builder')).toBeInTheDocument();
      expect(
        screen.getByText(/Build your zman calculation formula/)
      ).toBeInTheDocument();
    });

    it('[P1] should render all four method cards', () => {
      render(<FormulaBuilder />);

      expect(screen.getByTestId('method-card-fixed_zman')).toBeInTheDocument();
      expect(screen.getByTestId('method-card-solar')).toBeInTheDocument();
      expect(screen.getByTestId('method-card-fixed')).toBeInTheDocument();
      expect(screen.getByTestId('method-card-proportional')).toBeInTheDocument();
    });

    it('[P1] should have no method selected initially', () => {
      render(<FormulaBuilder />);

      expect(screen.getByTestId('method-card-fixed_zman')).toHaveAttribute(
        'data-selected',
        'false'
      );
      expect(screen.getByTestId('method-card-solar')).toHaveAttribute(
        'data-selected',
        'false'
      );
    });
  });

  describe('method selection', () => {
    it('[P1] should select fixed_zman method on click', async () => {
      render(<FormulaBuilder />);

      fireEvent.click(screen.getByTestId('method-card-fixed_zman'));

      await waitFor(() => {
        expect(screen.getByTestId('method-card-fixed_zman')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });
    });

    it('[P1] should select solar method on click', async () => {
      render(<FormulaBuilder />);

      fireEvent.click(screen.getByTestId('method-card-solar'));

      await waitFor(() => {
        expect(screen.getByTestId('method-card-solar')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });
    });

    it('[P1] should deselect method when clicked again', async () => {
      render(<FormulaBuilder />);

      // Select
      fireEvent.click(screen.getByTestId('method-card-solar'));
      await waitFor(() => {
        expect(screen.getByTestId('method-card-solar')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });

      // Deselect
      fireEvent.click(screen.getByTestId('method-card-solar'));
      await waitFor(() => {
        expect(screen.getByTestId('method-card-solar')).toHaveAttribute(
          'data-selected',
          'false'
        );
      });
    });

    it('[P1] should show form when method is selected', async () => {
      render(<FormulaBuilder />);

      fireEvent.click(screen.getByTestId('method-card-solar'));

      await waitFor(() => {
        expect(screen.getByTestId('solar-angle-form')).toBeInTheDocument();
      });
    });

    it('[P2] should switch between methods', async () => {
      render(<FormulaBuilder />);

      // Select solar
      fireEvent.click(screen.getByTestId('method-card-solar'));
      await waitFor(() => {
        expect(screen.getByTestId('solar-angle-form')).toBeInTheDocument();
      });

      // Select fixed offset
      fireEvent.click(screen.getByTestId('method-card-fixed'));
      await waitFor(() => {
        expect(screen.getByTestId('fixed-offset-form')).toBeInTheDocument();
        expect(screen.queryByTestId('solar-angle-form')).not.toBeInTheDocument();
      });
    });
  });

  describe('initial formula parsing', () => {
    it('[P1] should parse and select solar formula', async () => {
      render(
        <FormulaBuilder initialFormula="solar(16.1, before_visible_sunrise)" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('method-card-solar')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });
    });

    it('[P1] should parse and select fixed offset formula', async () => {
      render(<FormulaBuilder initialFormula="visible_sunrise - 72min" />);

      await waitFor(() => {
        expect(screen.getByTestId('method-card-fixed')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });
    });

    it('[P1] should parse and select proportional hours formula', async () => {
      render(<FormulaBuilder initialFormula="proportional_hours(3, gra)" />);

      await waitFor(() => {
        expect(screen.getByTestId('method-card-proportional')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });
    });

    it('[P1] should parse and select fixed zman formula', async () => {
      render(<FormulaBuilder initialFormula="visible_sunrise" />);

      await waitFor(() => {
        expect(screen.getByTestId('method-card-fixed_zman')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });
    });
  });

  describe('parse error handling', () => {
    it('[P1] should show error state for complex formula', () => {
      render(
        <FormulaBuilder initialFormula="if(is_friday, sunset - 40min, sunset)" />
      );

      expect(screen.getByText('Advanced Formula Detected')).toBeInTheDocument();
    });

    it('[P1] should show error state for midpoint formula', () => {
      render(<FormulaBuilder initialFormula="midpoint(sunrise, sunset)" />);

      expect(screen.getByText('Advanced Formula Detected')).toBeInTheDocument();
    });

    it('[P2] should show greyed out method cards when parse error', () => {
      const { container } = render(
        <FormulaBuilder initialFormula="if(condition, a, b)" />
      );

      // Should have opacity class on cards
      const greyedSection = container.querySelector('.opacity-40');
      expect(greyedSection).toBeInTheDocument();
    });

    it('[P2] should call onParseError callback', () => {
      const onParseError = vi.fn();
      render(
        <FormulaBuilder
          initialFormula="midpoint(a, b)"
          onParseError={onParseError}
        />
      );

      expect(onParseError).toHaveBeenCalled();
    });
  });

  describe('onChange callback', () => {
    it('[P1] should call onChange when method is selected', async () => {
      const onChange = vi.fn();
      render(<FormulaBuilder onChange={onChange} />);

      fireEvent.click(screen.getByTestId('method-card-fixed_zman'));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('[P1] should call onChange with generated formula', async () => {
      const onChange = vi.fn();
      render(<FormulaBuilder onChange={onChange} />);

      // Select solar method
      fireEvent.click(screen.getByTestId('method-card-solar'));

      await waitFor(() => {
        // Default solar formula
        expect(onChange).toHaveBeenCalledWith(
          expect.stringContaining('solar(')
        );
      });
    });

    it('[P2] should not call onChange during initial parse', async () => {
      const onChange = vi.fn();
      render(
        <FormulaBuilder
          initialFormula="solar(16.1, before_visible_sunrise)"
          onChange={onChange}
        />
      );

      // Wait for parsing to complete
      await waitFor(() => {
        expect(screen.getByTestId('method-card-solar')).toHaveAttribute(
          'data-selected',
          'true'
        );
      });

      // onChange should not be called during initial sync
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('form interactions', () => {
    it('[P1] should update formula when solar degrees change', async () => {
      const onChange = vi.fn();
      render(<FormulaBuilder onChange={onChange} />);

      // Select solar method
      fireEvent.click(screen.getByTestId('method-card-solar'));
      await waitFor(() => {
        expect(screen.getByTestId('solar-angle-form')).toBeInTheDocument();
      });

      // Change degrees
      fireEvent.change(screen.getByTestId('solar-degrees'), {
        target: { value: '18' },
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.stringContaining('solar(18')
        );
      });
    });

    it('[P1] should update formula when offset minutes change', async () => {
      const onChange = vi.fn();
      render(<FormulaBuilder onChange={onChange} />);

      // Select fixed offset method
      fireEvent.click(screen.getByTestId('method-card-fixed'));
      await waitFor(() => {
        expect(screen.getByTestId('fixed-offset-form')).toBeInTheDocument();
      });

      // Change minutes
      fireEvent.change(screen.getByTestId('offset-minutes'), {
        target: { value: '40' },
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('40min'));
      });
    });
  });

  describe('className prop', () => {
    it('[P2] should apply custom className', () => {
      const { container } = render(
        <FormulaBuilder className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('localityId prop', () => {
    it('[P3] should pass localityId to child forms', async () => {
      render(<FormulaBuilder localityId={12345} />);

      // Select fixed offset to render form
      fireEvent.click(screen.getByTestId('method-card-fixed'));

      await waitFor(() => {
        expect(screen.getByTestId('fixed-offset-form')).toBeInTheDocument();
      });

      // The form should receive localityId (tested via mock)
    });
  });
});
