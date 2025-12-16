# Data Models

This document describes the database schema and corresponding Go/TypeScript models used in Shtetl Zmanim.

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   publishers    │       │   algorithms    │       │ coverage_areas  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ publisher_id(FK)│       │ id (PK)         │
│ name            │       │ id (PK)         │       │ publisher_id(FK)│──┐
│ organization    │       │ name            │       │ name            │  │
│ slug            │       │ version         │       │ boundary (GIS)  │  │
│ email           │       │ formula_def     │       │ priority        │  │
│ description     │       │ calculation_type│       │ is_active       │  │
│ status          │       │ is_active       │       └─────────────────┘  │
│ verified_at     │       └─────────────────┘                            │
└─────────────────┘                │                                     │
        │                          │                                     │
        │                          ▼                                     │
        │               ┌─────────────────────┐                          │
        │               │ calculation_cache   │                          │
        │               ├─────────────────────┤                          │
        │               │ id (PK)             │                          │
        │               │ algorithm_id (FK)   │                          │
        │               │ location_id (FK)    │                          │
        │               │ calculation_date    │                          │
        │               │ zmanim_data (JSON)  │                          │
        │               │ expires_at          │                          │
        │               └─────────────────────┘                          │
        │                                                                │
        ▼                                                                │
┌─────────────────┐       ┌─────────────────┐                            │
│user_subscriptions│      │ geographic_regions│◄───────────────────────────┘
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │       │ name            │
│ publisher_id(FK)│       │ type            │
│ subscribed_at   │       │ location (GIS)  │
└─────────────────┘       │ boundary (GIS)  │
                          │ timezone        │
                          └─────────────────┘
```

---

## Tables

### publishers

Stores halachic authorities who publish zmanim calculations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `organization` | VARCHAR(255) | NOT NULL | Organization name |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Contact email |
| `description` | TEXT | | Publisher description |
| `website` | VARCHAR(500) | | Website URL |
| `logo_url` | VARCHAR(500) | | Logo image URL |
| `contact_info` | JSONB | DEFAULT '{}' | Additional contact info |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending_verification' | pending_verification, verified, active, suspended, retired |
| `verified_at` | TIMESTAMPTZ | | When publisher was verified |
| `verified_by` | UUID | FK → auth.users | Who verified the publisher |
| `metadata` | JSONB | DEFAULT '{}' | Additional metadata |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_publishers_status` on `status`
- `idx_publishers_slug` on `slug`

---

### algorithms

Stores calculation algorithms belonging to publishers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `publisher_id` | UUID | FK → publishers, NOT NULL, ON DELETE CASCADE | Owner publisher |
| `name` | VARCHAR(255) | NOT NULL | Algorithm name |
| `version` | VARCHAR(50) | NOT NULL | Semantic version |
| `description` | TEXT | | Algorithm description |
| `formula_definition` | JSONB | NOT NULL | Algorithm DSL (see below) |
| `calculation_type` | VARCHAR(50) | NOT NULL | solar_depression, fixed_minutes, proportional, custom |
| `validation_status` | VARCHAR(20) | DEFAULT 'pending' | Validation state |
| `validation_results` | JSONB | | Validation output |
| `is_active` | BOOLEAN | DEFAULT FALSE | Active for calculations |
| `published_at` | TIMESTAMPTZ | | When algorithm was published |
| `deprecated_at` | TIMESTAMPTZ | | When algorithm was deprecated |
| `tags` | TEXT[] | DEFAULT '{}' | Searchable tags |
| `metadata` | JSONB | DEFAULT '{}' | Additional metadata |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Constraints:**
- UNIQUE on `(publisher_id, name, version)`
- CHECK on `calculation_type`

**Indexes:**
- `idx_algorithms_publisher` on `publisher_id`
- `idx_algorithms_active` on `is_active`
- `idx_algorithms_type` on `calculation_type`

#### Algorithm Formula DSL

