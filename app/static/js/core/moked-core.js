// Moked 106 core: reads the monthly director's report (pptx slide XML + optional
// streets Excel rows), normalizes it into one month model, cross-checks it, builds
// the public (transparency) export and validates it.
//
// ONE implementation shared by: the admin upload page (browser), the storage
// function (Supabase Edge / Deno) and the transparency build (Node). No DOM, no deps.
// Loaded as a plain script; exposes globalThis.MokedCore.
(function (root) {
    'use strict';

    const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי',
        'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const NEIGHBORHOODS = ['רובע א', 'רובע ב', 'רובע ג', 'רובע ד', 'רובע ה', 'רובע הסיטי', 'רובע הקריה',
        'רובע ו', 'רובע ז', 'רובע ח', 'רובע ט', 'רובע ט"ו', 'רובע ט"ז', 'רובע י', 'רובע י"א', 'רובע י"ב',
        'רובע י"ג', 'רובע י"ז', 'רובע מיוחד', 'רובע פארק לכיש', 'מע"ר דרום', 'מרינה', 'רצועת החוף', 'חוף הים',
        'אשדוד ים', 'אזור התעשיה הכבדה', 'אזור התעשיה הצפונית', 'אזור התעשיה הקלה', 'תעשיות עורף הנמל'];
    // Other spellings of the same neighborhood seen in exports
    const HOOD_ALIASES = { 'רובע הנחל - פרק לכיש': 'רובע פארק לכיש', 'רובע הנחל - פארק לכיש': 'רובע פארק לכיש' };
    const hoodName = s => HOOD_ALIASES[clean(s)] || clean(s);
    const UNASSIGNED_HOOD = 'ללא שיוך לרובע';
    const UNASSIGNED_DIV = 'ללא שיוך לאגף';
    const MIN_CELL = 5;
    const GOAL = 80;
    const RATE_TOL = 0.15;
    const FORBIDDEN_KEYS = /street|address|manager|phone|email|resident|caller|id_number|^lat$|^lng$|^lon$/i;

    const monthLabel = ym => `${HEB_MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
    const prevMonthOf = ym => {
        let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
        if (m < 1) { m = 12; y -= 1; }
        return `${y}-${String(m).padStart(2, '0')}`;
    };
    const clean = s => String(s ?? '').replace(/[ ‏‎]/g, ' ').replace(/\s+/g, ' ').trim();
    const round1 = v => Math.round(v * 10) / 10;

    // "16,145" -> 16145, "92.10%" -> 92.1, "" -> null, "abc" -> NaN
    function num(s) {
        const t = clean(s).replace(/,/g, '').replace(/%$/, '');
        if (t === '' || t === '-' || t === '—') return null;
        const v = Number(t);
        return Number.isFinite(v) ? v : NaN;
    }

    // Topic names differ slightly between tables ("אבחון רכב נטוש-עם מספרים" vs "רכב נטוש-עם מספרים")
    const topicKey = s => clean(s).replace(/["'״׳\\/\-–\s]/g, '');
    function sameTopic(a, b) {
        const x = topicKey(a), y = topicKey(b);
        return x === y || (x.length > 5 && y.length > 5 && (x.endsWith(y) || y.endsWith(x)));
    }

    // ---------------------------------------------------------------- slide XML
    const decodeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');

    function paragraphs(xml) {
        return (xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) || []).map(p =>
            decodeXml((p.replace(/<a:br\/>/g, ' ').match(/<a:t>[\s\S]*?<\/a:t>|<a:t\/>/g) || [])
                .map(t => t.replace(/<\/?a:t\/?>/g, '')).join('')));
    }

    function readSlide(xml) {
        const tables = (xml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/g) || []).map(tbl =>
            (tbl.match(/<a:tr[ >][\s\S]*?<\/a:tr>/g) || []).map(tr =>
                (tr.match(/<a:tc(?:\s[^>]*)?>[\s\S]*?<\/a:tc>|<a:tc(?:\s[^>]*)?\/>/g) || [])
                    .map(tc => clean(paragraphs(tc).join(' ')))));
        const texts = paragraphs(xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, '')).map(clean).filter(Boolean);
        return { texts, tables };
    }

    // ---------------------------------------------------------------- report parsing
    const hdr = row => row.map(h => clean(h).replace(/["']/g, ''));
    const col = (h, ...needles) => h.findIndex(x => needles.every(n => x.includes(n)));

    function parseMonth(slides) {
        for (const s of slides.slice(0, 3)) {
            const m = s.texts.join(' ').match(new RegExp(`(${HEB_MONTHS.join('|')})\\s*(\\d{4})`));
            if (m) return `${m[2]}-${String(HEB_MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}`;
        }
        return null;
    }

    function parseManagers(t, where) {
        const h = hdr(t[0]);
        const c = {
            total: col(h, 'סהכ פניות'), sla: col(h, 'אחוז עמידה בתקן', 'חודש'), change: col(h, 'שינוי'),
            prevYear: h.findIndex(x => /שנת\s*\d{4}/.test(x)), overdue: col(h, 'חורגות'),
        };
        const yearM = c.prevYear >= 0 ? h[c.prevYear].match(/(\d{4})/) : null;
        const rows = [];
        let total = null;
        for (const r of t.slice(1)) {
            const name = clean(r[0]);
            if (!name) continue;
            const row = {
                name, total_calls: num(r[c.total]), sla_percent: num(r[c.sla]), sla_change: num(r[c.change]),
                sla_prev_year: c.prevYear >= 0 ? num(r[c.prevYear]) : null, overdue_open: num(r[c.overdue]),
            };
            if (/^סה"?כ$/.test(name.replace(/["']/g, '')) || name.replace(/["']/g, '') === 'סהכ') total = row;
            else rows.push(row);
        }
        return { rows, total, prev_year: yearM ? +yearM[1] : null, where };
    }

    function parseIssues(t, where) {
        const h = hdr(t[0]);
        const c = { dept: col(h, 'מחלקה'), topic: col(h, 'נושא'), std: col(h, 'זמן תקן'), total: col(h, 'סהכ פניות'),
            sla: col(h, 'אחוז עמידה'), avg: col(h, 'זמן טיפול ממוצע') };
        let dept = '';
        const rows = [];
        for (const r of t.slice(1)) {
            if (clean(r[c.dept])) dept = clean(r[c.dept]);
            const name = clean(r[c.topic]);
            if (!name) continue;
            rows.push({
                department: dept, issue_name: name, sla_time: clean(r[c.std]) || null,
                total_calls: num(r[c.total]), sla_percent: num(r[c.sla]),
                avg_handling_time: c.avg >= 0 ? (clean(r[c.avg]) || null) : null,
            });
        }
        return { rows, where };
    }

    function parseDepartments(t, where) {
        const h = hdr(t[0]);
        const c = { total: col(h, 'סהכ פניות'), callsChange: col(h, 'שינוי בכמות'), sla: col(h, 'עמידה בתקן', 'נוכחי'),
            slaChange: col(h, 'שינוי בתקן'), overdue: col(h, 'חורגות') };
        const rows = t.slice(1).filter(r => clean(r[0])).map(r => ({
            name: clean(r[0]), total_calls: num(r[c.total]), calls_change_percent: num(r[c.callsChange]),
            sla_percent: num(r[c.sla]), sla_change: num(r[c.slaChange]), overdue_open: num(r[c.overdue]),
        }));
        return { rows, where };
    }

    // Street x topic pivot. Rows named after a neighborhood are group rows (neighborhood totals).
    function parseStreetPivot(t, where) {
        const h = t[0].map(clean);
        const totalCol = h.findIndex(x => x.replace(/["']/g, '').includes('סכום כולל'));
        const topics = h.slice(1, totalCol > 0 ? totalCol : undefined);
        const rows = [], groups = [];
        let totals = null, group = null;
        for (const r of t.slice(1)) {
            const name = clean(r[0]);
            if (!name) continue;
            const counts = {};
            topics.forEach((tp, i) => { const v = num(r[i + 1]); if (v) counts[tp] = v; });
            const rowTotal = totalCol > 0 ? num(r[totalCol]) : null;
            const entry = { name, counts, total: rowTotal };
            if (name.replace(/["']/g, '').includes('סכום כולל')) totals = entry;
            else if (NEIGHBORHOODS.includes(hoodName(name))) { group = hoodName(name); groups.push({ ...entry, name: group }); }
            else rows.push({ ...entry, district: group });
        }
        return { topics, rows, groups, totals, grouped: groups.length > 0, where };
    }

    // Neighborhoods table is transposed: first column holds the row labels.
    function parseDistricts(t, where) {
        const label = r => clean(r[0]).replace(/["']/g, '');
        const find = (...needles) => t.find(r => needles.every(n => label(r).includes(n)));
        const names = t[0].slice(1).map(hoodName);
        const rPop = find('תושבים'), rTot = find('סהכ פניות'), rSla = find('עמידה בתקן'),
            rOver = find('חורגות'), rPerPop = find('ביחס', 'תושבים');
        const rows = names.map((name, i) => ({
            name, population: rPop ? num(rPop[i + 1]) : null, total_calls: rTot ? num(rTot[i + 1]) : NaN,
            sla_percent: rSla ? num(rSla[i + 1]) : null, overdue_open: rOver ? num(rOver[i + 1]) : null,
            reported_per_population: rPerPop ? num(rPerPop[i + 1]) : null,
        })).filter(r => r.name);
        return { rows, where };
    }

    // Excel export: one row per request (מספר פניה, נושא, רשימת רובעים, רחוב)
    function parseStreetSheet(sheetRows, fileName) {
        const hi = sheetRows.findIndex(r => r.some(c => clean(c) === 'נושא') && r.some(c => clean(c) === 'רחוב'));
        if (hi < 0) return { error: `בקובץ ${fileName} לא נמצאה שורת כותרת עם "נושא" ו"רחוב"` };
        const h = sheetRows[hi].map(clean);
        const c = { id: h.findIndex(x => x.includes('מספר')), topic: h.indexOf('נושא'), hood: h.findIndex(x => x.includes('רובע')),
            street: h.indexOf('רחוב') };
        const byTopic = {}, byHood = {}, streets = {};
        const ids = new Set();
        let rows = 0, dupIds = 0;
        for (const r of sheetRows.slice(hi + 1)) {
            const topic = clean(r[c.topic]);
            if (!topic) continue;
            rows++;
            const id = c.id >= 0 ? clean(r[c.id]) : '';
            if (id) { if (ids.has(id)) dupIds++; ids.add(id); }
            const hood = c.hood >= 0 ? hoodName(r[c.hood]) || UNASSIGNED_HOOD : UNASSIGNED_HOOD;
            const street = clean(r[c.street]) || 'ללא רחוב';
            byTopic[topic] = (byTopic[topic] || 0) + 1;
            byHood[hood] = (byHood[hood] || 0) + 1;
            const s = streets[street] || (streets[street] = { name: street, counts: {}, total: 0, hoods: {} });
            s.counts[topic] = (s.counts[topic] || 0) + 1;
            s.total++;
            s.hoods[hood] = (s.hoods[hood] || 0) + 1;
        }
        const list = Object.values(streets).map(s => ({
            name: s.name, counts: s.counts, total: s.total,
            district: Object.entries(s.hoods).sort((a, b) => b[1] - a[1])[0][0],
        })).sort((a, b) => b.total - a.total);
        return { file: fileName, rows, dup_ids: dupIds, by_topic: byTopic, by_hood: byHood, streets: list, topics: Object.keys(byTopic) };
    }

    // slides: [xmlString] in slide order; sheet: { name, rows } | null
    function parseReport(slideXmls, sheet) {
        const slides = slideXmls.map(readSlide);
        const out = { month: parseMonth(slides), period: null, sections: {}, unrecognized: [] };
        const periodM = slides[0]?.texts.join(' ').match(/(\d{1,2}\.\d{1,2})\s*[-–]\s*(\d{1,2}\.\d{1,2})/);
        if (periodM) out.period = `${periodM[1]}–${periodM[2]}`;

        slides.forEach((s, i) => {
            const where = `שקופית ${i + 1}`;
            const context = s.texts.join(' ');
            for (const t of s.tables) {
                if (!t.length) continue;
                const h = hdr(t[0]);
                const first = h[0] || '';
                const put = (key, val) => {
                    if (out.sections[key]) out.unrecognized.push(`${where}: טבלה נוספת מסוג ${key} – התעלמתי ממנה`);
                    else out.sections[key] = val;
                };
                if (first === 'מנהל' && col(h, 'חורגות') >= 0) put('managers', parseManagers(t, where));
                else if (col(h, 'נושא') >= 0 && col(h, 'זמן תקן') >= 0 && col(h, 'זמן טיפול ממוצע') >= 0) put('issues_core', parseIssues(t, where));
                else if (col(h, 'נושא') >= 0 && col(h, 'זמן תקן') >= 0) put(/מתחת ל\s*-?\s*80/.test(context) ? 'issues_below80' : 'issues_top', parseIssues(t, where));
                else if (first.startsWith('מחלקה') && col(h, 'שינוי בכמות') >= 0) put('departments', parseDepartments(t, where));
                else if (first.startsWith('רחוב')) {
                    const p = parseStreetPivot(t, where);
                    put(/מתחת ל\s*-?\s*80/.test(context) ? 'streets_below80' : (p.grouped ? 'streets_by_hood' : 'heatmap'), p);
                } else if (first.includes('רשימת רובעים') && t.some(r => clean(r[0]).includes('תושבים'))) put('districts', parseDistricts(t, where));
                else if (first.includes('רשימת רובעים') || first.startsWith('להלן תמצית') || first.startsWith('מס הפעמים')) {
                    /* narrative summary, repeat-offenders and initiated-requests tables: not used */
                }
                else out.unrecognized.push(`${where}: טבלה שלא זוהתה ("${first}")`);
            }
        });
        if (sheet) out.sections.street_sheet = parseStreetSheet(sheet.rows, sheet.name);
        return out;
    }

    // ---------------------------------------------------------------- month model
    // Builds the month model the dashboard and the public export read.
    function buildMonth(parsed, meta = {}) {
        const s = parsed.sections;
        const m = {
            schema: 1, month: parsed.month, month_label: parsed.month ? monthLabel(parsed.month) : null,
            period: parsed.period, sources: {},
            summary: null, managers: [], departments: [], issues_top: [], issues_below80: [], issues_core: [],
            districts: [], heatmap: null, streets: null, ...meta,
        };
        if (s.managers) {
            const tot = s.managers.total;
            m.managers = s.managers.rows;
            m.summary = {
                total_calls: tot ? tot.total_calls : s.managers.rows.reduce((a, r) => a + (r.total_calls || 0), 0),
                sla_percent: tot ? tot.sla_percent : null, sla_change: tot ? tot.sla_change : null,
                sla_prev_year: tot ? tot.sla_prev_year : null, overdue_open: tot ? tot.overdue_open : null,
                prev_year: s.managers.prev_year,
            };
            m.sources.managers = s.managers.where;
        }
        for (const k of ['departments', 'issues_top', 'issues_below80', 'issues_core', 'districts']) {
            if (s[k]) { m[k] = s[k].rows; m.sources[k] = s[k].where; }
        }
        m.districts = m.districts.map(({ reported_per_population, ...d }) => d);
        if (s.heatmap) {
            m.heatmap = { topics: s.heatmap.topics, rows: s.heatmap.rows.map(r => ({ name: r.name, counts: r.counts, total: r.total })),
                source: s.heatmap.where };
        }
        // Street-level detail for trends: full Excel export when present, else the grouped report table
        if (s.street_sheet && !s.street_sheet.error) {
            m.streets = { source: `קובץ ${s.street_sheet.file}`, kind: 'sheet', topics: s.street_sheet.topics,
                rows: s.street_sheet.streets, by_hood: s.street_sheet.by_hood };
            m.sources.streets = m.streets.source;
        } else if (s.streets_by_hood) {
            m.streets = { source: s.streets_by_hood.where, kind: 'report', topics: s.streets_by_hood.topics,
                rows: s.streets_by_hood.rows, by_hood: Object.fromEntries(s.streets_by_hood.groups.map(g => [g.name, g.total])) };
            m.sources.streets = m.streets.source;
        }
        return m;
    }

    // ---------------------------------------------------------------- checks
    // errors block saving; warnings are real gaps inside the source report and must be acknowledged.
    function checkMonth(parsed, m, opts = {}) {
        const errors = [], warnings = [], ok = [];
        const E = msg => errors.push(msg), W = msg => warnings.push(msg), OK = msg => ok.push(msg);
        const s = parsed.sections;
        const fmt = n => (n == null ? '—' : Number(n).toLocaleString('he-IL'));

        // Month
        if (!m.month) E('לא זוהה חודש הדוח בשקופית הפתיחה (למשל "מאי 2026").');
        else if (opts.expectedMonth && opts.expectedMonth !== m.month) {
            E(`בחרת ${monthLabel(opts.expectedMonth)}, אבל הדוח הוא של ${m.month_label}.`);
        } else OK(`חודש הדוח: ${m.month_label}`);
        if (s.street_sheet && s.street_sheet.error) E(s.street_sheet.error);
        for (const u of parsed.unrecognized) W(u);

        // Required sections
        const need = { managers: 'טבלת מנהלים', issues_top: '10 נושאים מובילים', districts: 'פילוח לפי רובעים' };
        for (const [k, label] of Object.entries(need)) if (!s[k]) E(`לא נמצאה בדוח ${label}.`);
        const nice = { departments: 'דוח 20/80 מחלקות', issues_below80: 'נושאים מתחת ל-80%', issues_core: 'ליבת הפעילות', heatmap: 'מפת חום לפי רחובות' };
        for (const [k, label] of Object.entries(nice)) if (!s[k]) W(`לא נמצאה בדוח ${label} – הלשונית המתאימה תהיה ריקה החודש.`);

        // Values
        const checkRows = (rows, label, fields) => rows.forEach(r => fields.forEach(f => {
            const v = r[f];
            if (Number.isNaN(v)) E(`${label} "${r.name || r.issue_name}": ערך לא מספרי בעמודה ${f}.`);
            else if (v != null && f.includes('percent') && (v < 0 || v > 100)) E(`${label} "${r.name || r.issue_name}": אחוז מחוץ לטווח (${v}).`);
            else if (v != null && (f === 'total_calls' || f === 'overdue_open') && (v < 0 || !Number.isInteger(v))) E(`${label} "${r.name || r.issue_name}": כמות לא תקינה (${v}).`);
        }));
        checkRows(m.managers, 'מנהל', ['total_calls', 'sla_percent', 'overdue_open']);
        checkRows(m.departments, 'מחלקה', ['total_calls', 'sla_percent', 'overdue_open']);
        checkRows(m.issues_top, 'נושא', ['total_calls', 'sla_percent']);
        checkRows(m.issues_below80, 'נושא', ['total_calls', 'sla_percent']);
        checkRows(m.issues_core, 'נושא', ['total_calls', 'sla_percent']);
        checkRows(m.districts, 'רובע', ['total_calls', 'sla_percent', 'overdue_open']);
        const dup = (rows, key, label) => {
            const seen = new Set();
            rows.forEach(r => { if (seen.has(r[key])) E(`${label} "${r[key]}" מופיע פעמיים באותה טבלה.`); seen.add(r[key]); });
        };
        dup(m.managers, 'name', 'מנהל'); dup(m.departments, 'name', 'מחלקה'); dup(m.issues_top, 'issue_name', 'נושא');
        dup(m.districts, 'name', 'רובע');
        for (const t of [...m.issues_top, ...m.issues_below80, ...m.issues_core]) {
            if (t.sla_time && !parseStandard(t.sla_time)) E(`נושא "${t.issue_name}": זמן תקן לא מוכר "${t.sla_time}".`);
        }

        const total = m.summary?.total_calls;
        if (s.managers) {
            if (!s.managers.total) W('בטבלת המנהלים אין שורת סה"כ – הסה"כ חושב מסכום המנהלים.');
            const sum = m.managers.reduce((a, r) => a + (r.total_calls || 0), 0);
            if (sum !== total) W(`בדוח עצמו: סכום המנהלים ${fmt(sum)} ≠ סה"כ ${fmt(total)} (הפרש ${fmt(total - sum)}). בדף הציבורי ההפרש יוצג כ"${UNASSIGNED_DIV}".`);
            else OK(`סכום המנהלים = סה"כ הפניות (${fmt(total)})`);
            if (sum > total) E(`סכום המנהלים גדול מסה"כ הפניות – לא ניתן לפרסם.`);
            const od = m.managers.reduce((a, r) => a + (r.overdue_open || 0), 0);
            if (m.summary.overdue_open != null && od !== m.summary.overdue_open) W(`בדוח עצמו: סכום החורגות של המנהלים ${fmt(od)} ≠ סה"כ ${fmt(m.summary.overdue_open)}.`);
            const rated = m.managers.filter(r => r.sla_percent != null);
            const w = rated.reduce((a, r) => a + r.total_calls * r.sla_percent, 0) / rated.reduce((a, r) => a + r.total_calls, 0);
            if (m.summary.sla_percent != null && Math.abs(w - m.summary.sla_percent) > RATE_TOL) {
                W(`עמידה בתקן כללית ${m.summary.sla_percent}% ≠ ממוצע משוקלל של המנהלים ${w.toFixed(2)}%.`);
            } else OK(`עמידה בתקן כללית (${m.summary.sla_percent}%) תואמת לממוצע המשוקלל של המנהלים`);
        }

        // Neighborhoods: names, alignment (calls ÷ residents must match the report's own %), totals
        if (s.districts) {
            const unknown = m.districts.filter(d => !NEIGHBORHOODS.includes(d.name));
            unknown.forEach(d => W(`רובע לא מוכר: "${d.name}" (אם זה רובע חדש – יש להוסיף אותו לרשימה).`));
            const missing = NEIGHBORHOODS.filter(n => !m.districts.some(d => d.name === n));
            if (missing.length) W(`רובעים שלא הופיעו בדוח: ${missing.join(', ')}.`);
            let misaligned = 0;
            for (const d of s.districts.rows) {
                if (d.population && d.reported_per_population != null) {
                    const calc = d.total_calls / d.population * 100;
                    if (Math.abs(calc - d.reported_per_population) > 0.02) {
                        misaligned++;
                        E(`רובע "${d.name}": ${fmt(d.total_calls)} פניות ÷ ${fmt(d.population)} תושבים = ${calc.toFixed(2)}%, אבל בדוח ${d.reported_per_population}% – העמודות לא מיושרות.`);
                    }
                }
            }
            if (!misaligned) OK('טבלת הרובעים מיושרת (פניות ÷ תושבים תואם לאחוז שבדוח)');
            const dsum = m.districts.reduce((a, d) => a + (d.total_calls || 0), 0);
            if (total != null && dsum > total) E(`סכום הפניות ברובעים (${fmt(dsum)}) גדול מסה"כ הפניות (${fmt(total)}).`);
            else if (total != null) OK(`${fmt(dsum)} פניות שויכו לרובע, ${fmt(total - dsum)} ללא שיוך`);
        }

        // Street pivots show only the busiest streets; their totals row covers all streets.
        // So: every row must add up to its own total (a mismatch means a misread cell),
        // and the totals row must match the topic table it summarizes.
        const pivots = [
            ['heatmap', 'מפת החום', m.issues_core, 'ליבת הפעילות'],
            ['streets_by_hood', 'טבלת הרחובות לפי רובע', m.issues_top, '10 הנושאים המובילים'],
            ['streets_below80', 'מפת החום של הנושאים החורגים', m.issues_below80, 'טבלת החורגים'],
        ];
        for (const [k, label, issues, issuesLabel] of pivots) {
            const p = s[k];
            if (!p) continue;
            let bad = 0;
            for (const r of [...p.rows, ...p.groups]) {
                const rs = Object.values(r.counts).reduce((a, v) => a + v, 0);
                if (r.total != null && rs !== r.total) { bad++; E(`${label} (${p.where}): השורה "${r.name}" מסתכמת ל-${rs} אבל בעמודת הסיכום ${r.total}.`); }
            }
            if (!bad) OK(`${label}: כל שורה מסתכמת לעמודת הסיכום שלה`);
            if (!p.totals || !issues.length) continue;
            const diffs = [];
            for (const tp of p.topics) {
                const t = issues.find(x => sameTopic(x.issue_name, tp));
                const v = p.totals.counts[tp] || 0;
                if (!t) diffs.push(`"${tp}" לא קיים ב${issuesLabel}`);
                else if (t.total_calls !== v) diffs.push(`"${tp}" ${fmt(v)} מול ${fmt(t.total_calls)}`);
            }
            if (diffs.length) W(`${label} (${p.where}) לעומת ${issuesLabel}: ${diffs.join('; ')}.`);
            else OK(`שורת הסיכום של ${label} תואמת ל${issuesLabel}`);
        }

        // Cross-table: the same topic in different tables
        const compareTopics = (a, b, la, lb) => {
            const diffs = [];
            for (const x of a) {
                const y = b.find(t => sameTopic(t.issue_name, x.issue_name));
                if (y && (y.total_calls !== x.total_calls || y.sla_percent !== x.sla_percent)) {
                    diffs.push(`"${x.issue_name}" ${fmt(x.total_calls)} פניות/${x.sla_percent}% מול ${fmt(y.total_calls)}/${y.sla_percent}%`);
                }
            }
            if (diffs.length) W(`נושאים שמופיעים גם ב${la} וגם ב${lb} עם ערכים שונים (כך בדוח עצמו; כל טבלה מוצגת בדשבורד כפי שהיא, ובדף הציבורי נלקחים רק 10 המובילים): ${diffs.join('; ')}.`);
        };
        compareTopics(m.issues_top, m.issues_below80, '10 המובילים', 'טבלת החורגים');
        compareTopics(m.issues_top, m.issues_core, '10 המובילים', 'ליבת הפעילות');

        // Street Excel: per-topic counts vs the report, neighborhoods vs the grouped table
        const sh = s.street_sheet;
        if (sh && !sh.error) {
            if (sh.dup_ids) W(`בקובץ ${sh.file} יש ${sh.dup_ids} מספרי פניה כפולים.`);
            const td = [];
            for (const t of m.issues_top) {
                const tp = Object.keys(sh.by_topic).find(x => sameTopic(x, t.issue_name));
                const v = tp ? sh.by_topic[tp] : 0;
                if (v !== t.total_calls) td.push(`"${t.issue_name}" ${fmt(t.total_calls)} בדוח מול ${fmt(v)} בקובץ`);
            }
            if (td.length) W(`קובץ הרחובות לא זהה לדוח בכמות לפי נושא (כנראה הופקו בשעות שונות): ${td.join('; ')}.`);
            const bad = td.length;
            const extra = Object.keys(sh.by_topic).filter(x => !m.issues_top.some(t => sameTopic(t.issue_name, x)));
            if (extra.length) W(`בקובץ הרחובות יש נושאים שאינם ב-10 המובילים: ${extra.join(', ')}.`);
            if (!bad && !extra.length) OK(`קובץ הרחובות (${fmt(sh.rows)} פניות) תואם לכמויות של 10 הנושאים המובילים`);
            if (s.streets_by_hood) {
                const hd = s.streets_by_hood.groups.filter(g => (sh.by_hood[g.name] || 0) !== g.total)
                    .map(g => `${g.name} ${fmt(g.total)} בדוח מול ${fmt(sh.by_hood[g.name] || 0)} בקובץ`);
                if (hd.length) W(`קובץ הרחובות לא זהה לדוח בכמות לפי רובע: ${hd.join('; ')}.`);
                else OK('כמויות הרובעים בקובץ הרחובות תואמות לדוח');
            }
            for (const [hood, n] of Object.entries(sh.by_hood)) {
                const d = m.districts.find(x => x.name === hood);
                if (d && n > d.total_calls) E(`רובע "${hood}": ${fmt(n)} פניות בקובץ הרחובות, יותר מסה"כ הרובע (${fmt(d.total_calls)}).`);
                if (!d && hood !== UNASSIGNED_HOOD) W(`בקובץ הרחובות מופיע רובע לא מוכר: "${hood}".`);
            }
        }

        // Against the previous month in the system: the report's own "change" columns should agree
        const prev = opts.prevMonth;
        if (prev) {
            let bad = 0;
            for (const r of m.managers) {
                const p = prev.managers.find(x => x.name === r.name);
                if (p && r.sla_change != null && Math.abs((r.sla_percent - p.sla_percent) - r.sla_change) > RATE_TOL) {
                    bad++; W(`מנהל "${r.name}": בדוח שינוי של ${r.sla_change}%, אבל לפי ${prev.month_label} במערכת השינוי הוא ${(r.sla_percent - p.sla_percent).toFixed(1)}%.`);
                }
            }
            if (!bad) OK(`שינויי המנהלים בדוח תואמים ל${prev.month_label} שבמערכת`);
        }

        // The public export built from this month must pass the public validation too
        if (!errors.length) {
            const pub = toPublic(m, opts.exportedOn || '2000-01-01');
            const pe = validatePublicMonth(pub);
            pe.forEach(e => E(`דף השקיפות: ${e}`));
            if (!pe.length) OK('קובץ דף השקיפות נבנה ועבר את כל הבדיקות');
        }
        return { errors, warnings, ok };
    }

    // ---------------------------------------------------------------- standards
    // Report standard is [D]DD:HH:MM (000:16:00 = 16 hours, 060:00:00 = 60 days)
    function parseStandard(s) {
        const m = clean(s).match(/^(\d{1,3}):(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;
        const [d, h, mi] = [+m[1], +m[2], +m[3]];
        if (h > 23 || mi > 59) return null;
        return { d, h, m: mi, hours: round1(d * 24 + h + mi / 60) };
    }

    function standardText(s) {
        const p = parseStandard(s);
        if (!p) return null;
        const days = n => ({ 1: 'יום', 2: 'יומיים' }[n] || `${n} ימים`);
        const hours = n => ({ 1: 'שעה', 2: 'שעתיים' }[n] || `${n} שעות`);
        if (p.d && !p.h && !p.m) return days(p.d);
        if (!p.d && p.h && p.m === 30) return `${hours(p.h)} וחצי`;
        if (!p.d && !p.h) return `${p.m} דקות`;
        const parts = [];
        if (p.d) parts.push(days(p.d));
        if (p.h) parts.push(hours(p.h));
        if (p.m) parts.push(`${p.m} דקות`);
        return parts.join(' ו-');
    }

    // ---------------------------------------------------------------- public export
    function suppress(rows, total) {
        const small = rows.filter(r => r.cases < MIN_CELL);
        if (small.length === 1) {
            const rest = rows.filter(r => r.cases >= MIN_CELL && r.name !== UNASSIGNED_HOOD).sort((a, b) => a.cases - b.cases);
            if (rest.length) small.push(rest[0]);
        }
        let hidden = 0;
        for (const r of small) {
            hidden += r.cases;
            for (const k of Object.keys(r)) if (!['id', 'name', 'department'].includes(k)) r[k] = null;
            r.suppressed = true;
        }
        return { total, suppressed_total: hidden, rows };
    }

    function toPublic(m, exportedOn) {
        const total = m.summary.total_calls;
        const departments = [...m.managers].sort((a, b) => b.total_calls - a.total_calls)
            .map(r => ({ name: r.name, cases: r.total_calls, on_time_rate: r.sla_percent == null ? null : round1(r.sla_percent) }));
        const gap = total - departments.reduce((a, d) => a + d.cases, 0);
        if (gap > 0) departments.push({ name: UNASSIGNED_DIV, cases: gap, on_time_rate: null });

        const neighborhoods = m.districts.map(d => ({ name: d.name, cases: d.total_calls,
            on_time_rate: d.sla_percent == null ? null : round1(d.sla_percent), reopened_rate: null }));
        const un = total - neighborhoods.reduce((a, d) => a + d.cases, 0);
        neighborhoods.push({ name: UNASSIGNED_HOOD, cases: un, on_time_rate: null, reopened_rate: null });

        const topics = [...m.issues_top].sort((a, b) => b.total_calls - a.total_calls).map(t => {
            const p = parseStandard(t.sla_time);
            return { id: t.issue_name, name: t.issue_name, department: t.department, standard_hours: p ? p.hours : null,
                standard_text: standardText(t.sla_time), cases: t.total_calls,
                on_time_rate: t.sla_percent == null ? null : round1(t.sla_percent), reopened_rate: null };
        });
        topics.push({ id: 'other', name: 'כל שאר הנושאים', department: null, standard_hours: null, standard_text: null,
            cases: total - topics.reduce((a, t) => a + t.cases, 0), on_time_rate: null, reopened_rate: null });

        return {
            schema_version: 1, month: m.month, month_label: monthLabel(m.month), data_status: 'real',
            provenance: { cases: 'real', on_time_rate: 'real', reopened_rate: 'not_collected' },
            exported_on: exportedOn, min_cell_size: MIN_CELL,
            city: { total_cases: total, on_time_rate: m.summary.sla_percent == null ? null : round1(m.summary.sla_percent), reopened_rate: null },
            departments: suppress(departments, total),
            neighborhoods: suppress(neighborhoods, total),
            topics: suppress(topics, total),
        };
    }

    // ---------------------------------------------------------------- public validation
    function scanKeys(obj, out, path = '') {
        if (Array.isArray(obj)) return obj.forEach((v, i) => scanKeys(v, out, `${path}[${i}]`));
        if (obj && typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj)) {
                if (FORBIDDEN_KEYS.test(k)) out.push(`שדה אסור "${path}.${k}" (אין רחובות, מנהלים או פרטים אישיים)`);
                scanKeys(v, out, `${path}.${k}`);
            }
        }
    }

    function validatePublicMonth(d, fileMonth) {
        const errs = [];
        scanKeys(d, errs);
        if (fileMonth && d.month !== fileMonth) errs.push(`חודש הנתונים ${d.month} ≠ שם הקובץ ${fileMonth}`);
        if (!d.month || d.month_label !== monthLabel(d.month)) errs.push(`תווית החודש "${d.month_label}" ≠ "${d.month && monthLabel(d.month)}"`);
        for (const key of ['departments', 'neighborhoods', 'topics']) {
            const t = d[key];
            if (!t || !Array.isArray(t.rows)) { errs.push(`חסרה טבלה ${key}`); continue; }
            if (t.total !== d.city.total_cases) errs.push(`${key}: סה"כ ${t.total} ≠ סה"כ העיר ${d.city.total_cases}`);
            const visible = t.rows.reduce((s, r) => s + (r.cases ?? 0), 0);
            if (visible + t.suppressed_total !== t.total) errs.push(`${key}: שורות (${visible}) + מוסתרות (${t.suppressed_total}) ≠ סה"כ (${t.total})`);
            const hidden = t.rows.filter(r => r.suppressed);
            if (hidden.length === 1) errs.push(`${key}: תא מוסתר יחיד ניתן לחישוב מהסכום`);
            const seen = new Set();
            for (const r of t.rows) {
                if (r.suppressed) {
                    for (const [k, v] of Object.entries(r)) {
                        if (!['id', 'name', 'department', 'suppressed'].includes(k) && v !== null) errs.push(`${key} "${r.name}": שורה מוסתרת חושפת ${k}`);
                    }
                } else if (typeof r.cases !== 'number' || r.cases < d.min_cell_size) {
                    errs.push(`${key} "${r.name}": ${r.cases} פניות – פחות מהמינימום (${d.min_cell_size})`);
                }
                for (const k of ['on_time_rate', 'reopened_rate']) {
                    if (r[k] != null && (r[k] < 0 || r[k] > 100)) errs.push(`${key} "${r.name}": ${k} מחוץ לטווח`);
                }
                const id = r.id ?? r.name;
                if (seen.has(id)) errs.push(`${key} "${r.name}" מופיע פעמיים (מדד אחד, שני ערכים)`);
                seen.add(id);
            }
        }
        for (const r of d.neighborhoods?.rows ?? []) {
            if (r.name !== UNASSIGNED_HOOD && !NEIGHBORHOODS.includes(r.name)) errs.push(`רובע לא מוכר "${r.name}"`);
        }
        const dep = d.departments;
        if (dep && dep.total && dep.suppressed_total / dep.total < 0.005 && d.city.on_time_rate != null) {
            const rated = dep.rows.filter(r => r.on_time_rate != null);
            const w = rated.reduce((s, r) => s + r.cases * r.on_time_rate, 0) / rated.reduce((s, r) => s + r.cases, 0);
            if (Math.abs(w - d.city.on_time_rate) > RATE_TOL) errs.push(`עמידה בתקן של העיר ${d.city.on_time_rate}% ≠ ממוצע משוקלל של האגפים ${w.toFixed(2)}%`);
        }
        return errs;
    }

    function publicIndexEntry(d) {
        return { month: d.month, month_label: d.month_label, data_status: d.data_status,
            total_cases: d.city.total_cases, on_time_rate: d.city.on_time_rate };
    }

    // index must list exactly the given months, with identical headline values
    function validatePublicIndex(index, months) {
        const errs = [];
        const listed = index.months.map(m => m.month);
        const have = months.map(m => m.month).sort();
        if (JSON.stringify(listed) !== JSON.stringify(have)) errs.push(`רשימת החודשים באינדקס (${listed.join(',')}) ≠ הקבצים (${have.join(',')})`);
        if (index.latest !== listed[listed.length - 1]) errs.push(`latest ${index.latest} אינו החודש האחרון`);
        for (const d of months) {
            const e = index.months.find(x => x.month === d.month);
            if (!e) continue;
            const want = publicIndexEntry(d);
            for (const k of Object.keys(want)) if (e[k] !== want[k]) errs.push(`${d.month}: ${k} הוא ${want[k]} בקובץ אבל ${e[k]} באינדקס`);
        }
        return errs;
    }

    // ---------------------------------------------------------------- trends
    // Arrow data vs the previous month. dir: 'up'|'down'|'same'; good: true/false/null.
    function change(cur, prev, higherIsBetter) {
        if (cur == null || prev == null) return null;
        const diff = round1(cur - prev);
        const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
        return { diff, prev, dir, good: dir === 'same' ? null : (dir === 'up') === higherIsBetter };
    }

    function compareMonths(cur, prev) {
        if (!prev) return null;
        const byName = (rows, key = 'name') => Object.fromEntries(rows.map(r => [r[key], r]));
        const mk = (rows, prevRows, key = 'name') => {
            const p = byName(prevRows, key);
            return Object.fromEntries(rows.map(r => {
                const q = p[r[key]];
                return [r[key], q ? { calls: change(r.total_calls, q.total_calls, false), sla: change(r.sla_percent, q.sla_percent, true) } : null];
            }));
        };
        const out = {
            prev_month: prev.month, prev_label: prev.month_label,
            summary: { calls: change(cur.summary.total_calls, prev.summary.total_calls, false),
                sla: change(cur.summary.sla_percent, prev.summary.sla_percent, true),
                overdue: change(cur.summary.overdue_open, prev.summary.overdue_open, false) },
            managers: mk(cur.managers, prev.managers),
            departments: mk(cur.departments, prev.departments),
            issues: mk(cur.issues_top, prev.issues_top, 'issue_name'),
            districts: mk(cur.districts, prev.districts),
            streets: {}, streets_comparable: false,
        };
        // Streets only compare like with like (same source kind and the same topic set)
        const cs = cur.streets, ps = prev.streets;
        if (cs && ps && cs.kind === ps.kind && cs.topics.length === ps.topics.length
            && cs.topics.every(t => ps.topics.some(x => sameTopic(x, t)))) {
            out.streets_comparable = true;
            const p = byName(ps.rows);
            for (const r of cs.rows) out.streets[r.name] = change(r.total, p[r.name] ? p[r.name].total : 0, false);
        }
        return out;
    }

    root.MokedCore = {
        HEB_MONTHS, NEIGHBORHOODS, HOOD_ALIASES, UNASSIGNED_HOOD, UNASSIGNED_DIV, MIN_CELL, GOAL,
        monthLabel, prevMonthOf, sameTopic, readSlide, parseReport, buildMonth, checkMonth,
        parseStandard, standardText, toPublic, validatePublicMonth, validatePublicIndex, publicIndexEntry, compareMonths,
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
