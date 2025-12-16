# Story 5.10: Mandatory Publisher Logo with Image Editor

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P2
**Story Points:** 8
**Dependencies:** None (can be done in parallel with other Epic 5 stories)
**FRs:** FR100, FR101, FR102, FR103 (Publisher logo and profile enhancements)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Unified API Client" (use `useApi()` hook)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Image Handling:**
- `react-easy-crop` handles EXIF orientation but verify on mobile uploads
- Output format should be PNG for transparency support (initials may need transparent bg in future)
- Xata | Shared dev DBStorage bucket must be configured with public access for logos

**Personal Name Detection:**
- The regex patterns will have false positives (e.g., "Young Israel of X" triggers "Israel" as name)
- Use a more sophisticated approach: check for common organization words (Congregation, Shul, Center, etc.)
- Warning should be non-blocking and dismissable

**Migration Consideration:**
- Existing publishers without logos need a grace period or prompt on next login
- Don't break existing publisher functionality

---

## Story

As a **publisher**,
I want **a proper logo upload experience with cropping and sizing tools**,
So that **my logo looks professional and consistent across the platform**.

---

## Acceptance Criteria

### AC-5.10.1: Mandatory Logo
- [ ] Logo is REQUIRED field in publisher profile (marked with *)
- [ ] Cannot save profile without logo
- [ ] Validation error shown if logo missing
- [ ] Existing publishers without logo prompted to add one

### AC-5.10.2: Image Upload & Editor
- [ ] File upload accepts common image formats (jpg, png, gif, webp)
- [ ] After upload, image editor opens with:
  - Crop selection box (drag corners to resize)
  - Zoom in/out controls (slider or +/- buttons)
  - Pan/drag image within crop area
  - Aspect ratio locked to 1:1 (square)
- [ ] Preview of final result at actual display size (e.g., 48x48, 96x96)

### AC-5.10.3: Crop & Resize
- [ ] Crop area is always square (1:1 aspect ratio)
- [ ] Final image resized to standard size (200x200px)
- [ ] Image quality optimized for web
- [ ] "Apply" button saves cropped result

### AC-5.10.4: Generate from Initials
- [ ] "Generate from Initials" button available
- [ ] Creates logo using publisher name initials (e.g., "BIC" for Beth Israel Congregation)
- [ ] Color picker for background color
- [ ] Multiple color presets available
- [ ] Generated logo displayed in preview
- [ ] Can be used as final logo

### AC-5.10.5: Publisher Name Field
- [ ] Label reads "Publisher Name" (not just "Name")
- [ ] Helper text: "Organization or publication name (not personal name)"
- [ ] Validation warning if personal name detected (e.g., "Rabbi David Cohen")
- [ ] Warning is non-blocking but informative

### AC-5.10.6: Personal Name Detection
- [ ] Pattern matching for common personal name formats
- [ ] Detects titles like "Rabbi", "Rav", "Dr.", "Rev."
- [ ] Detects two-word names that look personal
- [ ] Warning message: "This appears to be a personal name. Publisher names should be organization names like 'Beth Israel Congregation' or 'Chicago Rabbinical Council'"

### AC-5.10.7: Consistent Terminology
- [ ] All UI references use "Publisher Name" not "Name"
- [ ] Publisher cards, headers, forms updated
- [ ] Search results show "Publisher Name"

---

## Technical Context

### Logo Editor Component

**File: `web/components/publisher/LogoEditor.tsx`**
```typescript
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/crop-image';

interface LogoEditorProps {
  initialImage?: string;
  onSave: (blob: Blob) => Promise<void>;
  onCancel: () => void;
}

export function LogoEditor({ initialImage, onSave, onCancel }: LogoEditorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => setImageSrc(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsSaving(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 200, 200);
      await onSave(croppedBlob);
    } catch (error) {
      toast.error('Failed to save logo');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!imageSrc ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="logo-upload"
          />
          <label htmlFor="logo-upload" className="cursor-pointer">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm">Click to upload an image</p>
          </label>
        </div>
      ) : (
        <>
          <div className="relative h-64 bg-gray-100 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">Zoom:</span>
            <Slider
              value={[zoom]}
              onValueChange={([z]) => setZoom(z)}
              min={1}
              max={3}
              step={0.1}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">Preview:</span>
            <div className="flex gap-2">
              <LogoPreview src={imageSrc} crop={croppedAreaPixels} size={48} />
              <LogoPreview src={imageSrc} crop={croppedAreaPixels} size={96} />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!imageSrc || isSaving}>
          {isSaving ? 'Saving...' : 'Apply'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="ghost" onClick={() => setImageSrc(null)}>
          Change Image
        </Button>
      </div>
    </div>
  );
}
```

### Initials Logo Generator

