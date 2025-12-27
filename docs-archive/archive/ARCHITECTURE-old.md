> **ARCHIVED DOCUMENT**: This file is historical and references outdated technology (Supabase).
> The project now uses Xata for PostgreSQL hosting. See `docs/ARCHITECTURE.md` for current architecture.

# Shtetl Zmanim - System Architecture Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Diagrams](#architecture-diagrams)
4. [Technology Stack](#technology-stack)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [Publisher System](#publisher-system)
8. [Authentication & Authorization](#authentication--authorization)
9. [Data Flow](#data-flow)
10. [Deployment Architecture](#deployment-architecture)
11. [Security Considerations](#security-considerations)
12. [Scalability & Performance](#scalability--performance)

---

## Executive Summary

Shtetl Zmanim is a multi-publisher platform for calculating Jewish Zmanim (zmanim) based on various halachic (Jewish legal) calculation methods. The system enables religious authorities and organizations to publish their own calculation algorithms and geographic coverage, while users can discover and consume zmanim data for their locations.

### Key Features
- **Multi-Publisher Architecture**: Religious authorities maintain independent calculation methods
- **Real-Time Calculations**: On-demand zmanim computation via REST API
- **Geographic Coverage**: Publishers define service areas with flexible geographic boundaries
- **Algorithm Flexibility**: Publishers have full control over calculation formulas
- **User Discovery**: Location-based search to find relevant publishers
- **Modern Stack**: Go backend, Supabase database, Next.js frontend (web + admin)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  ┌──────────────┐                        ┌──────────────┐       │
│  │   Web App    │                        │  Admin Panel │       │
│  │  (Next.js)   │                        │  (Next.js)   │       │
│  └──────┬───────┘                        └──────┬───────┘       │
│         │                                        │               │
└─────────┼────────────────────────────────────────┼───────────────┘
          │                                        │
          └────────────────┬───────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                   REST API LAYER (Go)                             │
│                          │                                        │
│  ┌───────────────────────┴────────────────────────┐              │
│  │                                                 │              │
│  │  ┌──────────────┐  ┌──────────────┐           │              │
│  │  │   REST API   │  │  Middleware  │           │              │
│  │  │   Handlers   │  │ (Auth/CORS)  │           │              │
│  │  └──────────────┘  └──────────────┘           │              │
│  └──────────────────────────────────────────────┘               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                   SERVICE LAYER (Go)                              │
│                            │                                      │
│  ┌──────────────┬─────────┴────────┬────────────┬──────────┐    │
│  │              │                  │            │          │    │
│  │  Publisher   │   Calculation    │  Location  │   User   │    │
│  │   Service    │    Service       │  Service   │ Service  │    │
│  │              │                  │            │          │    │
│  └──────┬───────┴──────────┬───────┴─────┬──────┴────┬─────┘    │
│         │                  │             │           │          │
└─────────┼──────────────────┼─────────────┼───────────┼──────────┘
          │                  │             │           │
┌─────────┼──────────────────┼─────────────┼───────────┼──────────┐
│         │           DATA LAYER            │           │          │
│         │                  │             │           │          │
│  ┌──────▼─────┐    ┌──────▼────┐  ┌─────▼──────┐ ┌──▼───────┐ │
│  │  Supabase  │    │  Redis    │  │PostGIS Ext.│ │  Auth    │ │
│  │ PostgreSQL │    │  Cache    │  │ (Geo Data) │ │ Service  │ │
│  └────────────┘    └───────────┘  └────────────┘ └──────────┘ │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                    PUBLISHER INTEGRATION                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Algorithm   │  │   Coverage   │  │  Validation  │           │
│  │    Engine    │  │   Manager    │  │    Engine    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Frontend Layer (Next.js)
- **Web Application**: User-facing interface for searching locations and viewing zmanim
- **Admin Panel**: Publisher management interface for algorithm configuration

#### REST API Layer (Go)
- Request routing and handling
- Rate limiting and throttling
- API versioning
- Request/response transformation
- CORS and security middleware

#### Service Layer (Go)
- **Publisher Service**: CRUD operations for publisher data, algorithm management
- **Calculation Service**: Executes calculation algorithms, caching strategy
- **Location Service**: Geographic search, coverage matching, geocoding
- **User Service**: User management, preferences, subscriptions

#### Data Layer
- **Supabase PostgreSQL**: Primary data store with PostGIS extension
- **Redis**: High-performance caching layer
- **Auth Service**: Supabase Auth for authentication

---

## Architecture Diagrams

### System Context Diagram

```mermaid
graph TB
    User[End Users] -->|Search & View| WebApp[Next.js Web App]
    Publisher[Publishers/Rabbis] -->|Manage Algorithms| AdminPanel[Admin Panel]
    WebApp -->|REST API| GoAPI[Go REST API]
    AdminPanel -->|REST API| GoAPI
    GoAPI -->|Query/Store| Supabase[(Supabase PostgreSQL)]
    GoAPI -->|Cache| Redis[(Redis Cache)]
    GoAPI -->|Auth| SupabaseAuth[Supabase Auth]

    style User fill:#e1f5ff
    style Publisher fill:#ffe1e1
    style Supabase fill:#00f
    style Redis fill:#f00
```

### Data Flow: Calculate Zmanim

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant A as API Gateway
    participant C as Calculation Service
    participant P as Publisher Service
    participant R as Redis
    participant D as Database

    U->>W: Search location "Jerusalem"
    W->>A: GET /api/v1/locations?query=Jerusalem
    A->>D: Query geographic data
    D-->>A: Location results
    A-->>W: Available locations
    W->>U: Display locations

    U->>W: Select location + publisher
    W->>A: GET /api/v1/publishers/available?location_id=123
    A->>P: Get publishers for location
    P->>D: Query publisher coverage
    D-->>P: Publisher list
    P-->>A: Available publishers
    A-->>W: Publisher options
    W->>U: Display publishers

    U->>W: Request zmanim calculation
    W->>A: POST /api/v1/zmanim/calculate
    A->>C: Calculate(location, date, publisher_id)

    C->>R: Check cache
    alt Cache Hit
        R-->>C: Cached zmanim
    else Cache Miss
        C->>D: Fetch algorithm
        D-->>C: Algorithm definition
        C->>C: Execute calculation
        C->>R: Store result
    end

    C-->>A: Zmanim data
    A-->>W: JSON response
    W->>U: Display zmanim table
```

### Publisher Workflow

```mermaid
stateDiagram-v2
    [*] --> Registration: Publisher Signs Up
    Registration --> PendingVerification: Submit Details
    PendingVerification --> Verified: Admin Approval
    PendingVerification --> Rejected: Admin Rejects
    Rejected --> [*]

    Verified --> DefineAlgorithm: Create Algorithm
    DefineAlgorithm --> TestingPhase: Submit for Testing
    TestingPhase --> ValidationFailed: Tests Fail
    ValidationFailed --> DefineAlgorithm: Revise
    TestingPhase --> Active: Tests Pass

    Active --> DefineCoverage: Set Geographic Areas
    DefineCoverage --> Publishing: Enable Publishing
    Publishing --> Monitoring: Live & Serving

    Monitoring --> Suspended: Issues Detected
    Suspended --> Monitoring: Issues Resolved
    Monitoring --> Retired: Publisher Deactivates
    Retired --> [*]
```

---

## Technology Stack

### Backend (Go)
```go
// Core Framework
- Chi Router (lightweight, fast HTTP router)
- Standard library (net/http)

// Database & ORM
- pgx (PostgreSQL driver)
- sqlc (type-safe SQL)
- PostGIS integration

// Caching
- go-redis/redis
- BigCache (in-memory)

// Calculation Engine
- Custom solar calculation library
- go-astro (astronomical calculations)
- go-sundial (time zone handling)

// Authentication
- Supabase Go Client
- JWT validation

// Observability
- OpenTelemetry
- Prometheus metrics
- Structured logging (zerolog)

// Testing
- testify
- sqlmock
- httptest
```

### Frontend (Next.js)
```javascript
// Framework
- Next.js 16.x (App Router)
- React 19.x
- TypeScript

// UI Components
- Tailwind CSS
- Radix UI primitives
- shadcn/ui components

// State Management
- Zustand
- React Query (TanStack Query)

// Maps & Geo
- Mapbox GL JS
- react-map-gl

// API Client
- Axios

// Forms
- React Hook Form
- Zod validation

// Calculations (client-side fallback)
- kosher-zmanim library
- Luxon (date/time)
```

### Database (Supabase)
```sql
-- PostgreSQL 15+
-- PostGIS extension (geographic calculations)
-- pg_cron (scheduled jobs)
-- Supabase Auth
-- Supabase Storage (algorithm assets)
```

### Infrastructure
```yaml
Backend Hosting: Google Cloud Run / AWS ECS
Database: Supabase (managed PostgreSQL)
Cache: Upstash Redis / AWS ElastiCache
CDN: Cloudflare
Frontend: Vercel
Monitoring: Datadog / New Relic
CI/CD: GitHub Actions
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    PUBLISHERS ||--o{ ALGORITHMS : creates
    PUBLISHERS ||--o{ COVERAGE_AREAS : defines
    PUBLISHERS ||--o{ API_KEYS : owns
    ALGORITHMS ||--o{ ALGORITHM_PARAMETERS : has
    ALGORITHMS ||--o{ CALCULATION_METHODS : uses
    COVERAGE_AREAS }o--|| GEOGRAPHIC_REGIONS : references
    USERS ||--o{ USER_PREFERENCES : has
    USERS ||--o{ USER_SUBSCRIPTIONS : subscribes
    USER_SUBSCRIPTIONS }o--|| PUBLISHERS : follows
    CALCULATION_CACHE ||--|| ALGORITHMS : for
    AUDIT_LOGS }o--|| PUBLISHERS : tracks

    PUBLISHERS {
        uuid id PK
        string name
        string organization
        string email
        string description
        string website
        json contact_info
        enum status
        timestamp verified_at
        uuid verified_by FK
        timestamp created_at
        timestamp updated_at
    }

    ALGORITHMS {
        uuid id PK
        uuid publisher_id FK
        string name
        string version
        text description
        jsonb formula_definition
        enum calculation_type
        boolean is_active
        timestamp published_at
        timestamp created_at
        timestamp updated_at
    }

    COVERAGE_AREAS {
        uuid id PK
        uuid publisher_id FK
        string name
        geography boundary
        int priority
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    USERS {
        uuid id PK
        string email
        string name
        json preferences
        timestamp created_at
        timestamp updated_at
    }
```

### Detailed Schema Definition

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Publishers table
CREATE TABLE publishers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    website VARCHAR(500),
    logo_url VARCHAR(500),
    contact_info JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
    -- Status: pending_verification, verified, active, suspended, retired
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT publishers_status_check
        CHECK (status IN ('pending_verification', 'verified', 'active', 'suspended', 'retired'))
);

CREATE INDEX idx_publishers_status ON publishers(status);
CREATE INDEX idx_publishers_slug ON publishers(slug);

-- Algorithms table
CREATE TABLE algorithms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,

    -- Core formula definition (JSON structure defined below)
    formula_definition JSONB NOT NULL,

    -- Calculation type enum
    calculation_type VARCHAR(50) NOT NULL,
    -- Types: solar_depression, fixed_minutes, proportional, custom

    -- Validation results
    validation_status VARCHAR(20) DEFAULT 'pending',
    validation_results JSONB,

    -- Publishing status
    is_active BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT algorithms_version_unique UNIQUE (publisher_id, name, version),
    CONSTRAINT algorithms_calc_type_check
        CHECK (calculation_type IN ('solar_depression', 'fixed_minutes', 'proportional', 'custom'))
);

CREATE INDEX idx_algorithms_publisher ON algorithms(publisher_id);
CREATE INDEX idx_algorithms_active ON algorithms(is_active);
CREATE INDEX idx_algorithms_type ON algorithms(calculation_type);

-- Algorithm Parameters (configurable values)
CREATE TABLE algorithm_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorithm_id UUID NOT NULL REFERENCES algorithms(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_type VARCHAR(50) NOT NULL,
    -- Types: number, angle, duration, boolean, string
    default_value JSONB NOT NULL,
    min_value NUMERIC,
    max_value NUMERIC,
    unit VARCHAR(50),
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,

    CONSTRAINT algorithm_params_unique UNIQUE (algorithm_id, parameter_name)
);

CREATE INDEX idx_algo_params_algorithm ON algorithm_parameters(algorithm_id);

-- Calculation Methods (predefined zmanim types)
CREATE TABLE calculation_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorithm_id UUID NOT NULL REFERENCES algorithms(id) ON DELETE CASCADE,
    zman_type VARCHAR(100) NOT NULL,
    -- Types: alos, sunrise, sunset, sof_zman_shma, sof_zman_tefillah,
    --        chatzos, mincha_gedola, mincha_ketana, plag_hamincha,
    --        shkiah, tzeis, chatzos_halailah, etc.

    -- Method-specific formula
    formula_override JSONB,

    -- Dependencies on other zmanim
    dependencies TEXT[] DEFAULT '{}',

    -- Calculation order (for dependency resolution)
    calculation_order INT DEFAULT 0,

    is_enabled BOOLEAN DEFAULT TRUE,

    CONSTRAINT calc_methods_unique UNIQUE (algorithm_id, zman_type)
);

CREATE INDEX idx_calc_methods_algorithm ON calculation_methods(algorithm_id);
CREATE INDEX idx_calc_methods_type ON calculation_methods(zman_type);

-- Geographic Coverage Areas
CREATE TABLE coverage_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Geographic boundary (PostGIS geometry)
    boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,

    -- Center point for searching
    center_point GEOGRAPHY(POINT, 4326),

    -- Priority when multiple publishers cover same area
    priority INT DEFAULT 0,

    -- Administrative info
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coverage_publisher ON coverage_areas(publisher_id);
CREATE INDEX idx_coverage_boundary ON coverage_areas USING GIST(boundary);
CREATE INDEX idx_coverage_center ON coverage_areas USING GIST(center_point);
CREATE INDEX idx_coverage_active ON coverage_areas(is_active);

-- Geographic Regions (for common location searches)
CREATE TABLE geographic_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_local VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    -- Types: country, state, city, neighborhood, custom
    parent_id UUID REFERENCES geographic_regions(id),

    -- Geographic data
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    boundary GEOGRAPHY(POLYGON, 4326),

    -- Administrative data
    country_code VARCHAR(2),
    timezone VARCHAR(100) NOT NULL,
    elevation NUMERIC,

    -- Population (for ranking search results)
    population INT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_geo_regions_location ON geographic_regions USING GIST(location);
CREATE INDEX idx_geo_regions_boundary ON geographic_regions USING GIST(boundary);
CREATE INDEX idx_geo_regions_type ON geographic_regions(type);
CREATE INDEX idx_geo_regions_parent ON geographic_regions(parent_id);

-- Users table (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    -- Preferences: default_location, preferred_publishers, display_settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions (following publishers)
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT user_subscriptions_unique UNIQUE (user_id, publisher_id)
);

CREATE INDEX idx_user_subs_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subs_publisher ON user_subscriptions(publisher_id);

-- API Keys for publishers
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_publisher ON api_keys(publisher_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Calculation Cache (for performance)
CREATE TABLE calculation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorithm_id UUID NOT NULL REFERENCES algorithms(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES geographic_regions(id),
    calculation_date DATE NOT NULL,

    -- Cached zmanim data
    zmanim_data JSONB NOT NULL,

    -- Cache metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INT DEFAULT 0,

    CONSTRAINT calc_cache_unique UNIQUE (algorithm_id, location_id, calculation_date)
);

CREATE INDEX idx_calc_cache_algo_loc_date ON calculation_cache(algorithm_id, location_id, calculation_date);
CREATE INDEX idx_calc_cache_expires ON calculation_cache(expires_at);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    changes JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_publishers_updated_at BEFORE UPDATE ON publishers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_algorithms_updated_at BEFORE UPDATE ON algorithms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coverage_areas_updated_at BEFORE UPDATE ON coverage_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geo_regions_updated_at BEFORE UPDATE ON geographic_regions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Algorithm Formula Definition Schema

The `formula_definition` JSONB field follows this structure:

```json
{
  "version": "1.0",
  "type": "solar_depression",
  "base_calculations": {
    "sunrise": {
      "method": "elevation_adjusted",
      "refraction": 0.833
    },
    "sunset": {
      "method": "elevation_adjusted",
      "refraction": 0.833
    }
  },
  "zmanim": {
    "alos_hashachar": {
      "method": "solar_angle",
      "angle_degrees": 16.1,
      "direction": "before_sunrise"
    },
    "sof_zman_shma": {
      "method": "shaos_zmaniyos",
      "hours": 3,
      "base": "sunrise"
    },
    "sof_zman_tefillah": {
      "method": "shaos_zmaniyos",
      "hours": 4,
      "base": "sunrise"
    },
    "chatzos": {
      "method": "midpoint",
      "between": ["sunrise", "sunset"]
    },
    "mincha_gedola": {
      "method": "fixed_offset",
      "minutes": 30,
      "base": "chatzos",
      "direction": "after"
    },
    "mincha_ketana": {
      "method": "shaos_zmaniyos",
      "hours": 9.5,
      "base": "sunrise"
    },
    "plag_hamincha": {
      "method": "shaos_zmaniyos",
      "hours": 10.75,
      "base": "sunrise"
    },
    "tzeis": {
      "method": "solar_angle",
      "angle_degrees": 8.5,
      "direction": "after_sunset"
    },
    "chatzos_halailah": {
      "method": "solar_midnight"
    }
  },
  "shaah_zmanis_method": {
    "type": "gra",
    "start": "sunrise",
    "end": "sunset"
  },
  "special_rules": {
    "high_latitude_threshold": 60,
    "high_latitude_fallback": "nearest_calculation",
    "min_daylight_hours": 6
  }
}
```

---

## API Design

### API Architecture Principles

1. **RESTful Design**: Standard HTTP methods and status codes
2. **Versioning**: URL-based versioning (`/api/v1/`)
3. **JSON Payloads**: All requests and responses use JSON
4. **Authentication**: JWT-based with Supabase Auth
5. **Rate Limiting**: Per-endpoint and per-user limits
6. **Pagination**: Cursor-based for large datasets
7. **Error Handling**: Consistent error response format

### Base URL Structure

```
Production:  https://api.zmanim.lab/v1
Staging:     https://api-staging.zmanim.lab/v1
Development: http://localhost:8080/api/v1
```

### Authentication

All authenticated endpoints require JWT token in header:
```
Authorization: Bearer <jwt_token>
```

### Core API Endpoints

#### 1. Location Search & Discovery

```go
// Search for locations
GET /api/v1/locations/search
Query Parameters:
  - q: string (search query)
  - lat: float (optional, for proximity search)
  - lng: float (optional, for proximity search)
  - limit: int (default: 10, max: 50)
  - offset: int (default: 0)

Response: 200 OK
{
  "locations": [
    {
      "id": "uuid",
      "name": "Jerusalem",
      "name_local": "ירושלים",
      "type": "city",
      "country_code": "IL",
      "timezone": "Asia/Jerusalem",
      "coordinates": {
        "lat": 31.7683,
        "lng": 35.2137
      },
      "elevation": 754,
      "population": 936425
    }
  ],
  "total": 1,
  "has_more": false
}
```

```go
// Get location details
GET /api/v1/locations/:id

Response: 200 OK
{
  "id": "uuid",
  "name": "Jerusalem",
  "name_local": "ירושלים",
  "type": "city",
  "parent": {
    "id": "uuid",
    "name": "Israel",
    "type": "country"
  },
  "coordinates": {
    "lat": 31.7683,
    "lng": 35.2137
  },
  "timezone": "Asia/Jerusalem",
  "elevation": 754,
  "metadata": {
    "population": 936425,
    "area_km2": 125
  },
  "available_publishers": [
    {
      "id": "uuid",
      "name": "Chief Rabbinate of Israel",
      "coverage_priority": 10
    }
  ]
}
```

#### 2. Publisher Management

```go
// List publishers
GET /api/v1/publishers
Query Parameters:
  - status: string (verified, active, all)
  - location_id: uuid (filter by coverage)
  - limit: int (default: 20)
  - cursor: string (pagination)

Response: 200 OK
{
  "publishers": [
    {
      "id": "uuid",
      "name": "Chief Rabbinate of Israel",
      "organization": "Israel Chief Rabbinate",
      "slug": "israel-chief-rabbinate",
      "description": "Official Jewish legal authority in Israel",
      "logo_url": "https://cdn.zmanim.lab/logos/rabbi-israel.png",
      "website": "https://www.rabbinate.gov.il",
      "status": "active",
      "algorithms_count": 5,
      "coverage_areas_count": 1,
      "subscribers_count": 15420,
      "verified_at": "2024-01-15T10:00:00Z"
    }
  ],
  "cursor": "next_page_token",
  "has_more": true
}
```

```go
// Get publisher details
GET /api/v1/publishers/:id

Response: 200 OK
{
  "id": "uuid",
  "name": "Chief Rabbinate of Israel",
  "organization": "Israel Chief Rabbinate",
  "slug": "israel-chief-rabbinate",
  "description": "Official calculations for Israel",
  "logo_url": "https://cdn.zmanim.lab/logos/rabbi-israel.png",
  "website": "https://www.rabbinate.gov.il",
  "contact_info": {
    "email": "info@rabbinate.gov.il",
    "phone": "+972-2-531-1211"
  },
  "status": "active",
  "verified_at": "2024-01-15T10:00:00Z",
  "algorithms": [
    {
      "id": "uuid",
      "name": "Standard Israeli Calculation",
      "version": "2.0",
      "calculation_type": "solar_depression",
      "is_active": true,
      "published_at": "2024-03-01T00:00:00Z"
    }
  ],
  "coverage_areas": [
    {
      "id": "uuid",
      "name": "All of Israel",
      "center": {
        "lat": 31.5,
        "lng": 34.9
      }
    }
  ],
  "statistics": {
    "total_calculations": 1500000,
    "subscribers_count": 15420,
    "active_users_30d": 8500
  }
}
```

```go
// Create publisher (authenticated admin only)
POST /api/v1/publishers
Authorization: Bearer <admin_token>

Request Body:
{
  "name": "Bais HaVaad Halacha Center",
  "organization": "Bais HaVaad",
  "email": "admin@baishavaad.org",
  "description": "Contemporary halachic authority",
  "website": "https://www.baishavaad.org",
  "contact_info": {
    "phone": "+1-732-xxx-xxxx"
  }
}

Response: 201 Created
{
  "id": "uuid",
  "name": "Bais HaVaad Halacha Center",
  "status": "pending_verification",
  "created_at": "2024-11-24T19:00:00Z"
}
```

#### 3. Algorithm Management

```go
// List algorithms for a publisher
GET /api/v1/publishers/:publisher_id/algorithms

Response: 200 OK
{
  "algorithms": [
    {
      "id": "uuid",
      "name": "Standard Calculation",
      "version": "2.0",
      "description": "Based on 16.1° depression angle",
      "calculation_type": "solar_depression",
      "is_active": true,
      "published_at": "2024-03-01T00:00:00Z",
      "supported_zmanim": [
        "alos_hashachar",
        "sunrise",
        "sof_zman_shma",
        "sof_zman_tefillah",
        "chatzos",
        "mincha_gedola",
        "mincha_ketana",
        "plag_hamincha",
        "sunset",
        "tzeis",
        "chatzos_halailah"
      ]
    }
  ]
}
```

```go
// Create algorithm (authenticated publisher only)
POST /api/v1/publishers/:publisher_id/algorithms
Authorization: Bearer <publisher_token>

Request Body:
{
  "name": "Enhanced Calculation Method",
  "version": "1.0",
  "description": "Custom calculation for northern latitudes",
  "calculation_type": "custom",
  "formula_definition": {
    // See Algorithm Formula Definition Schema above
  },
  "tags": ["northern_latitudes", "enhanced"]
}

Response: 201 Created
{
  "id": "uuid",
  "name": "Enhanced Calculation Method",
  "validation_status": "pending",
  "created_at": "2024-11-24T19:00:00Z"
}
```

```go
// Update algorithm
PATCH /api/v1/algorithms/:id
Authorization: Bearer <publisher_token>

Request Body:
{
  "description": "Updated description",
  "is_active": true
}

Response: 200 OK
```

#### 4. Zmanim Calculations

```go
// Calculate zmanim for specific location and date
POST /api/v1/zmanim/calculate

Request Body:
{
  "location_id": "uuid", // OR coordinates
  "coordinates": {
    "lat": 31.7683,
    "lng": 35.2137,
    "elevation": 754
  },
  "date": "2024-11-24",
  "publisher_id": "uuid",
  "algorithm_id": "uuid", // Optional, uses publisher's default
  "timezone": "Asia/Jerusalem"
}

Response: 200 OK
{
  "calculation_id": "uuid",
  "location": {
    "name": "Jerusalem",
    "coordinates": {
      "lat": 31.7683,
      "lng": 35.2137
    },
    "timezone": "Asia/Jerusalem"
  },
  "date": "2024-11-24",
  "publisher": {
    "id": "uuid",
    "name": "Chief Rabbinate of Israel"
  },
  "algorithm": {
    "id": "uuid",
    "name": "Standard Calculation",
    "version": "2.0"
  },
  "zmanim": {
    "alos_hashachar": {
      "time": "2024-11-24T04:47:23Z",
      "method": "solar_angle",
      "parameters": {
        "angle_degrees": 16.1
      }
    },
    "sunrise": {
      "time": "2024-11-24T06:03:45Z",
      "method": "elevation_adjusted"
    },
    "sof_zman_shma": {
      "time": "2024-11-24T09:12:30Z",
      "method": "shaos_zmaniyos",
      "parameters": {
        "hours": 3
      }
    },
    "sof_zman_tefillah": {
      "time": "2024-11-24T10:18:15Z",
      "method": "shaos_zmaniyos",
      "parameters": {
        "hours": 4
      }
    },
    "chatzos": {
      "time": "2024-11-24T11:40:00Z",
      "method": "solar_noon"
    },
    "mincha_gedola": {
      "time": "2024-11-24T12:10:00Z",
      "method": "fixed_offset",
      "parameters": {
        "minutes": 30
      }
    },
    "mincha_ketana": {
      "time": "2024-11-24T14:52:45Z",
      "method": "shaos_zmaniyos",
      "parameters": {
        "hours": 9.5
      }
    },
    "plag_hamincha": {
      "time": "2024-11-24T15:58:30Z",
      "method": "shaos_zmaniyos",
      "parameters": {
        "hours": 10.75
      }
    },
    "sunset": {
      "time": "2024-11-24T17:16:15Z",
      "method": "elevation_adjusted"
    },
    "tzeis": {
      "time": "2024-11-24T17:52:00Z",
      "method": "solar_angle",
      "parameters": {
        "angle_degrees": 8.5
      }
    },
    "chatzos_halailah": {
      "time": "2024-11-24T23:40:00Z",
      "method": "solar_midnight"
    }
  },
  "metadata": {
    "calculation_duration_ms": 45,
    "cached": false,
    "shaah_zmanis_minutes": 65.75
  },
  "calculated_at": "2024-11-24T19:00:00Z"
}
```

#### 5. Coverage Areas

```go
// Get publishers available for location
GET /api/v1/locations/:location_id/publishers

Response: 200 OK
{
  "location": {
    "id": "uuid",
    "name": "Jerusalem"
  },
  "publishers": [
    {
      "id": "uuid",
      "name": "Chief Rabbinate of Israel",
      "coverage_priority": 10,
      "distance_km": 0,
      "algorithms_count": 5
    },
    {
      "id": "uuid",
      "name": "OU Israel Center",
      "coverage_priority": 5,
      "distance_km": 2.5,
      "algorithms_count": 3
    }
  ]
}
```

```go
// Create coverage area (authenticated publisher only)
POST /api/v1/publishers/:publisher_id/coverage
Authorization: Bearer <publisher_token>

Request Body:
{
  "name": "Greater Tel Aviv",
  "description": "Coverage for Tel Aviv metropolitan area",
  "boundary": {
    "type": "Polygon",
    "coordinates": [
      [
        [34.7, 32.0],
        [34.9, 32.0],
        [34.9, 32.2],
        [34.7, 32.2],
        [34.7, 32.0]
      ]
    ]
  },
  "priority": 5
}

Response: 201 Created
```

#### 6. User Management

```go
// Subscribe to publisher
POST /api/v1/users/subscriptions
Authorization: Bearer <user_token>

Request Body:
{
  "publisher_id": "uuid"
}

Response: 201 Created
{
  "id": "uuid",
  "publisher": {
    "id": "uuid",
    "name": "Chief Rabbinate of Israel"
  },
  "subscribed_at": "2024-11-24T19:00:00Z"
}
```

```go
// Get user's subscriptions
GET /api/v1/users/subscriptions
Authorization: Bearer <user_token>

Response: 200 OK
{
  "subscriptions": [
    {
      "id": "uuid",
      "publisher": {
        "id": "uuid",
        "name": "Chief Rabbinate of Israel",
        "logo_url": "https://..."
      },
      "subscribed_at": "2024-11-24T19:00:00Z"
    }
  ]
}
```

### Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid location coordinates",
    "details": {
      "field": "coordinates.lat",
      "reason": "Latitude must be between -90 and 90"
    },
    "request_id": "req_abc123xyz"
  }
}
```

Standard Error Codes:
- `VALIDATION_ERROR` (400)
- `AUTHENTICATION_ERROR` (401)
- `AUTHORIZATION_ERROR` (403)
- `NOT_FOUND` (404)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)
- `SERVICE_UNAVAILABLE` (503)

---

## Publisher System

### Publisher Lifecycle

```mermaid
graph LR
    A[Registration] --> B{Admin Review}
    B -->|Approved| C[Verified]
    B -->|Rejected| D[Rejected]
    C --> E[Create Algorithm]
    E --> F[Test & Validate]
    F --> G{Tests Pass?}
    G -->|Yes| H[Active]
    G -->|No| E
    H --> I[Define Coverage]
    I --> J[Publishing]
    J --> K[Monitor]
    K -->|Issues| L[Suspended]
    L -->|Fixed| K
    K -->|Retire| M[Retired]
```

### Algorithm Definition System

Publishers define algorithms using a flexible JSON-based DSL (Domain Specific Language):

#### Calculation Types

1. **Solar Depression Angle**
```json
{
  "method": "solar_angle",
  "angle_degrees": 16.1,
  "direction": "before_sunrise"
}
```

2. **Fixed Time Offset**
```json
{
  "method": "fixed_offset",
  "minutes": 72,
  "base": "sunrise",
  "direction": "before"
}
```

3. **Proportional Hours (Shaos Zmaniyos)**
```json
{
  "method": "shaos_zmaniyos",
  "hours": 3,
  "base": "sunrise",
  "shaah_zmanis_method": {
    "type": "gra",
    "start": "sunrise",
    "end": "sunset"
  }
}
```

4. **Custom Formula**
```json
{
  "method": "custom",
  "formula": "sunrise + (sunset - sunrise) * 0.25",
  "dependencies": ["sunrise", "sunset"]
}
```

### Validation Engine

The validation engine tests algorithms against known datasets:

```go
type ValidationTest struct {
    TestID      string
    Location    Coordinates
    Date        time.Time
    ExpectedValues map[string]time.Time
    Tolerance   time.Duration
}

// Example validation tests
var StandardValidationTests = []ValidationTest{
    {
        TestID: "jerusalem_standard",
        Location: Coordinates{Lat: 31.7683, Lng: 35.2137},
        Date: time.Date(2024, 3, 21, 0, 0, 0, 0, time.UTC),
        ExpectedValues: map[string]time.Time{
            "sunrise": time.Date(2024, 3, 21, 6, 3, 0, 0, time.UTC),
            "sunset":  time.Date(2024, 3, 21, 18, 12, 0, 0, time.UTC),
        },
        Tolerance: 2 * time.Minute,
    },
    // More test cases...
}
```

### Coverage Management

Publishers define geographic coverage using GeoJSON:

```json
{
  "name": "Israel National Coverage",
  "boundary": {
    "type": "Polygon",
    "coordinates": [
      [
        [34.2, 29.5],
        [35.9, 29.5],
        [35.9, 33.3],
        [34.2, 33.3],
        [34.2, 29.5]
      ]
    ]
  },
  "priority": 10,
  "metadata": {
    "notes": "Official coverage for all of Israel"
  }
}
```

Priority system:
- **10**: Official/primary authority
- **5-9**: Regional authorities
- **1-4**: Local communities
- **0**: Informational only

---

## Authentication & Authorization

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant S as Supabase Auth
    participant A as API Gateway
    participant D as Database

    U->>F: Login with email/password
    F->>S: auth.signIn()
    S-->>F: JWT token + refresh token
    F->>F: Store tokens in local storage

    U->>F: Make API request
    F->>A: Request + Authorization header
    A->>A: Validate JWT signature
    A->>D: Check user permissions
    D-->>A: User roles & permissions
    A->>A: Authorize request
    A-->>F: API response
    F-->>U: Display data
```

### Role-Based Access Control (RBAC)

#### Roles

1. **Public** (Unauthenticated)
   - View public publisher information
   - Calculate zmanim (rate-limited)
   - Search locations

2. **User** (Authenticated)
   - All public permissions
   - Save preferences
   - Subscribe to publishers
   - Higher rate limits
   - View calculation history

3. **Publisher** (Authenticated + Verified)
   - All user permissions
   - Create/edit own algorithms
   - Manage coverage areas
   - View analytics
   - API key management

4. **Admin** (Authenticated + Admin)
   - All permissions
   - Verify publishers
   - Moderate content
   - View system analytics
   - Manage users

### Permission Matrix

| Resource | Public | User | Publisher | Admin |
|----------|--------|------|-----------|-------|
| View Publishers | ✓ | ✓ | ✓ | ✓ |
| Calculate Zmanim | ✓ (limited) | ✓ | ✓ | ✓ |
| Subscribe to Publisher | - | ✓ | ✓ | ✓ |
| Create Algorithm | - | - | ✓ (own) | ✓ |
| Edit Algorithm | - | - | ✓ (own) | ✓ |
| Verify Publisher | - | - | - | ✓ |
| View Analytics | - | - | ✓ (own) | ✓ (all) |

### API Authentication

```go
// JWT Claims Structure
type Claims struct {
    UserID      string   `json:"sub"`
    Email       string   `json:"email"`
    Role        string   `json:"role"`
    PublisherID *string  `json:"publisher_id,omitempty"`
    Permissions []string `json:"permissions"`
    jwt.StandardClaims
}

// Middleware example
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractBearerToken(r)

        claims, err := validateJWT(token)
        if err != nil {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), "claims", claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Rate Limiting

```go
// Rate limit tiers
var RateLimits = map[string]RateLimit{
    "public": {
        RequestsPerMinute: 60,
        BurstSize:         10,
    },
    "user": {
        RequestsPerMinute: 300,
        BurstSize:         50,
    },
    "publisher": {
        RequestsPerMinute: 1000,
        BurstSize:         200,
    },
    "admin": {
        RequestsPerMinute: 5000,
        BurstSize:         1000,
    },
}
```

---

## Data Flow

### Request Flow: Calculate Zmanim

```mermaid
graph TD
    A[User Request] --> B{Authenticated?}
    B -->|No| C[Apply Public Rate Limit]
    B -->|Yes| D[Apply User Rate Limit]

    C --> E[Validate Request]
    D --> E

    E --> F{Valid?}
    F -->|No| G[Return 400 Error]
    F -->|Yes| H[Check Cache]

    H --> I{Cache Hit?}
    I -->|Yes| J[Return Cached Data]
    I -->|No| K[Load Algorithm]

    K --> L[Load Location Data]
    L --> M[Execute Calculation]
    M --> N[Validate Results]
    N --> O[Store in Cache]
    O --> P[Return Results]

    style J fill:#90EE90
    style P fill:#90EE90
    style G fill:#FFB6C1
```

### Caching Strategy

#### Cache Layers

1. **Level 1: Redis Cache**
   - TTL: 24 hours
   - Key pattern: `zmanim:{algorithm_id}:{location_id}:{date}`
   - Stores complete calculation results

2. **Level 2: Application Cache (BigCache)**
   - In-memory cache for frequently accessed data
   - TTL: 1 hour
   - Stores location and publisher metadata

3. **Level 3: Database Cache Table**
   - Persistent cache for historical data
   - TTL: 90 days
   - Enables analytics and trends

#### Cache Invalidation

```go
// Invalidate on algorithm update
func (s *CalculationService) InvalidateAlgorithmCache(algorithmID string) error {
    pattern := fmt.Sprintf("zmanim:%s:*", algorithmID)
    return s.redis.DeletePattern(pattern)
}

// Pre-warm cache for popular locations
func (s *CalculationService) PrewarmCache(ctx context.Context) error {
    popularLocations := s.getPopularLocations()
    today := time.Now()

    for _, loc := range popularLocations {
        for _, pub := range loc.Publishers {
            go s.Calculate(ctx, CalcRequest{
                LocationID:  loc.ID,
                PublisherID: pub.ID,
                Date:        today,
            })
        }
    }
    return nil
}
```

### Background Jobs

```go
// Daily cache warming (runs at midnight local time)
// - Pre-calculate next 7 days for popular locations
// - Clean expired cache entries
// - Update location statistics

// Weekly algorithm validation
// - Run validation tests for all active algorithms
// - Alert publishers of failing tests
// - Update algorithm validation status

// Monthly analytics
// - Calculate publisher usage statistics
// - Generate trend reports
// - Identify performance bottlenecks
```

---

## Deployment Architecture

### Infrastructure Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WA[Web App - Vercel]
        AP[Admin Panel - Vercel]
    end

    subgraph "CDN Layer"
        CF[Cloudflare CDN]
    end

    subgraph "API Layer - Cloud Run"
        LB[Load Balancer]
        API1[API Instance 1]
        API2[API Instance 2]
        API3[API Instance N]
    end

    subgraph "Data Layer"
        SB[(Supabase PostgreSQL)]
        RD[(Redis Cache)]
    end

    subgraph "Monitoring"
        MON[Monitoring & Logs]
    end

    WA --> CF
    AP --> CF
    CF --> LB
    LB --> API1
    LB --> API2
    LB --> API3

    API1 --> SB
    API2 --> SB
    API3 --> SB

    API1 --> RD
    API2 --> RD
    API3 --> RD

    API1 --> MON
    API2 --> MON
    API3 --> MON

    style SB fill:#00f,color:#fff
    style RD fill:#f00,color:#fff
```

### Container Architecture

```dockerfile
# Go Backend Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

### Kubernetes Deployment (if using GKE/EKS)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zmanim-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zmanim-api
  template:
    metadata:
      labels:
        app: zmanim-api
    spec:
      containers:
      - name: api
        image: gcr.io/zmanim/api:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: zmanim-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: zmanim-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: zmanim-api-service
spec:
  selector:
    app: zmanim-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

### Environment Configuration

```bash
# Production Environment Variables
DATABASE_URL=postgresql://user:pass@supabase-host:5432/zmanim_prod
REDIS_URL=redis://redis-host:6379
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...
JWT_SECRET=xxx
ENVIRONMENT=production
LOG_LEVEL=info
PORT=8080
ENABLE_METRICS=true
ENABLE_TRACING=true
```

---

## Security Considerations

### Data Protection

1. **Encryption at Rest**
   - Database: Supabase default encryption
   - Backups: Encrypted with AES-256
   - Secrets: Google Secret Manager / AWS Secrets Manager

2. **Encryption in Transit**
   - TLS 1.3 for all API connections
   - Certificate management via Let's Encrypt
   - HSTS headers enabled

3. **Authentication Security**
   - JWT tokens with short expiration (15 min)
   - Refresh token rotation
   - Secure password hashing (bcrypt)
   - MFA support via Supabase Auth

### API Security

```go
// Security headers middleware
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Strict-Transport-Security",
            "max-age=63072000; includeSubDomains")
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'")

        next.ServeHTTP(w, r)
    })
}
```

### Input Validation

```go
// Validate all user inputs
type LocationRequest struct {
    Latitude  float64 `json:"lat" validate:"required,min=-90,max=90"`
    Longitude float64 `json:"lng" validate:"required,min=-180,max=180"`
    Date      string  `json:"date" validate:"required,datetime=2006-01-02"`
}

func ValidateRequest(v *validator.Validate, req interface{}) error {
    if err := v.Struct(req); err != nil {
        return fmt.Errorf("validation error: %w", err)
    }
    return nil
}
```

### SQL Injection Prevention

Using prepared statements with sqlc:

```sql
-- queries.sql
-- name: GetPublisherByID :one
SELECT * FROM publishers WHERE id = $1;

-- Generated Go code automatically uses prepared statements
func (q *Queries) GetPublisherByID(ctx context.Context, id uuid.UUID) (Publisher, error)
```

---

## Scalability & Performance

### Performance Targets

- **API Response Time**: p95 < 100ms
- **Calculation Time**: p99 < 500ms
- **Throughput**: 10,000 requests/second
- **Availability**: 99.9% uptime

### Scaling Strategy

#### Horizontal Scaling

```go
// Auto-scaling configuration for Cloud Run
minInstances: 2
maxInstances: 100
cpuThreshold: 70%
memoryThreshold: 80%
```

#### Database Optimization

```sql
-- Critical indexes for performance
CREATE INDEX CONCURRENTLY idx_calc_cache_lookup
ON calculation_cache(algorithm_id, location_id, calculation_date)
WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY idx_coverage_spatial
ON coverage_areas USING GIST(boundary)
WHERE is_active = true;

-- Partitioning strategy for audit logs
CREATE TABLE audit_logs_2024_11 PARTITION OF audit_logs
FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
```

#### Caching Strategy

```go
// Multi-tier caching
type CacheStrategy struct {
    // L1: In-memory (BigCache) - 100ms access
    // L2: Redis - 2-5ms access
    // L3: Database - 20-50ms access
}

func (c *CalculationService) GetZmanim(ctx context.Context, req Request) (*Zmanim, error) {
    // Try L1 cache
    if result := c.memCache.Get(req.CacheKey()); result != nil {
        return result, nil
    }

    // Try L2 cache
    if result := c.redis.Get(ctx, req.CacheKey()); result != nil {
        c.memCache.Set(req.CacheKey(), result)
        return result, nil
    }

    // Calculate and store in all caches
    result := c.calculate(ctx, req)
    c.memCache.Set(req.CacheKey(), result)
    c.redis.Set(ctx, req.CacheKey(), result, 24*time.Hour)

    return result, nil
}
```

### Monitoring & Observability

```go
// Metrics collection
import "github.com/prometheus/client_golang/prometheus"

var (
    calculationDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "zmanim_calculation_duration_seconds",
            Help: "Duration of zmanim calculations",
        },
        []string{"algorithm_type", "status"},
    )

    cacheHitRate = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "cache_hits_total",
            Help: "Total cache hits",
        },
        []string{"cache_level"},
    )
)

// Distributed tracing with OpenTelemetry
func (s *Service) Calculate(ctx context.Context, req Request) (*Result, error) {
    ctx, span := tracer.Start(ctx, "calculate_zmanim")
    defer span.End()

    span.SetAttributes(
        attribute.String("algorithm.id", req.AlgorithmID),
        attribute.String("location.id", req.LocationID),
    )

    // Implementation...
}
```

---

## Conclusion

This architecture provides a robust, scalable platform for multi-publisher zmanim calculations with:

✅ **Flexible Algorithm System** - Publishers control their own calculations
✅ **Real-Time Performance** - Sub-second response times with multi-tier caching
✅ **Geographic Precision** - PostGIS integration for accurate location matching
✅ **Secure Authentication** - Role-based access with Supabase Auth
✅ **Scalable Infrastructure** - Auto-scaling backend with managed database
✅ **Modern Stack** - Go for performance, Next.js for user experience

### Next Steps

1. Review and approve
