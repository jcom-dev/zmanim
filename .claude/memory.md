# Testing Configuration

## Formula Builder Testing
- **Publisher ID**: 3 (Machzikei Hadass - Manchester)
- **Locality ID**: 542266 (Manchester, United Kingdom)

Use these values when testing FormulaBuilder, FixedOffsetForm, ProportionalHoursForm components.

## Test API Call Example
```bash
curl -H "Authorization: Bearer <token>" -H "X-Publisher-Id: 3" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542266&date=2025-12-25"
```

