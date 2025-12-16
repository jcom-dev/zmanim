'use client';

import { cn } from '@/lib/utils';
import type { ShaosBase } from '../types';

interface DayArcDiagramProps {
  hours: number;
  base: ShaosBase;
  className?: string;
}

export function DayArcDiagram({ hours, base, className }: DayArcDiagramProps) {
  // SVG dimensions
  const width = 300;
  const height = 160;
  const centerX = width / 2;
  const centerY = height - 20;
  const radius = 120;

  // Calculate arc path
  const startAngle = Math.PI; // Left side (sunrise/dawn)
  const endAngle = 0; // Right side (sunset/nightfall)

  // Arc start and end points
  const arcStartX = centerX + radius * Math.cos(startAngle);
  const arcStartY = centerY + radius * Math.sin(startAngle);
  const arcEndX = centerX + radius * Math.cos(endAngle);
  const arcEndY = centerY + radius * Math.sin(endAngle);

  // Calculate position for selected hour
  const hourAngle = Math.PI - (hours / 12) * Math.PI;
  const hourX = centerX + radius * Math.cos(hourAngle);
  const hourY = centerY + radius * Math.sin(hourAngle);

  // Generate tick marks for each hour
  const ticks = [];
  for (let i = 0; i <= 12; i++) {
    const tickAngle = Math.PI - (i / 12) * Math.PI;
    const innerRadius = radius - 8;
    const outerRadius = radius + 8;
    const x1 = centerX + innerRadius * Math.cos(tickAngle);
    const y1 = centerY + innerRadius * Math.sin(tickAngle);
    const x2 = centerX + outerRadius * Math.cos(tickAngle);
    const y2 = centerY + outerRadius * Math.sin(tickAngle);
    ticks.push({ x1, y1, x2, y2, hour: i });
  }

  // Labels
  const labels = base === 'gra'
    ? { start: 'Sunrise', end: 'Sunset', label: 'GRA Day' }
    : base === 'mga'
    ? { start: 'Alos', end: 'Tzeis', label: 'MGA Day' }
    : { start: 'Start', end: 'End', label: 'Custom' };

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="dayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--muted))" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--muted))" />
          </linearGradient>
        </defs>

        {/* Day arc background */}
        <path
          d={`M ${arcStartX} ${arcStartY} A ${radius} ${radius} 0 0 1 ${arcEndX} ${arcEndY}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Highlighted portion (from start to selected hour) */}
        <path
          d={`M ${arcStartX} ${arcStartY} A ${radius} ${radius} 0 0 1 ${hourX} ${hourY}`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="16"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Hour tick marks */}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={i <= hours ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
            strokeWidth={i === Math.floor(hours) ? 3 : 1}
            opacity={i <= hours ? 1 : 0.5}
          />
        ))}

        {/* Sun indicator at current position */}
        <circle
          cx={hourX}
          cy={hourY}
          r="12"
          fill="hsl(var(--primary))"
          stroke="hsl(var(--background))"
          strokeWidth="3"
        />
        <text
          x={hourX}
          y={hourY + 4}
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="hsl(var(--primary-foreground))"
        >
          ☀
        </text>

        {/* Start label */}
        <text
          x={arcStartX - 5}
          y={arcStartY + 20}
          textAnchor="middle"
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          {labels.start}
        </text>

        {/* End label */}
        <text
          x={arcEndX + 5}
          y={arcEndY + 20}
          textAnchor="middle"
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          {labels.end}
        </text>

        {/* Center label */}
        <text
          x={centerX}
          y={centerY - 40}
          textAnchor="middle"
          fontSize="12"
          fontWeight="medium"
          fill="hsl(var(--foreground))"
        >
          {hours} hours into {labels.label}
        </text>

        {/* Horizon line */}
        <line
          x1={arcStartX - 20}
          y1={centerY}
          x2={arcEndX + 20}
          y2={centerY}
          stroke="hsl(var(--border))"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
}

export default DayArcDiagram;
