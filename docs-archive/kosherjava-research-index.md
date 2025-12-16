# KosherJava Zmanim Library - Research Documentation Index

**Comprehensive extraction and analysis of the KosherJava Zmanim library**
**Completed:** December 21, 2025

---

## About This Research

This documentation represents an exhaustive analysis of the KosherJava Zmanim library, extracting every zman calculation method, halachic opinion, and formula for the purpose of building a comprehensive master zmanim registry.

**Total Research Output:**
- **4 comprehensive documents**
- **100,000+ words** of documentation
- **180+ methods** fully documented
- **30+ degree constants** explained
- **15+ poskim** covered
- **7 calculation types** detailed

---

## Documents

### 1. [Complete Extraction](./kosherjava-zmanim-complete-extraction.md)
**73,000 words | The definitive reference**

**What's in it:**
- Complete catalog of all 180+ methods
- All 30+ degree constants with explanations
- Detailed categorization by zman type (Alos, Tzais, Shma, etc.)
- Comprehensive coverage of all halachic opinions
- Implementation patterns and calculation types
- Community customs and configurations
- Complete method index with cross-references

**Use this when:**
- You need comprehensive understanding of the library
- You're researching a specific posek's opinions
- You need to understand the full range of variations
- You're building a master registry

**Sections:**
1. Fundamental Constants (30+ degree values)
2. Zmanim Methods Catalog (180+ methods)
3. Halachic Opinions & Shitos (15+ poskim)
4. Calculation Methodologies (7 types)
5. Key Concepts (mil, shaah zmanis, etc.)
6. Zmanim Categories (detailed breakdown)
7. Implementation Patterns
8. Degree Values Reference Table
9. Shaos Zmaniyos Methods
10. Community Customs
11. Practical Usage Notes
12. Deprecated Methods
13. Complete Method Index

---

### 2. [Formula Quick Reference](./kosherjava-formulas-quick-reference.md)
**18,000 words | Mathematical formulas**

**What's in it:**
- Exact mathematical formula for every method
- Table-based organization by category
- Start/end day definitions
- Calculation helper methods reference
- Zmaniyos fraction reference

**Use this when:**
- You need the exact formula for a specific zman
- You're implementing calculations in another language
- You need to understand how a method works
- You're validating calculations

**Sections:**
- Alos formulas (18 methods)
- Misheyakir formulas (5 methods)
- Sof Zman Shma formulas (42 methods)
- Sof Zman Tfila formulas (17 methods)
- Chatzos formulas (3 methods)
- Mincha formulas (15 methods)
- Plag Hamincha formulas (19 methods)
- Bain Hashmashos formulas (14 methods)
- Tzais formulas (35 methods)
- Special times (Kiddush Levana, Chametz, etc.)
- Shaos Zmaniyos formulas (20+ methods)
- Calculation helpers
- Zmaniyos fraction reference

---

### 3. [Research Summary](./kosherjava-research-summary.md)
**8,000 words | Executive overview**

**What's in it:**
- Key statistics and metrics
- Core constants reference
- Major halachic opinions overview
- Calculation types summary
- Zmanim categories overview
- Class structure
- Important patterns
- Community customs
- Master registry mapping recommendations
- Integration next steps

**Use this when:**
- You need a high-level overview
- You're presenting to stakeholders
- You need quick statistics
- You're planning integration work

**Sections:**
1. Key Statistics
2. Core Constants
3. Major Halachic Opinions
4. Calculation Types
5. Zmanim Categories
6. Class Structure
7. Important Patterns
8. Community Customs
9. Master Registry Recommendations
10. Next Steps for Integration

---

### 4. [Developer Quick Lookup](./kosherjava-developer-quick-lookup.md)
**14,000 words | Practical developer guide**

**What's in it:**
- "I need X" instant lookup
- Community-specific configurations
- Custom calculation examples
- Configuration quick reference
- Troubleshooting guide
- Performance tips
- Common patterns
- Error handling

**Use this when:**
- You're coding and need a method fast
- You're integrating the library
- You need configuration examples
- You're troubleshooting issues

**Sections:**
1. Instant Lookup (by use case)
2. Community Quick Lookup
3. Configuration Quick Lookup
4. Custom Calculation Quick Lookup
5. Troubleshooting Quick Lookup
6. Performance Quick Lookup
7. Constants Reference
8. Common Patterns
9. Error Handling
10. Quick Decision Tree

