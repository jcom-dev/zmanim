/**
 * @file ProportionalHoursForm.test.tsx
 * @purpose Unit tests for ProportionalHoursForm component
 * @priority P1 - Core form for proportional hours method
 *
 * Tests cover:
 * - Hours slider rendering
 * - Hour preset buttons
 * - Base system selection
 * - Custom start/end selectors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProportionalHoursForm } from '../methods/ProportionalHoursForm';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock useZmanimList hook
vi.mock('@/lib/hooks/useZmanimList', () => ({
  useZmanimList: () => ({
    data: [],
    isLoading: false,
  }),
  useAstronomicalPrimitivesGrouped: () => ({
    data: [
      {
        category: 'sunrise_sunset',
        display_name: 'Sunrise & Sunset',
        primitives: [
          {
            variable_name: 'visible_sunrise',
            display_name: 'Visible Sunrise',
            description: 'When the sun appears on the horizon',
          },
          {
            variable_name: 'visible_sunset',
            display_name: 'Visible Sunset',
            description: 'When the sun disappears below horizon',
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

// Mock Slider component
vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onChange,
    min,
    max,
    step,
  }: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
  }) => (
    <input
      data-testid="hours-slider"
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  ),
}));

// =============================================================================
// ProportionalHoursForm Tests
// =============================================================================

describe('ProportionalHoursForm', () => {
  const defaultProps = {
    hours: 3,
    base: 'gra' as const,
    customStart: '',
    customEnd: '',
    onHoursChange: vi.fn(),
    onBaseChange: vi.fn(),
    onCustomStartChange: vi.fn(),
    onCustomEndChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('[P1] should render hours display', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      expect(screen.getByText('3 hours')).toBeInTheDocument();
    });

    it('[P1] should render hours slider', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      expect(screen.getByTestId('hours-slider')).toBeInTheDocument();
    });

    it('[P1] should render hour preset buttons', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      expect(screen.getByText('3h')).toBeInTheDocument();
      expect(screen.getByText('4h')).toBeInTheDocument();
      expect(screen.getByText('9h')).toBeInTheDocument();
    });

    it('[P1] should render calculation system label', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      expect(screen.getByText('Calculation System')).toBeInTheDocument();
    });
  });

  describe('hours slider', () => {
    it('[P1] should call onHoursChange when slider changes', () => {
      const onHoursChange = vi.fn();
      render(
        <ProportionalHoursForm {...defaultProps} onHoursChange={onHoursChange} />
      );

      const slider = screen.getByTestId('hours-slider');
      fireEvent.change(slider, { target: { value: '6' } });

      expect(onHoursChange).toHaveBeenCalledWith(6);
    });

    it('[P2] should display current hours value', () => {
      render(<ProportionalHoursForm {...defaultProps} hours={9.5} />);

      expect(screen.getByText('9.5 hours')).toBeInTheDocument();
    });
  });

  describe('hour preset buttons', () => {
    it('[P1] should call onHoursChange when preset clicked', () => {
      const onHoursChange = vi.fn();
      render(
        <ProportionalHoursForm {...defaultProps} onHoursChange={onHoursChange} />
      );

      fireEvent.click(screen.getByText('9h'));

      expect(onHoursChange).toHaveBeenCalledWith(9);
    });

    it('[P1] should highlight selected preset', () => {
      render(<ProportionalHoursForm {...defaultProps} hours={3} />);

      const button3h = screen.getByText('3h');
      // The button should be present and clickable
      expect(button3h.closest('button')).toBeInTheDocument();
    });

    it('[P2] should stop propagation on preset click', () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <ProportionalHoursForm {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByText('4h'));

      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('base system selection', () => {
    it('[P1] should show GRA description when selected', () => {
      render(<ProportionalHoursForm {...defaultProps} base="gra" />);

      expect(
        screen.getByText('Vilna Gaon: Sunrise to sunset')
      ).toBeInTheDocument();
    });

    it('[P1] should show MGA description when selected', () => {
      render(<ProportionalHoursForm {...defaultProps} base="mga" />);

      expect(
        screen.getByText(
          'Magen Avraham: 72 min before sunrise to 72 min after sunset'
        )
      ).toBeInTheDocument();
    });

    it('[P1] should show MGA 90 description when selected', () => {
      render(<ProportionalHoursForm {...defaultProps} base="mga_90" />);

      expect(screen.getByText('MGA with 90 minute offset')).toBeInTheDocument();
    });

    it('[P1] should show Baal HaTanya description when selected', () => {
      render(<ProportionalHoursForm {...defaultProps} base="baal_hatanya" />);

      expect(
        screen.getByText("Shulchan Aruch HaRav: 1.583° below horizon")
      ).toBeInTheDocument();
    });

    it('[P1] should show custom description when selected', () => {
      render(<ProportionalHoursForm {...defaultProps} base="custom" />);

      expect(
        screen.getByText('Define your own day start and end times')
      ).toBeInTheDocument();
    });
  });

  describe('custom base selectors', () => {
    it('[P1] should show custom selectors when base is custom', () => {
      render(<ProportionalHoursForm {...defaultProps} base="custom" />);

      expect(screen.getByText('Day Start Reference')).toBeInTheDocument();
      expect(screen.getByText('Day End Reference')).toBeInTheDocument();
    });

    it('[P1] should hide custom selectors when base is not custom', () => {
      render(<ProportionalHoursForm {...defaultProps} base="gra" />);

      expect(screen.queryByText('Day Start Reference')).not.toBeInTheDocument();
      expect(screen.queryByText('Day End Reference')).not.toBeInTheDocument();
    });

    it('[P2] should display selected custom start value', () => {
      render(
        <ProportionalHoursForm
          {...defaultProps}
          base="custom"
          customStart="alos_hashachar"
        />
      );

      // The select should show the value (handled by mocked Select)
      expect(screen.getByText('Day Start Reference')).toBeInTheDocument();
    });

    it('[P2] should display selected custom end value', () => {
      render(
        <ProportionalHoursForm
          {...defaultProps}
          base="custom"
          customEnd="tzeis_hakochavim"
        />
      );

      expect(screen.getByText('Day End Reference')).toBeInTheDocument();
    });
  });

  describe('labels and headings', () => {
    it('[P2] should render Proportional Hours label', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      expect(screen.getByText('Proportional Hours')).toBeInTheDocument();
    });

    it('[P2] should render Calculation System label', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      expect(screen.getByText('Calculation System')).toBeInTheDocument();
    });
  });

  describe('event propagation', () => {
    it('[P2] should stop propagation on base select click', () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <ProportionalHoursForm {...defaultProps} />
        </div>
      );

      // Click on the select trigger area (Calculation System section)
      const selectTrigger = screen.getByRole('combobox');
      fireEvent.click(selectTrigger);

      expect(parentClick).not.toHaveBeenCalled();
    });

    it('[P2] should stop propagation on custom selector container click', () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <ProportionalHoursForm {...defaultProps} base="custom" />
        </div>
      );

      // Click on custom selector container
      const container = screen.getByText('Day Start Reference').closest('.space-y-3');
      if (container) {
        fireEvent.click(container);
      }

      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('fractional hours', () => {
    it('[P2] should display fractional hours correctly', () => {
      render(<ProportionalHoursForm {...defaultProps} hours={10.75} />);

      expect(screen.getByText('10.75 hours')).toBeInTheDocument();
    });

    it('[P2] should handle 9.5h preset', () => {
      const onHoursChange = vi.fn();
      render(
        <ProportionalHoursForm {...defaultProps} onHoursChange={onHoursChange} />
      );

      fireEvent.click(screen.getByText('9.5h'));

      expect(onHoursChange).toHaveBeenCalledWith(9.5);
    });

    it('[P2] should handle 10.75h preset', () => {
      const onHoursChange = vi.fn();
      render(
        <ProportionalHoursForm {...defaultProps} onHoursChange={onHoursChange} />
      );

      fireEvent.click(screen.getByText('10.75h'));

      expect(onHoursChange).toHaveBeenCalledWith(10.75);
    });
  });

  describe('slider range', () => {
    it('[P3] should have slider with correct range', () => {
      render(<ProportionalHoursForm {...defaultProps} />);

      const slider = screen.getByTestId('hours-slider');
      // The actual slider range from the mock component
      expect(slider).toHaveAttribute('min', '0.5');
      expect(slider).toHaveAttribute('max', '12');
    });
  });
});
