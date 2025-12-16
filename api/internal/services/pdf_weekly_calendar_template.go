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
    <style>
        /* A4 Page Setup */
        @page {
            size: A4 portrait;
            margin: 10mm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            background: white;
            padding: 0;
            margin: 0;
        }

        /* A4 Paper Container */
        .a4-page {
            width: 210mm;
            min-height: 297mm;
            background: white;
            padding: 8mm;
            display: flex;
            flex-direction: column;
        }

        /* Header Bar */
        .header-bar {
            background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
            color: white;
            padding: 4mm 6mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3mm;
        }

        .header-bar .publisher-name {
            font-size: 11pt;
            font-weight: bold;
        }

        .header-bar .hebrew-title {
            font-size: 11pt;
            font-weight: bold;
            direction: rtl;
        }

        /* Sub Header */
        .sub-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2mm 0;
            border-bottom: 1px solid #ccc;
            margin-bottom: 2mm;
        }

        .sub-header .week-info {
            font-size: 12pt;
            font-weight: bold;
            color: #1a1a1a;
        }

        .sub-header .location-info {
            font-size: 9pt;
            color: #666;
        }

        /* Main Calendar Grid */
        .calendar-grid {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        /* Day Row */
        .day-row {
            display: grid;
            grid-template-columns: 1fr auto;
            border: 1px solid #999;
            border-bottom: none;
            min-height: 32mm;
        }

        .day-row:last-child {
            border-bottom: 1px solid #999;
        }

        /* Zmanim Section (left side) */
        .zmanim-section {
            display: flex;
            flex-direction: column;
            border-right: 1px solid #ccc;
        }

        .zmanim-columns {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
            padding: 2mm;
            flex: 1;
        }

        .zman-column {
            display: flex;
            flex-direction: column;
            gap: 1mm;
            padding: 0 2mm;
            border-right: 1px solid #eee;
        }

        .zman-column:last-child {
            border-right: none;
        }

        .zman-item {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 8pt;
            line-height: 1.4;
        }

        .zman-item .time {
            font-weight: bold;
            font-size: 9pt;
            min-width: 28px;
        }

        .zman-item .name {
            color: #444;
            font-size: 7pt;
            text-align: right;
            flex: 1;
            margin-left: 2mm;
        }

        /* Day Info Section (right side) */
        .day-info {
            width: 28mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 2mm;
            background: #f8f8f8;
            text-align: center;
        }

        .day-info .hebrew-day {
            font-size: 10pt;
            font-weight: bold;
            color: #1a1a1a;
            direction: rtl;
        }

        .day-info .hebrew-date-num {
            font-size: 22pt;
            font-weight: bold;
            color: #1a1a1a;
            line-height: 1;
            direction: rtl;
        }

        .day-info .english-day {
            font-size: 7pt;
            color: white;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: bold;
        }

        .day-info .gregorian-num {
            font-size: 16pt;
            font-weight: bold;
            color: #333;
            line-height: 1;
        }

        /* Pastel Day-of-Week Backgrounds - Light & Soft */

        /* Sunday - Soft Rose/Pink */
        .day-row.sunday {
            background: linear-gradient(to right, #fff5f5 0%, #ffe4e6 100%);
        }
        .day-row.sunday .day-info {
            background: linear-gradient(135deg, #fda4af 0%, #fb7185 100%);
        }
        .day-row.sunday .day-info .hebrew-day,
        .day-row.sunday .day-info .hebrew-date-num,
        .day-row.sunday .day-info .gregorian-num {
            color: #881337;
        }

        /* Monday - Soft Peach/Orange */
        .day-row.monday {
            background: linear-gradient(to right, #fff7ed 0%, #ffedd5 100%);
        }
        .day-row.monday .day-info {
            background: linear-gradient(135deg, #fdba74 0%, #fb923c 100%);
        }
        .day-row.monday .day-info .hebrew-day,
        .day-row.monday .day-info .hebrew-date-num,
        .day-row.monday .day-info .gregorian-num {
            color: #7c2d12;
        }

        /* Tuesday - Soft Lemon/Yellow */
        .day-row.tuesday {
            background: linear-gradient(to right, #fefce8 0%, #fef9c3 100%);
        }
        .day-row.tuesday .day-info {
            background: linear-gradient(135deg, #fde047 0%, #facc15 100%);
        }
        .day-row.tuesday .day-info .hebrew-day,
        .day-row.tuesday .day-info .hebrew-date-num,
        .day-row.tuesday .day-info .gregorian-num {
            color: #713f12;
        }

        /* Wednesday - Soft Mint/Green */
        .day-row.wednesday {
            background: linear-gradient(to right, #f0fdf4 0%, #dcfce7 100%);
        }
        .day-row.wednesday .day-info {
            background: linear-gradient(135deg, #86efac 0%, #4ade80 100%);
        }
        .day-row.wednesday .day-info .hebrew-day,
        .day-row.wednesday .day-info .hebrew-date-num,
        .day-row.wednesday .day-info .gregorian-num {
            color: #14532d;
        }

        /* Thursday - Soft Sky/Blue */
        .day-row.thursday {
            background: linear-gradient(to right, #eff6ff 0%, #dbeafe 100%);
        }
        .day-row.thursday .day-info {
            background: linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%);
        }
        .day-row.thursday .day-info .hebrew-day,
        .day-row.thursday .day-info .hebrew-date-num,
        .day-row.thursday .day-info .gregorian-num {
            color: #1e3a8a;
        }

        /* Friday - Soft Amber/Gold for Erev Shabbos */
        .day-row.friday {
            background: linear-gradient(to right, #fffbeb 0%, #fef3c7 100%);
        }
        .day-row.friday .day-info {
            background: linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%);
        }
        .day-row.friday .day-info .hebrew-day,
        .day-row.friday .day-info .hebrew-date-num,
        .day-row.friday .day-info .gregorian-num {
            color: #78350f;
        }

        /* Shabbos - Soft Lavender/Purple */
        .day-row.shabbos {
            background: linear-gradient(to right, #faf5ff 0%, #f3e8ff 70%, #e9d5ff 100%);
        }
        .day-row.shabbos .day-info {
            background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
        }
        .day-row.shabbos .day-info .hebrew-day,
        .day-row.shabbos .day-info .hebrew-date-num,
        .day-row.shabbos .day-info .gregorian-num {
            color: #4c1d95;
        }
        .day-row.shabbos .hebrew-day {
            font-size: 11pt;
        }

        /* Event Zmanim Section (bottom of each day) */
        .event-zmanim-section {
            grid-column: 1 / -1;
            display: flex;
            flex-wrap: wrap;
            gap: 1.5mm 3mm;
            padding: 2mm;
            border-top: 1px dashed #9b59b6;
            background: linear-gradient(to right, rgba(155, 89, 182, 0.03), rgba(155, 89, 182, 0.08));
        }

        .event-zman-item {
            display: flex;
            align-items: center;
            gap: 1.5mm;
            background: rgba(155, 89, 182, 0.12);
            padding: 1mm 2.5mm;
            border-radius: 2mm;
            white-space: nowrap;
        }

        .event-zman-item .time {
            font-weight: bold;
            font-size: 8pt;
            color: #6b21a8;
        }

        .event-zman-item .name {
            font-size: 7pt;
            color: #7c3aed;
        }

        /* Special Times Section (legacy) */
        .special-times {
            display: flex;
            gap: 3mm;
            margin-top: auto;
            padding-top: 2mm;
            border-top: 1px dashed #ccc;
            font-size: 8pt;
        }

        .special-time {
            display: flex;
            align-items: center;
            gap: 1mm;
        }

        .special-time .label {
            font-size: 7pt;
            color: #666;
        }

        .special-time .time {
            font-weight: bold;
            font-size: 9pt;
        }

        /* Footer */
        .footer {
            margin-top: 3mm;
            padding-top: 2mm;
            border-top: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            font-size: 6pt;
            color: #666;
        }

        /* Print Styles */
        @media print {
            body {
                background: white;
                padding: 0;
            }

            .a4-page {
                width: 100%;
                min-height: auto;
                box-shadow: none;
                page-break-after: always;
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
