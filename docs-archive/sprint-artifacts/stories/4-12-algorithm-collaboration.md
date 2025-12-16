# Story 4.12: Algorithm Collaboration (Copy/Fork)

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** ready-for-dev
**Priority:** P3
**Story Points:** 5
**Dependencies:** Story 4.2 (DSL Parser), Story 4.9 (Algorithm Publishing from Epic 1)

---

## Story

As a **publisher**,
I want **to copy or fork algorithms from other publishers**,
So that **I can start from a proven configuration and customize it for my community rather than building from scratch**.

---

## Acceptance Criteria

### AC-4.12.1: Browse Public Algorithms
- [ ] Page listing algorithms marked as "public/shareable"
- [ ] Filter by: template base (GRA, MGA, etc.), publisher, region
- [ ] Search by algorithm name or publisher name
- [ ] Preview of key zmanim for each algorithm

### AC-4.12.2: Algorithm Details View
- [ ] View complete configuration of a public algorithm
- [ ] See all zmanim with their formulas
- [ ] See publisher information and reputation
- [ ] Usage statistics (how many have copied/forked)
- [ ] View halachic notes if provided

### AC-4.12.3: Copy/Fork Actions
- [ ] "Copy" button creates exact duplicate under my account
- [ ] "Fork" creates linked copy with attribution
- [ ] Fork maintains reference to original for updates notification
- [ ] Both actions require confirmation dialog
- [ ] Attribution shown: "Based on [Publisher]'s algorithm"

### AC-4.12.4: Privacy Controls
- [ ] Publisher can mark algorithm as "public" or "private"
- [ ] Default is "private"
- [ ] Public algorithms appear in browse list
- [ ] Private algorithms cannot be copied/forked

### AC-4.12.5: Fork Management
- [ ] See list of my forks and their sources
- [ ] Notification when source algorithm updated
- [ ] Option to "sync" with source changes
- [ ] Option to "detach" fork and remove link
- [ ] See who has forked my public algorithm

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for copy/fork logic
- [ ] Integration tests pass for API endpoints
- [ ] E2E tests pass for browse and copy flow
- [ ] Privacy controls verified (cannot access private)
- [ ] Attribution displays correctly
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Database Schema Updates (AC: 4.12.3, 4.12.4)
  - [ ] 1.1 Add `is_public` column to algorithms table
  - [ ] 1.2 Add `forked_from` column (nullable FK)
  - [ ] 1.3 Add `attribution_text` column
  - [ ] 1.4 Add `fork_count` counter
  - [ ] 1.5 Create migration

- [ ] Task 2: Browse API (AC: 4.12.1)
  - [ ] 2.1 Create `GET /api/algorithms/public` endpoint
  - [ ] 2.2 Add filtering by template, publisher, region
  - [ ] 2.3 Add search capability
  - [ ] 2.4 Add pagination
  - [ ] 2.5 Return preview data

- [ ] Task 3: Algorithm Details API (AC: 4.12.2)
  - [ ] 3.1 Create `GET /api/algorithms/{id}/public` endpoint
  - [ ] 3.2 Only return if algorithm is public
  - [ ] 3.3 Include all zmanim configurations
  - [ ] 3.4 Include publisher info
  - [ ] 3.5 Include usage statistics

- [ ] Task 4: Copy/Fork API (AC: 4.12.3)
  - [ ] 4.1 Create `POST /api/algorithms/{id}/copy` endpoint
  - [ ] 4.2 Create `POST /api/algorithms/{id}/fork` endpoint
  - [ ] 4.3 Implement deep copy logic
  - [ ] 4.4 Track fork relationship
  - [ ] 4.5 Generate attribution text

- [ ] Task 5: Privacy Controls (AC: 4.12.4)
  - [ ] 5.1 Add privacy toggle in publisher settings
  - [ ] 5.2 Enforce privacy in all API endpoints
  - [ ] 5.3 Filter public algorithms in browse

