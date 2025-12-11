'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, RefreshCw } from 'lucide-react';

interface LogoGeneratorProps {
  publisherName: string;
  onGenerate: (dataUrl: string) => void;
  currentLogo?: string | null;
}

// Professional color palette for logo backgrounds
const LOGO_COLORS = [
  { color: '#1e40af', name: 'Royal Blue' },
  { color: '#166534', name: 'Forest Green' },
  { color: '#9a3412', name: 'Burnt Orange' },
  { color: '#7e22ce', name: 'Purple' },
  { color: '#be123c', name: 'Rose' },
  { color: '#0f766e', name: 'Teal' },
  { color: '#b45309', name: 'Amber' },
  { color: '#4338ca', name: 'Indigo' },
];

/**
 * Extracts initials from a publisher name
 * - Single word: First 2 characters
 * - Multiple words: First letter of first 2 words
 * - Hebrew text: First 2 characters
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  // Check if the name contains Hebrew characters
  const hebrewRegex = /[\u0590-\u05FF]/;
  if (hebrewRegex.test(trimmed)) {
    // For Hebrew, just take first 2 characters
    return trimmed.substring(0, 2);
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function LogoGenerator({ publisherName, onGenerate, currentLogo }: LogoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState(LOGO_COLORS[0].color);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogo || null);

  const generateLogo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw background circle
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Add subtle gradient overlay
    const gradient = ctx.createRadialGradient(
      size / 3,
      size / 3,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw initials
    const initials = getInitials(publisherName);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add text shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(initials, size / 2, size / 2);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Generate data URL
    const dataUrl = canvas.toDataURL('image/png');
    setPreviewUrl(dataUrl);
    onGenerate(dataUrl);
  }, [publisherName, selectedColor, onGenerate]);

  // Generate logo when color or name changes
  useEffect(() => {
    if (publisherName) {
      generateLogo();
    }
  }, [publisherName, selectedColor, generateLogo]);

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Generate Logo from Name</Label>

      {/* Hidden canvas for generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview */}
      <div className="flex items-center gap-4">
        {previewUrl && (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Generated logo preview"
              className="w-20 h-20 rounded-full border-2 border-border shadow-xs"
            />
          </div>
        )}

        <div className="flex-1">
          {/* Color picker */}
          <Label className="text-xs text-muted-foreground mb-2 block">
            Choose Background Color
          </Label>
          <div className="flex flex-wrap gap-2">
            {LOGO_COLORS.map(({ color, name }) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  selectedColor === color
                    ? 'border-foreground ring-2 ring-primary ring-offset-2'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                title={name}
                aria-label={`Select ${name} color`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Regenerate button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generateLogo}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Regenerate
      </Button>

      <p className="text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3 inline mr-1" />
        Logo is generated from your publisher name initials
      </p>
    </div>
  );
}