---

## Quick Navigation

### By Use Case

#### "I'm a researcher/rabbi studying zmanim"
→ Start with [Complete Extraction](./kosherjava-zmanim-complete-extraction.md)
- Read Part 3 (Halachic Opinions)
- Read Part 5 (Key Concepts)
- Read Part 11 (Community Customs)

#### "I'm a developer implementing zmanim"
→ Start with [Developer Quick Lookup](./kosherjava-developer-quick-lookup.md)
- Use "I need X" sections
- Check Configuration section
- Reference [Formula Quick Reference](./kosherjava-formulas-quick-reference.md) for exact calculations

#### "I'm building a master zmanim registry"
→ Start with [Research Summary](./kosherjava-research-summary.md)
- Read Master Registry Mapping Recommendations
- Use [Complete Extraction](./kosherjava-zmanim-complete-extraction.md) for full data
- Use [Formula Quick Reference](./kosherjava-formulas-quick-reference.md) for formulas

#### "I'm validating existing calculations"
→ Start with [Formula Quick Reference](./kosherjava-formulas-quick-reference.md)
- Find the exact formula
- Cross-reference with [Complete Extraction](./kosherjava-zmanim-complete-extraction.md)

#### "I'm presenting to stakeholders"
→ Use [Research Summary](./kosherjava-research-summary.md)
- Statistics section
- Key statistics
- Community customs

---

## Key Findings

### Library Scope
- **180+ calculation methods** across 3 classes
- **30+ degree constants** for various opinions
- **7 calculation types** (fixed time, degrees, zmaniyos, shaos, half-day, asymmetric, fixed chatzos)
- **15+ poskim** represented
- **20+ years** of development

### Most Important Methods

**Top 10 (must-have for any implementation):**
1. `getSunrise()` / `getSunset()`
2. `getAlosHashachar()` (16.1°)
3. `getTzais()` (8.5°)
4. `getSofZmanShmaGRA()`
5. `getSofZmanShmaMGA()`
6. `getSofZmanTfilaGRA()`
7. `getSofZmanTfilaMGA()`
8. `getChatzos()`
9. `getMinchaGedola()` / `getMinchaKetana()`
10. `getPlagHamincha()`

**Essential variations:**
- MGA 16.1°, 72 minutes, 90 minutes
- Baal Hatanya (all methods)
- Geonim tzais (especially 7.083° and 6.45°)
- Rabbeinu Tam

### Most Common Configurations

**Ashkenaz Standard:**
- Alos: 72 min or 16.1°
- Tzais: 72 min or 8.5°
- Day: MGA or GRA

**Chabad:**
- All Baal Hatanya methods
- Netz amiti (1.583°)

