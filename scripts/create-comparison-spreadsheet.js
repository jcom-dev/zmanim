const XLSX = require('xlsx');
const path = require('path');

// All 30 zmanim from Machzikei Hadass in logical order
const ZMANIM = [
  // Dawn times
  { key: 'alos_hashachar', name: 'Alos HaShachar (16.1°)', applies: 'daily' },
  { key: 'alos_12', name: 'Alos 12°', applies: 'daily' },
  { key: 'alos_72', name: 'Alos 72 min', applies: 'daily' },
  { key: 'alos_90', name: 'Alos 90 min', applies: 'daily' },
  { key: 'alos_eighth_day', name: 'Alos 1/8 Day', applies: 'daily' },
  { key: 'alos_shemini_atzeres', name: 'Alos for Aravos', applies: 'special' },

  // Early morning
  { key: 'misheyakir', name: 'Misheyakir (11.5°)', applies: 'daily' },
  { key: 'misheyakir_bedieved', name: 'Misheyakir Bedieved (13.5°)', applies: 'daily' },
  { key: 'sunrise', name: 'HaNetz (Sunrise)', applies: 'daily' },

  // Shema times
  { key: 'sof_zman_shma_mga', name: "Sof Z'man Shma MA (12°)", applies: 'daily' },
  { key: 'sof_zman_shma_mga_16_1', name: "Sof Z'man Shma MA (16.1°)", applies: 'daily' },
  { key: 'sof_zman_shma_mga_72', name: "Sof Z'man Shma MA (72min)", applies: 'daily' },
  { key: 'sof_zman_shma_gra', name: "Sof Z'man Shma GRA", applies: 'daily' },

  // Tefila times
  { key: 'sof_zman_tfila_mga', name: "Sof Z'man Tefila MA (12°)", applies: 'daily' },
  { key: 'sof_zman_tfila_mga_72', name: "Sof Z'man Tefila MA (72min)", applies: 'daily' },
  { key: 'sof_zman_tfila_gra', name: "Sof Z'man Tefila GRA", applies: 'daily' },

  // Midday
  { key: 'chatzos', name: 'Chatzos (Solar Noon)', applies: 'daily' },

  // Afternoon
  { key: 'mincha_gedola', name: 'Mincha Gedola', applies: 'daily' },
  { key: 'mincha_ketana', name: 'Mincha Ketana', applies: 'daily' },
  { key: 'plag_hamincha', name: 'Plag HaMincha (Levush)', applies: 'daily' },
  { key: 'plag_hamincha_72', name: 'Plag HaMincha MA (72)', applies: 'daily' },
  { key: 'plag_hamincha_terumas_hadeshen', name: 'Plag HaMincha THD', applies: 'daily' },

  // Evening
  { key: 'candle_lighting', name: 'Candle Lighting', applies: 'friday' },
  { key: 'sunset', name: 'Shkiah (Sunset)', applies: 'daily' },

  // Nightfall
  { key: 'tzais_7_08', name: 'Tzais 7.08°', applies: 'daily' },
  { key: 'tzais_72', name: "Tzais R'T (72min/8°)", applies: 'daily' },
  { key: 'shabbos_ends', name: 'Motzei Shabbos (8°)', applies: 'saturday' },

  // Fast times
  { key: 'fast_begins', name: 'Fast Begins', applies: 'fast' },
  { key: 'fast_ends', name: 'Fast Ends', applies: 'fast' },

  // Midnight
  { key: 'chatzos_layla', name: 'Chatzos Layla', applies: 'daily' },
];

// Generate dates for Hebrew year 5786 (roughly Sept 2025 - Sept 2026)
function generateDates() {
  const dates = [];
  const start = new Date('2025-09-23'); // Rosh Hashanah 5786
  const end = new Date('2026-09-12');   // Before Rosh Hashanah 5787

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    dates.push({
      date: d.toISOString().split('T')[0],
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
      isFriday: dayOfWeek === 5,
      isSaturday: dayOfWeek === 6,
    });
  }
  return dates;
}

function createSpreadsheet() {
  const wb = XLSX.utils.book_new();
  const dates = generateDates();

  // Build header rows
  // Row 1: Merged headers for each zman (spans 3 columns)
  // Row 2: MH | MBD | Shtetl for each zman

  const headerRow1 = ['Date', 'Day', 'Hebrew Date'];
  const headerRow2 = ['', '', ''];

  ZMANIM.forEach(zman => {
    headerRow1.push(zman.name, '', '');  // Will merge these 3 cells
    headerRow2.push('MH', 'MBD', 'Shtetl');
  });

  // Build data rows
  const dataRows = dates.map(d => {
    const row = [d.date, d.day, '']; // Hebrew date placeholder
    ZMANIM.forEach(zman => {
      row.push('', '', ''); // Empty cells for MH, MBD, Shtetl
    });
    return row;
  });

  const allRows = [headerRow1, headerRow2, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 5 },  // Day
    { wch: 14 }, // Hebrew Date
  ];
  ZMANIM.forEach(() => {
    colWidths.push({ wch: 8 }, { wch: 8 }, { wch: 8 }); // MH, MBD, Shtetl
  });
  ws['!cols'] = colWidths;

  // Create merges for header row (zman names spanning 3 columns)
  const merges = [];
  let col = 3; // Start after Date, Day, Hebrew Date
  ZMANIM.forEach(() => {
    merges.push({
      s: { r: 0, c: col },     // Start: row 0, column col
      e: { r: 0, c: col + 2 }  // End: row 0, column col+2
    });
    col += 3;
  });
  ws['!merges'] = merges;

  // Freeze first row and first 3 columns
  ws['!freeze'] = { xSplit: 3, ySplit: 2 };

  XLSX.utils.book_append_sheet(wb, ws, 'Zmanim Comparison');

  // Add notes sheet
  const notesData = [
    ['Manchester Zmanim Comparison 5786 (2025-2026)'],
    [''],
    ['Purpose:'],
    ['Compare zmanim times from three sources for Manchester, UK:'],
    ['  1. MH = Machzikei Hadass (source calendar)'],
    ['  2. MBD = Manchester Beth Din (should match MH)'],
    ['  3. Shtetl = Our calculated times (should match MH/MBD)'],
    [''],
    ['Location: Manchester, UK (53.4808°N, 2.2426°W)'],
    [''],
    ['Zmanim List (30 total):'],
    [''],
  ];

  ZMANIM.forEach((z, i) => {
    notesData.push([`${i + 1}. ${z.key}: ${z.name} (${z.applies})`]);
  });

  notesData.push(['']);
  notesData.push(['Column Structure:']);
  notesData.push(['Each zman has 3 columns grouped together:']);
  notesData.push(['  - MH: Time from Machzikei Hadass source']);
  notesData.push(['  - MBD: Time from Manchester Beth Din source']);
  notesData.push(['  - Shtetl: Time calculated by our system']);
  notesData.push(['']);
  notesData.push(['All times should match. Any differences indicate a formula issue.']);
  notesData.push(['']);
  notesData.push([`Generated: ${new Date().toISOString().split('T')[0]}`]);

  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');

  // Write the file
  const outputPath = path.join(__dirname, '../docs/comparisons/manchester-zmanim-comparison-5786.xlsx');
  XLSX.writeFile(wb, outputPath);

  console.log(`Created: ${outputPath}`);
  console.log(`Zmanim count: ${ZMANIM.length}`);
  console.log(`Date rows: ${dates.length}`);
  console.log(`Total columns: ${3 + (ZMANIM.length * 3)}`);
}

createSpreadsheet();
