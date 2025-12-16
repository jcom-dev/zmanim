# Frontend Components

This document describes the React components and UI patterns used in the Shtetl Zmanim frontend.

## Component Architecture

```
app/
├── layout.tsx          # Root layout with metadata
├── page.tsx            # Main page (client component)
└── globals.css         # Global styles + Tailwind

components/
├── LocationInput.tsx   # Geolocation input
├── DatePicker.tsx      # Date selection
├── PublisherCard.tsx   # Publisher display card
├── MethodCard.tsx      # Calculation method card
└── ZmanimDisplay.tsx   # Zmanim results display

lib/
├── api.ts              # API client
├── constants.ts        # App constants
├── location.ts         # Geolocation utilities
└── zmanim.ts           # Zmanim calculation methods
```

---

## Page Components

### app/page.tsx

Main application page - client-side rendered.

**State Management:**
```typescript
const [publishers, setPublishers] = useState<Publisher[]>([]);
const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);
const [loading, setLoading] = useState(true);
const [zmanimLoading, setZmanimLoading] = useState(false);
const [zmanim, setZmanim] = useState<ZmanimResponse | null>(null);
const [error, setError] = useState<string | null>(null);
const [latitude, setLatitude] = useState(31.7683);  // Default: Jerusalem
const [longitude, setLongitude] = useState(35.2137);
const [timezone, setTimezone] = useState('Asia/Jerusalem');
const [selectedDate, setSelectedDate] = useState<DateTime>(DateTime.now());
```

**Key Functions:**
- `loadPublishers()` - Fetches publishers on mount
- `handleLocationChange(lat, lon, tz)` - Updates location state
- `calculateZmanim()` - Calls API to calculate times

**Layout Sections:**
1. Header with title and description
2. Publisher selection grid
3. Calculation controls (location + date)
4. Calculate button
5. Results display
6. Footer

---

## UI Components

### LocationInput

Handles geographic coordinate input with browser geolocation support.

**File:** `components/LocationInput.tsx`

**Props:**
```typescript
interface LocationInputProps {
  onLocationChange: (latitude: number, longitude: number, timeZone: string) => void;
}
```

**Features:**
- Manual latitude/longitude input with validation
- "Use My Location" button with browser Geolocation API
- Automatic timezone detection
- Error handling for geolocation failures

**Usage:**
```tsx
<LocationInput onLocationChange={handleLocationChange} />
```

---

### DatePicker

Date selection component using Luxon for date handling.

**File:** `components/DatePicker.tsx`

**Props:**
```typescript
interface DatePickerProps {
  onDateChange: (date: DateTime) => void;
}
```

**Features:**
- Native date input
- Formatted date display (weekday, month, day, year)
- "Today" quick-select button

**Usage:**
```tsx
<DatePicker onDateChange={setSelectedDate} />
```

---

### PublisherCard

Displays publisher information with selection state.

**File:** `components/PublisherCard.tsx`

**Props:**
```typescript
interface PublisherCardProps {
  publisher: Publisher;
  onSelect?: (publisher: Publisher) => void;
  isSelected?: boolean;
}
```

**Features:**
- Publisher logo or initial avatar
- Verification badge for verified publishers
- Subscriber count display
- Website link
- Selection state styling
- Hover animations

**Usage:**
```tsx
<PublisherCard
  publisher={publisher}
  onSelect={setSelectedPublisher}
  isSelected={selectedPublisher?.id === publisher.id}
/>
```

---

### MethodCard

Displays calculation method information (for local calculations).

**File:** `components/MethodCard.tsx`

**Usage:** Currently not used in main page flow (available for future use).

---

### ZmanimDisplay

Displays calculated zmanim results.

**File:** `components/ZmanimDisplay.tsx`

**Usage:** Currently not used - results displayed inline in page.tsx.

---

## Library Modules

### lib/api.ts

Typed API client for backend communication.

