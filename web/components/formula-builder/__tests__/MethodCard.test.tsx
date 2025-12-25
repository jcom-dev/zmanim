/**
 * @file MethodCard.test.tsx
 * @purpose Unit tests for MethodCard component
 * @priority P1 - Core UI component for formula builder
 *
 * Tests cover:
 * - Rendering with different props
 * - Click interactions
 * - Selected state styling
 * - Children rendering when selected
 * - Tooltip rendering
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MethodCard } from '../MethodCard';

// =============================================================================
// Test Setup
// =============================================================================

// Mock InfoTooltip component
vi.mock('@/components/shared/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <span data-testid="info-tooltip">{content}</span>
  ),
}));

// =============================================================================
// MethodCard Tests
// =============================================================================

describe('MethodCard', () => {
  const defaultProps = {
    method: 'solar' as const,
    title: 'Solar Angle',
    description: 'Calculate based on sun position',
    selected: false,
    onSelect: vi.fn(),
  };

  describe('rendering', () => {
    it('[P1] should render title and description', () => {
      render(<MethodCard {...defaultProps} />);

      expect(screen.getByText('Solar Angle')).toBeInTheDocument();
      expect(screen.getByText('Calculate based on sun position')).toBeInTheDocument();
    });

    it('[P1] should render icon for each method type', () => {
      const methods = ['solar', 'fixed', 'proportional', 'fixed_zman'] as const;

      methods.forEach((method) => {
        const { container, unmount } = render(
          <MethodCard
            {...defaultProps}
            method={method}
            title={`Test ${method}`}
          />
        );

        // Icon should be rendered (SVG element)
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();

        unmount();
      });
    });

    it('[P1] should render tooltip when provided', () => {
      render(
        <MethodCard
          {...defaultProps}
          tooltip="Helpful tooltip content"
        />
      );

      expect(screen.getByTestId('info-tooltip')).toBeInTheDocument();
      expect(screen.getByText('Helpful tooltip content')).toBeInTheDocument();
    });

    it('[P2] should not render tooltip when not provided', () => {
      render(<MethodCard {...defaultProps} />);

      expect(screen.queryByTestId('info-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('[P1] should call onSelect when clicked', () => {
      const onSelect = vi.fn();
      render(<MethodCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Solar Angle'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('[P1] should be clickable on the entire card', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <MethodCard {...defaultProps} onSelect={onSelect} />
      );

      // Click on the card container
      const card = container.firstChild as HTMLElement;
      fireEvent.click(card);

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('selected state', () => {
    it('[P1] should apply selected styles when selected', () => {
      const { container } = render(
        <MethodCard {...defaultProps} selected={true} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-primary');
    });

    it('[P1] should apply unselected styles when not selected', () => {
      const { container } = render(
        <MethodCard {...defaultProps} selected={false} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-border');
    });

    it('[P1] should render children only when selected', () => {
      const { rerender } = render(
        <MethodCard {...defaultProps} selected={false}>
          <div data-testid="child-content">Child Content</div>
        </MethodCard>
      );

      // Not selected - children should not be visible
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

      // Rerender as selected
      rerender(
        <MethodCard {...defaultProps} selected={true}>
          <div data-testid="child-content">Child Content</div>
        </MethodCard>
      );

      // Selected - children should be visible
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('[P2] should show expanded parameters section when selected with children', () => {
      render(
        <MethodCard {...defaultProps} selected={true}>
          <input data-testid="param-input" placeholder="Enter value" />
        </MethodCard>
      );

      expect(screen.getByTestId('param-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });
  });

  describe('icon styling', () => {
    it('[P2] should apply selected icon styling when selected', () => {
      const { container } = render(
        <MethodCard {...defaultProps} selected={true} />
      );

      // Icon container should have primary background
      const iconContainer = container.querySelector('.p-3.rounded-xl');
      expect(iconContainer?.className).toContain('bg-primary');
    });

    it('[P2] should apply muted icon styling when not selected', () => {
      const { container } = render(
        <MethodCard {...defaultProps} selected={false} />
      );

      // Icon container should have muted background
      const iconContainer = container.querySelector('.p-3.rounded-xl');
      expect(iconContainer?.className).toContain('bg-muted');
    });
  });

  describe('accessibility', () => {
    it('[P2] should have cursor-pointer class for clickability', () => {
      const { container } = render(<MethodCard {...defaultProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('cursor-pointer');
    });

    it('[P3] should have proper heading hierarchy', () => {
      render(<MethodCard {...defaultProps} />);

      // Title should be in an h3
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Solar Angle');
    });
  });
});