```json
{
  "version": "1.0",
  "type": "solar_depression",
  "zmanim": {
    "alos_hashachar": {
      "method": "solar_angle",
      "angle_degrees": 16.1,
      "direction": "before_sunrise"
    },
    "sunrise": {
      "method": "elevation_adjusted",
      "refraction": 0.833
    },
    "sof_zman_shma": {
      "method": "shaos_zmaniyos",
      "hours": 3,
      "base": "sunrise"
    }
  },
  "shaah_zmanis_method": {
    "type": "gra",
    "start": "sunrise",
    "end": "sunset"
  }
}
```

---

### geographic_regions

Stores geographic locations with PostGIS support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `name` | VARCHAR(255) | NOT NULL | Region name |
| `name_local` | VARCHAR(255) | | Name in local language |
| `type` | VARCHAR(50) | NOT NULL | country, state, city, custom |
| `parent_id` | UUID | FK → geographic_regions | Parent region |
| `location` | GEOGRAPHY(POINT, 4326) | NOT NULL | Center point |
| `boundary` | GEOGRAPHY(POLYGON, 4326) | | Region boundary |
| `country_code` | VARCHAR(2) | | ISO country code |
| `timezone` | VARCHAR(100) | NOT NULL | IANA timezone |
| `elevation` | NUMERIC | | Meters above sea level |
| `population` | INT | | Population count |
| `metadata` | JSONB | DEFAULT '{}' | Additional metadata |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes (PostGIS GIST):**
- `idx_geo_regions_location` on `location`
- `idx_geo_regions_boundary` on `boundary`
- `idx_geo_regions_type` on `type`
- `idx_geo_regions_parent` on `parent_id`

---

### coverage_areas

Defines geographic areas served by each publisher.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `publisher_id` | UUID | FK → publishers, NOT NULL, ON DELETE CASCADE | Owner publisher |
| `name` | VARCHAR(255) | NOT NULL | Coverage area name |
| `description` | TEXT | | Area description |
| `boundary` | GEOGRAPHY(POLYGON, 4326) | NOT NULL | Area boundary |
| `center_point` | GEOGRAPHY(POINT, 4326) | | Center of area |
| `priority` | INT | DEFAULT 0 | Selection priority (higher = preferred) |
| `country_code` | VARCHAR(2) | | ISO country code |
| `region` | VARCHAR(100) | | Region/state name |
| `city` | VARCHAR(100) | | City name |
| `is_active` | BOOLEAN | DEFAULT TRUE | Active for lookup |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_coverage_publisher` on `publisher_id`
- `idx_coverage_boundary` GIST on `boundary`
- `idx_coverage_center` GIST on `center_point`
- `idx_coverage_active` on `is_active`

---

### calculation_cache

Caches zmanim calculation results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `algorithm_id` | UUID | FK → algorithms, NOT NULL, ON DELETE CASCADE | Algorithm used |
| `location_id` | UUID | FK → geographic_regions, NOT NULL | Location reference |
| `calculation_date` | DATE | NOT NULL | Date of calculation |
| `zmanim_data` | JSONB | NOT NULL | Calculated times |
| `calculated_at` | TIMESTAMPTZ | DEFAULT NOW() | When calculated |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Cache expiration |
| `hit_count` | INT | DEFAULT 0 | Cache hit counter |

**Constraints:**
- UNIQUE on `(algorithm_id, location_id, calculation_date)`

**Indexes:**
- `idx_calc_cache_algo_loc_date` on `(algorithm_id, location_id, calculation_date)`
- `idx_calc_cache_expires` on `expires_at`

---

### user_profiles

Stores user profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, FK → auth.users, ON DELETE CASCADE | User ID |
| `display_name` | VARCHAR(255) | | Display name |
| `avatar_url` | VARCHAR(500) | | Avatar image URL |
| `preferences` | JSONB | DEFAULT '{}' | User preferences |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

---

### user_subscriptions

Links users to their subscribed publishers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → auth.users, NOT NULL, ON DELETE CASCADE | Subscriber |
| `publisher_id` | UUID | FK → publishers, NOT NULL, ON DELETE CASCADE | Publisher |
| `subscribed_at` | TIMESTAMPTZ | DEFAULT NOW() | Subscription time |

**Constraints:**
- UNIQUE on `(user_id, publisher_id)`

**Indexes:**
- `idx_user_subs_user` on `user_id`
- `idx_user_subs_publisher` on `publisher_id`

---

### audit_logs

Tracks changes to entities for compliance and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `entity_type` | VARCHAR(50) | NOT NULL | Type of entity (publisher, algorithm, etc.) |
| `entity_id` | UUID | NOT NULL | ID of affected entity |
| `action` | VARCHAR(50) | NOT NULL | Action performed (create, update, delete) |
| `actor_id` | UUID | FK → auth.users | User who performed action |
| `changes` | JSONB | | Before/after values |
| `metadata` | JSONB | DEFAULT '{}' | Additional context |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When action occurred |

**Indexes:**
- `idx_audit_entity` on `(entity_type, entity_id)`
- `idx_audit_actor` on `actor_id`
- `idx_audit_created` on `created_at`

---

## Go Models

Located in `backend/internal/models/models.go`:

```go
// Publisher represents a zmanim calculation publisher
type Publisher struct {
    ID              string    `json:"id"`
    Name            string    `json:"name"`
    Description     string    `json:"description"`
    Website         string    `json:"website"`
    ContactEmail    string    `json:"contact_email"`
    LogoURL         *string   `json:"logo_url,omitempty"`
    IsVerified      bool      `json:"is_verified"`
    SubscriberCount int       `json:"subscriber_count"`
    CreatedAt       time.Time `json:"created_at"`
    UpdatedAt       time.Time `json:"updated_at"`
}

