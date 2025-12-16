import { HDate, months } from '@hebcal/core';

// Hebrew month names
const HEBREW_MONTHS: Record<number, string> = {
  [months.NISAN]: 'ניסן',
  [months.IYYAR]: 'אייר',
  [months.SIVAN]: 'סיון',
  [months.TAMUZ]: 'תמוז',
  [months.AV]: 'אב',
  [months.ELUL]: 'אלול',
  [months.TISHREI]: 'תשרי',
  [months.CHESHVAN]: 'חשון',
  [months.KISLEV]: 'כסלו',
  [months.TEVET]: 'טבת',
  [months.SHVAT]: 'שבט',
  [months.ADAR_I]: 'אדר א׳',
  [months.ADAR_II]: 'אדר ב׳',
};

// Hebrew numerals for days (1-30)
const HEBREW_DAYS: Record<number, string> = {
  1: 'א׳',
  2: 'ב׳',
  3: 'ג׳',
  4: 'ד׳',
  5: 'ה׳',
  6: 'ו׳',
  7: 'ז׳',
  8: 'ח׳',
  9: 'ט׳',
  10: 'י׳',
  11: 'י״א',
  12: 'י״ב',
  13: 'י״ג',
  14: 'י״ד',
  15: 'ט״ו',
  16: 'ט״ז',
  17: 'י״ז',
  18: 'י״ח',
  19: 'י״ט',
  20: 'כ׳',
  21: 'כ״א',
  22: 'כ״ב',
  23: 'כ״ג',
  24: 'כ״ד',
  25: 'כ״ה',
  26: 'כ״ו',
  27: 'כ״ז',
  28: 'כ״ח',
  29: 'כ״ט',
  30: 'ל׳',
};

// Hebrew year letters
function hebrewYear(year: number): string {
  // For years 5700-5999 (1940-2239)
  const thousands = Math.floor(year / 1000);
  const hundreds = Math.floor((year % 1000) / 100);
  const tens = Math.floor((year % 100) / 10);
  const ones = year % 10;

  const thousandsLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה'];
  const hundredsLetters = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const tensLetters = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const onesLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

  // Special cases for 15 and 16
  if (tens === 1 && ones === 5) {
    return `${thousandsLetters[thousands]}${hundredsLetters[hundreds]}ט״ו`;
  }
  if (tens === 1 && ones === 6) {
    return `${thousandsLetters[thousands]}${hundredsLetters[hundreds]}ט״ז`;
  }

  let result = thousandsLetters[thousands] + hundredsLetters[hundreds] + tensLetters[tens] + onesLetters[ones];

  // Add gershayim before last letter
  if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  } else if (result.length === 1) {
    result = result + '׳';
  }

  return result;
}

// Hebrew day of week names
const HEBREW_DAYS_OF_WEEK: Record<number, string> = {
  0: 'יום ראשון',
  1: 'יום שני',
  2: 'יום שלישי',
  3: 'יום רביעי',
  4: 'יום חמישי',
  5: 'יום שישי',
  6: 'שבת',
};

// Short Hebrew day of week names
const HEBREW_DAYS_OF_WEEK_SHORT: Record<number, string> = {
  0: 'א׳',
  1: 'ב׳',
  2: 'ג׳',
  3: 'ד׳',
  4: 'ה׳',
  5: 'ו׳',
  6: 'ש׳',
};

export interface HebrewDateInfo {
  day: number;
  month: number;
  year: number;
  dayOfWeek: number;
  dayHebrew: string;
  monthHebrew: string;
  yearHebrew: string;
  dayOfWeekHebrew: string;
  dayOfWeekHebrewShort: string;
  formatted: string;
  formattedShort: string;
  formattedWithDayOfWeek: string;
}

/**
 * Convert a Gregorian date to Hebrew date info
 */
