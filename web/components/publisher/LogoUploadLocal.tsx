'use client';

import { useState, useRef, DragEvent, ChangeEvent, useCallback, useEffect } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, Sparkles, RotateCcw, RefreshCw } from 'lucide-react';

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

interface LogoUploadLocalProps {
  currentLogoUrl?: string | null;
  publisherName?: string;
  onLogoChange: (logoDataUrl: string | null) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * LogoUploadLocal - Same UI as LogoUpload but stores locally (no server upload)
 * Used for registration flow where publisher doesn't exist yet
 */
export function LogoUploadLocal({
  currentLogoUrl,
  publisherName,
  onLogoChange,
  onError,
  disabled = false
}: LogoUploadLocalProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedColor, setSelectedColor] = useState(LOGO_COLORS[0].color);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const [isCustomLogo, setIsCustomLogo] = useState(!!currentLogoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate logo from initials
  const generateLogo = useCallback(() => {
    if (!publisherName) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

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
    return canvas.toDataURL('image/png');
  }, [publisherName, selectedColor]);

  // Auto-generate logo when name/color changes
  useEffect(() => {
    if (publisherName) {
      const dataUrl = generateLogo();
      if (dataUrl) {
        setGeneratedLogo(dataUrl);
        // Auto-set preview to generated if no custom logo
        if (!isCustomLogo && !currentLogoUrl) {
          setPreview(dataUrl);
        }
      }
    }
  }, [publisherName, selectedColor, generateLogo, isCustomLogo, currentLogoUrl]);

  // Handle use generated logo (local only, no upload)
  const handleUseGeneratedLogo = useCallback(() => {
    if (generatedLogo) {
      setPreview(generatedLogo);
      setIsCustomLogo(false);
      onLogoChange(generatedLogo);
    }
  }, [generatedLogo, onLogoChange]);

  // Handle revert to generated
  const handleRevertToGenerated = useCallback(() => {
    if (generatedLogo) {
      setPreview(generatedLogo);
      setIsCustomLogo(false);
      onLogoChange(generatedLogo);
    }
  }, [generatedLogo, onLogoChange]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload a valid image file (JPEG, PNG, or WebP)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB';
    }
    return null;
  };

  const handleFile = (file: File) => {
    const error = validateFile(file);
    if (error) {
      onError?.(error);
      return;
    }

    // Read file as data URL and store locally
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setIsCustomLogo(true);
      onLogoChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setIsCustomLogo(false);
    onLogoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for logo generation */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="shrink-0">
          {preview ? (
            <div className="relative group w-24 h-24">
              <NextImage
                src={preview}
                alt="Logo preview"
                fill
                className="rounded-lg object-cover border border-border"
                unoptimized
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove logo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-background">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Upload area */}
        <div className="flex-1">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-border hover:border-muted-foreground'
            } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-3">
              <div className="flex justify-center">
                <Upload className="w-10 h-10 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drag and drop your logo here, or
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleButtonClick}
                  disabled={disabled}
                  className="mt-2"
                >
                  Browse Files
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG or WebP (max 5MB)
              </p>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Logo Generator Section */}
      {publisherName && (
        <div className="border border-border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Generate from Initials</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Generated logo preview */}
            {generatedLogo && (
              <div className="shrink-0">
                <img
                  src={generatedLogo}
                  alt="Generated logo"
                  className="w-16 h-16 rounded-full border border-border"
                />
              </div>
            )}

            <div className="flex-1 space-y-3">
              {/* Color picker */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Choose color</p>
                <div className="flex flex-wrap gap-2">
                  {LOGO_COLORS.map(({ color, name }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      disabled={disabled}
                      className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                        selectedColor === color
                          ? 'border-foreground ring-2 ring-primary ring-offset-1'
                          : 'border-transparent'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ backgroundColor: color }}
                      title={name}
                      aria-label={`Select ${name} color`}
                    />
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {isCustomLogo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRevertToGenerated}
                    disabled={disabled}
                    className="gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Revert to Generated
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseGeneratedLogo}
                    disabled={disabled || !generatedLogo}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Use This Logo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
