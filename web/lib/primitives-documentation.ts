/**
 * @file primitives-documentation.ts
 * @purpose Comprehensive documentation for astronomical primitives
 * @pattern reference-data
 * @dependencies Used by PrimitivesTable for detailed primitive info dialogs
 *
 * This file contains authoritative documentation for each astronomical primitive,
 * including the actual algorithms used, mathematical formulas, halachic sources,
 * and links to authoritative references.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FormulaStep {
  step: number;
  description: string;
  formula?: string;
  notes?: string;
}

export interface AlgorithmDetails {
  name: string;
  source: string;
  sourceUrl?: string;
  description: string;
  steps: FormulaStep[];
  mathFormulas: MathFormula[];
  constants?: Record<string, { value: string; description: string }>;
  elevationAdjustment?: string;
}

export interface MathFormula {
  name: string;
  latex?: string;
  plain: string;
  description: string;
}

export interface HalachicSource {
  source: string;
  reference?: string;
  description: string;
  url?: string;
}

export interface PrimitiveDocumentation {
  variableName: string;

  // Scientific
  scientificExplanation: string;
  astronomicalDefinition: string;

  // Algorithm Details
  algorithm: AlgorithmDetails;

  // Halachic
  hebrewName: string;
  hebrewText?: string;
  halachicSignificance: string;
  halachicSources: HalachicSource[];

  // Practical
  practicalNotes: string;
  accuracy: string;
  edgeCases?: string;

  // Links
  authoritativeLinks: { title: string; url: string; description: string }[];
}

// =============================================================================
// SHARED ALGORITHM COMPONENTS
// =============================================================================

const NOAA_ALGORITHM_BASE: Omit<AlgorithmDetails, 'description' | 'steps'> = {
  name: 'NOAA Solar Calculator',
  source: 'National Oceanic and Atmospheric Administration (NOAA)',
  sourceUrl: 'https://gml.noaa.gov/grad/solcalc/calcdetails.html',
  mathFormulas: [
    {
      name: 'Julian Day',
      plain: 'JD = floor(365.25 × (Y + 4716)) + floor(30.6001 × (M + 1)) + D + B - 1524.5',
      description: 'Converts calendar date to Julian Day number for astronomical calculations',
    },
    {
      name: 'Julian Century',
      plain: 'T = (JD - 2451545.0) / 36525.0',
      description: 'Julian centuries since J2000.0 epoch (January 1, 2000, 12:00 TT)',
    },
    {
      name: 'Geometric Mean Longitude',
      plain: 'L₀ = 280.46646° + 36000.76983° × T + 0.0003032° × T²',
      description: 'Mean longitude of the sun, normalized to 0-360°',
    },
    {
      name: 'Geometric Mean Anomaly',
      plain: 'M = 357.52911° + 35999.05029° × T - 0.0001537° × T²',
      description: 'Mean anomaly of the sun (angular distance from perihelion)',
    },
    {
      name: 'Equation of Center',
      plain: 'C = (1.9146° - 0.004817° × T) × sin(M) + 0.019993° × sin(2M) + 0.00029° × sin(3M)',
      description: 'Correction from mean to true anomaly due to elliptical orbit',
    },
    {
      name: 'Solar Declination',
      plain: 'δ = arcsin(sin(ε) × sin(λ))',
      latex: '\\delta = \\arcsin(\\sin(\\varepsilon) \\times \\sin(\\lambda))',
      description: 'Angular distance of the sun north or south of the celestial equator',
    },
    {
      name: 'Hour Angle',
      plain: 'HA = arccos((cos(Z) / (cos(φ) × cos(δ))) - tan(φ) × tan(δ))',
      latex: 'HA = \\arccos\\left(\\frac{\\cos(Z)}{\\cos(\\phi) \\times \\cos(\\delta)} - \\tan(\\phi) \\times \\tan(\\delta)\\right)',
      description: 'Angular distance of sun from local meridian; Z=zenith angle, φ=latitude, δ=declination',
    },
    {
      name: 'Equation of Time',
      plain: 'EoT = 4 × (y × sin(2L₀) - 2e × sin(M) + 4ey × sin(M) × cos(2L₀) - 0.5y² × sin(4L₀) - 1.25e² × sin(2M))',
      description: 'Difference between apparent solar time and mean solar time (minutes)',
    },
  ],
  constants: {
    'Standard Refraction': {
      value: '0.833°',
      description: 'Atmospheric refraction at horizon (34 arcmin) + solar semi-diameter (16 arcmin)',
    },
    'Earth Radius': {
      value: '6,371,000 m',
      description: 'Mean radius of Earth for elevation calculations',
    },
    'J2000.0 Epoch': {
      value: '2451545.0 JD',
      description: 'January 1, 2000, 12:00 TT - reference epoch for astronomical calculations',
    },
  },
  elevationAdjustment: 'adjustment = arccos(R / (R + h)) where R = Earth radius, h = elevation in meters. This accounts for the extended horizon visible from elevated positions.',
};

const SEASONAL_ALGORITHM: AlgorithmDetails = {
  name: 'Seasonal Proportional Method (ROY/Zemaneh-Yosef)',
  source: 'Based on equinox offset scaling',
  description: 'Calculates twilight times by determining the offset at the equinox and scaling proportionally to current day length. Used by Rabbi Ovadia Yosef and Zemaneh-Yosef methodology.',
  steps: [
    { step: 1, description: 'Calculate equinox date (March 20 of current year)' },
    { step: 2, description: 'Calculate sunrise/sunset and angle times for equinox', formula: 'equinox_dawn, equinox_dusk = SunTimeAtAngle(equinox_date, angle)' },
    { step: 3, description: 'Calculate equinox offsets', formula: 'dawn_offset = sunrise - dawn; dusk_offset = dusk - sunset' },
    { step: 4, description: 'Get current day length ratio', formula: 'ratio = current_day_length / equinox_day_length' },
    { step: 5, description: 'Scale offsets', formula: 'scaled_dawn_offset = equinox_dawn_offset × ratio' },
    { step: 6, description: 'Apply to current sunrise/sunset', formula: 'dawn = sunrise - scaled_dawn_offset' },
  ],
  mathFormulas: [
    {
      name: 'Day Length Ratio',
      plain: 'r = (sunset_today - sunrise_today) / (sunset_equinox - sunrise_equinox)',
      description: 'Ratio of current day length to equinox day length (~12 hours)',
    },
    {
      name: 'Scaled Offset',
      plain: 'offset_scaled = offset_equinox × r',
      description: 'Twilight offset proportionally scaled to current day length',
    },
  ],
};

// =============================================================================
// PRIMITIVE DOCUMENTATION
// =============================================================================

export const PRIMITIVES_DOCUMENTATION: Record<string, PrimitiveDocumentation> = {
  // ---------------------------------------------------------------------------
  // HORIZON EVENTS
  // ---------------------------------------------------------------------------
  geometric_sunrise: {
    variableName: 'geometric_sunrise',
    hebrewName: '',
    hebrewText: '',

    scientificExplanation: 'Geometric sunrise occurs when the geometric center of the sun crosses the geometric horizon (0° altitude). This is a theoretical moment calculated without accounting for atmospheric refraction, which typically makes the sun visible about 2 minutes earlier in reality.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches 0° altitude (geometric horizon) at 90° zenith angle, with no corrections for atmospheric refraction or the sun\'s semi-diameter.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA Solar Calculator algorithm using spherical trigonometry to determine when the sun\'s center crosses the horizon.',
      steps: [
        { step: 1, description: 'Convert date to Julian Day (JD)' },
        { step: 2, description: 'Calculate Julian Century (T) from J2000.0 epoch' },
        { step: 3, description: 'Compute solar declination (δ) using orbital elements' },
        { step: 4, description: 'Calculate equation of time (EoT) for true solar time' },
        { step: 5, description: 'Compute hour angle (HA) for zenith = 90°', formula: 'HA = arccos((cos(90°) / (cos(lat) × cos(δ))) - tan(lat) × tan(δ))' },
        { step: 6, description: 'Calculate sunrise time', formula: 'sunrise = 720 - 4×longitude - EoT - 4×HA (minutes from midnight UTC)' },
        { step: 7, description: 'Apply elevation adjustment if needed', formula: 'zenith_adj = zenith - arccos(R / (R + elevation))' },
      ],
    },

    halachicSignificance: 'This is the pure geometric calculation representing the theoretical moment when the sun\'s center crosses the mathematical horizon. It is primarily used as a reference point for calculations. Most practical halachic calculations use the visible sunrise which accounts for refraction.',

    halachicSources: [
      { source: 'Various poskim', description: 'Used as a reference point in astronomical calculations' },
    ],

    practicalNotes: 'This is a theoretical calculation. The geometric sunrise occurs approximately 2-4 minutes after the visible sunrise. For practical halachic applications, use the visible_sunrise primitive which accounts for atmospheric refraction.',

    accuracy: '±1 minute under normal calculation conditions. This represents the mathematical moment, not the observed phenomenon.',

    edgeCases: 'At latitudes above ~66.5°, there may be days with no sunrise (polar night) or continuous daylight (polar day). The algorithm returns null for these cases.',

    authoritativeLinks: [
      { title: 'NOAA Solar Calculator', url: 'https://gml.noaa.gov/grad/solcalc/', description: 'Interactive calculator and algorithm documentation' },
      { title: 'NOAA Calculation Details', url: 'https://gml.noaa.gov/grad/solcalc/calcdetails.html', description: 'Detailed mathematical formulas used' },
      { title: 'Astronomical Algorithms', url: 'https://www.willbell.com/math/MC1.HTM', description: 'Jean Meeus reference book for astronomical calculations' },
    ],
  },

  geometric_sunset: {
    variableName: 'geometric_sunset',
    hebrewName: '',
    hebrewText: '',

    scientificExplanation: 'Geometric sunset occurs when the geometric center of the sun crosses the geometric horizon (0° altitude) in the evening. This is a theoretical calculation that does not account for atmospheric refraction, which causes the sun to remain visible for about 2-3 minutes after this moment.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches 0° altitude on the western horizon at 90° zenith angle, with no corrections for atmospheric refraction or the sun\'s semi-diameter.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'Same NOAA algorithm as geometric sunrise, but calculating when the sun crosses the horizon in the evening.',
      steps: [
        { step: 1, description: 'Convert date to Julian Day (JD)' },
        { step: 2, description: 'Calculate Julian Century (T) from J2000.0 epoch' },
        { step: 3, description: 'Compute solar declination (δ) using orbital elements' },
        { step: 4, description: 'Calculate equation of time (EoT) for true solar time' },
        { step: 5, description: 'Compute hour angle (HA) for zenith = 90°' },
        { step: 6, description: 'Calculate sunset time', formula: 'sunset = 720 - 4×longitude - EoT + 4×HA (minutes from midnight UTC)' },
        { step: 7, description: 'Apply elevation adjustment if needed' },
      ],
    },

    halachicSignificance: 'This is the pure geometric calculation representing the theoretical moment when the sun\'s center crosses the mathematical horizon in the evening. It is primarily used as a reference point for calculations. Most practical halachic calculations use the visible sunset which accounts for refraction.',

    halachicSources: [
      { source: 'Various poskim', description: 'Used as a reference point in astronomical calculations' },
    ],

    practicalNotes: 'This is a theoretical calculation. The geometric sunset occurs approximately 2-3 minutes before the visible sunset. For practical halachic applications, use the visible_sunset primitive which accounts for atmospheric refraction.',

    accuracy: '±1 minute under normal calculation conditions. This represents the mathematical moment, not the observed phenomenon.',

    edgeCases: 'Polar regions may have days without sunset (polar day) or continuous darkness (polar night). Mountainous terrain does not affect the geometric calculation but significantly affects visible sunset.',

    authoritativeLinks: [
      { title: 'NOAA Solar Calculator', url: 'https://gml.noaa.gov/grad/solcalc/', description: 'Interactive calculator and algorithm documentation' },
      { title: 'US Naval Observatory - Sun Data', url: 'https://aa.usno.navy.mil/data/RS_OneYear', description: 'Official sunrise/sunset tables' },
    ],
  },

  visible_sunrise: {
    variableName: 'visible_sunrise',
    hebrewName: 'הנץ הנראה',
    hebrewText: 'Hanetz Hanireh',

    scientificExplanation: 'Visible sunrise occurs when the upper limb (top edge) of the sun first appears above the horizon as seen by an observer. This accounts for atmospheric refraction which bends light, making the sun appear higher than its geometric position.',

    astronomicalDefinition: 'The moment when the sun\'s upper limb reaches the apparent horizon, calculated with a zenith angle of approximately 90.833° (accounting for 0.833° correction from atmospheric refraction and the sun\'s semi-diameter).',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'Same NOAA algorithm with adjusted zenith to account for the sun\'s upper limb and full refraction correction.',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm but with zenith = 90.833° (for upper limb visibility)' },
        { step: 2, description: 'The 0.833° accounts for atmospheric refraction (~0.567°) + solar semi-diameter (~0.266°)' },
        { step: 3, description: 'Result is approximately 2-4 minutes before geometric sunrise' },
      ],
    },

    halachicSignificance: 'This primitive represents "Netz HaChama" (הנץ החמה) - when sunlight first reaches the observer, accounting for atmospheric refraction. This is the standard definition used by most halachic authorities for calculating the beginning of the day and sha\'os zmaniyos (proportional hours).',

    halachicSources: [
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 58:1', description: 'Discusses the proper time for Shema and its relationship to sunrise' },
      { source: 'Mishnah Berurah', reference: '58:1', description: 'Explains the significance of sunrise for the start of the halachic day' },
      { source: 'Bi\'ur Halacha', reference: '58:1 "MiSheYakir"', description: 'Discusses the relationship between visible and geometric sunrise' },
    ],

    practicalNotes: 'This is the standard visible sunrise used in most zmanim calculations. It occurs 2-4 minutes before geometric sunrise. Temperature and humidity affect the exact amount of refraction. Clear, cold mornings may have different refraction than humid summer mornings.',

    accuracy: '±1 minute under normal atmospheric conditions. Accuracy decreases at extreme latitudes (>60°) and during unusual atmospheric conditions.',

    authoritativeLinks: [
      { title: 'NOAA Solar Calculator', url: 'https://gml.noaa.gov/grad/solcalc/', description: 'Interactive calculator and algorithm documentation' },
      { title: 'NOAA Calculation Details', url: 'https://gml.noaa.gov/grad/solcalc/calcdetails.html', description: 'Detailed mathematical formulas used' },
      { title: 'USNO Refraction Tables', url: 'https://aa.usno.navy.mil/faq/RST_defs', description: 'US Naval Observatory definitions and refraction information' },
    ],
  },

  visible_sunset: {
    variableName: 'visible_sunset',
    hebrewName: 'שקיעה נראית',
    hebrewText: 'Shkiah Nireis',

    scientificExplanation: 'Visible sunset occurs when the last visible edge of the sun disappears below the horizon, accounting for atmospheric refraction. This is what an observer actually sees as the moment of sunset.',

    astronomicalDefinition: 'The moment when the sun\'s upper limb reaches the apparent horizon, calculated with a zenith angle of approximately 90.833° (accounting for 0.833° correction from atmospheric refraction and the sun\'s semi-diameter).',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'Same NOAA algorithm with adjusted zenith for visible upper limb.',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 90.833°' },
        { step: 2, description: 'The 0.833° accounts for atmospheric refraction (~0.567°) + solar semi-diameter (~0.266°)' },
        { step: 3, description: 'Result is approximately 2-4 minutes after geometric sunset' },
      ],
    },

    halachicSignificance: 'This primitive represents "Shkiah" (שקיעה) - when the sun is no longer visible to an observer, accounting for atmospheric refraction. This is the standard definition used by most halachic authorities and marks the end of the halachic day, defining the start of the twilight period (bein hashmashos) and the reference point for Shabbos/holiday start times.',

    halachicSources: [
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 261:1-2', description: 'Laws regarding the start of Shabbos at sunset' },
      { source: 'Igros Moshe', reference: 'Orach Chaim 4:62', description: 'Discussion of sunset timing and its halachic implications' },
      { source: 'Mishnah Berurah', reference: '261:1-23', description: 'Detailed discussion of sunset and bein hashmashos' },
    ],

    practicalNotes: 'This is the standard visible sunset used in most zmanim calculations. It occurs 2-4 minutes after geometric sunset. Mountains or tall buildings on the western horizon can delay the visible sunset further. The exact time varies with atmospheric conditions.',

    accuracy: '±1 minute under normal atmospheric conditions.',

    authoritativeLinks: [
      { title: 'NOAA Solar Calculator', url: 'https://gml.noaa.gov/grad/solcalc/', description: 'Interactive calculator and algorithm documentation' },
      { title: 'US Naval Observatory - Sun Data', url: 'https://aa.usno.navy.mil/data/RS_OneYear', description: 'Official sunrise/sunset tables' },
    ],
  },

  // ---------------------------------------------------------------------------
  // TWILIGHT EVENTS
  // ---------------------------------------------------------------------------
  civil_dawn: {
    variableName: 'civil_dawn',
    hebrewName: '',

    scientificExplanation: 'Civil dawn occurs when the center of the sun is 6° below the horizon. At this point, there is enough natural light for most outdoor activities without artificial lighting. The horizon is clearly visible, and only the brightest stars and planets remain visible.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches -6° altitude (6° below the geometric horizon).',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm calculating when the sun reaches a zenith of 96° (90° + 6°).',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 96°' },
        { step: 2, description: 'Hour angle calculation uses 96° instead of 90.833°' },
        { step: 3, description: 'Apply elevation adjustment: zenith_adj = 96° - arccos(R / (R + h))' },
      ],
    },

    halachicSignificance: 'Civil dawn is sometimes used as a reference point for "Alos HaShachar" (dawn) by certain poskim, though most halachic authorities use deeper angles (16.1° or 18°). At 6° depression, one can distinguish colors and read without artificial light.',

    halachicSources: [
      { source: 'Various poskim', description: 'Some lenient opinions equate early dawn with civil twilight' },
    ],

    practicalNotes: 'At 6° depression, you can read newspaper print outdoors without artificial lighting. This is used in aviation for Visual Flight Rules (VFR) operations. Street lights typically turn off around this time.',

    accuracy: '±1 minute.',

    authoritativeLinks: [
      { title: 'US Naval Observatory - Twilight Definitions', url: 'https://aa.usno.navy.mil/faq/twilight', description: 'Official definitions of civil, nautical, and astronomical twilight' },
      { title: 'FAA Regulations on Twilight', url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap7_section_1.html', description: 'Aviation rules based on civil twilight' },
    ],
  },

  civil_dusk: {
    variableName: 'civil_dusk',
    hebrewName: '',

    scientificExplanation: 'Civil dusk occurs when the sun is 6° below the horizon in the evening. After this point, artificial lighting becomes necessary for most outdoor activities.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches -6° altitude in the evening.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm calculating when the sun reaches zenith = 96° after sunset.',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 96° for evening' },
      ],
    },

    halachicSignificance: 'Some authorities use civil dusk as an early estimate for "Tzeis HaKochavim" (nightfall), though most use later times (8.5° or more). This is sometimes used for lenient opinions regarding the end of Shabbos in emergencies.',

    halachicSources: [
      { source: 'Various poskim', description: 'Lenient opinions for definition of nightfall' },
    ],

    practicalNotes: 'Civil twilight is the brightest of the three twilight phases. Street lights typically turn on around this time. Useful as an upper bound for when Shabbos definitely cannot end.',

    accuracy: '±1 minute.',

    authoritativeLinks: [
      { title: 'IERS Technical Notes', url: 'https://www.iers.org/IERS/EN/Publications/TechnicalNotes/tn.html', description: 'International Earth Rotation Service technical documentation' },
    ],
  },

  nautical_dawn: {
    variableName: 'nautical_dawn',
    hebrewName: '',

    scientificExplanation: 'Nautical dawn occurs when the sun is 12° below the horizon. At this point, the horizon becomes visible at sea, allowing sailors to take star sightings for navigation while still seeing the horizon line.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches -12° altitude.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm with zenith = 102° (90° + 12°).',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 102°' },
      ],
    },

    halachicSignificance: 'Nautical dawn corresponds to what some poskim describe as when "one can distinguish between blue and white" (techeles and lavan) - an intermediate stage of dawn. Some opinions place misheyakir (earliest time for tallis) around this time.',

    halachicSources: [
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 58:1 with Mishnah Berurah', description: 'Discussion of the stages of dawn' },
    ],

    practicalNotes: 'At 12° depression, the sea horizon becomes clearly defined and general outlines of ground objects are distinguishable. The 12° angle is historically important for maritime navigation.',

    accuracy: '±1 minute.',

    authoritativeLinks: [
      { title: 'Nautical Almanac Office', url: 'https://aa.usno.navy.mil/publications/navpubs', description: 'Official nautical publications' },
    ],
  },

  nautical_dusk: {
    variableName: 'nautical_dusk',
    hebrewName: '',

    scientificExplanation: 'Nautical dusk occurs when the sun is 12° below the horizon in the evening. After this point, the horizon at sea becomes indistinguishable from the sky.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches -12° altitude in the evening.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm with zenith = 102° for evening.',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 102° for evening' },
      ],
    },

    halachicSignificance: 'This roughly corresponds to the end of "bein hashmashos" according to some opinions, when the sky becomes significantly darker. Some Sephardic communities use this as a reference for tzeis.',

    halachicSources: [
      { source: 'Various poskim on twilight', description: 'Discussion of the progression of darkness after sunset' },
    ],

    practicalNotes: 'Navigation by stars becomes practical after nautical dusk as the horizon fades and stars become more prominent. This marks a significant darkening of the sky.',

    accuracy: '±1 minute.',

    authoritativeLinks: [
      { title: 'Nautical Almanac', url: 'https://aa.usno.navy.mil/', description: 'US Naval Observatory nautical data' },
    ],
  },

  astronomical_dawn: {
    variableName: 'astronomical_dawn',
    hebrewName: '',
    hebrewText: '',

    scientificExplanation: 'Astronomical dawn occurs when the sun is 18° below the horizon. Before this point, the sky is completely dark (assuming no moon or light pollution). After this, the faintest glow begins to appear on the eastern horizon.',

    astronomicalDefinition: 'The moment when the sun\'s center reaches -18° altitude. This is the boundary between astronomical night and twilight - at greater depressions, the sky is as dark as it gets.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm with zenith = 108° (90° + 18°).',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 108°' },
        { step: 2, description: 'At high latitudes in summer, 18° depression may not occur (white nights)' },
      ],
    },

    halachicSignificance: 'The 18° angle is highly significant as it corresponds to "Alos HaShachar" (dawn) according to many Rishonim. The Rambam and others describe dawn as 72 minutes (in equinoctial minutes) before sunrise, which corresponds to approximately 16.1-18° depending on methodology. This is the earliest time for most morning mitzvos.',

    halachicSources: [
      { source: 'Rambam', reference: 'Hilchos Krias Shema 1:11', description: 'Defines dawn as 72 minutes before sunrise' },
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 89:1', description: 'Earliest time for Shacharis' },
      { source: 'Rabbeinu Tam', reference: 'quoted in Tosafos', description: 'Discussion of twilight calculations' },
    ],

    practicalNotes: 'At 18° depression, even sensitive astronomical instruments cannot detect scattered sunlight. This represents the boundary between night and twilight. The Magen Avraham uses this as the start of the halachic day.',

    accuracy: '±1 minute.',

    edgeCases: 'At latitudes above ~49° during summer, the sun may never reach 18° below the horizon, resulting in "white nights" with no true astronomical darkness.',

    authoritativeLinks: [
      { title: 'US Naval Observatory - Twilight', url: 'https://aa.usno.navy.mil/faq/twilight', description: 'Official twilight definitions' },
      { title: 'KosherJava Zmanim Library', url: 'https://kosherjava.com/zmanim-project/', description: 'Reference implementation for Jewish astronomical calculations' },
    ],
  },

  astronomical_dusk: {
    variableName: 'astronomical_dusk',
    hebrewName: '',
    hebrewText: '',

    scientificExplanation: 'Astronomical dusk occurs when the sun is 18° below the horizon in the evening. After this point, the sky is completely dark for astronomical observations (weather and moon permitting).',

    astronomicalDefinition: 'The moment when the sun\'s center reaches -18° altitude in the evening.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm with zenith = 108° for evening.',
      steps: [
        { step: 1, description: 'Calculate using standard algorithm with zenith = 108° for evening' },
      ],
    },

    halachicSignificance: 'This corresponds to "Tzeis HaKochavim" (appearance of stars) according to Rabbeinu Tam, who holds that nightfall occurs 72 equinoctial minutes after sunset. Many Sephardic communities follow this stringent opinion for ending Shabbos and other matters.',

    halachicSources: [
      { source: 'Rabbeinu Tam', reference: 'Tosafos Shabbos 35a', description: 'The opinion that nightfall is 72 minutes after sunset' },
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 261:2', description: 'Discussion of when Shabbos ends' },
      { source: 'Yalkut Yosef', description: 'Sephardic practice based on Rabbeinu Tam' },
    ],

    practicalNotes: 'The 18° angle represents complete astronomical darkness. However, three medium-sized stars (required for halachic nightfall) become visible much earlier, around 8.5° depression. Most Ashkenazi communities end Shabbos earlier than 18°.',

    accuracy: '±1 minute.',

    authoritativeLinks: [
      { title: 'Chabad Zmanim Calculations', url: 'https://www.chabad.org/library/article_cdo/aid/3209349/jewish/About-Our-Zmanim-Calculations.htm', description: 'Explanation of Rabbeinu Tam opinion' },
    ],
  },

  // ---------------------------------------------------------------------------
  // SOLAR POSITION EVENTS
  // ---------------------------------------------------------------------------
  solar_noon: {
    variableName: 'solar_noon',
    hebrewName: '',
    hebrewText: '',

    scientificExplanation: 'Solar noon (transit) is the moment when the sun crosses the local meridian and reaches its highest point in the sky for that day. At this exact moment, shadows point exactly north (in the northern hemisphere) or south (in the southern hemisphere), and the shadow-sm is at its shortest length.',

    astronomicalDefinition: 'The moment when the sun\'s hour angle equals zero - i.e., when the sun is on the observer\'s meridian. This is independent of zenith angle.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'NOAA algorithm for solar transit, using the Equation of Time to correct from mean to apparent solar time.',
      steps: [
        { step: 1, description: 'Calculate Julian Day and Julian Century' },
        { step: 2, description: 'Calculate Equation of Time (EoT)', formula: 'EoT = 4 × (y×sin(2L₀) - 2e×sin(M) + 4ey×sin(M)×cos(2L₀) - 0.5y²×sin(4L₀) - 1.25e²×sin(2M))' },
        { step: 3, description: 'Calculate solar noon', formula: 'noon_UTC = 720 - 4×longitude - EoT (minutes from midnight)' },
        { step: 4, description: 'Convert to local time' },
      ],
    },

    halachicSignificance: 'Chatzos HaYom (midday) marks the halachic midpoint of the day. The latest time for morning Shema and Shacharis is calculated relative to this point (according to most opinions, 1/4 of the day before chatzos for Shema, 1/3 for Shacharis). Mincha may not begin until after chatzos (or chatzos + 30 minutes for Mincha Gedola).',

    halachicSources: [
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 233:1', description: 'Mincha cannot begin until after chatzos' },
      { source: 'Mishnah Berurah', reference: '233:1-4', description: 'Detailed discussion of chatzos calculations' },
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 58:1', description: 'Deadline for Shema relative to chatzos' },
    ],

    practicalNotes: 'Solar noon can occur anywhere from about 11:15 AM to 12:45 PM local clock time depending on your position within the time zone, daylight saving time, and time of year. The Equation of Time can shift solar noon by up to ±16 minutes from the mean.',

    accuracy: '±30 seconds.',

    authoritativeLinks: [
      { title: 'NOAA Solar Calculator', url: 'https://gml.noaa.gov/grad/solcalc/', description: 'Interactive solar noon calculator' },
      { title: 'Equation of Time', url: 'https://en.wikipedia.org/wiki/Equation_of_time', description: 'Explanation of the Equation of Time' },
    ],
  },

  solar_midnight: {
    variableName: 'solar_midnight',
    hebrewName: '',
    hebrewText: '',

    scientificExplanation: 'Solar midnight (anti-transit) occurs when the sun is at its lowest point, directly opposite to its noon position. The sun is on the opposite side of the Earth from the observer, at the nadir of its daily path.',

    astronomicalDefinition: 'The moment when the sun\'s hour angle equals 180° (or -180°), occurring approximately 12 hours after solar noon.',

    algorithm: {
      ...NOAA_ALGORITHM_BASE,
      description: 'Calculated as 12 hours after solar noon, with minor adjustment for the changing Equation of Time.',
      steps: [
        { step: 1, description: 'Calculate solar noon for the current day' },
        { step: 2, description: 'Add 12 hours (720 minutes)' },
        { step: 3, description: 'Minor adjustment may be needed for EoT change during the 12-hour period' },
        { step: 4, description: 'Result may fall on the next calendar day' },
      ],
    },

    halachicSignificance: 'Chatzos HaLaylah (midnight) is the halachic midpoint of the night. Traditionally, this is the time when the gates of the Beis HaMikdash would open and when Dovid HaMelech would arise to study Torah. It marks the latest time for eating the Korban Pesach and the Afikoman. Various midnight practices (Tikkun Chatzos) are performed at this time.',

    halachicSources: [
      { source: 'Berachos 3b', description: 'Dovid HaMelech arose at midnight to study Torah' },
      { source: 'Shulchan Aruch', reference: 'Orach Chaim 1:2', description: 'Arising at midnight for learning' },
      { source: 'Rambam', reference: 'Hilchos Korban Pesach 8:15', description: 'Deadline for eating Korban Pesach' },
    ],

    practicalNotes: 'The night is divided into two halachic halves at this point. Solar midnight typically differs from clock midnight due to longitude position within the time zone and the Equation of Time.',

    accuracy: '±30 seconds.',

    authoritativeLinks: [
      { title: 'US Naval Observatory', url: 'https://aa.usno.navy.mil/', description: 'Astronomical reference data' },
    ],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get documentation for a primitive by variable name
 */
export function getPrimitiveDocumentation(variableName: string): PrimitiveDocumentation | undefined {
  return PRIMITIVES_DOCUMENTATION[variableName];
}

/**
 * Get all documented primitive variable names
 */
export function getDocumentedPrimitives(): string[] {
  return Object.keys(PRIMITIVES_DOCUMENTATION);
}

/**
 * Check if a primitive has documentation
 */
export function hasPrimitiveDocumentation(variableName: string): boolean {
  return variableName in PRIMITIVES_DOCUMENTATION;
}
