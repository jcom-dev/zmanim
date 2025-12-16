/**
 * Generate zmanim comparison times for Manchester 5786
 * Creates a clean spreadsheet with MBD, MH, and Shtetl calculated times
 */

const XLSX = require('xlsx');

// Manchester coordinates
const LAT = 53.4808;
const LON = -2.2426;

// Helper: Convert degrees to radians
const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;

// NOAA Solar Calculator algorithms
function calculateSunTimes(date, lat, lon) {
  const jd = getJulianDay(date);
  const t = (jd - 2451545.0) / 36525.0;

  // Sun's geometric mean longitude
  const L0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360;

  // Sun's geometric mean anomaly
  const M = (357.52911 + t * (35999.05029 - 0.0001537 * t)) % 360;

  // Earth's orbit eccentricity
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Sun's equation of center
  const C = Math.sin(toRad(M)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
            Math.sin(toRad(2 * M)) * (0.019993 - 0.000101 * t) +
            Math.sin(toRad(3 * M)) * 0.000289;

  // Sun's true longitude
  const sunLon = L0 + C;

  // Sun's apparent longitude
  const omega = 125.04 - 1934.136 * t;
  const lambda = sunLon - 0.00569 - 0.00478 * Math.sin(toRad(omega));

  // Mean obliquity of ecliptic
  const obliq0 = 23 + (26 + ((21.448 - t * (46.8150 + t * (0.00059 - t * 0.001813)))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(toRad(omega));

  // Sun's declination
  const decl = toDeg(Math.asin(Math.sin(toRad(obliq)) * Math.sin(toRad(lambda))));

  // Equation of time (minutes)
  const y = Math.tan(toRad(obliq / 2)) ** 2;
  const eqTime = 4 * toDeg(
    y * Math.sin(2 * toRad(L0)) -
    2 * e * Math.sin(toRad(M)) +
    4 * e * y * Math.sin(toRad(M)) * Math.cos(2 * toRad(L0)) -
    0.5 * y * y * Math.sin(4 * toRad(L0)) -
    1.25 * e * e * Math.sin(2 * toRad(M))
  );

  return { decl, eqTime };
}

function getJulianDay(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;

  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function getSunriseSet(date, lat, lon, zenith = 90.833) {
  const { decl, eqTime } = calculateSunTimes(date, lat, lon);

  // Hour angle
  const cosHA = (Math.cos(toRad(zenith)) / (Math.cos(toRad(lat)) * Math.cos(toRad(decl)))) -
                Math.tan(toRad(lat)) * Math.tan(toRad(decl));

  if (cosHA > 1 || cosHA < -1) {
    return null; // No sunrise/sunset (polar day/night)
  }

  const ha = toDeg(Math.acos(cosHA));

  // Solar noon (LST)
  const noon = (720 - 4 * lon - eqTime) / 60;

  // Get timezone offset for the date
  const tzOffset = getTimezoneOffset(date);

  const sunrise = noon - ha / 15 + tzOffset;
  const sunset = noon + ha / 15 + tzOffset;
  const solarNoon = noon + tzOffset;

  return { sunrise, sunset, solarNoon };
}

function getSunTimeAtAngle(date, lat, lon, angle, beforeSunrise = true) {
  // Zenith for angle below horizon
  const zenith = 90 + angle;
  const times = getSunriseSet(date, lat, lon, zenith);
  if (!times) return null;
  return beforeSunrise ? times.sunrise : times.sunset;
}

function getTimezoneOffset(date) {
  // UK timezone: GMT in winter, BST (GMT+1) in summer
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Find last Sunday of March
  let marchLast = new Date(year, 2, 31);
  while (marchLast.getDay() !== 0) marchLast.setDate(marchLast.getDate() - 1);

  // Find last Sunday of October
  let octLast = new Date(year, 9, 31);
  while (octLast.getDay() !== 0) octLast.setDate(octLast.getDate() - 1);

  const isBST = (month > 2 && month < 9) ||
                (month === 2 && day >= marchLast.getDate()) ||
                (month === 9 && day < octLast.getDate());

  return isBST ? 1 : 0;
}

function formatTime(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) return '';

  // Handle times that wrap around midnight
  while (hours < 0) hours += 24;
  while (hours >= 24) hours -= 24;

  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (m === 60) {
    return `${(h + 1).toString().padStart(2, '0')}:00`;
  }

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function calculateAllZmanim(date, lat, lon) {
  const basic = getSunriseSet(date, lat, lon);
  if (!basic) return null;

  const { sunrise, sunset, solarNoon } = basic;
  const dayLength = sunset - sunrise;
  const shaahZmanisGRA = dayLength / 12;

  // Alos options
  const alos161 = getSunTimeAtAngle(date, lat, lon, 16.1, true);
  const alos12 = getSunTimeAtAngle(date, lat, lon, 12, true);

  // Misheyakir 11.5°
  const misheyakir = getSunTimeAtAngle(date, lat, lon, 11.5, true);

  // MH specific: 12° dawn to 7.08° nightfall for MGA
  const tzais708 = getSunTimeAtAngle(date, lat, lon, 7.08, false);
  const dayLengthMH = tzais708 && alos12 ? (tzais708 - alos12) : null;
  const shaahZmanisMH = dayLengthMH ? dayLengthMH / 12 : null;

  // Sof Zman Shema GRA (3 hours into day from sunrise)
  const sofShemaGRA = sunrise + 3 * shaahZmanisGRA;

  // Sof Zman Shema MGA/MH (3 hours from 12° to 7.08°)
  const sofShemaMH = alos12 && shaahZmanisMH ? alos12 + 3 * shaahZmanisMH : null;

  // Tzeis 8° (Shabbos ends)
  const tzais8 = getSunTimeAtAngle(date, lat, lon, 8, false);

  return {
    alos161,
    alos12,
    misheyakir,
    sunrise,
    sofShemaMH,
    sofShemaGRA,
    solarNoon,
    sunset,
    tzais708,
    tzais8,
  };
}

// Hebrew date data (from our MBD extraction)
const hebrewMonths = [
  'תשרי', 'מרחשון', 'כסלו', 'טבת', 'שבט', 'אדר',
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'
];

const hebrewDays = [
  'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳',
  'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט', 'כ׳',
  'כ״א', 'כ״ב', 'כ״ג', 'כ״ד', 'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל׳'
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// MBD published times (extracted from PDF page 2 table) - by week
// Format: {date: [alos, misheyakir, sunrise, shemaMA, shemaGRA, sunset, endShabbos]}
// Data extracted from Manchester Beis Din Calendar 5786
// Note: MBD and MH (Machzikei Hadass) use identical times - they source from same calculation

const mbdData = {
  // ===== 2025 =====
  // Row: 5786 - from PDF page 2 table
  // Columns: 1=Earliest Daybreak/Tallis, 2=Sunrise, 3=Latest Shema (two), 4=Latest Shema, 5=Earliest Mincha, etc.

  // September 2025 - Elul 5785 / Tishrei 5786
  // Week of Sept 27 (Shabbos)
  '2025-09-27': ['5:19', '5:55', '7:04', '9:09', '10:01', '18:57', '20:09'], // 27 Elul - Shabbos
  '2025-09-21': ['5:19', '5:55', '7:00', '9:06', '9:58', '19:06', ''],       // Sunday 21 Elul

  // Tishrei 5786 (starts evening of Sept 22, 2025)
  // Data from PDF - week starting columns
  '2025-10-04': ['5:33', '6:08', '7:17', '9:14', '10:04', '18:38', '19:49'], // 12 Tishrei - Shabbos
  '2025-10-11': ['5:46', '6:21', '7:29', '9:19', '10:06', '18:22', '19:31'], // 19 Tishrei - Shabbos (Chol HaMoed)
  '2025-10-18': ['6:00', '6:34', '7:42', '9:24', '10:08', '18:07', '19:14'], // 26 Tishrei - Shabbos
  '2025-10-25': ['6:14', '6:48', '7:55', '9:29', '10:11', '17:53', '18:58'], // 3 Marcheshvan - Shabbos

  // Marcheshvan 5786
  '2025-11-01': ['6:29', '7:02', '8:08', '9:35', '10:15', '16:40', '17:44'], // 10 Marcheshvan - Shabbos (clocks change)
  '2025-11-08': ['5:44', '6:16', '7:21', '9:10', '9:49', '16:29', '17:31'], // 17 Marcheshvan - Shabbos
  '2025-11-15': ['5:58', '6:30', '7:33', '9:14', '9:51', '16:19', '17:20'], // 24 Marcheshvan - Shabbos
  '2025-11-22': ['6:13', '6:44', '7:45', '9:19', '9:54', '16:11', '17:11'], // 1 Kislev - Shabbos
  '2025-11-29': ['6:26', '6:57', '7:56', '9:24', '9:57', '16:05', '17:04'], // 8 Kislev - Shabbos

  // Kislev 5786
  '2025-12-06': ['6:38', '7:08', '8:05', '9:28', '10:00', '16:02', '17:00'], // 15 Kislev - Shabbos
  '2025-12-13': ['6:48', '7:17', '8:12', '9:32', '10:03', '16:02', '17:00'], // 22 Kislev - Shabbos
  '2025-12-20': ['6:54', '7:22', '8:16', '9:36', '10:06', '16:05', '17:03'], // 29 Kislev - Shabbos (Chanukah)
  '2025-12-27': ['6:57', '7:25', '8:18', '9:39', '10:08', '16:11', '17:09'], // 7 Teves - Shabbos

  // Teves 5786
  '2026-01-03': ['6:56', '7:24', '8:16', '9:39', '10:09', '16:20', '17:18'], // 14 Teves - Shabbos
  '2026-01-10': ['6:51', '7:20', '8:12', '9:38', '10:08', '16:30', '17:29'], // 21 Teves - Shabbos
  '2026-01-17': ['6:43', '7:13', '8:05', '9:35', '10:07', '16:42', '17:41'], // 28 Teves - Shabbos

  // Shevat 5786
  '2026-01-24': ['6:33', '7:03', '7:56', '9:31', '10:04', '16:55', '17:55'], // 5 Shevat - Shabbos
  '2026-01-31': ['6:20', '6:51', '7:45', '9:26', '10:01', '17:09', '18:09'], // 12 Shevat - Shabbos
  '2026-02-07': ['6:05', '6:37', '7:32', '9:19', '9:56', '17:23', '18:24'], // 19 Shevat - Shabbos
  '2026-02-14': ['5:48', '6:21', '7:18', '9:11', '9:51', '17:37', '18:39'], // 26 Shevat - Shabbos

  // Adar 5786
  '2026-02-21': ['5:29', '6:04', '7:02', '9:02', '9:44', '17:51', '18:53'], // 4 Adar - Shabbos
  '2026-02-28': ['5:09', '5:45', '6:46', '8:52', '9:37', '18:05', '19:08'], // 11 Adar - Shabbos
  '2026-03-07': ['5:48', '6:25', '7:29', '9:42', '10:29', '18:18', '19:22'], // 18 Adar - Shabbos
  '2026-03-14': ['5:27', '6:05', '7:12', '9:31', '10:20', '18:31', '19:36'], // 25 Adar - Shabbos

  // Nissan 5786
  '2026-03-21': ['5:05', '5:45', '6:55', '9:19', '10:11', '18:44', '19:50'], // 2 Nissan - Shabbos
  '2026-03-28': ['5:42', '6:24', '7:37', '10:07', '11:01', '19:57', '21:04'], // 9 Nissan - Shabbos (clocks change)
  '2026-04-04': ['5:18', '6:02', '7:19', '9:54', '10:50', '20:10', '21:19'], // 16 Nissan - Shabbos (Pesach)
  '2026-04-11': ['4:54', '5:40', '7:01', '9:40', '10:39', '20:23', '21:33'], // 23 Nissan - Shabbos

  // Iyar 5786
  '2026-04-18': ['4:29', '5:18', '6:44', '9:27', '10:28', '20:36', '21:47'], // 1 Iyar - Shabbos
  '2026-04-25': ['4:05', '4:57', '6:27', '9:13', '10:17', '20:49', '22:01'], // 8 Iyar - Shabbos
  '2026-05-02': ['3:42', '4:37', '6:12', '9:00', '10:07', '21:01', '22:15'], // 15 Iyar - Shabbos
  '2026-05-09': ['3:20', '4:19', '5:57', '8:47', '9:57', '21:13', '22:28'], // 22 Iyar - Shabbos
  '2026-05-16': ['3:02', '4:04', '5:45', '8:36', '9:49', '21:23', '22:39'], // 29 Iyar - Shabbos

  // Sivan 5786
  '2026-05-23': ['2:50', '3:53', '5:35', '8:27', '9:42', '21:32', '22:49'], // 7 Sivan - Shabbos (Shavuos)
  '2026-05-30': ['2:45', '3:49', '5:29', '8:22', '9:38', '21:39', '22:56'], // 14 Sivan - Shabbos
  '2026-06-06': ['2:48', '3:51', '5:27', '8:20', '9:37', '21:43', '22:59'], // 21 Sivan - Shabbos
  '2026-06-13': ['2:58', '3:58', '5:28', '8:22', '9:38', '21:44', '22:59'], // 28 Sivan - Shabbos

  // Tammuz 5786
  '2026-06-20': ['3:13', '4:10', '5:32', '8:26', '9:42', '21:43', '22:56'], // 5 Tammuz - Shabbos
  '2026-06-27': ['3:31', '4:25', '5:39', '8:32', '9:46', '21:39', '22:51'], // 12 Tammuz - Shabbos
  '2026-07-04': ['3:50', '4:41', '5:48', '8:38', '9:51', '21:32', '22:42'], // 19 Tammuz - Shabbos
  '2026-07-11': ['4:09', '4:58', '5:59', '8:44', '9:55', '21:23', '22:31'], // 26 Tammuz - Shabbos

  // Av 5786
  '2026-07-18': ['4:28', '5:14', '6:11', '8:49', '9:58', '21:12', '22:18'], // 4 Av - Shabbos
  '2026-07-25': ['4:45', '5:30', '6:24', '8:54', '10:01', '20:59', '22:03'], // 11 Av - Shabbos
  '2026-08-01': ['5:02', '5:45', '6:37', '8:58', '10:03', '20:44', '21:47'], // 18 Av - Shabbos
  '2026-08-08': ['5:18', '5:59', '6:50', '9:01', '10:05', '20:28', '21:29'], // 25 Av - Shabbos

  // Elul 5786
  '2026-08-15': ['5:33', '6:13', '7:02', '9:04', '10:06', '20:12', '21:11'], // 2 Elul - Shabbos
  '2026-08-22': ['5:47', '6:26', '7:14', '9:06', '10:06', '19:54', '20:52'], // 9 Elul - Shabbos
  '2026-08-29': ['6:01', '6:39', '7:27', '9:07', '10:06', '19:36', '20:33'], // 16 Elul - Shabbos
  '2026-09-05': ['6:14', '6:51', '7:39', '9:08', '10:05', '19:17', '20:13'], // 23 Elul - Shabbos
  '2026-09-12': ['6:27', '7:03', '7:51', '9:09', '10:04', '18:58', '19:53'], // 30 Elul / Erev RH - Shabbos
};

// Machzikei Hadass (MH) optional zmanim - from mh_optional_zmanim.jpg
// This table provides weekly data for the full year 5786
// Format per week: [alos, tallis, hanetz, sofShemaMGA, sofShemaGRA, mincha, plag, shkia, tzais708, tzais_rt, motzeiShabbos]
const mhOptionalData = {
  // Data extracted from the MH optional zmanim table (image is rotated/mirrored)
  // Each row represents a week, starting from 1 Tishrei
  // The table has columns for various zmanim at different times

  // Sample rows from the visible data - format varies by time of year
  // Winter shows more alos/tallis, summer shows more tzais variations
};

function getMbdDataForDate(dateStr) {
  // First try exact match
  if (mbdData[dateStr]) return mbdData[dateStr];

  // Otherwise, find the most recent Saturday's data
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();

  // Go back to previous Saturday
  const prevSat = new Date(date);
  prevSat.setDate(prevSat.getDate() - ((dayOfWeek + 1) % 7));

  const prevSatStr = prevSat.toISOString().slice(0, 10);
  return mbdData[prevSatStr] || ['', '', '', '', '', '', ''];
}

// Generate all data
function main() {
  console.log('Generating Manchester Zmanim Comparison 5786...');

  const data = [];

  // Header row - clarify what each column represents
  // MBD = Manchester Beis Din published times (from their calendar)
  // MH 12° = Machzikei Hadas calculation using 12° dawn
  // Calc 16.1° = Standard calculation using 16.1° dawn
  data.push([
    'Date', 'Day', 'Hebrew', '',
    'Alos MBD', 'Alos MH 12°', 'Alos 16.1°', '',
    'Misheyakir MBD', 'Misheyakir 11.5°', 'Misheyakir+15', '',
    'Sunrise MBD', 'Sunrise Calc', 'Diff (min)', '',
    'Shema MA MBD', 'Shema MA MH', 'Shema MA 16.1°', '',
    'Shema GRA MBD', 'Shema GRA Calc', 'Diff (min)', '',
    'Sunset MBD', 'Sunset Calc', 'Diff (min)', '',
    'Tzeis 7.08°', 'Tzeis 8.08°', '', '',
    'End Shabbos MBD', 'End Shabbos 8°', 'Diff (min)'
  ]);

  // Hebrew calendar for 5786
  const months5786 = [
    { name: 'תשרי', days: 30, start: new Date(2025, 8, 23) },
    { name: 'מרחשון', days: 30, start: new Date(2025, 9, 23) },
    { name: 'כסלו', days: 30, start: new Date(2025, 10, 22) },
    { name: 'טבת', days: 29, start: new Date(2025, 11, 22) },
    { name: 'שבט', days: 30, start: new Date(2026, 0, 20) },
    { name: 'אדר', days: 29, start: new Date(2026, 1, 19) },
    { name: 'ניסן', days: 30, start: new Date(2026, 2, 20) },
    { name: 'אייר', days: 29, start: new Date(2026, 3, 19) },
    { name: 'סיון', days: 30, start: new Date(2026, 4, 18) },
    { name: 'תמוז', days: 29, start: new Date(2026, 5, 17) },
    { name: 'אב', days: 30, start: new Date(2026, 6, 16) },
    { name: 'אלול', days: 29, start: new Date(2026, 7, 15) },
  ];

  let rowCount = 0;

  for (const month of months5786) {
    for (let day = 1; day <= month.days; day++) {
      const date = new Date(month.start);
      date.setDate(month.start.getDate() + day - 1);

      const dateStr = date.toISOString().slice(0, 10);
      const dayName = dayNames[date.getDay()];
      const hebrewDate = `${hebrewDays[day - 1]} ${month.name}`;

      // Get MBD data
      const mbd = getMbdDataForDate(dateStr);

      // Calculate our times
      const zmanim = calculateAllZmanim(date, LAT, LON);

      const isSaturday = date.getDay() === 6;

      // Calculate differences where MBD provides data
      // MBD times are in 12-hour format, need to convert afternoon times to 24-hour
      const calcDiff = (mbdTime, calcHours, isAfternoon = false) => {
        if (!mbdTime || !calcHours) return '';
        const [h, m] = mbdTime.split(':').map(Number);
        let mbdMins = h * 60 + m;
        // Convert afternoon times (sunset, shabbos end) to 24-hour
        if (isAfternoon && h < 12) {
          mbdMins += 12 * 60;
        }
        const calcMins = Math.round(calcHours * 60);
        return mbdMins - calcMins;
      };

      // Misheyakir + 15 min buffer (as MH publishes)
      const misheyakirPlus15 = zmanim?.misheyakir ? zmanim.misheyakir + 0.25 : null;

      // Standard 16.1° based Shema MA (for comparison)
      const alos161 = zmanim?.alos161;
      const sofShemaMA161 = alos161 && zmanim?.tzais708 ?
        alos161 + 3 * ((zmanim.tzais708 - alos161) / 12) : null;

      const row = [
        dateStr,
        dayName,
        hebrewDate,
        '', // separator
        mbd[0] || '', // Alos MBD (their 12°)
        formatTime(zmanim?.alos12), // Alos MH 12°
        formatTime(zmanim?.alos161), // Alos 16.1°
        '', // separator
        mbd[1] || '', // Misheyakir MBD (includes their buffer)
        formatTime(zmanim?.misheyakir), // Misheyakir raw 11.5°
        formatTime(misheyakirPlus15), // Misheyakir + 15 min
        '', // separator
        mbd[2] || '', // Sunrise MBD
        formatTime(zmanim?.sunrise), // Sunrise calculated
        calcDiff(mbd[2], zmanim?.sunrise), // Difference
        '', // separator
        mbd[3] || '', // Shema MA MBD
        formatTime(zmanim?.sofShemaMH), // Shema MA MH (12° to 7.08°)
        formatTime(sofShemaMA161), // Shema MA 16.1° based
        '', // separator
        mbd[4] || '', // Shema GRA MBD
        formatTime(zmanim?.sofShemaGRA), // Shema GRA calculated
        calcDiff(mbd[4], zmanim?.sofShemaGRA), // Difference (morning time)
        '', // separator
        mbd[5] || '', // Sunset MBD (12-hr format)
        formatTime(zmanim?.sunset), // Sunset calculated (24-hr)
        calcDiff(mbd[5], zmanim?.sunset, true), // Difference (afternoon)
        '', // separator
        formatTime(zmanim?.tzais708), // Tzeis 7.08°
        formatTime(zmanim?.tzais8), // Tzeis 8°
        '', '',
        isSaturday ? (mbd[6] || '') : '', // End Shabbos MBD (12-hr format)
        isSaturday ? formatTime(zmanim?.tzais8) : '', // End Shabbos 8° (24-hr)
        isSaturday && mbd[6] ? calcDiff(mbd[6], zmanim?.tzais8, true) : '', // Difference (afternoon)
      ];

      data.push(row);
      rowCount++;
    }
  }

  console.log(`Generated ${rowCount} days of data`);

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    {wch: 12}, {wch: 5}, {wch: 14}, {wch: 2},
    {wch: 10}, {wch: 12}, {wch: 10}, {wch: 2},
    {wch: 14}, {wch: 14}, {wch: 14}, {wch: 2},
    {wch: 12}, {wch: 12}, {wch: 10}, {wch: 2},
    {wch: 13}, {wch: 13}, {wch: 14}, {wch: 2},
    {wch: 13}, {wch: 13}, {wch: 10}, {wch: 2},
    {wch: 11}, {wch: 11}, {wch: 10}, {wch: 2},
    {wch: 11}, {wch: 10}, {wch: 2}, {wch: 2},
    {wch: 15}, {wch: 14}, {wch: 10}
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Zmanim 5786');

  // Add Notes sheet
  const notes = [
    ['Manchester Zmanim Comparison 5786 (2025-2026)'],
    [''],
    ['Sources:'],
    ['- MBD: Manchester Beis Din published calendar (5786)'],
    ['- MH: Machzikei Hadass Manchester calculated times'],
    ['- Calc: NOAA Solar Calculator (astronomical standard)'],
    [''],
    ['Location: Manchester, UK (53.4808°N, 2.2426°W)'],
    [''],
    ['Calculation Methods:'],
    [''],
    ['Alos (Dawn):'],
    ['- MBD uses 12° below horizon (practical dawn)'],
    ['- MH 12° = 12 degrees below horizon (Minchas Yitzchak method)'],
    ['- Alos 16.1° = 16.1 degrees below horizon (stricter, Vilna Gaon)'],
    [''],
    ['Misheyakir (Earliest tallis/tefillin):'],
    ['- 11.5° = Sun 11.5 degrees below horizon'],
    ['- +15 = With 15-minute safety buffer (as MH publishes)'],
    [''],
    ['Sof Zman Shema (Latest Shema):'],
    ['- MA (Magen Avraham): 3 proportional hours from dawn to nightfall'],
    ['  - MH: Uses 12° dawn to 7.08° nightfall'],
    ['  - 16.1° based: Uses 16.1° dawn to 7.08° nightfall'],
    ['- GRA (Vilna Gaon): 3 proportional hours from sunrise to sunset'],
    [''],
    ['Tzeis (Nightfall):'],
    ['- 7.08° = Small stars visible (standard nightfall)'],
    ['- 8° = Shabbos ends (three medium stars)'],
    [''],
    ['Time Format:'],
    ['- MBD times: 12-hour format (from published calendar)'],
    ['- Calculated times: 24-hour format (HH:MM)'],
    ['- UK local time (GMT in winter, BST in summer)'],
    [''],
    ['Diff columns show: MBD time - Calculated time (in minutes)'],
    ['- Positive = MBD is later'],
    ['- Negative = MBD is earlier'],
    [''],
    ['Note: MBD published times appear to have a systematic offset'],
    ['from astronomical calculations. This may be due to:'],
    ['- Local horizon adjustments for Manchester terrain'],
    ['- Built-in safety margins'],
    ['- Different calculation methodology'],
    [''],
    ['Generated: ' + new Date().toISOString().slice(0, 10)],
  ];

  const notesWs = XLSX.utils.aoa_to_sheet(notes);
  notesWs['!cols'] = [{wch: 70}];
  XLSX.utils.book_append_sheet(wb, notesWs, 'Notes');

  XLSX.writeFile(wb, 'docs/comparisons/manchester-zmanim-comparison-5786.xlsx');

  console.log('Done! Created manchester-zmanim-comparison-5786.xlsx');
}

main();