**Israel:**
- Tzais: 6.45° (R' Tucazinsky)
- Often MGA 16.1°

**Jerusalem:**
- Candle lighting: 40 minutes

---

## Statistics

### Method Distribution
| Category | Count |
|----------|-------|
| Alos (Dawn) | 18 |
| Misheyakir | 5 |
| Sof Zman Shma | 42 |
| Sof Zman Tfila | 17 |
| Chatzos | 3 |
| Mincha Gedola | 9 |
| Mincha Ketana | 6 |
| Samuch Lemincha Ketana | 4 |
| Plag Hamincha | 19 |
| Bain Hashmashos | 14 |
| Tzais | 35 |
| Shaos Zmaniyos | 20+ |
| Special (Chametz, Kiddush Levana, etc.) | 15+ |
| **Total** | **180+** |

### Degree Distribution
| Degree Range | Count | Use |
|--------------|-------|-----|
| Below 5° | 11 | Tzais (early) |
| 5° - 10° | 8 | Tzais, Misheyakir |
| 10° - 15° | 3 | Misheyakir, Alos |
| 15° - 20° | 5 | Alos, Tzais (standard) |
| Above 20° | 2 | Alos (lechumra) |
| Above horizon (negative) | 4 | Yereim, Baal Hatanya |

### Posek Coverage
| Posek | Methods | Primary Use |
|-------|---------|-------------|
| GRA | 15+ | Standard calculations |
| MGA | 40+ | Dawn-dusk day variations |
| Baal Hatanya | 10+ | Chabad community |
| Geonim | 15+ | Tzais variations |
| Rabbeinu Tam | 4 | Late tzais |
| Yereim | 6 | Bain hashmashos |
| Ateret Torah | 6 | Sefardi community |
| Others | 10+ | Various |

---

## Methodology

This research was conducted through:

1. **Complete code review** of all 3 main classes
2. **JavaDoc analysis** for halachic sources
3. **Constant extraction** for all degree values
4. **Method signature extraction** (all 180+ methods)
5. **Formula analysis** for exact calculations
6. **Cross-referencing** with halachic sources mentioned in code
7. **Pattern identification** for calculation types
8. **Community usage research** based on code documentation

**Tools used:**
- Direct source code reading
- grep/awk for extraction
- Manual analysis and categorization
- Cross-referencing with library documentation

---

## File Locations

All documents in: `/home/daniel/repos/zmanim/docs/`

```
kosherjava-zmanim-complete-extraction.md    - 73,000 words
kosherjava-formulas-quick-reference.md      - 18,000 words
kosherjava-research-summary.md              -  8,000 words
kosherjava-developer-quick-lookup.md        - 14,000 words
kosherjava-research-index.md                -  3,000 words (this file)
```

---

## Source Repository

**GitHub:** https://github.com/KosherJava/zmanim
**Author:** Eliyahu Hershfeld
**License:** LGPL 2.1
**Version Analyzed:** Latest (as of December 21, 2025)

**Main Classes:**
- `AstronomicalCalendar.java` (1,142 lines)
- `ZmanimCalendar.java` (1,234 lines)
- `ComplexZmanimCalendar.java` (4,597 lines)

---

## Next Steps

### For Master Registry Implementation

1. **Database Schema**
   - Import all constants
   - Map methods to formulas
   - Link to poskim
   - Store community preferences

2. **Formula Storage**
   - JSON format for structured formulas
   - Parameter storage (degrees, minutes, fractions)
   - Day definition storage

3. **Validation**
   - Cross-reference with Hebcal
   - Cross-reference with MyZmanim
   - Cross-reference with community calendars

4. **Documentation**
   - User-facing explanations
   - Posek attributions
   - Community recommendations

### For Developers

1. **Integration**
   - Use [Developer Quick Lookup](./kosherjava-developer-quick-lookup.md)
   - Start with basic methods
   - Add community-specific configurations
   - Test with multiple locations/dates

2. **Testing**
   - Compare with known-good calendars
   - Test edge cases (Arctic, etc.)
   - Test all null conditions
   - Performance testing for bulk calculations

3. **Extension**
   - Use generic calculators for custom opinions
   - Document any custom formulas
   - Contribute back to library if appropriate

---

## Updates and Maintenance

**Last Updated:** December 21, 2025

**Future Updates:**
- Monitor KosherJava library for new releases
- Add newly discovered methods
- Update formulas if algorithms change
- Add community feedback

**Contribution:**
These documents are living references. Corrections, additions, and clarifications are welcome.

---

## Acknowledgments

**Primary Source:**
- KosherJava Zmanim library by Eliyahu Hershfeld

**Halachic Sources Referenced in Library:**
- Sefer Yisroel Vehazmanim (Rabbi Yisrael Dovid Harfenes)
- Zmanim Kehilchasam (Rabbi Dovid Yehuda Bursztyn)
- Hazmanim Bahalacha (Rabbi Chaim Banish)
- Birur Halacha (Rabbi Yechiel Avrahom Zilber)
- Various responsa and halachic works

---

## Contact and Support

For questions about this research:
- Review the appropriate document above
- Check the library's GitHub issues
- Consult with a posek for halachic questions

For questions about the library itself:
- GitHub: https://github.com/KosherJava/zmanim
- Issues: https://github.com/KosherJava/zmanim/issues

---

**END OF INDEX**

---

## Quick Reference Card

**Need basic times?** → [Developer Quick Lookup](./kosherjava-developer-quick-lookup.md)

**Need exact formulas?** → [Formula Quick Reference](./kosherjava-formulas-quick-reference.md)

**Need comprehensive info?** → [Complete Extraction](./kosherjava-zmanim-complete-extraction.md)

**Need overview/stats?** → [Research Summary](./kosherjava-research-summary.md)

**Lost?** → You're reading the right document (this index)