**Configuration:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
```

**Methods:**
```typescript
class ApiClient {
  healthCheck(): Promise<HealthResponse>;
  getPublishers(params?: { page?: number; page_size?: number; region_id?: string }): Promise<PublisherListResponse>;
  getPublisher(id: string): Promise<Publisher>;
  getLocations(): Promise<LocationListResponse>;
  calculateZmanim(request: ZmanimRequest): Promise<ZmanimResponse>;
}

export const api = new ApiClient();
```

---

### lib/constants.ts

Application constants and configuration.

**Exports:**
```typescript
export const DEFAULT_LOCATION = {
  name: 'Jerusalem',
  latitude: 31.7683,
  longitude: 35.2137,
  timeZone: 'Asia/Jerusalem',
  elevation: 754,
};

export const TIMEZONE_MAPPINGS: Record<string, string>;
export const UI_TEXT: Record<string, string | Record<string, string>>;
export const CATEGORY_COLORS: Record<string, ColorConfig>;
```

---

### lib/location.ts

Geolocation utilities.

**Functions:**
```typescript
// Get user's current location via browser API
getCurrentLocation(): Promise<GeolocationPosition>;

// Create GeoLocation object for kosher-zmanim library
createGeoLocation(locationData: LocationData): GeoLocation;

// Get default location as GeoLocation
getDefaultGeoLocation(): GeoLocation;

// Detect timezone from coordinates (simple approximation)
detectTimeZone(latitude: number, longitude: number): string;

// Validate coordinate ranges
validateCoordinates(latitude: number, longitude: number): ValidationResult;
```

---

### lib/zmanim.ts

Local zmanim calculation using kosher-zmanim library.

**Alos Methods (13 total):**

| ID | Name | Category | Method |
|----|------|----------|--------|
| `alos-60` | Alos 60 Minutes | fixed | 60 min before sunrise |
| `alos-72` | Alos 72 Minutes | fixed | 72 min (Magen Avraham) |
| `alos-90` | Alos 90 Minutes | fixed | 90 min |
| `alos-96` | Alos 96 Minutes | fixed | 96 min |
| `alos-120` | Alos 120 Minutes | fixed | 120 min |
| `alos-72-zmanis` | Alos 72 Zmaniyos | zmaniyos | 1/10th of day |
| `alos-90-zmanis` | Alos 90 Zmaniyos | zmaniyos | 1/8th of day |
| `alos-96-zmanis` | Alos 96 Zmaniyos | zmaniyos | 1/7.5th of day |
| `alos-16-1` | Alos 16.1° | angle | 16.1° below horizon |
| `alos-18` | Alos 18° | angle | 18° (astronomical dawn) |
| `alos-19` | Alos 19° | angle | 19° below horizon |
| `alos-19-8` | Alos 19.8° | angle | 19.8° below horizon |
| `alos-26` | Alos 26° | angle | 26° below horizon |

**Functions:**
```typescript
calculateAllAlosTimes(geoLocation: GeoLocation, date: DateTime): Map<string, DateTime | null>;
getMethodById(id: string): AlosMethod | undefined;
getMethodsByCategory(category: 'fixed' | 'zmaniyos' | 'angle'): AlosMethod[];
```

---

## Styling

### Design System

Apple-inspired design with Tailwind CSS extensions:

**Colors:**
```typescript
colors: {
  apple: {
    blue: '#007AFF',
    gray: { 50-900 scale }
  }
}
```

**Shadows:**
```typescript
boxShadow: {
  'apple': '0 2px 16px rgba(0, 0, 0, 0.08)',
  'apple-lg': '0 4px 24px rgba(0, 0, 0, 0.12)',
  'apple-xl': '0 8px 40px rgba(0, 0, 0, 0.16)',
}
```

**Animations:**
- `fade-in` - Opacity transition
- `slide-up` - Translate + opacity
- `scale-in` - Scale + opacity

**Utility Classes:**
- `.glass` - Frosted glass effect with backdrop blur
- `.card-hover` - Hover lift effect

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8080` |

---

*Generated by BMAD Document Project Workflow - 2025-11-25*