export function toHebrewDate(date: Date): HebrewDateInfo {
  const hdate = new HDate(date);
  const day = hdate.getDate();
  const month = hdate.getMonth();
  const year = hdate.getFullYear();
  const dayOfWeek = date.getDay();

  const dayHebrew = HEBREW_DAYS[day] || day.toString();
  const monthHebrew = HEBREW_MONTHS[month] || hdate.getMonthName();
  const yearHebrew = hebrewYear(year);
  const dayOfWeekHebrew = HEBREW_DAYS_OF_WEEK[dayOfWeek];
  const dayOfWeekHebrewShort = HEBREW_DAYS_OF_WEEK_SHORT[dayOfWeek];

  return {
    day,
    month,
    year,
    dayOfWeek,
    dayHebrew,
    monthHebrew,
    yearHebrew,
    dayOfWeekHebrew,
    dayOfWeekHebrewShort,
    formatted: `${dayHebrew} ${monthHebrew} ${yearHebrew}`,
    formattedShort: `${dayHebrew} ${monthHebrew}`,
    formattedWithDayOfWeek: `${dayOfWeekHebrew}, ${dayHebrew} ${monthHebrew} ${yearHebrew}`,
  };
}

/**
 * Format a date for display, optionally in Hebrew
 */
export function formatDateDisplay(date: Date, showHebrew: boolean): string {
  if (showHebrew) {
    const hebrewDate = toHebrewDate(date);
    return hebrewDate.formattedWithDayOfWeek;
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get both Gregorian and Hebrew date formatted
 */
export function getDualDateDisplay(date: Date): { gregorian: string; hebrew: string } {
  const hebrewDate = toHebrewDate(date);

  return {
    gregorian: date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    hebrew: hebrewDate.formattedWithDayOfWeek,
  };
}

/**
 * Get Hebrew months for a given Hebrew year
 * Returns array of { month: number, name: string }
 * Handles leap years (13 months) vs regular years (12 months)
 */
export function getHebrewMonthsForYear(hebrewYear: number): { month: number; name: string }[] {
  const isLeapYear = HDate.isLeapYear(hebrewYear);

  // Hebrew calendar month order (starting from Tishrei for civil year)
  const monthOrder: number[] = [
    months.TISHREI,
    months.CHESHVAN,
    months.KISLEV,
    months.TEVET,
    months.SHVAT,
  ];

  if (isLeapYear) {
    monthOrder.push(months.ADAR_I, months.ADAR_II);
  } else {
    // In non-leap years, ADAR_I is the regular Adar
    monthOrder.push(months.ADAR_I);
  }

  monthOrder.push(
    months.NISAN,
    months.IYYAR,
    months.SIVAN,
    months.TAMUZ,
    months.AV,
    months.ELUL
  );

  return monthOrder.map(month => ({
    month,
    name: HEBREW_MONTHS[month] || `Month ${month}`,
  }));
}

/**
 * Convert Hebrew year number to Hebrew letters
 */
export function hebrewYearToLetters(year: number): string {
  // For years 5700-5999 (1940-2239)
  const thousands = Math.floor(year / 1000);
  const hundreds = Math.floor((year % 1000) / 100);
  const tens = Math.floor((year % 100) / 10);
  const ones = year % 10;

  const thousandsLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה'];
  const hundredsLetters = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const tensLetters = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const onesLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

  // Special cases for 15 and 16
  if (tens === 1 && ones === 5) {
    return `${thousandsLetters[thousands]}${hundredsLetters[hundreds]}ט״ו`;
  }
  if (tens === 1 && ones === 6) {
    return `${thousandsLetters[thousands]}${hundredsLetters[hundreds]}ט״ז`;
  }

  let result = thousandsLetters[thousands] + hundredsLetters[hundreds] + tensLetters[tens] + onesLetters[ones];

  // Add gershayim before last letter
  if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  } else if (result.length === 1) {
    result = result + '׳';
  }

  return result;
}

/**
 * Generate a range of Hebrew years around a given year
 */
export function generateHebrewYearRange(centerYear: number, range: number = 10): { year: number; display: string }[] {
  const years: { year: number; display: string }[] = [];
  for (let i = centerYear - range; i <= centerYear + range; i++) {
    years.push({
      year: i,
      display: hebrewYearToLetters(i),
    });
  }
  return years;
}

/**
 * Get the first day of a Hebrew month as a JavaScript Date
 */
export function getHebrewMonthStartDate(hebrewYear: number, hebrewMonth: number): Date {
  const hdate = new HDate(1, hebrewMonth, hebrewYear);
  return hdate.greg();
}

/**
 * Get Hebrew date info from Hebrew year/month/day
 */
export function fromHebrewDate(hebrewYear: number, hebrewMonth: number, hebrewDay: number): Date {
  const hdate = new HDate(hebrewDay, hebrewMonth, hebrewYear);
  return hdate.greg();
}
