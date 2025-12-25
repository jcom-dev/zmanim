/**
 * @file FixedOffsetForm.test.tsx
 * @purpose Unit tests for FixedOffsetForm component
 * @priority P1 - Core form for fixed offset method
 *
 * Tests cover:
 * - Formula preview rendering
 * - Preset button selection
 * - Minutes input
 * - Direction selection
 * - Base time selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FixedOffsetForm } from '../methods/FixedOffsetForm';

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

// =============================================================================
// FixedOffsetForm Tests
// =============================================================================

describe('FixedOffsetForm', () => {
  const defaultProps = {
    minutes: 72,
    direction: 'before' as const,
    base: 'visible_sunrise',
    onMinutesChange: vi.fn(),
    onDirectionChange: vi.fn(),
    onBaseChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('[P1] should render formula preview', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      expect(screen.getByText('Formula Preview')).toBeInTheDocument();
      expect(screen.getByText('visible_sunrise - 72min')).toBeInTheDocument();
    });

    it('[P1] should render preset buttons', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      expect(screen.getByText('18 min')).toBeInTheDocument();
      expect(screen.getByText('40 min')).toBeInTheDocument();
      expect(screen.getByText('72 min')).toBeInTheDocument();
      expect(screen.getByText('90 min')).toBeInTheDocument();
    });

    it('[P1] should render direction buttons', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
    });

    it('[P1] should render minutes input', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(72);
    });

    it('[P2] should render preset descriptions', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      expect(screen.getByText('Misheyakir')).toBeInTheDocument();
      expect(screen.getByText('Rabbeinu Tam')).toBeInTheDocument();
    });
  });

  describe('formula preview', () => {
    it('[P1] should show minus for before direction', () => {
      render(<FixedOffsetForm {...defaultProps} direction="before" />);

      expect(screen.getByText('visible_sunrise - 72min')).toBeInTheDocument();
    });

    it('[P1] should show plus for after direction', () => {
      render(<FixedOffsetForm {...defaultProps} direction="after" />);

      expect(screen.getByText('visible_sunrise + 72min')).toBeInTheDocument();
    });

    it('[P1] should update with different base', () => {
      render(<FixedOffsetForm {...defaultProps} base="visible_sunset" />);

      expect(screen.getByText('visible_sunset - 72min')).toBeInTheDocument();
    });

    it('[P2] should show base without @ prefix for primitives', () => {
      // With our default mock (useZmanimList returns empty data), primitives don't get @ prefix
      render(<FixedOffsetForm {...defaultProps} base="visible_sunrise" />);

      // Should NOT have @ prefix since visible_sunrise is a primitive, not a zman
      expect(screen.getByText('visible_sunrise - 72min')).toBeInTheDocument();
    });
  });

  describe('preset buttons', () => {
    it('[P1] should highlight selected preset', () => {
      render(<FixedOffsetForm {...defaultProps} minutes={72} />);

      const button72 = screen.getByText('72 min').closest('button');
      expect(button72?.className).toContain('border-primary');
    });

    it('[P1] should call onMinutesChange when preset clicked', () => {
      const onMinutesChange = vi.fn();
      render(
        <FixedOffsetForm {...defaultProps} onMinutesChange={onMinutesChange} />
      );

      fireEvent.click(screen.getByText('40 min'));

      expect(onMinutesChange).toHaveBeenCalledWith(40);
    });

    it('[P2] should not highlight unselected presets', () => {
      render(<FixedOffsetForm {...defaultProps} minutes={72} />);

      const button18 = screen.getByText('18 min').closest('button');
      expect(button18?.className).toContain('border-border');
    });
  });

  describe('minutes input', () => {
    it('[P1] should call onMinutesChange on input change', () => {
      const onMinutesChange = vi.fn();
      render(
        <FixedOffsetForm {...defaultProps} onMinutesChange={onMinutesChange} />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '50' } });

      expect(onMinutesChange).toHaveBeenCalledWith(50);
    });

    it('[P2] should handle empty input as 0', () => {
      const onMinutesChange = vi.fn();
      render(
        <FixedOffsetForm {...defaultProps} onMinutesChange={onMinutesChange} />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '' } });

      expect(onMinutesChange).toHaveBeenCalledWith(0);
    });
  });

  describe('direction buttons', () => {
    it('[P1] should highlight before direction when selected', () => {
      render(<FixedOffsetForm {...defaultProps} direction="before" />);

      const beforeButton = screen.getByText('Before').closest('button');
      expect(beforeButton?.className).toContain('border-primary');
    });

    it('[P1] should highlight after direction when selected', () => {
      render(<FixedOffsetForm {...defaultProps} direction="after" />);

      const afterButton = screen.getByText('After').closest('button');
      expect(afterButton?.className).toContain('border-primary');
    });

    it('[P1] should call onDirectionChange when clicked', () => {
      const onDirectionChange = vi.fn();
      render(
        <FixedOffsetForm
          {...defaultProps}
          direction="before"
          onDirectionChange={onDirectionChange}
        />
      );

      fireEvent.click(screen.getByText('After'));

      expect(onDirectionChange).toHaveBeenCalledWith('after');
    });
  });

  describe('event propagation', () => {
    it('[P2] should stop propagation on input click', () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <FixedOffsetForm {...defaultProps} />
        </div>
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.click(input);

      expect(parentClick).not.toHaveBeenCalled();
    });

    it('[P2] should stop propagation on preset click', () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <FixedOffsetForm {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByText('40 min'));

      expect(parentClick).not.toHaveBeenCalled();
    });

    it('[P2] should stop propagation on direction click', () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <FixedOffsetForm {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByText('After'));

      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('[P2] should have labels for form sections', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      expect(screen.getByText('1. Reference Time')).toBeInTheDocument();
      expect(screen.getByText('2. Offset (minutes)')).toBeInTheDocument();
      expect(screen.getByText('3. Direction')).toBeInTheDocument();
    });

    it('[P2] should have direction descriptions', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      expect(screen.getByText('Earlier in the day')).toBeInTheDocument();
      expect(screen.getByText('Later in the day')).toBeInTheDocument();
    });
  });

  describe('select trigger', () => {
    it('[P2] should render select trigger for reference time', () => {
      render(<FixedOffsetForm {...defaultProps} />);

      // Should have a select for choosing reference time
      const selectTrigger = screen.getByRole('combobox');
      expect(selectTrigger).toBeInTheDocument();
    });
  });
});