- [ ] Task 6: Browse UI (AC: 4.12.1, 4.12.2)
  - [ ] 6.1 Create `BrowseAlgorithms` page
  - [ ] 6.2 Create algorithm card component
  - [ ] 6.3 Implement filters and search
  - [ ] 6.4 Create algorithm detail modal/page

- [ ] Task 7: Copy/Fork UI (AC: 4.12.3)
  - [ ] 7.1 Add "Copy" and "Fork" buttons
  - [ ] 7.2 Create confirmation dialogs
  - [ ] 7.3 Show success message with attribution
  - [ ] 7.4 Navigate to new algorithm after action

- [ ] Task 8: Fork Management UI (AC: 4.12.5)
  - [ ] 8.1 Create "My Forks" section in dashboard
  - [ ] 8.2 Show fork relationships
  - [ ] 8.3 Add update notifications
  - [ ] 8.4 Implement sync/detach actions

- [ ] Task 9: Testing
  - [ ] 9.1 Write unit tests
  - [ ] 9.2 Write integration tests
  - [ ] 9.3 Write E2E tests
  - [ ] 9.4 Security testing (privacy)

---

## Dev Notes

### Database Schema

```sql
-- Add columns to algorithms table
ALTER TABLE algorithms
ADD COLUMN is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN forked_from UUID REFERENCES algorithms(id) ON DELETE SET NULL,
ADD COLUMN attribution_text TEXT,
ADD COLUMN fork_count INT DEFAULT 0;

-- Index for public algorithms browse
CREATE INDEX idx_algorithms_public ON algorithms(is_public) WHERE is_public = true;

-- Index for fork tracking
CREATE INDEX idx_algorithms_forked_from ON algorithms(forked_from) WHERE forked_from IS NOT NULL;
```

### Copy vs Fork

| Aspect | Copy | Fork |
|--------|------|------|
| Link to source | No | Yes |
| Attribution | Optional | Required |
| Update notifications | No | Yes |
| Can sync changes | No | Yes |
| Independence | Fully independent | Linked |

### API Endpoints

```go
// GET /api/algorithms/public
type BrowseRequest struct {
    Search   string `query:"search"`
    Template string `query:"template"`  // gra, mga, rabbeinu_tam
    Region   string `query:"region"`
    Page     int    `query:"page"`
    PageSize int    `query:"page_size"`
}

type BrowseResponse struct {
    Algorithms []PublicAlgorithm `json:"algorithms"`
    Total      int               `json:"total"`
    Page       int               `json:"page"`
}

type PublicAlgorithm struct {
    ID             string    `json:"id"`
    Name           string    `json:"name"`
    PublisherName  string    `json:"publisher_name"`
    PublisherLogo  string    `json:"publisher_logo"`
    Template       string    `json:"template"`
    ZmanimPreview  []ZmanPreview `json:"zmanim_preview"` // Top 5 zmanim
    ForkCount      int       `json:"fork_count"`
    CreatedAt      time.Time `json:"created_at"`
}

// POST /api/algorithms/{id}/copy
// POST /api/algorithms/{id}/fork
type CopyForkResponse struct {
    NewAlgorithmID string `json:"new_algorithm_id"`
    Attribution    string `json:"attribution"`
}
```

### Copy/Fork Logic

