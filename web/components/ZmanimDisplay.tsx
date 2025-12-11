'use client';

import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { GeoLocation, ComplexZmanimCalendar } from 'kosher-zmanim';
import { UI_TEXT } from '@/lib/constants';

interface ZmanimDisplayProps {
  geoLocation: GeoLocation;
  date: DateTime;
}

type SunriseMethod = 'elevation' | 'sealevel';
type SunsetMethod = 'elevation' | 'sealevel';
type ShaahZmanisMethod = 'gra' | 'mga' | '16.1degrees' | '18degrees' | '19.8degrees' | '90min' | '96min' | '120min';

export default function ZmanimDisplay({ geoLocation, date }: ZmanimDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [alosTime, setAlosTime] = useState<DateTime | null>(null);
  const [sofZmanShma, setSofZmanShma] = useState<DateTime | null>(null);
  const [sofZmanTefillah, setSofZmanTefillah] = useState<DateTime | null>(null);
  const [chatzos, setChatzos] = useState<DateTime | null>(null);
  const [minchaGedolah, setMinchaGedolah] = useState<DateTime | null>(null);
  const [minchaKetanah, setMinchaKetanah] = useState<DateTime | null>(null);
  const [plagHamincha, setPlagHamincha] = useState<DateTime | null>(null);
  const [sunset, setSunset] = useState<DateTime | null>(null);
  const [tzeis, setTzeis] = useState<DateTime | null>(null);
  const [chatzosHalailah, setChatzosHalailah] = useState<DateTime | null>(null);
  const [sunrise, setSunrise] = useState<DateTime | null>(null);
  const [shaahZmanis, setShaahZmanis] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Calculation method selections
  const [sunriseMethod, setSunriseMethod] = useState<SunriseMethod>('elevation');
  const [sunsetMethod, setSunsetMethod] = useState<SunsetMethod>('elevation');
  const [shaahZmanisMethod, setShaahZmanisMethod] = useState<ShaahZmanisMethod>('gra');

  // Formula explanation state
  const [expandedFormulas, setExpandedFormulas] = useState<Set<string>>(new Set());

  useEffect(() => {
    calculateTimes();
  }, [geoLocation, date, sunriseMethod, sunsetMethod, shaahZmanisMethod]);

  const calculateTimes = () => {
    setIsLoading(true);
    setError(null);

    try {
      const calendar = new ComplexZmanimCalendar(geoLocation);
      const jsDate = date.toJSDate();
      calendar.setDate(jsDate);

      // Get sunrise based on selected method
      const sunriseTime = sunriseMethod === 'sealevel'
        ? calendar.getSeaLevelSunrise()
        : calendar.getSunrise();
      setSunrise(sunriseTime);

      // Get sunset based on selected method
      const sunsetTime = sunsetMethod === 'sealevel'
        ? calendar.getSeaLevelSunset()
        : calendar.getSunset();
      setSunset(sunsetTime);

      // Calculate shaah zmanis based on selected method
      let shaahZmanisMinutes = 0;
      if (sunriseTime && sunsetTime) {
        switch (shaahZmanisMethod) {
          case 'gra':
            const dayLengthMinutes = sunsetTime.diff(sunriseTime, 'minutes').minutes;
            shaahZmanisMinutes = dayLengthMinutes / 12;
            break;
          case 'mga':
            const shaahZmanisMGA = calendar.getShaahZmanisMGA();
            if (shaahZmanisMGA) {
              shaahZmanisMinutes = shaahZmanisMGA / (1000 * 60); // Convert milliseconds to minutes
            }
            break;
          case '16.1degrees':
            const shaahZmanis161 = calendar.getShaahZmanis16Point1Degrees();
            if (shaahZmanis161) {
              shaahZmanisMinutes = shaahZmanis161 / (1000 * 60);
            }
            break;
          case '18degrees':
            const shaahZmanis18 = calendar.getShaahZmanis18Degrees();
            if (shaahZmanis18) {
              shaahZmanisMinutes = shaahZmanis18 / (1000 * 60);
            }
            break;
          case '19.8degrees':
            const shaahZmanis198 = calendar.getShaahZmanis19Point8Degrees();
            if (shaahZmanis198) {
              shaahZmanisMinutes = shaahZmanis198 / (1000 * 60);
            }
            break;
          case '90min':
            const shaahZmanis90 = calendar.getShaahZmanis90Minutes();
            if (shaahZmanis90) {
              shaahZmanisMinutes = shaahZmanis90 / (1000 * 60);
            }
            break;
          case '96min':
            const shaahZmanis96 = calendar.getShaahZmanis96Minutes();
            if (shaahZmanis96) {
              shaahZmanisMinutes = shaahZmanis96 / (1000 * 60);
            }
            break;
          case '120min':
            const shaahZmanis120 = calendar.getShaahZmanis120Minutes();
            if (shaahZmanis120) {
              shaahZmanisMinutes = shaahZmanis120 / (1000 * 60);
            }
            break;
        }
        setShaahZmanis(shaahZmanisMinutes);
      }

      // Calculate Alos 16.1°
      const alos = calendar.getAlos16Point1Degrees();
      setAlosTime(alos);

      // Calculate Sof Zman Shma GRA
      const shma = calendar.getSofZmanShmaGRA();
      setSofZmanShma(shma);

      // Calculate Sof Zman Tefillah GRA
      const tefillah = calendar.getSofZmanTfilaGRA();
      setSofZmanTefillah(tefillah);

      // Calculate Chatzos (solar noon)
      const chatzosTime = calendar.getChatzos();
      setChatzos(chatzosTime);

      // Calculate Mincha Gedolah
      const mGedolah = calendar.getMinchaGedola30Minutes();
      setMinchaGedolah(mGedolah);

      // Calculate Mincha Ketanah (9.5 shaos zmaniyos after sunrise)
      const mKetanah = calendar.getMinchaKetana(sunriseTime, sunsetTime);
      setMinchaKetanah(mKetanah);

      // Calculate Plag HaMincha (10.75 shaos zmaniyos after sunrise)
      const plag = calendar.getPlagHamincha(sunriseTime, sunsetTime);
      setPlagHamincha(plag);

      // Calculate Tzeis (8.5 degrees)
      const tzeis85 = calendar.getTzaisGeonim8Point5Degrees();
      setTzeis(tzeis85);

      // Calculate Chatzos HaLailah (midnight)
      const chatzosNight = calendar.getSolarMidnight();
      setChatzosHalailah(chatzosNight);
    } catch (err) {
      console.error('Error calculating zmanim:', err);
      setError('Failed to calculate times. Please check your location and date.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dt: DateTime | null): string => {
    if (!dt) return 'N/A';
    return dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 mx-auto text-apple-blue mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-apple-gray-600 font-medium">
            {UI_TEXT.calculating}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex">
          <div className="shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const toggleFormula = (id: string) => {
    const newExpanded = new Set(expandedFormulas);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFormulas(newExpanded);
  };

  const getFormulaExplanation = (id: string): string => {
    const explanations: Record<string, string> = {
      sunrise: `Sunrise (Netz HaChamah) is calculated when the sun's geometric center crosses the horizon. We account for atmospheric refraction (which makes the sun appear higher than it actually is) and the sun's angular radius. This means we calculate for when the sun's center is 0.833° below the geometric horizon. At your latitude of ${geoLocation.getLatitude().toFixed(4)}°, we use the spherical trigonometry formula to find the hour angle when the sun reaches this position. The hour angle is then converted to clock time by dividing by 15° (since the Earth rotates 15° per hour) and adjusting for your longitude and the equation of time.`,
      sunset: `Sunset (Shkiah) uses the same calculation as sunrise but for the western horizon. When the sun's center is 0.833° below the horizon in the west, we consider it sunset. The calculation accounts for your location's longitude of ${geoLocation.getLongitude().toFixed(4)}° and the daily variation in the sun's declination angle. The result tells us when the upper edge of the sun disappears below the horizon.`,
      dayLength: `Day length is simply the time difference between sunrise and sunset. This represents the total duration of the halachic day. In Jewish law, this period is divided into 12 equal "hours" (shaos zmaniyos), regardless of the actual clock time duration. During summer months, these hours are longer than 60 minutes; during winter, they're shorter.`,
      shaahZmanis: `A Shaah Zmanis (halachic hour) is one-twelfth of the day. We take the total time from sunrise to sunset and divide it by 12. Unlike a fixed 60-minute hour, a shaah zmanis varies throughout the year. Near the equator, it stays close to 60 minutes year-round. At higher latitudes, it can be significantly longer in summer and shorter in winter. This proportional time system ensures that halachic observances remain consistent relative to the sun's position throughout the year.`,
      alos: `Alos Hashachar (dawn) at 16.1° uses the solar depression angle method. When the sun is 16.1° below the horizon, the sky begins to lighten enough for dawn. We use the same spherical trigonometry formula as sunrise, but with -16.1° instead of -0.833°. This gives us a time before sunrise when the first light appears. The 16.1° angle is derived from correlating traditional time-based measurements (like 72 minutes) with actual solar positions at Jerusalem's latitude.`,
      shma: `Sof Zman Krias Shema (latest time for Shema) according to the Vilna Gaon (GRA) is 3 shaos zmaniyos after sunrise. We take the shaah zmanis value (${formatDuration(shaahZmanis)}) and multiply it by 3, then add that to sunrise. This means Shema must be recited within the first quarter of the halachic day. The calculation is: Sunrise + (3 × ${Math.round(shaahZmanis)} minutes) = ${Math.round(shaahZmanis * 3)} minutes after sunrise.`,
      tefillah: `Sof Zman Tefillah (latest time for morning prayer) is 4 shaos zmaniyos after sunrise. Using the same proportional hour system, we multiply the shaah zmanis by 4 and add it to sunrise. This gives us a time that's one-third through the halachic day. The GRA method uses sunrise and sunset as the boundaries, making it ${formatDuration(shaahZmanis * 4)} after sunrise.`,
      chatzos: `Chatzos Hayom (solar noon) is the exact midpoint between sunrise and sunset, which also corresponds to when the sun reaches its highest point (zenith) in the sky. It's calculated as sunrise plus 6 shaos zmaniyos, or equivalently, halfway between sunrise and sunset. At this moment, the sun is directly south (in the Northern Hemisphere) or north (in the Southern Hemisphere) of your location.`,
      minchaGedolah: `Mincha Gedolah (earliest time for afternoon prayer) begins half a shaah zmanis after Chatzos. This is traditionally calculated as 30 fixed minutes after solar noon. Once the sun begins its descent from its zenith, the time for afternoon prayer begins. This implementation uses a 30-minute fixed value for simplicity.`,
      minchaKetanah: `Mincha Ketanah (preferred afternoon prayer time) is 9.5 shaos zmaniyos after sunrise, or equivalently, 2.5 shaos zmaniyos before sunset. At this point, we're three-quarters through the halachic day. Many communities prefer to pray Mincha after this time rather than at Mincha Gedolah.`,
      plag: `Plag HaMincha (the split of Mincha) is 10.75 shaos zmaniyos after sunrise. This time divides the late afternoon period and has halachic significance for when certain communities may begin evening prayers. It's calculated as 1.25 shaos zmaniyos before sunset. The name "plag" means "half" - it's halfway between Mincha Ketanah and sunset.`,
      tzeis: `Tzeis Hakochavim (nightfall) at 8.5° is when three medium stars become visible. Using the Geonim's position, we calculate when the sun is 8.5° below the geometric horizon after sunset. This is computed using the same spherical trigonometry formula as dawn, but applied to the evening. The 8.5° depression angle correlates with the sky darkness needed to see three stars of medium magnitude.`,
      chatzosHalailah: `Chatzos HaLailah (solar midnight) is the midpoint between sunset and the following sunrise. Just as Chatzos Hayom is solar noon, this is solar midnight - when the sun is at its lowest point (nadir) below the horizon. It's exactly 12 hours of clock time after or before Chatzos Hayom, though the day and night may not be equal in length.`,
    };
    return explanations[id] || 'Explanation not available for this calculation.';
  };

  interface ZmanRow {
    id: string;
    level: number;
    icon: string;
    name: string;
    time: DateTime | null;
    method: string;
    formula: string;
    color: string;
    dependencies?: string[];
  }

  const zmanimData: ZmanRow[] = [
    {
      id: 'sunrise',
      level: 0,
      icon: '🌅',
      name: 'Sunrise (Netz)',
      time: sunrise,
      method: sunriseMethod === 'sealevel' ? 'Sea Level' : 'Elevation Adjusted',
      formula: 'cos(H) = [sin(-0.833°) - sin(φ) × sin(δ)] / [cos(φ) × cos(δ)]',
      color: 'from-orange-400 to-orange-600',
    },
    {
      id: 'alos',
      level: 1,
      icon: '🌄',
      name: 'Alos Hashachar',
      time: alosTime,
      method: 'Solar Depression 16.1°',
      formula: 'cos(H) = [sin(-16.1°) - sin(φ) × sin(δ)] / [cos(φ) × cos(δ)]',
      color: 'from-blue-400 to-blue-600',
      dependencies: ['sunrise'],
    },
    {
      id: 'sunset',
      level: 0,
      icon: '🌇',
      name: 'Sunset (Shkiah)',
      time: sunset,
      method: sunsetMethod === 'sealevel' ? 'Sea Level' : 'Elevation Adjusted',
      formula: 'cos(H) = [sin(-0.833°) - sin(φ) × sin(δ)] / [cos(φ) × cos(δ)]',
      color: 'from-red-500 to-orange-600',
    },
    {
      id: 'dayLength',
      level: 1,
      icon: '⏱️',
      name: 'Day Length',
      time: null,
      method: 'Difference',
      formula: 'Sunset - Sunrise',
      color: 'from-blue-500 to-indigo-600',
      dependencies: ['sunrise', 'sunset'],
    },
    {
      id: 'shaahZmanis',
      level: 2,
      icon: '⏰',
      name: 'Shaah Zmanis',
      time: null,
      method: shaahZmanisMethod.toUpperCase(),
      formula: '(Sunset - Sunrise) ÷ 12',
      color: 'from-purple-500 to-pink-600',
      dependencies: ['dayLength'],
    },
    {
      id: 'shma',
      level: 3,
      icon: '📖',
      name: 'Sof Zman Shema',
      time: sofZmanShma,
      method: 'GRA - 3 Hours',
      formula: 'Sunrise + (3 × Shaah Zmanis)',
      color: 'from-indigo-500 to-purple-600',
      dependencies: ['sunrise', 'shaahZmanis'],
    },
    {
      id: 'tefillah',
      level: 3,
      icon: '🙏',
      name: 'Sof Zman Tefillah',
      time: sofZmanTefillah,
      method: 'GRA - 4 Hours',
      formula: 'Sunrise + (4 × Shaah Zmanis)',
      color: 'from-green-500 to-emerald-600',
      dependencies: ['sunrise', 'shaahZmanis'],
    },
    {
      id: 'chatzos',
      level: 3,
      icon: '☀️',
      name: 'Chatzos Hayom',
      time: chatzos,
      method: 'Solar Noon',
      formula: 'Sunrise + (6 × Shaah Zmanis)',
      color: 'from-yellow-500 to-orange-500',
      dependencies: ['sunrise', 'shaahZmanis'],
    },
    {
      id: 'minchaGedolah',
      level: 4,
      icon: '🕐',
      name: 'Mincha Gedolah',
      time: minchaGedolah,
      method: '30 min after Chatzos',
      formula: 'Chatzos + 30 minutes',
      color: 'from-amber-500 to-orange-600',
      dependencies: ['chatzos'],
    },
    {
      id: 'minchaKetanah',
      level: 4,
      icon: '🕒',
      name: 'Mincha Ketanah',
      time: minchaKetanah,
      method: '9.5 Hours',
      formula: 'Sunrise + (9.5 × Shaah Zmanis)',
      color: 'from-red-400 to-pink-600',
      dependencies: ['sunrise', 'shaahZmanis'],
    },
    {
      id: 'plag',
      level: 4,
      icon: '🕔',
      name: 'Plag HaMincha',
      time: plagHamincha,
      method: '10.75 Hours',
      formula: 'Sunrise + (10.75 × Shaah Zmanis)',
      color: 'from-purple-400 to-purple-700',
      dependencies: ['sunrise', 'shaahZmanis'],
    },
    {
      id: 'tzeis',
      level: 1,
      icon: '🌃',
      name: 'Tzeis Hakochavim',
      time: tzeis,
      method: 'Solar Depression 8.5°',
      formula: 'cos(H) = [sin(-8.5°) - sin(φ) × sin(δ)] / [cos(φ) × cos(δ)]',
      color: 'from-indigo-700 to-blue-900',
      dependencies: ['sunset'],
    },
    {
      id: 'chatzosHalailah',
      level: 1,
      icon: '🌙',
      name: 'Chatzos HaLailah',
      time: chatzosHalailah,
      method: 'Solar Midnight',
      formula: 'Sunset + (Night Length ÷ 2)',
      color: 'from-slate-700 to-slate-900',
      dependencies: ['sunset'],
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="bg-linear-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl shadow-apple-xl border border-white/20 overflow-hidden max-w-7xl mx-auto">
        <div className="bg-card/95 backdrop-blur-sm p-8 md:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-apple-gray-900 mb-2">
              Zmanim Calculations
            </h2>
            <p className="text-apple-gray-600">
              Hierarchical view of all prayer times and their calculation methods
            </p>
          </div>

          {/* Configuration Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-xl p-4 border border-border">
              <label className="block text-xs font-semibold text-foreground mb-2">Sunrise Method</label>
              <select
                value={sunriseMethod}
                onChange={(e) => setSunriseMethod(e.target.value as SunriseMethod)}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              >
                <option value="elevation">Elevation-Adjusted</option>
                <option value="sealevel">Sea-Level</option>
              </select>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <label className="block text-xs font-semibold text-foreground mb-2">Sunset Method</label>
              <select
                value={sunsetMethod}
                onChange={(e) => setSunsetMethod(e.target.value as SunsetMethod)}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              >
                <option value="elevation">Elevation-Adjusted</option>
                <option value="sealevel">Sea-Level</option>
              </select>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <label className="block text-xs font-semibold text-foreground mb-2">Shaah Zmanis Method</label>
              <select
                value={shaahZmanisMethod}
                onChange={(e) => setShaahZmanisMethod(e.target.value as ShaahZmanisMethod)}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              >
                <option value="gra">GRA (Sunrise to Sunset)</option>
                <option value="mga">MGA (72-min Alos to Tzeis)</option>
                <option value="16.1degrees">16.1° Alos to Tzeis</option>
                <option value="18degrees">18° Alos to Tzeis</option>
                <option value="19.8degrees">19.8° Alos to Tzeis</option>
                <option value="90min">90-min Alos to Tzeis</option>
                <option value="96min">96-min Alos to Tzeis</option>
                <option value="120min">120-min Alos to Tzeis</option>
              </select>
            </div>
          </div>

          {/* Zmanim Table */}
          <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b-2 border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                    Zman
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                    Formula
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-foreground uppercase tracking-wider">
                    Explain
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {zmanimData.map((zman) => (
                  <>
                    <tr
                      key={zman.id}
                      className="hover:bg-muted transition-colors duration-150"
                    >
                      {/* Zman Name with Tree Structure */}
                      <td className="px-6 py-4">
                        <div
                          className="flex items-center"
                          style={{ paddingLeft: `${zman.level * 1.5}rem` }}
                        >
                          {zman.level > 0 && (
                            <div className="mr-2 text-muted-foreground">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}
                          <span className="text-2xl mr-3">{zman.icon}</span>
                          <div>
                            <div className="font-semibold text-foreground">{zman.name}</div>
                            {zman.dependencies && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Depends on: {zman.dependencies.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="px-6 py-4">
                        <div
                          className={`inline-flex items-center px-4 py-2 rounded-xl bg-linear-to-r ${zman.color} text-white font-bold text-lg shadow-md`}
                        >
                          {zman.id === 'dayLength' && sunrise && sunset
                            ? formatDuration(sunset.diff(sunrise, 'minutes').minutes)
                            : zman.id === 'shaahZmanis'
                            ? formatDuration(shaahZmanis)
                            : formatTime(zman.time)}
                        </div>
                      </td>

                      {/* Method */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground bg-muted px-3 py-2 rounded-lg inline-block">
                          {zman.method}
                        </div>
                      </td>

                      {/* Formula */}
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-foreground bg-blue-50 dark:bg-blue-950 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                          {zman.formula}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          φ = Latitude: {geoLocation.getLatitude().toFixed(4)}°
                          {', '}
                          δ = Solar declination
                        </div>
                      </td>

                      {/* Explain Button */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleFormula(zman.id)}
                          className="inline-flex items-center px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          {expandedFormulas.has(zman.id) ? (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Hide
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Explain
                            </>
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Explanation Row */}
                    {expandedFormulas.has(zman.id) && (
                      <tr key={`${zman.id}-explanation`} className="bg-blue-50 dark:bg-blue-950">
                        <td colSpan={5} className="px-6 py-6">
                          <div className="bg-card rounded-xl p-6 shadow-inner border border-blue-300 dark:border-blue-700">
                            <div className="flex items-start">
                              <div className="shrink-0">
                                <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="ml-4 flex-1">
                                <h4 className="text-lg font-bold text-foreground mb-3">
                                  How is {zman.name} calculated?
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">
                                  {getFormulaExplanation(zman.id)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Location Info Footer */}
      {sunrise && (
        <div className="bg-linear-to-br from-secondary to-muted rounded-2xl shadow-apple p-6 text-foreground max-w-7xl mx-auto border border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center">
              <svg
                className="w-8 h-8 mr-3 opacity-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <div>
                <p className="text-sm opacity-90 font-medium">Location</p>
                <p className="text-xl font-semibold">{geoLocation.getLocationName()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90 font-medium">Coordinates</p>
              <p className="text-base font-semibold">
                {geoLocation.getLatitude().toFixed(4)}°, {geoLocation.getLongitude().toFixed(4)}°
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
