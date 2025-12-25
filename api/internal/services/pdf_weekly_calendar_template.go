package services

// PDFWeeklyCalendarTemplate returns the HTML template for weekly calendar PDF generation
// This template is based on the Manchester-style weekly calendar mockup
// Uses chromedp to render a beautifully formatted A4 weekly calendar
func PDFWeeklyCalendarTemplate() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Zmanim Calendar - {{.Publisher.Name}}</title>
    <!-- Modern Fonts: Inter for UI, Heebo for Hebrew -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        /* ============================================
           BOLD MODERN WEEKLY CALENDAR - v2.0
           Clean, spacious, contemporary design
           ============================================ */

        /* A4 Page Setup */
        @page {
            size: A4 portrait;
            margin: 8mm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            /* Modern color palette - softer, more refined */
            --gray-50: #f9fafb;
            --gray-100: #f3f4f6;
            --gray-200: #e5e7eb;
            --gray-300: #d1d5db;
            --gray-400: #9ca3af;
            --gray-500: #6b7280;
            --gray-600: #4b5563;
            --gray-700: #374151;
            --gray-800: #1f2937;
            --gray-900: #111827;

            /* Accent colors */
            --primary: #4f46e5;
            --primary-light: #6366f1;

            /* Soft day colors - reduced saturation for elegance */
            --sunday-bg: #fef7f7;
            --sunday-accent: #fecaca;
            --sunday-sidebar: linear-gradient(180deg, #fca5a5 0%, #f87171 100%);
            --sunday-text: #991b1b;

            --monday-bg: #fefaf6;
            --monday-accent: #fed7aa;
            --monday-sidebar: linear-gradient(180deg, #fdba74 0%, #fb923c 100%);
            --monday-text: #9a3412;

            --tuesday-bg: #fefef6;
            --tuesday-accent: #fef08a;
            --tuesday-sidebar: linear-gradient(180deg, #fde047 0%, #facc15 100%);
            --tuesday-text: #854d0e;

            --wednesday-bg: #f6fef9;
            --wednesday-accent: #bbf7d0;
            --wednesday-sidebar: linear-gradient(180deg, #86efac 0%, #4ade80 100%);
            --wednesday-text: #166534;

            --thursday-bg: #f6f9fe;
            --thursday-accent: #bfdbfe;
            --thursday-sidebar: linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%);
            --thursday-text: #1e40af;

            --friday-bg: #fefcf6;
            --friday-accent: #fde68a;
            --friday-sidebar: linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%);
            --friday-text: #92400e;

            --shabbos-bg: #faf8fe;
            --shabbos-accent: #e9d5ff;
            --shabbos-sidebar: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%);
            --shabbos-text: #5b21b6;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: white;
            padding: 0;
            margin: 0;
            color: var(--gray-800);
            font-size: 9pt;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        /* Hebrew text styling */
        .hebrew, [dir="rtl"] {
            font-family: 'Heebo', 'Segoe UI', sans-serif;
            direction: rtl;
        }

        /* A4 Paper Container */
        .a4-page {
            width: 210mm;
            min-height: 297mm;
            background: white;
            padding: 6mm;
            display: flex;
            flex-direction: column;
        }

        /* ============ HEADER ============ */
        .header-bar {
            background: linear-gradient(135deg, var(--gray-800) 0%, var(--gray-900) 100%);
            color: white;
            padding: 5mm 6mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 3mm;
            margin-bottom: 4mm;
        }

        .header-bar .publisher-name {
            font-size: 13pt;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .header-bar .hebrew-title {
            font-family: 'Heebo', sans-serif;
            font-size: 13pt;
            font-weight: 600;
            direction: rtl;
            opacity: 0.95;
        }

        /* ============ SUB HEADER ============ */
        .sub-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3mm 1mm;
            margin-bottom: 3mm;
        }

        .sub-header .week-info {
            font-size: 11pt;
            font-weight: 600;
            color: var(--gray-800);
            letter-spacing: -0.01em;
        }

        .sub-header .location-info {
            font-size: 8.5pt;
            color: var(--gray-500);
            font-weight: 500;
        }

        /* ============ CALENDAR GRID ============ */
        .calendar-grid {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2mm;
        }

        /* ============ DAY ROW ============ */
        .day-row {
            display: grid;
            grid-template-columns: 1fr 30mm;
            border-radius: 2.5mm;
            overflow: hidden;
            min-height: 34mm;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            border: 1px solid var(--gray-200);
        }

        /* ============ ZMANIM SECTION (left) ============ */
        .zmanim-section {
            display: flex;
            flex-direction: column;
        }

        .zmanim-columns {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
            padding: 3mm 3.5mm;
            flex: 1;
            align-content: start;
        }

        .zman-column {
            display: flex;
            flex-direction: column;
            gap: 1.8mm;
            padding: 0 2.5mm;
            border-right: 1px solid var(--gray-200);
        }

        .zman-column:last-child {
            border-right: none;
        }

        .zman-item {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 2mm;
        }

        .zman-item .time {
            font-weight: 600;
            font-size: 9.5pt;
            color: var(--gray-800);
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.01em;
        }

        .zman-item .name {
            color: var(--gray-500);
            font-size: 7pt;
            text-align: right;
            flex: 1;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* ============ DAY INFO SIDEBAR (right) ============ */
        .day-info {
            width: 30mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 3mm 2mm;
            text-align: center;
            gap: 0.5mm;
        }

        .day-info .hebrew-day {
            font-family: 'Heebo', sans-serif;
            font-size: 11pt;
            font-weight: 600;
            direction: rtl;
            line-height: 1.2;
        }

        .day-info .hebrew-date-num {
            font-family: 'Heebo', sans-serif;
            font-size: 26pt;
            font-weight: 700;
            line-height: 1;
            direction: rtl;
            letter-spacing: -0.02em;
        }

        .day-info .english-day {
            font-size: 6.5pt;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 700;
            margin-top: 1mm;
            opacity: 0.85;
        }

        .day-info .gregorian-num {
            font-size: 15pt;
            font-weight: 700;
            line-height: 1;
            letter-spacing: -0.02em;
        }

        /* ============ DAY COLOR THEMES ============ */

        /* Sunday - Soft Rose */
        .day-row.sunday {
            background: var(--sunday-bg);
        }
        .day-row.sunday .day-info {
            background: var(--sunday-sidebar);
        }
        .day-row.sunday .day-info .hebrew-day,
        .day-row.sunday .day-info .hebrew-date-num,
        .day-row.sunday .day-info .gregorian-num {
            color: var(--sunday-text);
        }
        .day-row.sunday .day-info .english-day {
            color: white;
        }

        /* Monday - Soft Peach */
        .day-row.monday {
            background: var(--monday-bg);
        }
        .day-row.monday .day-info {
            background: var(--monday-sidebar);
        }
        .day-row.monday .day-info .hebrew-day,
        .day-row.monday .day-info .hebrew-date-num,
        .day-row.monday .day-info .gregorian-num {
            color: var(--monday-text);
        }
        .day-row.monday .day-info .english-day {
            color: white;
        }

        /* Tuesday - Soft Lemon */
        .day-row.tuesday {
            background: var(--tuesday-bg);
        }
        .day-row.tuesday .day-info {
            background: var(--tuesday-sidebar);
        }
        .day-row.tuesday .day-info .hebrew-day,
        .day-row.tuesday .day-info .hebrew-date-num,
        .day-row.tuesday .day-info .gregorian-num {
            color: var(--tuesday-text);
        }
        .day-row.tuesday .day-info .english-day {
            color: var(--tuesday-text);
        }

        /* Wednesday - Soft Mint */
        .day-row.wednesday {
            background: var(--wednesday-bg);
        }
        .day-row.wednesday .day-info {
            background: var(--wednesday-sidebar);
        }
        .day-row.wednesday .day-info .hebrew-day,
        .day-row.wednesday .day-info .hebrew-date-num,
        .day-row.wednesday .day-info .gregorian-num {
            color: var(--wednesday-text);
        }
        .day-row.wednesday .day-info .english-day {
            color: white;
        }

        /* Thursday - Soft Sky */
        .day-row.thursday {
            background: var(--thursday-bg);
        }
        .day-row.thursday .day-info {
            background: var(--thursday-sidebar);
        }
        .day-row.thursday .day-info .hebrew-day,
        .day-row.thursday .day-info .hebrew-date-num,
        .day-row.thursday .day-info .gregorian-num {
            color: var(--thursday-text);
        }
        .day-row.thursday .day-info .english-day {
            color: white;
        }

        /* Friday - Soft Amber (Erev Shabbos) */
        .day-row.friday {
            background: var(--friday-bg);
        }
        .day-row.friday .day-info {
            background: var(--friday-sidebar);
        }
        .day-row.friday .day-info .hebrew-day,
        .day-row.friday .day-info .hebrew-date-num,
        .day-row.friday .day-info .gregorian-num {
            color: var(--friday-text);
        }
        .day-row.friday .day-info .english-day {
            color: white;
        }

        /* Shabbos - Soft Lavender */
        .day-row.shabbos {
            background: var(--shabbos-bg);
        }
        .day-row.shabbos .day-info {
            background: var(--shabbos-sidebar);
        }
        .day-row.shabbos .day-info .hebrew-day,
        .day-row.shabbos .day-info .hebrew-date-num,
        .day-row.shabbos .day-info .gregorian-num {
            color: var(--shabbos-text);
        }
        .day-row.shabbos .day-info .english-day {
            color: white;
        }
        .day-row.shabbos .day-info .hebrew-day {
            font-size: 12pt;
        }

        /* ============ EVENT ZMANIM (Prominent but Soft) ============ */
        .event-zmanim-section {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm;
            padding: 2.5mm 3.5mm;
            background: linear-gradient(90deg, rgba(139, 92, 246, 0.04) 0%, rgba(139, 92, 246, 0.08) 100%);
            border-top: 1px solid rgba(139, 92, 246, 0.15);
        }

        .event-zman-item {
            display: inline-flex;
            align-items: center;
            gap: 2mm;
            background: white;
            padding: 1.5mm 3mm;
            border-radius: 10mm;
            border: 1px solid rgba(139, 92, 246, 0.2);
            box-shadow: 0 1px 2px rgba(139, 92, 246, 0.08);
        }

        .event-zman-item .time {
            font-weight: 700;
            font-size: 9pt;
            color: #7c3aed;
            font-variant-numeric: tabular-nums;
        }

        .event-zman-item .name {
            font-size: 7.5pt;
            color: #6d28d9;
            font-weight: 500;
        }

        /* ============ FOOTER ============ */
        .footer {
            margin-top: 4mm;
            padding-top: 3mm;
            border-top: 1px solid var(--gray-200);
            display: flex;
            justify-content: space-between;
            font-size: 6.5pt;
            color: var(--gray-400);
            font-weight: 500;
        }

        /* ============ PRINT STYLES ============ */
        @media print {
            body {
                background: white;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .a4-page {
                width: 100%;
                min-height: auto;
                box-shadow: none;
                page-break-after: always;
            }

            .day-row {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="a4-page">
        <!-- Header Bar -->
        <div class="header-bar">
            <span class="publisher-name">{{.Publisher.Name}}</span>
            {{if .Publisher.HebrewName}}
            <span class="hebrew-title">{{.Publisher.HebrewName}}</span>
            {{end}}
        </div>

        <!-- Sub Header -->
        <div class="sub-header">
            <span class="week-info">{{.WeekRange}}</span>
            <span class="location-info">{{.Location.Name}} • {{.Location.Timezone}}</span>
        </div>

        <!-- Calendar Grid -->
        <div class="calendar-grid">
            {{range .Days}}
            <!-- {{.DayOfWeek}} -->
            <div class="day-row {{.CSSClass}}">
                <div class="zmanim-section">
                    <div class="zmanim-columns">
                        {{range .ZmanimColumns}}
                        <div class="zman-column">
                            {{range .}}
                            <div class="zman-item">
                                <span class="time">{{.Time}}</span>
                                <span class="name">{{.Name}}</span>
                            </div>
                            {{end}}
                        </div>
                        {{end}}
                    </div>
                    {{if .EventZmanim}}
                    <div class="event-zmanim-section">
                        {{range .EventZmanim}}
                        <div class="event-zman-item">
                            <span class="time">{{.Time}}</span>
                            <span class="name">{{.Name}}</span>
                        </div>
                        {{end}}
                    </div>
                    {{end}}
                </div>
                <div class="day-info">
                    {{if .HebrewDayName}}
                    <span class="hebrew-day">{{.HebrewDayName}}</span>
                    {{end}}
                    {{if .HebrewDateNum}}
                    <span class="hebrew-date-num">{{.HebrewDateNum}}</span>
                    {{end}}
                    <span class="english-day">{{.DayOfWeek}}</span>
                    <span class="gregorian-num">{{.GregorianDay}}</span>
                </div>
            </div>
            {{end}}
        </div>

        <!-- Footer -->
        <div class="footer">
            <span>Generated: {{.GeneratedAt}} • via Shtetl.io</span>
            <span>{{.Location.Coordinates}} • Elevation: {{.Location.Elevation}}m</span>
        </div>
    </div>
</body>
</html>`
}