// Algorithm represents a calculation algorithm
type Algorithm struct {
    ID            string     `json:"id"`
    PublisherID   string     `json:"publisher_id"`
    Name          string     `json:"name"`
    Description   string     `json:"description"`
    Version       string     `json:"version"`
    Configuration pgtype.Map `json:"configuration"`
    IsActive      bool       `json:"is_active"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
}

// ZmanimRequest represents a request for zmanim calculations
type ZmanimRequest struct {
    Date        string  `json:"date"`
    Latitude    float64 `json:"latitude"`
    Longitude   float64 `json:"longitude"`
    Timezone    string  `json:"timezone"`
    PublisherID *string `json:"publisher_id,omitempty"`
    Elevation   *int    `json:"elevation,omitempty"`
}

// ZmanimResponse represents the response containing calculated zmanim
type ZmanimResponse struct {
    Date         string            `json:"date"`
    Location     Location          `json:"location"`
    Publisher    *Publisher        `json:"publisher,omitempty"`
    Algorithm    *Algorithm        `json:"algorithm,omitempty"`
    Zmanim       map[string]string `json:"zmanim"`
    CachedAt     *time.Time        `json:"cached_at,omitempty"`
    CalculatedAt time.Time         `json:"calculated_at"`
}
```

---

## TypeScript Models

Located in `lib/api.ts`:

```typescript
export interface Publisher {
  id: string;
  name: string;
  description: string;
  website: string;
  contact_email: string;
  logo_url?: string;
  is_verified: boolean;
  subscriber_count: number;
  created_at: string;
  updated_at: string;
}

export interface Algorithm {
  id: string;
  publisher_id: string;
  name: string;
  description: string;
  version: string;
  configuration: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZmanimRequest {
  date: string;
  latitude: number;
  longitude: number;
  timezone: string;
  publisher_id?: string;
  elevation?: number;
}

export interface ZmanimResponse {
  date: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    elevation?: number;
  };
  publisher?: Publisher;
  algorithm?: Algorithm;
  zmanim: Record<string, string>;
  cached_at?: string;
  calculated_at: string;
}
```

---

*Generated by BMAD Document Project Workflow - 2025-11-25*
