/**
 * @file PrimitivesTable.tsx
 * @purpose Shared astronomical primitives display component with detailed info dialogs
 * @pattern shared-component
 * @dependencies useApi, ColorBadge, Dialog
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApi } from '@/lib/api-client';
import { Sun, Sunrise, Moon, Clock, Loader2, Info, BookOpen, Calculator, Compass, FlaskConical, Copy, Check } from 'lucide-react';
import { ColorBadge, getCalculationTypeColor } from '@/components/ui/color-badge';

interface AstronomicalPrimitive {
  id: string;
  variable_name: string;
  display_name: string;
  description?: string;
  formula_dsl: string;
  category: string;
  calculation_type: string;
  solar_angle?: number;
  is_dawn?: boolean;
  edge_type: string;
  sort_order: number;
}

interface PrimitivesGrouped {
  category: string;
  display_name: string;
  primitives: AstronomicalPrimitive[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  horizon: <Sunrise className="w-5 h-5" />,
  civil_twilight: <Sun className="w-5 h-5" />,
  nautical_twilight: <Sun className="w-5 h-5 opacity-70" />,
  astronomical_twilight: <Moon className="w-5 h-5" />,
  solar_position: <Clock className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  horizon: 'border-l-amber-500 bg-amber-500/10',
  civil_twilight: 'border-l-orange-500 bg-orange-500/10',
  nautical_twilight: 'border-l-blue-500 bg-blue-500/10',
  astronomical_twilight: 'border-l-indigo-500 bg-indigo-500/10',
  solar_position: 'border-l-yellow-500 bg-yellow-500/10',
};

// Detailed scientific and halachic information for each primitive
const primitiveDetails: Record<string, {
  scientificExplanation: string;
  calculation: string;
  halachicSignificance?: string;
  sources?: string[];
  practicalNotes?: string;
}> = {
  sunrise: {
    scientificExplanation: 'Geometric sunrise occurs when the center of the sun crosses the geometric horizon (0° altitude). This is a theoretical moment calculated without accounting for atmospheric refraction, which typically makes the sun visible about 2 minutes earlier.',
    calculation: 'Calculated using the NOAA Solar Calculator algorithm, which accounts for the observer\'s latitude, longitude, and date. The algorithm computes the sun\'s declination and hour angle to determine when the sun\'s center reaches 0° altitude.',
    halachicSignificance: 'Known as "Netz HaChama" (נץ החמה), this is the halachically significant sunrise used for calculating the start of the day for many zmanim. The Vilna Gaon and others use this moment as the beginning of the halachic day.',
    sources: ['Shulchan Aruch OC 58:1', 'Mishnah Berurah 58:1', 'NOAA Solar Calculator'],
    practicalNotes: 'For most halachic purposes, the visible sunrise (accounting for refraction) may be more relevant. The difference is typically 1-3 minutes depending on atmospheric conditions.',
  },
  sunset: {
    scientificExplanation: 'Geometric sunset occurs when the center of the sun crosses the geometric horizon (0° altitude). Due to atmospheric refraction, the sun remains visible for about 2-3 minutes after this calculated moment.',
    calculation: 'Calculated using the same NOAA algorithm as sunrise, determining when the sun\'s center reaches 0° altitude on the western horizon.',
    halachicSignificance: 'Known as "Shkiah" (שקיעה), sunset marks the end of the halachic day and the beginning of the night for most purposes. Shabbos and holidays begin at this time (or earlier with tosefes).',
    sources: ['Shulchan Aruch OC 261:1-2', 'Igros Moshe OC 4:62', 'NOAA Solar Calculator'],
    practicalNotes: 'Many communities add "tosefes Shabbos" (additional time) before sunset. The exact moment of sunset varies by geographic location and terrain features like mountains.',
  },
  sunrise_visible: {
    scientificExplanation: 'Visible sunrise occurs when the top edge of the sun first appears above the horizon, accounting for atmospheric refraction (~0.833°). This is what an observer actually sees when watching the sunrise.',
    calculation: 'Calculated by determining when the sun\'s upper limb reaches the horizon after applying a refraction correction of approximately -0.833° (34 arcminutes for refraction + 16 arcminutes for the sun\'s semi-diameter).',
    halachicSignificance: 'Some poskim consider this the true "Netz" for practical purposes, as it represents when sunlight first reaches the observer. Particularly relevant for "Vatikin" prayers at sunrise.',
    sources: ['Bi\'ur Halacha 58:1', 'US Naval Observatory refraction tables'],
    practicalNotes: 'Occurs 2-4 minutes before geometric sunrise depending on latitude and atmospheric conditions. Temperature and humidity affect the exact refraction.',
  },
  sunset_visible: {
    scientificExplanation: 'Visible sunset occurs when the last visible edge of the sun disappears below the horizon, accounting for atmospheric refraction. This is the moment the sun appears to set to an observer.',
    calculation: 'Calculated when the sun\'s upper limb reaches 0° apparent altitude (approximately -0.833° true altitude after refraction correction).',
    halachicSignificance: 'Some authorities consider this the practical shkiah for determining the start of bein hashmashos (twilight period).',
    sources: ['Shulchan Aruch OC 261', 'US Naval Observatory'],
    practicalNotes: 'Occurs 2-4 minutes after geometric sunset. Mountains or buildings on the western horizon can delay this further.',
  },
  civil_dawn: {
    scientificExplanation: 'Civil dawn occurs when the sun is 6° below the horizon. At this point, there is enough natural light for most outdoor activities without artificial lighting. The horizon is clearly visible, and only the brightest stars and planets remain visible.',
    calculation: 'Using solar position algorithms, the time when sun altitude = -6° is computed. This involves solving for the hour angle when the sun reaches this specific depression angle.',
    halachicSignificance: 'Civil dawn is sometimes used as a reference point for "Alos HaShachar" (dawn) by certain poskim, though most use deeper angles (16.1° or 18°).',
    sources: ['US Naval Observatory definitions', 'IERS Technical Notes'],
    practicalNotes: 'At 6° depression, you can read newspaper print outdoors. This is used in aviation for determining when pilots may operate under Visual Flight Rules.',
  },
  civil_dusk: {
    scientificExplanation: 'Civil dusk occurs when the sun is 6° below the horizon in the evening. After this point, artificial lighting becomes necessary for most outdoor activities.',
    calculation: 'Computed as the moment when the sun\'s altitude reaches -6° after sunset.',
    halachicSignificance: 'Some authorities use civil dusk as an early estimate for "Tzeis HaKochavim" (nightfall), though most use later times.',
    sources: ['IERS Technical Notes', 'FAA regulations'],
    practicalNotes: 'Civil twilight is the brightest of the three twilight phases. Street lights typically turn on around this time.',
  },
  nautical_dawn: {
    scientificExplanation: 'Nautical dawn occurs when the sun is 12° below the horizon. The horizon becomes visible at sea, allowing sailors to take star sightings for navigation while still seeing the horizon line.',
    calculation: 'Calculated when solar altitude = -12°, using spherical trigonometry based on observer position and date.',
    halachicSignificance: 'Nautical dawn corresponds to what some poskim describe as when "one can distinguish between blue and white" - an intermediate stage of dawn.',
    sources: ['Shulchan Aruch OC 58:1 with Mishnah Berurah', 'Nautical Almanac'],
    practicalNotes: 'At 12° depression, the general outlines of ground objects are distinguishable. The sea horizon becomes clearly defined.',
  },
  nautical_dusk: {
    scientificExplanation: 'Nautical dusk occurs when the sun is 12° below the horizon in the evening. After this point, the horizon at sea becomes indistinguishable from the sky.',
    calculation: 'Computed when sun altitude reaches -12° after sunset.',
    halachicSignificance: 'This roughly corresponds to the end of "bein hashmashos" according to some opinions, when the sky becomes significantly darker.',
    sources: ['Nautical Almanac', 'Various poskim on twilight'],
    practicalNotes: 'Navigation by stars becomes practical after nautical dusk as the horizon fades and stars become more prominent.',
  },
  astronomical_dawn: {
    scientificExplanation: 'Astronomical dawn occurs when the sun is 18° below the horizon. Before this point, the sky is completely dark (assuming no moon or light pollution). After this, the faintest glow begins to appear on the eastern horizon.',
    calculation: 'Calculated when solar altitude = -18°. This requires precise ephemeris data for accurate computation.',
    halachicSignificance: 'The 18° angle is significant as it corresponds to "Alos HaShachar" according to many Rishonim. The Rambam and others describe dawn as 72 minutes (in equinoctial minutes) before sunrise, which corresponds to approximately 16.1-18° depending on methodology.',
    sources: ['Rambam Hilchos Krias Shema 1:11', 'Shulchan Aruch OC 89:1', 'Rabbeinu Tam (quoted in Tosafos)'],
    practicalNotes: 'At 18° depression, even sensitive astronomical instruments cannot detect sunlight. This is the boundary between night and twilight.',
  },
  astronomical_dusk: {
    scientificExplanation: 'Astronomical dusk occurs when the sun is 18° below the horizon in the evening. After this point, the sky is completely dark for astronomical observations (weather and moon permitting).',
    calculation: 'Computed when sun altitude reaches -18° after sunset.',
    halachicSignificance: 'This corresponds to "Tzeis HaKochavim" (appearance of stars) according to Rabbeinu Tam, who holds that nightfall occurs 72 equinoctial minutes after sunset. Many Sephardic communities follow this opinion for ending Shabbos.',
    sources: ['Rabbeinu Tam in Tosafos Shabbos 35a', 'Shulchan Aruch OC 261:2', 'Yalkut Yosef'],
    practicalNotes: 'The 18° angle represents complete astronomical darkness. Three medium-sized stars become visible around 8.5° depression, much earlier than this.',
  },
  solar_noon: {
    scientificExplanation: 'Solar noon (transit) is the moment when the sun crosses the local meridian and reaches its highest point in the sky for that day. At this moment, shadows point exactly north (in the northern hemisphere) or south (in the southern hemisphere).',
    calculation: 'Calculated using the equation of time, which accounts for Earth\'s elliptical orbit and axial tilt. The local solar noon differs from 12:00 clock time based on longitude within the time zone and the equation of time correction.',
    halachicSignificance: 'Known as "Chatzos HaYom" (חצות היום), solar noon marks the midpoint of the halachic day. The latest time for the morning Shema and Shacharis prayers is calculated relative to this point (either sunrise-to-solar noon or sunrise-to-sunset).',
    sources: ['Shulchan Aruch OC 233:1', 'Mishnah Berurah 233:1-4', 'USNO Astronomical Almanac'],
    practicalNotes: 'Solar noon can occur anywhere from about 11:30 AM to 12:30 PM local clock time depending on your position within the time zone and time of year.',
  },
  solar_midnight: {
    scientificExplanation: 'Solar midnight (anti-transit) occurs when the sun is at its lowest point, directly opposite to its noon position. The sun is on the other side of the Earth, at the nadir of its daily path.',
    calculation: 'Calculated as 12 hours after solar noon, adjusted for the asymmetry caused by the equation of time changing throughout the day.',
    halachicSignificance: 'Known as "Chatzos HaLaylah" (חצות הלילה), this is the halachic midpoint of the night. Traditionally, this is the time when the Beis HaMikdash gates would open and when Dovid HaMelech would arise to study Torah. It marks the latest time for eating the Korban Pesach.',
    sources: ['Berachos 3b', 'Shulchan Aruch OC 1:2', 'Rambam Hilchos Korban Pesach 8:15'],
    practicalNotes: 'The night is divided into two halachic halves at this point. Various midnight practices (Tikkun Chatzos) are performed at this time.',
  },
};

interface PrimitiveDetailDialogProps {
  primitive: AstronomicalPrimitive | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PrimitiveDetailDialog({ primitive, open, onOpenChange }: PrimitiveDetailDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!primitive) return null;

  const details = primitiveDetails[primitive.variable_name];

  const handleCopy = () => {
    navigator.clipboard.writeText(`@${primitive.variable_name}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {categoryIcons[primitive.category]}
            <div>
              <DialogTitle className="text-xl">{primitive.display_name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <code className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                  @{primitive.variable_name}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </Button>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Quick Info Badges */}
          <div className="flex flex-wrap gap-2">
            <ColorBadge color={getCalculationTypeColor(primitive.calculation_type)} size="md">
              {primitive.calculation_type.replace('_', ' ')}
            </ColorBadge>
            {primitive.solar_angle !== null && primitive.solar_angle !== undefined && (
              <ColorBadge color="violet" size="md">
                {primitive.solar_angle}° below horizon
              </ColorBadge>
            )}
            {primitive.is_dawn === true && (
              <ColorBadge color="orange" size="md">
                Morning (Dawn)
              </ColorBadge>
            )}
            {primitive.is_dawn === false && (
              <ColorBadge color="indigo" size="md">
                Evening (Dusk)
              </ColorBadge>
            )}
            {primitive.edge_type && (
              <ColorBadge color="slate" size="md">
                {primitive.edge_type.replace('_', ' ')}
              </ColorBadge>
            )}
          </div>

          {/* Description */}
          {primitive.description && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-foreground">{primitive.description}</p>
            </div>
          )}

          {/* DSL Formula */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calculator className="w-4 h-4 text-primary" />
              DSL Formula
            </div>
            <div className="p-3 bg-muted rounded-lg font-mono text-sm">
              {primitive.formula_dsl}
            </div>
          </div>

          {details && (
            <>
              {/* Scientific Explanation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Scientific Explanation
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                  <p className="text-sm text-foreground leading-relaxed">{details.scientificExplanation}</p>
                </div>
              </div>

              {/* Calculation Method */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Calculation Method
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <p className="text-sm text-foreground leading-relaxed">{details.calculation}</p>
                </div>
              </div>

              {/* Halachic Significance */}
              {details.halachicSignificance && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Halachic Significance
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <p className="text-sm text-foreground leading-relaxed">{details.halachicSignificance}</p>
                  </div>
                </div>
              )}

              {/* Sources */}
              {details.sources && details.sources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Sources & References
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg">
                    <ul className="list-disc list-inside space-y-1">
                      {details.sources.map((source, idx) => (
                        <li key={idx} className="text-sm text-foreground">{source}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Practical Notes */}
              {details.practicalNotes && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    Practical Notes
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <p className="text-sm text-foreground leading-relaxed">{details.practicalNotes}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {!details && (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Detailed documentation for this primitive is not yet available.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PrimitivesTableProps {
  title?: string;
  description?: string;
}

/**
 * PrimitivesTable - Shared component displaying astronomical primitives
 *
 * Used by both admin and publisher primitives pages.
 * Fetches data from public registry endpoint.
 * Click on any primitive to see detailed scientific and halachic information.
 */
export function PrimitivesTable({
  title = 'Astronomical Primitives',
  description = 'Core astronomical times used as building blocks for zmanim calculations.',
}: PrimitivesTableProps) {
  const api = useApi();
  const [groupedPrimitives, setGroupedPrimitives] = useState<PrimitivesGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrimitive, setSelectedPrimitive] = useState<AstronomicalPrimitive | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPrimitives = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.public.get<PrimitivesGrouped[]>('/registry/primitives/grouped');
      setGroupedPrimitives(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchPrimitives();
  }, [fetchPrimitives]);

  const handlePrimitiveClick = (primitive: AstronomicalPrimitive) => {
    setSelectedPrimitive(primitive);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-1">
          {description}{' '}
          Use <code className="text-xs bg-muted px-1 rounded">@variable_name</code> in DSL formulas.
          Click any primitive for detailed information.
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            {groupedPrimitives.reduce((acc, g) => acc + g.primitives.length, 0)} astronomical primitives
            across {groupedPrimitives.length} categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {groupedPrimitives.map((group) => (
              <div key={group.category} className={`p-4 rounded-lg border-l-4 ${categoryColors[group.category] || 'border-l-muted bg-muted/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {categoryIcons[group.category]}
                  <span className="font-medium text-sm text-foreground">{group.display_name}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{group.primitives.length}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Primitives by Category */}
      {groupedPrimitives.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <div className="flex items-center gap-3">
              {categoryIcons[group.category]}
              <div>
                <CardTitle>{group.display_name}</CardTitle>
                <CardDescription>
                  {group.primitives.length} primitive{group.primitives.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left text-sm">
                    <th className="pb-3 font-semibold text-foreground">DSL Variable</th>
                    <th className="pb-3 font-semibold text-foreground">Name</th>
                    <th className="pb-3 font-semibold text-foreground">Type & Info</th>
                    <th className="pb-3 font-semibold text-foreground w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.primitives.map((primitive) => (
                    <tr
                      key={primitive.id}
                      className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => handlePrimitiveClick(primitive)}
                    >
                      <td className="py-3 pr-4">
                        <code className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                          @{primitive.variable_name}
                        </code>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-foreground font-medium">{primitive.display_name}</span>
                          {primitive.description && (
                            <span className="text-sm text-muted-foreground max-w-md line-clamp-1">
                              {primitive.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <ColorBadge color={getCalculationTypeColor(primitive.calculation_type)} size="sm">
                            {primitive.calculation_type.replace('_', ' ')}
                          </ColorBadge>
                          {primitive.solar_angle !== null && primitive.solar_angle !== undefined && (
                            <ColorBadge color="violet" size="sm">
                              {primitive.solar_angle}°
                            </ColorBadge>
                          )}
                          {primitive.is_dawn === true && (
                            <ColorBadge color="orange" size="sm">
                              Dawn
                            </ColorBadge>
                          )}
                          {primitive.is_dawn === false && (
                            <ColorBadge color="indigo" size="sm">
                              Dusk
                            </ColorBadge>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Detail Dialog */}
      <PrimitiveDetailDialog
        primitive={selectedPrimitive}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