**File: `web/components/publisher/InitialsLogoGenerator.tsx`**
```typescript
interface InitialsLogoGeneratorProps {
  publisherName: string;
  onGenerate: (blob: Blob) => void;
}

const COLOR_PRESETS = [
  { name: 'Blue', bg: '#3B82F6', text: '#FFFFFF' },
  { name: 'Green', bg: '#10B981', text: '#FFFFFF' },
  { name: 'Purple', bg: '#8B5CF6', text: '#FFFFFF' },
  { name: 'Orange', bg: '#F59E0B', text: '#FFFFFF' },
  { name: 'Red', bg: '#EF4444', text: '#FFFFFF' },
  { name: 'Gray', bg: '#6B7280', text: '#FFFFFF' },
];

export function InitialsLogoGenerator({ publisherName, onGenerate }: InitialsLogoGeneratorProps) {
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initials = getInitials(publisherName);

  const generateLogo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = selectedColor.bg;
    ctx.fillRect(0, 0, 200, 200);

    // Draw initials
    ctx.fillStyle = selectedColor.text;
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 100);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) onGenerate(blob);
    }, 'image/png');
  }, [initials, selectedColor, onGenerate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          className="rounded-lg border"
          style={{ width: 100, height: 100 }}
        />
        <div>
          <p className="text-lg font-medium">{initials}</p>
          <p className="text-sm text-muted-foreground">From: {publisherName}</p>
        </div>
      </div>

      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2 mt-2">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.name}
              className={cn(
                'w-8 h-8 rounded-full border-2',
                selectedColor.name === color.name ? 'border-black' : 'border-transparent'
              )}
              style={{ backgroundColor: color.bg }}
              onClick={() => setSelectedColor(color)}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <Button onClick={generateLogo}>Use This Logo</Button>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(word => !['the', 'of', 'and', 'congregation', 'synagogue'].includes(word.toLowerCase()))
    .slice(0, 3)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');
}
```

### Personal Name Detection

**File: `web/lib/name-validation.ts`**
```typescript
const PERSONAL_NAME_PATTERNS = [
  /^(rabbi|rav|rev|dr|mr|mrs|ms)\s+/i,
  /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,  // "First Last"
  /^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+$/,  // "First M. Last"
];

export function detectPersonalName(name: string): boolean {
  return PERSONAL_NAME_PATTERNS.some(pattern => pattern.test(name.trim()));
}

export function getNameWarning(name: string): string | null {
  if (detectPersonalName(name)) {
    return "This appears to be a personal name. Publisher names should be organization names like 'Beth Israel Congregation' or 'Chicago Rabbinical Council'";
  }
  return null;
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Install Dependencies
  - [ ] 1.1 Install `react-easy-crop` for image cropping
  - [ ] 1.2 Create crop utility function for canvas manipulation

- [ ] Task 2: Create Logo Editor Component
  - [ ] 2.1 Create `web/components/publisher/LogoEditor.tsx`
  - [ ] 2.2 Implement file upload
  - [ ] 2.3 Implement crop/zoom controls
  - [ ] 2.4 Implement preview at multiple sizes
  - [ ] 2.5 Implement save to blob

- [ ] Task 3: Create Initials Generator
  - [ ] 3.1 Create `web/components/publisher/InitialsLogoGenerator.tsx`
  - [ ] 3.2 Implement initials extraction from name
  - [ ] 3.3 Implement color picker with presets
  - [ ] 3.4 Implement canvas rendering
  - [ ] 3.5 Convert to blob for upload

- [ ] Task 4: Update Profile Form
  - [ ] 4.1 Make logo_url required in validation
  - [ ] 4.2 Add LogoEditor to profile page
  - [ ] 4.3 Add "Generate from Initials" option
  - [ ] 4.4 Show current logo with edit option

- [ ] Task 5: Name Validation
  - [ ] 5.1 Create `web/lib/name-validation.ts`
  - [ ] 5.2 Implement personal name detection
  - [ ] 5.3 Add warning to publisher name field
  - [ ] 5.4 Make warning non-blocking

- [ ] Task 6: Update Terminology
  - [ ] 6.1 Change "Name" → "Publisher Name" in profile form
  - [ ] 6.2 Update publisher cards
  - [ ] 6.3 Update admin publisher list
  - [ ] 6.4 Update search results

- [ ] Task 7: Backend Validation
  - [ ] 7.1 Make logo_url required in API validation
  - [ ] 7.2 Return validation error if missing
  - [ ] 7.3 Handle migration for existing publishers

- [ ] Task 8: Image Storage
  - [ ] 8.1 Upload cropped image to Xata | Shared dev DBStorage
  - [ ] 8.2 Generate public URL
  - [ ] 8.3 Store URL in publisher profile

- [ ] Task 9: Testing
  - [ ] 9.1 Test image upload and crop
  - [ ] 9.2 Test initials generation
  - [ ] 9.3 Test personal name warning
  - [ ] 9.4 Test mandatory validation
  - [ ] 9.5 Test mobile upload

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Logo is mandatory with validation (for NEW publishers)
- [ ] Existing publishers without logo prompted but not blocked
- [ ] Image editor with crop/zoom works (including EXIF orientation)
- [ ] Initials generator works
- [ ] Personal name warning shows (non-blocking, dismissable)
- [ ] "Publisher Name" terminology consistent across UI
- [ ] Images stored in Xata | Shared dev DBStorage (bucket configured with public access)
- [ ] Mobile upload tested

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/components/publisher/LogoEditor.tsx` | Create | Image crop/zoom editor |
| `web/components/publisher/InitialsLogoGenerator.tsx` | Create | Generate logo from name |
| `web/lib/name-validation.ts` | Create | Personal name detection |
| `web/lib/crop-image.ts` | Create | Canvas cropping utility |
| `web/app/publisher/profile/page.tsx` | Modify | Add logo editor |
| `api/internal/handlers/publishers.go` | Modify | Make logo required |

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│ Publisher Profile                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Logo *                                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │  ┌─────────────┐                                   │ │
│ │  │  [Current]  │  [Upload New]  [Generate]         │ │
│ │  │    Logo     │                                   │ │
│ │  └─────────────┘                                   │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Publisher Name *                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Beth Israel Congregation                            │ │
│ └─────────────────────────────────────────────────────┘ │
│ Organization or publication name (not personal name)    │
│                                                         │
│ ⚠️ [If personal name detected]:                        │
│ This appears to be a personal name...                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