```go
func (s *AlgorithmService) CopyAlgorithm(ctx context.Context, sourceID, targetPublisherID string) (*Algorithm, error) {
    source, err := s.GetPublicAlgorithm(ctx, sourceID)
    if err != nil {
        return nil, err
    }

    // Deep copy
    newAlg := &Algorithm{
        PublisherID:    targetPublisherID,
        Name:           source.Name + " (Copy)",
        Status:         "draft",
        Config:         source.Config, // Deep copy JSON
        // No forked_from - this is a copy
    }

    return s.Create(ctx, newAlg)
}

func (s *AlgorithmService) ForkAlgorithm(ctx context.Context, sourceID, targetPublisherID string) (*Algorithm, error) {
    source, err := s.GetPublicAlgorithm(ctx, sourceID)
    if err != nil {
        return nil, err
    }

    // Fork with attribution
    attribution := fmt.Sprintf("Based on %s's algorithm", source.PublisherName)

    newAlg := &Algorithm{
        PublisherID:     targetPublisherID,
        Name:            source.Name + " (Fork)",
        Status:          "draft",
        Config:          source.Config,
        ForkedFrom:      &sourceID, // Link to source
        AttributionText: attribution,
    }

    // Increment fork count on source
    s.IncrementForkCount(ctx, sourceID)

    return s.Create(ctx, newAlg)
}
```

### Browse Page Component

```tsx
// web/app/publisher/algorithms/browse/page.tsx
export default function BrowseAlgorithmsPage() {
  const [filters, setFilters] = useState({
    search: '',
    template: '',
    region: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['public-algorithms', filters],
    queryFn: () => fetchPublicAlgorithms(filters),
  });

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Browse Public Algorithms</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <Select
          value={filters.template}
          onValueChange={(v) => setFilters({ ...filters, template: v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Templates</SelectItem>
            <SelectItem value="gra">GRA</SelectItem>
            <SelectItem value="mga">Magen Avraham</SelectItem>
            <SelectItem value="rabbeinu_tam">Rabbeinu Tam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Algorithm Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.algorithms.map((alg) => (
          <AlgorithmCard key={alg.id} algorithm={alg} />
        ))}
      </div>
    </div>
  );
}
```

### Algorithm Card Component

```tsx
// web/components/algorithms/AlgorithmCard.tsx
interface AlgorithmCardProps {
  algorithm: PublicAlgorithm;
}

export function AlgorithmCard({ algorithm }: AlgorithmCardProps) {
  const router = useRouter();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center gap-3">
        {algorithm.publisherLogo && (
          <img
            src={algorithm.publisherLogo}
            alt=""
            className="w-10 h-10 rounded-full"
          />
        )}
        <div>
          <CardTitle className="text-lg">{algorithm.name}</CardTitle>
          <CardDescription>{algorithm.publisherName}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {algorithm.zmanimPreview.map((zman) => (
            <div key={zman.key} className="flex justify-between text-sm">
              <span>{zman.name}</span>
              <span className="text-muted-foreground">{zman.sampleTime}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <Badge variant="secondary">{algorithm.template}</Badge>
          <span>•</span>
          <span>{algorithm.forkCount} forks</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/publisher/algorithms/browse/${algorithm.id}`)}
        >
          View Details
        </Button>
        <CopyForkButtons algorithmId={algorithm.id} />
      </CardFooter>
    </Card>
  );
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.12]

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestCopyAlgorithm` - creates independent copy
- [ ] `TestForkAlgorithm` - creates linked fork with attribution
- [ ] `TestForkCount` - increments on fork
- [ ] `TestPrivacyFilter` - private algorithms excluded

### Integration Tests (API)
- [ ] GET public algorithms returns only public
- [ ] Copy creates new algorithm
- [ ] Fork creates linked algorithm
- [ ] Cannot copy/fork private algorithm
- [ ] Fork notifications work

### E2E Tests (Playwright)
- [ ] Publisher can browse public algorithms
- [ ] Publisher can filter by template
- [ ] Publisher can search algorithms
- [ ] Publisher can view algorithm details
- [ ] Publisher can copy algorithm
- [ ] Publisher can fork algorithm
- [ ] Attribution shows on forked algorithm
- [ ] My Forks section shows forks

### Security Tests
- [ ] Cannot access private algorithm details
- [ ] Cannot copy private algorithm
- [ ] Cannot fork private algorithm
- [ ] API enforces authentication

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-12-algorithm-collaboration.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story created from Epic 4 comprehensive plan | Party Mode Team |
| 2025-11-28 | Story context generated | Winston (Architect) |
