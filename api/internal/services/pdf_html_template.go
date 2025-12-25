package services

// PDFHTMLTemplate returns the HTML template for PDF generation
// This template is used with chromedp to render beautiful PDF reports
func PDFHTMLTemplate() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zmanim Report - {{.Publisher.Name}}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Frank+Ruhl+Libre:wght@400;500;700&display=swap');

        :root {
            /* Primary Palette - Indigo/Purple Gradient */
            --primary-600: #4F46E5;
            --primary-500: #6366F1;
            --primary-400: #818CF8;
            --primary-100: #E0E7FF;

            /* Accent - Purple */
            --accent-600: #7C3AED;
            --accent-500: #8B5CF6;
            --accent-100: #EDE9FE;

            /* Semantic Colors */
            --success-500: #10B981;
            --success-100: #D1FAE5;
            --warning-500: #F59E0B;
            --warning-100: #FEF3C7;
            --error-500: #EF4444;
            --error-100: #FEE2E2;
            --info-500: #3B82F6;
            --info-100: #DBEAFE;

            /* Neutral Palette */
            --gray-900: #111827;
            --gray-800: #1F2937;
            --gray-700: #374151;
            --gray-600: #4B5563;
            --gray-500: #6B7280;
            --gray-400: #9CA3AF;
            --gray-300: #D1D5DB;
            --gray-200: #E5E7EB;
            --gray-100: #F3F4F6;
            --gray-50: #F9FAFB;
            --white: #FFFFFF;

            /* Category Colors */
            --cat-alos: #4F46E5;      /* Indigo - Dawn */
            --cat-shema: #3B82F6;     /* Blue - Morning prayers */
            --cat-tefilla: #06B6D4;   /* Cyan - Prayer times */
            --cat-chatzos: #F59E0B;   /* Amber - Midday */
            --cat-mincha: #F97316;    /* Orange - Afternoon */
            --cat-tzais: #8B5CF6;     /* Purple - Nightfall */
            --cat-other: #6B7280;     /* Gray - Other */

            /* Typography */
            --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --font-hebrew: 'Frank Ruhl Libre', 'Times New Roman', serif;
            --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-sans);
            background: var(--white);
            color: var(--gray-900);
            line-height: 1.5;
        }

        /* PDF Page Container */
        .pdf-page {
            background: var(--white);
            width: 210mm;
            position: relative;
        }

        /* Publisher Header */
        .publisher-header {
            background: linear-gradient(135deg, var(--primary-600) 0%, var(--accent-600) 100%);
            padding: 40px 50px;
            color: var(--white);
            position: relative;
            overflow: hidden;
        }

        .publisher-header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 80%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            pointer-events: none;
        }

        .publisher-header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg,
                var(--warning-500) 0%,
                var(--success-500) 50%,
                var(--info-500) 100%
            );
        }

        .publisher-logo-row {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 16px;
            position: relative;
            z-index: 1;
        }

        .publisher-logo {
            width: 120px;
            height: 120px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .publisher-logo img {
            width: 120px;
            height: 120px;
            object-fit: cover;
            border-radius: 12px;
        }

        .publisher-name {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .publisher-tagline {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 16px;
            max-width: 500px;
            position: relative;
            z-index: 1;
        }

        .publisher-badges {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            position: relative;
            z-index: 1;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-verified {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .badge-certified {
            background: var(--success-500);
            color: var(--white);
        }

        .generated-timestamp {
            position: absolute;
            bottom: 20px;
            right: 50px;
            font-size: 11px;
            opacity: 0.8;
            z-index: 1;
        }

        /* Location Section */
        .location-section {
            padding: 30px 50px;
            background: var(--gray-50);
            border-bottom: 1px solid var(--gray-200);
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--gray-800);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-title-icon {
            width: 28px;
            height: 28px;
            background: var(--primary-100);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }

        .location-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        .location-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .location-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .location-icon {
            width: 32px;
            height: 32px;
            background: var(--white);
            border: 1px solid var(--gray-200);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }

        .location-content {
            flex: 1;
        }

        .location-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--gray-500);
            margin-bottom: 2px;
        }

        .location-value {
            font-size: 14px;
            font-weight: 500;
            color: var(--gray-900);
        }

        .map-container {
            background: var(--white);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid var(--gray-200);
        }

        .map-image {
            width: 100%;
            height: auto;
            background: linear-gradient(135deg, var(--primary-100) 0%, var(--accent-100) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary-600);
            font-size: 14px;
            position: relative;
            aspect-ratio: 1;
        }

        .map-image img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }

        /* Metadata Section */
        .metadata-section {
            padding: 24px 50px;
            background: var(--white);
            border-bottom: 1px solid var(--gray-200);
        }

        .metadata-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
        }

        .date-display {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .date-card {
            background: linear-gradient(135deg, var(--primary-600) 0%, var(--accent-600) 100%);
            color: var(--white);
            padding: 12px 20px;
            border-radius: 12px;
            text-align: center;
            min-width: 80px;
        }

        .date-day {
            font-size: 28px;
            font-weight: 700;
            line-height: 1;
        }

        .date-month {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
        }

        .date-info {
            line-height: 1.4;
        }

        .date-full {
            font-size: 16px;
            font-weight: 600;
            color: var(--gray-900);
        }

        .date-hebrew {
            font-size: 14px;
            color: var(--gray-600);
            font-family: var(--font-hebrew);
            direction: rtl;
        }

        .sun-times {
            display: flex;
            gap: 24px;
        }

        .sun-time-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--gray-50);
            border-radius: 8px;
        }

        .sun-icon {
            font-size: 18px;
        }

        .sun-label {
            font-size: 11px;
            color: var(--gray-500);
            text-transform: uppercase;
        }

        .sun-value {
            font-size: 14px;
            font-weight: 600;
            color: var(--gray-900);
        }

        /* Zmanim Section */
        .zmanim-section {
            padding: 30px 50px;
        }

        .zmanim-intro {
            font-size: 13px;
            color: var(--gray-600);
            margin-bottom: 24px;
            padding: 12px 16px;
            background: var(--info-100);
            border-radius: 8px;
            border-left: 4px solid var(--info-500);
        }

        .zmanim-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .zmanim-table thead {
            background: linear-gradient(135deg, var(--gray-800) 0%, var(--gray-900) 100%);
            color: var(--white);
        }

        .zmanim-table th {
            padding: 14px 16px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .zmanim-table th:first-child {
            padding-left: 20px;
        }

        .zmanim-table td {
            padding: 8px 16px;
            border-bottom: 1px solid var(--gray-100);
            vertical-align: top;
        }

        .zmanim-table td:first-child {
            padding-left: 20px;
        }

        .zmanim-table tbody tr.main-row:nth-of-type(4n+1),
        .zmanim-table tbody tr.main-row:nth-of-type(4n+1) + tr.explanation-row {
            background: var(--white);
        }

        .zmanim-table tbody tr.main-row:nth-of-type(4n+3),
        .zmanim-table tbody tr.main-row:nth-of-type(4n+3) + tr.explanation-row {
            background: var(--gray-50);
        }

        .zmanim-table tbody tr.error-row {
            background: var(--error-100);
        }

        .zmanim-table tbody tr.explanation-row {
            border-top: none;
        }

        .zmanim-table tbody tr.explanation-row td {
            padding-top: 0;
            padding-bottom: 10px;
            font-size: 11px;
            color: var(--gray-600);
            line-height: 1.5;
        }

        /* Keep zman rows together - prevent page breaks between main-row and explanation-row */
        .zman-group {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        /* Zman Name Cell */
        .zman-name-cell {
            min-width: 180px;
        }

        .zman-hebrew {
            font-family: var(--font-hebrew);
            font-size: 15px;
            font-weight: 500;
            color: var(--gray-900);
            margin-bottom: 2px;
            direction: rtl;
        }

        .zman-english {
            font-size: 12px;
            color: var(--gray-600);
        }

        /* Time Cell */
        .time-cell {
            min-width: 100px;
        }

        .time-calculated {
            font-size: 11px;
            color: var(--gray-500);
            font-family: var(--font-mono);
        }

        .time-rounded {
            font-size: 16px;
            font-weight: 700;
            color: var(--gray-900);
        }

        .time-error {
            color: var(--error-500);
            font-weight: 600;
        }

        /* Rounding Badge */
        .rounding-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 6px;
            vertical-align: middle;
        }

        .rounding-ceil {
            background: rgba(239, 68, 68, 0.1);
            color: #DC2626;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .rounding-floor {
            background: rgba(34, 197, 94, 0.1);
            color: #16A34A;
            border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .rounding-math {
            background: rgba(107, 114, 128, 0.1);
            color: var(--gray-500);
            border: 1px solid rgba(107, 114, 128, 0.3);
        }

        /* Formula Cell */
        .formula-cell {
            min-width: 200px;
        }

        .formula-code {
            font-family: var(--font-mono);
            font-size: 11px;
            background: var(--gray-100);
            padding: 6px 10px;
            border-radius: 6px;
            display: inline-block;
            word-break: break-all;
        }

        /* Syntax highlighting */
        .formula-code .primitive {
            color: var(--info-500);
            font-weight: 500;
        }

        .formula-code .function {
            color: var(--success-500);
            font-weight: 500;
        }

        .formula-code .number {
            color: var(--warning-500);
        }

        .formula-code .operator {
            color: var(--gray-500);
        }

        .formula-code .reference {
            color: var(--accent-600);
        }


        /* Category Badge */
        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-top: 6px;
        }

        .cat-alos { background: rgba(79, 70, 229, 0.1); color: var(--cat-alos); }
        .cat-shema { background: rgba(59, 130, 246, 0.1); color: var(--cat-shema); }
        .cat-tefilla { background: rgba(6, 182, 212, 0.1); color: var(--cat-tefilla); }
        .cat-chatzos { background: rgba(245, 158, 11, 0.1); color: var(--cat-chatzos); }
        .cat-mincha { background: rgba(249, 115, 22, 0.1); color: var(--cat-mincha); }
        .cat-tzais { background: rgba(139, 92, 246, 0.1); color: var(--cat-tzais); }

        /* Tags */
        .tags-container {
            margin-top: 8px;
        }

        .tags-group {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
            margin-bottom: 4px;
        }

        .tags-group.negated-tags {
            margin-top: 4px;
        }

        .negated-label {
            font-size: 8px;
            font-weight: 700;
            color: var(--error-600);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-right: 4px;
        }

        .tag-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 500;
            background: var(--gray-100);
            color: var(--gray-700);
            border: 1px solid var(--gray-300);
            white-space: nowrap;
        }

        /* Tag type colors */
        .tag-badge.tag-type-event {
            background: #dbeafe;
            color: #1e40af;
            border-color: #93c5fd;
        }

        .tag-badge.tag-type-jewish_day {
            background: #fef3c7;
            color: #92400e;
            border-color: #fcd34d;
        }

        .tag-badge.tag-type-timing {
            background: #d1fae5;
            color: #065f46;
            border-color: #6ee7b7;
        }

        .tag-badge.tag-type-shita {
            background: #ede9fe;
            color: #5b21b6;
            border-color: #c4b5fd;
        }

        .tag-badge.tag-type-category {
            background: #fce7f3;
            color: #9d174d;
            border-color: #f9a8d4;
        }

        .tag-badge.tag-negated {
            text-decoration: line-through;
            border: 2px solid var(--error-600) !important;
            position: relative;
        }

        .tag-badge.tag-negated::before {
            content: "✕";
            font-size: 8px;
            color: var(--error-600);
            margin-right: 2px;
            font-weight: 700;
        }

        /* Glossary Section */
        .glossary-section {
            padding: 30px 50px;
            background: var(--gray-50);
        }

        .glossary-intro {
            font-size: 13px;
            color: var(--gray-600);
            margin-bottom: 20px;
        }

        .glossary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }

        .glossary-card {
            background: var(--white);
            border-radius: 12px;
            padding: 16px;
            border: 1px solid var(--gray-200);
        }

        .glossary-card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .glossary-icon {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .glossary-icon.primitive {
            background: var(--warning-100);
            color: var(--warning-500);
        }

        .glossary-icon.function {
            background: var(--accent-100);
            color: var(--accent-600);
        }

        .glossary-icon.base {
            background: var(--primary-100);
            color: var(--primary-600);
        }

        .glossary-name {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 600;
            color: var(--gray-900);
        }

        .glossary-definition {
            font-size: 12px;
            color: var(--gray-700);
            margin-bottom: 8px;
            line-height: 1.5;
        }

        .glossary-meta {
            font-size: 10px;
            color: var(--gray-500);
            padding-top: 8px;
            border-top: 1px dashed var(--gray-200);
        }

        .glossary-syntax {
            font-family: var(--font-mono);
            font-size: 11px;
            background: var(--gray-100);
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-top: 4px;
        }

        /* Footer */
        .pdf-footer {
            padding: 16px 50px;
            background: var(--gray-50);
            border-top: 1px solid var(--gray-200);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: var(--gray-500);
            margin-top: auto;
        }

        .footer-brand {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .footer-logo {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, var(--primary-600) 0%, var(--accent-600) 100%);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--white);
            font-size: 10px;
            font-weight: 700;
        }

        .footer-disclaimer {
            max-width: 400px;
            text-align: center;
            font-style: italic;
        }

        .footer-page {
            font-weight: 600;
        }

        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .pdf-page {
                page-break-after: always;
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <!-- Page 1: Main Report -->
    <div class="pdf-page">
        <!-- Publisher Header -->
        <header class="publisher-header">
            <div class="publisher-logo-row">
                {{if .Publisher.LogoData}}
                <div class="publisher-logo">
                    <img src="{{safeURL .Publisher.LogoData}}" alt="{{.Publisher.Name}} Logo">
                </div>
                {{else if .Publisher.LogoURL}}
                <div class="publisher-logo">
                    <img src="{{safeURL .Publisher.LogoURL}}" alt="{{.Publisher.Name}} Logo">
                </div>
                {{end}}
                <div>
                    <h1 class="publisher-name">{{.Publisher.Name}}</h1>
                    {{if .Publisher.IsGlobal}}
                    <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 4px;">Official Publisher</div>
                    {{else}}
                    <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 4px;">Community Publisher</div>
                    {{end}}
                </div>
            </div>
            {{if .Publisher.Description}}
            <p class="publisher-tagline">{{.Publisher.Description}}</p>
            {{end}}
            <div class="publisher-badges">
                {{if .Publisher.IsVerified}}
                <span class="badge badge-verified">✓ Verified Publisher</span>
                {{end}}
                {{if .Publisher.IsCertified}}
                <span class="badge badge-certified">★ Halachically Certified</span>
                {{end}}
            </div>
            <div class="generated-timestamp">Generated: {{.GeneratedAt}}</div>
        </header>

        <!-- Location Details -->
        <section class="location-section">
            <h2 class="section-title">
                <span class="section-title-icon">📍</span>
                Location Information
            </h2>
            <div class="location-grid">
                <div class="location-details">
                    <div class="location-item">
                        <div class="location-icon">🏙️</div>
                        <div class="location-content">
                            <div class="location-label">Location</div>
                            <div class="location-value">{{.Locality.DisplayName}}</div>
                        </div>
                    </div>
                    {{if .Locality.Coordinates}}
                    <div class="location-item">
                        <div class="location-icon">🗺️</div>
                        <div class="location-content">
                            <div class="location-label">Coordinates</div>
                            <div class="location-value">{{.Locality.Coordinates}}</div>
                        </div>
                    </div>
                    {{end}}
                    <div class="location-item">
                        <div class="location-icon">⛰️</div>
                        <div class="location-content">
                            <div class="location-label">Elevation</div>
                            <div class="location-value">{{.Locality.Elevation}}m above sea level</div>
                        </div>
                    </div>
                    <div class="location-item">
                        <div class="location-icon">🕐</div>
                        <div class="location-content">
                            <div class="location-label">Timezone</div>
                            <div class="location-value">{{.Locality.Timezone}}</div>
                        </div>
                    </div>
                </div>
                <div class="map-container">
                    {{if .MapImageData}}
                    <div class="map-image">
                        <img src="data:image/png;base64,{{.MapImageData}}" alt="Map">
                    </div>
                    {{else}}
                    <div class="map-image">
                        <span style="position: relative; top: 40px; font-size: 12px; color: var(--gray-500);">Map not available</span>
                    </div>
                    {{end}}
                </div>
            </div>
        </section>

        <!-- Report Metadata -->
        <section class="metadata-section">
            <div class="metadata-row">
                <div class="date-display">
                    <div class="date-card">
                        <div class="date-day">{{.Date.Day}}</div>
                        <div class="date-month">{{.Date.MonthShort}}</div>
                    </div>
                    <div class="date-info">
                        <div class="date-full">{{.Date.Full}}</div>
                        {{if .Date.Hebrew}}
                        <div class="date-hebrew">{{.Date.Hebrew}}</div>
                        {{end}}
                    </div>
                </div>
                {{if .SunTimes}}
                <div class="sun-times">
                    {{if .SunTimes.Sunrise}}
                    <div class="sun-time-item">
                        <span class="sun-icon">🌅</span>
                        <div>
                            <div class="sun-label">Sunrise</div>
                            <div class="sun-value">{{.SunTimes.Sunrise}}</div>
                        </div>
                    </div>
                    {{end}}
                    {{if .SunTimes.Sunset}}
                    <div class="sun-time-item">
                        <span class="sun-icon">🌇</span>
                        <div>
                            <div class="sun-label">Sunset</div>
                            <div class="sun-value">{{.SunTimes.Sunset}}</div>
                        </div>
                    </div>
                    {{end}}
                </div>
                {{end}}
            </div>
        </section>

        <!-- Zmanim Table -->
        <section class="zmanim-section">
            <h2 class="section-title">
                <span class="section-title-icon">📖</span>
                Zmanim Calculations
            </h2>
            <div class="zmanim-intro">
                All times are calculated using our DSL (Domain-Specific Language) formulas. See glossary below for detailed explanations of each primitive and function.
            </div>

            <table class="zmanim-table">
                <thead>
                    <tr>
                        <th>Zman Name</th>
                        <th>Time</th>
                        <th>DSL Formula</th>
                    </tr>
                </thead>
                    {{range .Zmanim}}
                    <tbody class="zman-group">
                    <tr{{if .HasError}} class="error-row main-row"{{else}} class="main-row"{{end}}>
                        <td class="zman-name-cell">
                            <div class="zman-hebrew">{{.HebrewName}}</div>
                            <div class="zman-english">{{.Name}}</div>
                            {{if .HasTags}}
                            <div class="tags-container">
                                {{if .Tags}}
                                <div class="tags-group">
                                    {{range .Tags}}
                                    <span class="tag-badge tag-type-{{.TagType}}{{if .Color}} custom-color{{end}}"{{if .Color}} style="background-color: {{.Color}}22; border-color: {{.Color}}; color: {{.Color}};"{{end}}>
                                        {{.DisplayNameEnglish}}{{if .IsModified}}*{{end}}
                                    </span>
                                    {{end}}
                                </div>
                                {{end}}
                                {{if .NegatedTags}}
                                <div class="tags-group negated-tags">
                                    <span class="negated-label">NOT:</span>
                                    {{range .NegatedTags}}
                                    <span class="tag-badge tag-type-{{.TagType}} tag-negated{{if .Color}} custom-color{{end}}"{{if .Color}} style="background-color: {{.Color}}22; border-color: {{.Color}}; color: {{.Color}}; opacity: 0.6;"{{end}}>
                                        {{.DisplayNameEnglish}}{{if .IsModified}}*{{end}}
                                    </span>
                                    {{end}}
                                </div>
                                {{end}}
                            </div>
                            {{end}}
                        </td>
                        <td class="time-cell">
                            {{if .HasError}}
                            <div class="time-rounded time-error">Error</div>
                            {{else}}
                            <div class="time-calculated">{{.CalculatedTime}}</div>
                            <div class="time-rounded">{{.RoundedTime}}<span class="rounding-badge rounding-{{.RoundingMode}}" title="{{.RoundingLabel}}">{{.RoundingIcon}}</span></div>
                            {{end}}
                        </td>
                        <td class="formula-cell">
                            <code class="formula-code">{{noescape .FormulaSyntaxHighlighted}}</code>
                        </td>
                    </tr>
                    <tr class="explanation-row{{if .HasError}} error-row{{end}}">
                        <td colspan="3" class="explanation-cell">
                            {{if .HasError}}
                            <span style="color: var(--error-500);">{{.ErrorMessage}}</span>
                            {{else}}
                            {{.Explanation}}
                            {{end}}
                        </td>
                    </tr>
                    </tbody>
                    {{end}}
            </table>
        </section>
    </div>

    <!-- Glossary: Day Bases (if included) -->
    {{if .Bases}}
    <div class="pdf-page" style="padding-top: 30px;">
        <section class="glossary-section">
            <h2 class="section-title">
                <span class="section-title-icon">📐</span>
                Glossary: Day Definitions
            </h2>
            <p class="glossary-intro">
                Day definitions (bases) determine the start and end times for calculating proportional hours (sha'os zmaniyos). Different halachic authorities define the day differently.
            </p>

            <div class="glossary-grid">
                {{range .Bases}}
                <div class="glossary-card">
                    <div class="glossary-card-header">
                        <span class="glossary-icon base">📐</span>
                        <span class="glossary-name">{{.Name}}</span>
                    </div>
                    <p class="glossary-definition">{{.Definition}}</p>
                    <div class="glossary-meta">
                        <strong>Day starts:</strong> {{.DayStart}}<br>
                        <strong>Day ends:</strong> {{.DayEnd}}{{if .Source}}<br>
                        <strong>Source:</strong> {{.Source}}{{end}}
                    </div>
                </div>
                {{end}}
            </div>
        </section>
    </div>
    {{end}}

    <!-- Glossary: Primitives (if included) -->
    {{if .Primitives}}
    <div class="pdf-page" style="padding-top: 30px;">
        <section class="glossary-section">
            <h2 class="section-title">
                <span class="section-title-icon">☀️</span>
                Glossary: Primitives
            </h2>
            <p class="glossary-intro">
                Primitives are foundational astronomical events used in zmanim calculations. These are the building blocks from which all zmanim are derived.
            </p>

            <div class="glossary-grid">
                {{range .Primitives}}
                <div class="glossary-card">
                    <div class="glossary-card-header">
                        <span class="glossary-icon primitive">☀️</span>
                        <span class="glossary-name">{{.Name}}</span>
                    </div>
                    <p class="glossary-definition">{{.Definition}}</p>
                    {{if .Method}}
                    <div class="glossary-meta">
                        <strong>Method:</strong> {{.Method}}{{if .Source}}<br><strong>Source:</strong> {{.Source}}{{end}}
                    </div>
                    {{end}}
                </div>
                {{end}}
            </div>
        </section>
    </div>
    {{end}}

    <!-- Page 3: Functions Glossary (if included) -->
    {{if .Functions}}
    <div class="pdf-page pdf-page-last" style="padding-top: 30px;">
        <section class="glossary-section" style="background: var(--white);">
            <h2 class="section-title">
                <span class="section-title-icon">⚙️</span>
                Glossary: Functions
            </h2>
            <p class="glossary-intro">
                Functions perform operations on primitives and other values to calculate specific zmanim. They transform base astronomical data into halachically meaningful times.
            </p>

            <div class="glossary-grid">
                {{range .Functions}}
                <div class="glossary-card">
                    <div class="glossary-card-header">
                        <span class="glossary-icon function">f(x)</span>
                        <span class="glossary-name">{{.Name}}</span>
                    </div>
                    <p class="glossary-definition">{{.Purpose}}</p>
                    {{if .Syntax}}
                    <div class="glossary-syntax">{{.Syntax}}</div>
                    {{end}}
                </div>
                {{end}}
            </div>
        </section>
    </div>
    {{end}}
</body>
</html>`
}
