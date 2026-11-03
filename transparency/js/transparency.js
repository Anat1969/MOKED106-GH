// Public transparency page. Reads ONLY monthly aggregated exports: the ones published
// by the upload function (storage public/) and the bundled ones (public_data/, demo
// history until real months accumulate), plus the editable content files (content/).
// Never reads internal data.
//
// "Promise vs reality" rule: every conclusion (trend, verdict, comparison) is computed
// from REAL months only. Demo months can be shown in charts on request, dashed and
// labelled, but never feed a sentence that interprets the data.
(() => {
    const STORAGE_PUBLIC = 'https://cbhexpybdggwzyakgagd.supabase.co/storage/v1/object/authenticated/moked106/public/';
    const STORAGE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGV4cHliZGdnd3p5YWtnYWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkzMjksImV4cCI6MjA5MTMyNTMyOX0.X1b7pLyig-bGfxM7XjmwH0TqiuhqoS_o-Czg5qdsN6o';
    const GOAL = 80;              // minimum on-time rate the city reports against
    const TREND_MONTHS = 12;
    const IMPROVE_POINTS = 1;     // change (in points) that counts as "improving"/"declining"
    const UNASSIGNED = 'ללא שיוך לרובע';
    const SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
    const LONG = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const $ = id => document.getElementById(id);
    const icon = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
    // Minimal topic icons, matched by keywords in the topic name
    const TOPIC_ICONS = [
        [/גזם|עצ|נטיע|גינ/, 't-tree'], [/אשפה|פסולת|גרוטאות|מכולת/, 't-trash'], [/רכב|חני|חוסם/, 't-car'],
        [/חיות|כלב|חתול|פגר|וטרינר/, 't-paw'], [/ריצוף|אספלט|מדרכ|דרכים/, 't-pave'], [/יתוש|הדברה|מזיק/, 't-bug'],
        [/טפטפת|השקיה|מים|ביוב|נזיל/, 't-drop'], [/ניקיון|לכלוך|טיאוט/, 't-sparkle'],
    ];
    const topicIcon = name => icon((TOPIC_ICONS.find(([re]) => re.test(name || '')) || [, 't-dot'])[1], 'ico topic-ico');
    const NUM = new Intl.NumberFormat('he-IL');
    const PCT = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const num = n => NUM.format(n);
    const pct = v => (v == null ? '—' : `${PCT.format(v)}%`);
    const pts1 = v => PCT.format(Math.abs(v));
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const shortLabel = ym => `${SHORT[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
    const dateLabel = iso => { const d = new Date(iso); return `${d.getDate()} ב${LONG[d.getMonth()]} ${d.getFullYear()}`; };
    const monthYear = iso => `${LONG[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
    const daysIn = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
    // "6 שעות" -> "מ-6 שעות", "יומיים" -> "מיומיים" (Hebrew "than" prefix)
    const than = std => (/^\d/.test(std) ? `מ-${std}` : `מ${std}`);
    // Cases that waited longer than promised, derived from the published rate (rounded, so "כ-")
    const lateOf = (cases, rate) => Math.round(cases * (100 - rate) / 100);

    const state = { index: null, months: {}, actions: null, stories: null, current: null, hood: null,
        sort: 'cases', psort: 'cases', showDemo: false };

    async function getJson(path, headers) {
        const r = await fetch(path, { cache: 'no-cache', headers });
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.json();
    }
    const storageJson = name => getJson(STORAGE_PUBLIC + name, { apikey: STORAGE_KEY, Authorization: `Bearer ${STORAGE_KEY}` });

    async function load() {
        const bundled = await getJson('public_data/index.json');
        const files = await Promise.all(bundled.months.map(m => getJson(`public_data/${m.month}.json`)));
        files.forEach(f => { state.months[f.month] = f; });
        let updatedOn = bundled.updated_on;
        try {
            // Months published from report uploads replace bundled (demo) months
            const live = await storageJson('index.json');
            const liveFiles = await Promise.all(live.months.map(m => storageJson(`${m.month}.json`)));
            liveFiles.forEach(f => { state.months[f.month] = f; });
            updatedOn = live.updated_on;
        } catch (err) {
            console.info('No uploaded months yet; showing bundled data', err.message);
        }
        const months = Object.values(state.months).sort((a, b) => a.month.localeCompare(b.month))
            .map(d => ({ month: d.month, month_label: d.month_label, data_status: d.data_status }));
        state.index = { latest: months[months.length - 1].month, updated_on: updatedOn, months };
        [state.actions, state.stories] = await Promise.all([getJson('content/actions.json'), getJson('content/stories.json')]);
        const q = new URLSearchParams(location.search);
        const asked = q.get('month');
        state.current = months.some(m => m.month === asked) ? asked
            : [...months].reverse().find(m => m.data_status === 'real')?.month || state.index.latest;
        state.showDemo = q.get('demo') === '1';
    }

    // The 12 months ending at the selected month (only those that exist)
    function window12() {
        const all = state.index.months.map(m => m.month);
        const end = all.indexOf(state.current);
        return all.slice(Math.max(0, end - TREND_MONTHS + 1), end + 1).map(ym => state.months[ym]);
    }
    const isDemo = (d, metric) => d.data_status === 'demo' || d.provenance?.[metric] === 'demo';
    const cur = () => state.months[state.current];
    const curDemo = () => cur().data_status === 'demo';
    // All points, demo flagged (for charts when the visitor asks to see demo months)
    const series = (pick, metric) => window12().map(d => ({
        label: shortLabel(d.month), full: d.month_label, value: pick(d), demo: isDemo(d, metric),
    }));
    // What a chart shows: real points only, unless the visitor turned demo months on
    const shown = (pick, metric) => series(pick, metric).filter(p => state.showDemo || !p.demo);
    // What a conclusion may use: real, non-empty points only
    const realPts = (pick, metric) => series(pick, metric).filter(p => !p.demo && p.value != null);
    const findRow = (d, table, key) => d[table].rows.find(r => (r.id ?? r.name) === key);
    const realMonths = () => state.index.months.filter(m => m.data_status === 'real');

    // Trend between the first and last REAL month in the window; null if fewer than two
    function trend(pick, metric) {
        const pts = realPts(pick, metric);
        if (pts.length < 2) return null;
        const first = pts[0], last = pts[pts.length - 1];
        const diff = last.value - first.value;
        const dir = diff >= IMPROVE_POINTS ? 'up' : diff <= -IMPROVE_POINTS ? 'down' : 'flat';
        const since = `לעומת ${first.full}`;
        const word = { up: 'משתפר', down: 'יורד', flat: 'יציב' }[dir];
        const detail = dir === 'flat'
            ? (diff === 0 ? `ללא שינוי ${since}` : `שינוי של פחות מנקודה ${since}`)
            : `${dir === 'up' ? 'עלייה' : 'ירידה'} של ${pts1(diff)} נקודות ${since}`;
        return { dir, word, detail, n: pts.length };
    }
    const trendTag = t => (t ? `<span class="trend trend-${t.dir}"><b>${t.word}</b> ${esc(t.detail)}</span>` : '');
    const demoTag = () => (curDemo() ? '<span class="tag tag-demo">הדגמה</span>' : '');
    const oneRealMonthNote = () => {
        const rm = realMonths();
        if (rm.length >= 2) return '';
        return rm.length === 1
            ? `יש עד כה חודש אמיתי אחד, ${rm[0].month_label}. כיוון מגמה יופיע מהחודש האמיתי השני.`
            : 'עדיין אין חודש אמיתי, ולכן אין מגמה.';
    };

    function renderTruth() {
        const months = window12();
        $('truthStrip').innerHTML = months.map(d => {
            const real = d.data_status === 'real';
            const sel = d.month === state.current ? ' is-current' : '';
            return `<li class="tm ${real ? 'tm-real' : 'tm-demo'}${sel}"><span class="tm-m">${esc(SHORT[+d.month.slice(5, 7) - 1])}</span><span class="tm-y">${esc(d.month.slice(2, 4))}</span><span class="tm-s">${real ? 'אמיתי' : 'הדגמה'}</span></li>`;
        }).join('');
        const real = months.filter(d => d.data_status === 'real');
        const demo = months.length - real.length;
        $('truthLine').innerHTML = real.length === months.length
            ? `<b>כל ${num(months.length)} החודשים בדוח הם נתוני אמת.</b>`
            : `<b>${real.length === 1 ? 'חודש אמיתי אחד' : `${num(real.length)} חודשים אמיתיים`} מתוך ${num(months.length)}${real.length ? `: ${real.map(d => esc(d.month_label)).join(', ')}` : ''}.</b><br>`
              + `${num(demo)} החודשים האחרים הם נתוני הדגמה, עד שיצטברו דוחות אמיתיים. שום מסקנה בדף לא נגזרת מהם.`;

        const parts = [];
        if (curDemo()) parts.push(`החודש שנבחר, ${cur().month_label}, הוא חודש הדגמה. כל המספרים בו להמחשה בלבד, ולא נבנית מהם מגמה.`);
        if (state.actions.draft || state.stories.draft) parts.push('התכנים בסעיפים 3 ו-4 הם טיוטה לאישור.');
        $('demoNotice').hidden = !parts.length;
        $('demoNotice').textContent = parts.join(' ');
        const t = $('demoToggle');
        t.hidden = !demo;
        t.setAttribute('aria-pressed', String(state.showDemo));
        t.textContent = state.showDemo ? 'הסתרת חודשי ההדגמה מהגרפים' : `הצגת ${num(demo)} חודשי ההדגמה בגרפים`;
    }

    function renderAnswers() {
        const d = cur();
        const tag = curDemo() ? ' (הדגמה)' : '';
        $('aHeard').textContent = num(d.city.total_cases);
        $('aHeardSub').textContent = `פניות התקבלו במוקד ב${d.month_label}${tag}`;
        const un = d.neighborhoods.rows.find(r => r.name === UNASSIGNED);
        const perDay = Math.round(d.city.total_cases / daysIn(d.month));
        $('aHeardWhy').innerHTML = `כלומר כ-<b>${num(perDay)} פניות ביום</b>.`
            + (un && !un.suppressed ? `<br><b>${num(un.cases)}</b> מהן (${pct(un.cases / d.city.total_cases * 100)}) בלי שיוך לרובע, ולכן לא במפת הרבעים.` : '');

        const rate = d.city.on_time_rate;
        $('aKept').textContent = pct(rate);
        $('aKeptSub').textContent = `טופלו בזמן שהבטחנו${tag}`;
        if (rate == null) $('aKeptWhy').textContent = '';
        else {
            const late = lateOf(d.city.total_cases, rate);
            const gap = rate - GOAL;
            $('aKeptWhy').innerHTML = `כ-<b>${num(late)} פניות</b> חיכו יותר מהזמן שהובטח.<br>`
                + (gap >= 0 ? `<span class="ok-t">${pts1(gap)} נקודות מעל</span> הרף העירוני של 80%.` : `<span class="bad-t">${pts1(gap)} נקודות מתחת</span> לרף העירוני של 80%.`);
        }
        renderHoodAnswer();
    }

    const hoodPick = name => m => findRow(m, 'neighborhoods', name)?.on_time_rate ?? null;

    function hoodSentence(row, d) {
        if (!row || row.suppressed) return 'פחות מ-5 פניות החודש, ולכן הנתונים מוסתרים.';
        if (row.on_time_rate == null) return 'אין נתון טיפול בזמן לרובע החודש.';
        const diff = row.on_time_rate - d.city.on_time_rate;
        const vsCity = Math.abs(diff) < 0.05 ? 'בדיוק כמו הממוצע העירוני'
            : `${pts1(diff)} נקודות ${diff > 0 ? 'מעל' : 'מתחת ל'}ממוצע העיר (${pct(d.city.on_time_rate)})`;
        return `${vsCity}${row.on_time_rate < GOAL ? ', ומתחת לרף של 80%' : ''}.`;
    }

    function renderHoodAnswer() {
        const d = cur();
        const row = findRow(d, 'neighborhoods', state.hood);
        const t = curDemo() ? null : trend(hoodPick(state.hood), 'on_time_rate');
        $('aHood').textContent = row?.suppressed ? 'מוסתר' : pct(row?.on_time_rate);
        $('aHoodSub').textContent = row?.suppressed ? 'פחות מ-5 פניות החודש'
            : `טופלו בזמן ב${state.hood} ב${d.month_label}${curDemo() ? ' (הדגמה)' : ''}`;
        const trendLine = curDemo() ? 'חודש הדגמה: אין כאן מסקנה על מגמה.'
            : t ? `מגמה: <b>${t.word}</b>, ${esc(t.detail)}.` : esc(oneRealMonthNote());
        $('aHoodWhy').innerHTML = `${esc(hoodSentence(row, d))}<br>${trendLine}`;
    }

    // 1. Promise vs reality: one bar per promise (topic), target line at GOAL
    function bar(rate, extraMarks = '') {
        if (rate == null) return '<div class="pbar pbar-empty" aria-hidden="true"></div>';
        const cls = rate < GOAL ? 'bad' : 'ok';
        return `<div class="pbar" aria-hidden="true"><i class="${cls}" style="inline-size:${Math.max(0, Math.min(100, rate))}%"></i><b class="goal-mark" style="inset-inline-start:${GOAL}%"></b>${extraMarks}</div>`;
    }

    function promiseSentence(t) {
        const r = t.on_time_rate, std = t.standard_text;
        if (r == null) return 'אין נתון טיפול בזמן החודש.';
        const late = lateOf(t.cases, r);
        if (late === 0) return `כל ${num(t.cases)} הפניות טופלו בתוך ${esc(std)}.`;
        const gap = r - GOAL;
        const share = `כ-<b>${num(late)} מתוך ${num(t.cases)}</b> פניות חיכו יותר ${esc(than(std))}`;
        return gap >= 0
            ? `${share}.<br><span class="ok-t">${pts1(gap)} נקודות מעל הרף.</span>`
            : `<span class="bad-t">ההבטחה לא נשמרה.</span> ${share}.<br><span class="bad-t">${pts1(gap)} נקודות מתחת לרף.</span>`;
    }

    function renderPromise() {
        const d = cur();
        let topics = d.topics.rows.filter(t => t.id !== 'other' && !t.suppressed && t.standard_text);
        if (state.psort === 'gap') topics = [...topics].sort((a, b) => (a.on_time_rate ?? 101) - (b.on_time_rate ?? 101));
        $('promiseSorted').textContent = state.psort === 'gap'
            ? 'מסודר מהנושא שהכי רחוק מההבטחה' : 'מסודר לפי כמות הפניות, מהנושא הנפוץ ביותר';
        const rated = topics.filter(t => t.on_time_rate != null);
        const kept = rated.filter(t => t.on_time_rate >= GOAL);
        const worst = [...rated].sort((a, b) => a.on_time_rate - b.on_time_rate)[0];
        const covered = topics.reduce((s, t) => s + (t.cases || 0), 0);
        $('promiseInsight').innerHTML = rated.length
            ? `<mark>${num(kept.length)} מתוך ${num(rated.length)} ההבטחות עברו את הרף.</mark>${demoTag()}<br>`
              + `הפער הגדול ביותר: <b>${esc(worst.name)}</b>, ${pct(worst.on_time_rate)} בתוך ${esc(worst.standard_text)}.<br>`
              + `<span class="note-in">${num(topics.length)} הנושאים האלה הם ${pct(covered / d.city.total_cases * 100)} מכלל הפניות; לשאר הנושאים אין פירוט בדוח.</span>`
            : 'אין החודש נושאים עם נתון טיפול בזמן.';

        $('promiseList').innerHTML = topics.map(t => {
            const reo = t.reopened_rate == null ? '' : `<span class="reo">${pct(t.reopened_rate)} נפתחו מחדש${isDemo(d, 'reopened_rate') ? ' (הדגמה)' : ''}</span>`;
            const tr = curDemo() ? null : trend(m => findRow(m, 'topics', t.id)?.on_time_rate ?? null, 'on_time_rate');
            return `<li class="pvr${t.on_time_rate != null && t.on_time_rate < GOAL ? ' is-bad' : ''}">
              <div class="pvr-head">
                <span class="t-name">${topicIcon(t.name)}<span>${esc(t.name)}<span class="t-dept">${esc(t.department)}</span></span></span>
                <span class="t-promise"><small>ההבטחה</small>תוך ${esc(t.standard_text)}</span>
                <span class="t-real"><small>המציאות</small><span class="rate${t.on_time_rate != null && t.on_time_rate < GOAL ? ' below' : ''}">${pct(t.on_time_rate)}</span></span>
              </div>
              ${bar(t.on_time_rate)}
              <p class="why">${promiseSentence(t)}</p>
              ${reo || tr ? `<p class="pvr-meta">${trendTag(tr)}${reo}</p>` : ''}
            </li>`;
        }).join('');
        $('promiseTrendNote').textContent = curDemo()
            ? 'חודש הדגמה: המספרים להמחשה בלבד, ולכן אין כאן כיוון מגמה.'
            : oneRealMonthNote() ? `${oneRealMonthNote()} עד אז כל הבטחה נמדדת מול הרף בלבד.` : '';
    }

    // Chart, or an explained empty state when there is nothing real to draw
    function trendChart(box, pts, opts, emptyText) {
        const vals = pts.filter(p => p.value != null);
        if (vals.length < 2 && !(state.showDemo && vals.length)) {
            box.classList.remove('chart');
            box.innerHTML = `<p class="chart-empty">${emptyText}</p>`;
            return;
        }
        (opts.kind === 'bars' ? Charts.bars : Charts.line)(box, pts, opts);
    }

    function renderKept() {
        const d = cur();
        const real = realPts(m => m.city.on_time_rate, 'on_time_rate');
        const lastReal = real[real.length - 1];
        trendChart($('cityOnTime'), shown(m => m.city.on_time_rate, 'on_time_rate'),
            { goal: GOAL, max: 100, fmt: v => `${v}%`, label: 'אחוז הפניות שטופלו בזמן, 12 חודשים' },
            lastReal ? `נתון אמיתי אחד: <b>${pct(lastReal.value)}</b> ב${esc(lastReal.full)}.<br>קו מגמה יופיע מהחודש האמיתי השני.` : 'אין עדיין נתון אמיתי לחודשים האלה.');
        trendChart($('cityReopened'), shown(m => m.city.reopened_rate, 'reopened_rate'),
            { min: 0, fmt: v => `${v}%`, gold: true, label: 'אחוז הפניות שנפתחו מחדש, 12 חודשים' },
            'שיעור הפניות שנפתחו מחדש <b>עדיין לא נאסף</b> במערכת המוקד.<br>עד שייאסף, אין לו נתון אמיתי להציג.');

        $('cityOnTimeNow').textContent = `${shortLabel(d.month)}: ${pct(d.city.on_time_rate)}${curDemo() ? ' (הדגמה)' : ''}`;
        $('cityReopenedNow').textContent = `${shortLabel(d.month)}: ${d.city.reopened_rate == null ? 'טרם נאסף' : pct(d.city.reopened_rate) + (isDemo(d, 'reopened_rate') ? ' (הדגמה)' : '')}`;
        const t = curDemo() ? null : trend(m => m.city.on_time_rate, 'on_time_rate');
        $('cityOnTimeWhy').innerHTML = curDemo() ? 'חודש הדגמה: אין מסקנה על מגמה.'
            : t ? `טיפול בזמן בכל העיר: <b>${t.word}</b>, ${esc(t.detail)}.` : '';
        const reoReal = realPts(m => m.city.reopened_rate, 'reopened_rate');
        $('cityReopenedWhy').innerHTML = reoReal.length
            ? 'סגירה מהירה שלא פתרה את הבעיה אינה עמידה בהבטחה, ולכן המדד מוצג לצד הטיפול בזמן.'
            : 'מה שהוצג כאן בעבר היה הדגמה. המדד חשוב, כי סגירה מהירה שלא פתרה את הבעיה אינה עמידה בהבטחה.';
        $('chartLegend').hidden = !state.showDemo;
        renderHoodGrid();
    }

    function renderHoodGrid() {
        const d = cur();
        const hoods = d.neighborhoods.rows.filter(r => r.name !== UNASSIGNED);
        const visible = hoods.filter(h => !h.suppressed && h.on_time_rate != null);
        const below = visible.filter(h => h.on_time_rate < GOAL);
        const lowest = [...visible].sort((a, b) => a.on_time_rate - b.on_time_rate)[0];
        const busiest = [...visible].sort((a, b) => b.cases - a.cases)[0];
        const city = d.city.on_time_rate;
        document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
        $('hoodLensText').textContent = state.sort === 'cases'
            ? 'כמות הפניות בכל רובע: ככל שהריבוע כהה יותר, יותר פניות'
            : 'כל רובע מול הרף של 80% ומול ממוצע העיר, מהנמוך לגבוה';
        $('hoodInsight').innerHTML = !visible.length ? '' : state.sort === 'cases'
            ? `<mark>${esc(busiest.name)} הוא הרובע עם הכי הרבה פניות: ${num(busiest.cases)}.</mark>${demoTag()}<br>כמות פניות גבוהה מלמדת על צורך או על מודעות למוקד, לא בהכרח על שירות חלש.`
            : `<mark>${below.length ? `${num(below.length)} מתוך ${num(visible.length)} רבעים מתחת לרף.` : `כל ${num(visible.length)} הרבעים עברו את הרף.`}</mark>${demoTag()}<br>`
              + `הנמוך ביותר: <b>${esc(lowest.name)}</b>, ${pct(lowest.on_time_rate)}, ${pts1(lowest.on_time_rate - city)} נקודות מתחת לממוצע העיר.`;

        const grid = $('hoodGrid');
        if (state.sort === 'rate') {
            grid.className = 'hood-rank';
            const order = [...hoods].sort((a, b) => (a.on_time_rate ?? 101) - (b.on_time_rate ?? 101));
            const cityMark = city == null ? '' : `<b class="city-mark" style="inset-inline-start:${city}%"></b>`;
            grid.innerHTML = `<p class="legend" aria-hidden="true"><span class="key-fill ok"></span>עמדו ברף <span class="key-fill bad"></span>מתחת לרף <span class="key-mark"></span>רף 80% <span class="key-city"></span>ממוצע העיר ${pct(city)}</p>`
                + order.map(h => {
                    const sel = h.name === state.hood;
                    if (h.suppressed || h.on_time_rate == null) {
                        return `<button type="button" class="hr${sel ? ' selected' : ''}" data-name="${esc(h.name)}" aria-pressed="${sel}"><span class="hr-name">${esc(h.name)}</span><span class="hr-val">מוסתר</span><span class="hr-bar"></span><span class="hr-why">פחות מ-5 פניות</span></button>`;
                    }
                    const t = curDemo() ? null : trend(hoodPick(h.name), 'on_time_rate');
                    const diff = h.on_time_rate - city;
                    return `<button type="button" class="hr${h.on_time_rate < GOAL ? ' is-bad' : ''}${sel ? ' selected' : ''}" data-name="${esc(h.name)}" aria-pressed="${sel}">
                        <span class="hr-name">${esc(h.name)}</span>
                        <span class="hr-val"><span class="rate${h.on_time_rate < GOAL ? ' below' : ''}">${pct(h.on_time_rate)}</span></span>
                        <span class="hr-bar">${bar(h.on_time_rate, cityMark)}</span>
                        <span class="hr-why">${Math.abs(diff) < 0.05 ? 'כמו ממוצע העיר' : `${pts1(diff)} ${diff > 0 ? 'מעל' : 'מתחת ל'}ממוצע העיר`} · ${num(h.cases)} פניות${t ? ` · <b class="trend-${t.dir}">${t.word}</b>` : ''}</span>
                      </button>`;
                }).join('');
        } else {
            grid.className = 'hood-grid';
            const maxCases = Math.max(...hoods.map(h => h.cases || 0));
            const sorted = [...hoods].sort((a, b) => (b.cases ?? -1) - (a.cases ?? -1));
            grid.innerHTML = sorted.map(h => {
                const sel = h.name === state.hood;
                if (h.suppressed) {
                    return `<button type="button" class="hood${sel ? ' selected' : ''}" data-name="${esc(h.name)}" aria-pressed="${sel}"><span class="h-name">${esc(h.name)}</span><span class="h-meta">פחות מ-5 פניות</span></button>`;
                }
                // Pulse: 5 shades, darker = more cases (sqrt spreads the many small neighborhoods)
                const step = Math.min(4, Math.floor(Math.sqrt(h.cases / maxCases) * 5));
                const dark = step >= 3 ? ' dark' : '';
                const below = h.on_time_rate != null && h.on_time_rate < GOAL ? ' below' : '';
                return `<button type="button" class="hood p${step}${dark}${below}${sel ? ' selected' : ''}" data-name="${esc(h.name)}" aria-pressed="${sel}">
                          <span class="h-name">${esc(h.name)}</span>
                          <span class="h-meta">${num(h.cases)} פניות · <span class="h-rate">${pct(h.on_time_rate)}</span>${below ? '<span class="sr"> מתחת לרף</span>' : ''}</span>
                        </button>`;
            }).join('');
        }
        const un = d.neighborhoods.rows.find(r => r.name === UNASSIGNED);
        $('hoodDetail').dataset.unassigned = un && !un.suppressed
            ? `בנוסף, ${num(un.cases)} פניות ב${d.month_label} לא שויכו לרובע.` : '';
        renderHoodDetail();
    }

    function renderHoodDetail() {
        const d = cur();
        const row = findRow(d, 'neighborhoods', state.hood);
        const t = curDemo() ? null : trend(hoodPick(state.hood), 'on_time_rate');
        const box = $('hoodDetail');
        const city = d.city.on_time_rate;
        const trendLine = curDemo() ? 'חודש הדגמה: אין כאן מסקנה על מגמה.'
            : t ? `האם הרובע משתפר? <b>${t.word}</b>, ${esc(t.detail)}.` : esc(oneRealMonthNote());
        const realRate = realPts(hoodPick(state.hood), 'on_time_rate');
        const lastReal = realRate[realRate.length - 1];
        box.innerHTML = `
            <h4>${esc(state.hood)}${demoTag()}</h4>
            <div aria-live="polite">
              <p class="verdict">${row?.on_time_rate != null && !row.suppressed ? `<b>${pct(row.on_time_rate)}</b> טופלו בזמן: ` : ''}${esc(hoodSentence(row, d))}</p>
              <p class="verdict">${trendLine}</p>
            </div>
            ${row && !row.suppressed && row.on_time_rate != null ? `<div class="pvr-solo">${bar(row.on_time_rate, city == null ? '' : `<b class="city-mark" style="inset-inline-start:${city}%"></b>`)}<p class="legend" aria-hidden="true"><span class="key-mark"></span>רף 80% <span class="key-city"></span>ממוצע העיר ${pct(city)}</p></div>` : ''}
            <div class="stats">
              <span><strong>${row?.suppressed ? '—' : num(row.cases)}</strong> פניות</span>
              <span><strong>${row?.suppressed ? '—' : num(lateOf(row.cases, row.on_time_rate ?? 100))}</strong> חיכו יותר מהמובטח (הערכה)</span>
              <span>${row?.reopened_rate == null ? 'נפתחו מחדש: טרם נאסף' : `<strong>${pct(row.reopened_rate)}</strong> נפתחו מחדש${isDemo(d, 'reopened_rate') ? ' (הדגמה)' : ''}`}</span>
            </div>
            <div class="charts-2">
              <figure class="chart-card"><figcaption>טופלו בזמן, 12 חודשים <span class="fig-now">${pct(row?.on_time_rate)}</span></figcaption><div id="hoodRate"></div></figure>
              <figure class="chart-card"><figcaption>כמות פניות, 12 חודשים <span class="fig-now">${row?.suppressed ? '—' : num(row.cases)}</span></figcaption><div id="hoodCases"></div></figure>
            </div>
            <p class="legend">${esc(box.dataset.unassigned || '')}</p>`;
        trendChart($('hoodRate'), shown(hoodPick(state.hood), 'on_time_rate'),
            { goal: GOAL, max: 100, fmt: x => `${x}%`, label: `טיפול בזמן ב${state.hood}` },
            lastReal ? `נתון אמיתי אחד: <b>${pct(lastReal.value)}</b> ב${esc(lastReal.full)}.<br>קו מגמה יופיע מהחודש האמיתי השני.` : 'אין עדיין נתון אמיתי לרובע.');
        const realCases = realPts(m => findRow(m, 'neighborhoods', state.hood)?.cases ?? null, 'cases');
        const lastCases = realCases[realCases.length - 1];
        trendChart($('hoodCases'), shown(m => findRow(m, 'neighborhoods', state.hood)?.cases ?? null, 'cases'),
            { kind: 'bars', label: `כמות פניות ב${state.hood}` },
            lastCases ? `נתון אמיתי אחד: <b>${num(lastCases.value)} פניות</b> ב${esc(lastCases.full)}.<br>השוואה בין חודשים תופיע מהחודש האמיתי השני.` : 'אין עדיין נתון אמיתי לרובע.');
    }

    function renderWeak() {
        const d = cur();
        const weakest = d.topics.rows
            .filter(t => t.id !== 'other' && t.on_time_rate != null)
            .sort((a, b) => a.on_time_rate - b.on_time_rate)
            .slice(0, 3);
        const draft = state.actions.draft ? '<span class="tag">טיוטה</span>' : '';
        $('weakList').innerHTML = weakest.map(t => {
            const a = state.actions.items.find(x => x.topic_id === t.id);
            return `<article class="weak">
                <h3>${topicIcon(t.name)}${esc(t.name)}${draft}${demoTag()}</h3>
                <p class="w-rate">טופלו בזמן: <strong${t.on_time_rate < GOAL ? ' class="bad"' : ''}>${pct(t.on_time_rate)}</strong> · ההבטחה: תוך ${esc(t.standard_text)}</p>
                ${bar(t.on_time_rate)}
                <p class="why">${promiseSentence(t)}</p>
                ${a ? `<dl>
                    <dt>מה הבעיה</dt><dd class="tone-problem">${esc(a.problem)}</dd>
                    <dt>מה עושים</dt><dd class="tone-solution">${esc(a.action)}</dd>
                    <dt>עד מתי</dt><dd class="w-date">${esc(monthYear(a.target_date))}</dd>
                  </dl>` : '<p class="empty">תוכנית הפעולה בהכנה ותפורסם כאן.</p>'}
              </article>`;
        }).join('');
    }

    function renderVoice() {
        const list = state.stories.months[state.current] || [];
        $('voice').hidden = !list.length;
        $('tocVoice').hidden = !list.length;
        const draft = state.stories.draft ? '<span class="tag">טיוטה</span>' : '';
        $('storyList').innerHTML = list.map(s => `
            <article class="story">
              <p class="s-where">${topicIcon(s.topic)}${esc(s.neighborhood)} · ${esc(s.topic)}${draft}</p>
              <p><span class="s-label">אמרתם:</span>${esc(s.you_said)}</p>
              <p class="s-did"><span class="s-label">עשינו:</span>${esc(s.we_did)}</p>
            </article>`).join('');
    }

    function renderMethod() {
        const d = cur();
        const v = d.verification;
        $('verifiedNote').textContent = v
            ? `כל מספר בדף נבנה אוטומטית מ${v.source}${v.checks_passed != null ? `, עבר ${v.checks_passed} בדיקות התאמה בין טבלאות הדוח` : ''}, ונבדק מול הדשבורד הניהולי של העירייה.`
            : `נתוני ${d.month_label} הם נתוני הדגמה, ולכן לא נבדקו מול דוח.`;
        $('minCell').textContent = d.min_cell_size;
        $('updatedOn').textContent = `${dateLabel(state.index.updated_on)} · נתוני ${d.month_label} הופקו ב-${dateLabel(d.exported_on)}`;
        const gaps = [];
        if (realPts(m => m.city.reopened_rate, 'reopened_rate').length === 0) gaps.push('שיעור הפניות שנפתחו מחדש עדיין לא נאסף במערכת המוקד.');
        const other = d.topics.rows.find(t => t.id === 'other');
        if (other?.cases) gaps.push(`${num(other.cases)} פניות (${pct(other.cases / d.city.total_cases * 100)}) שייכות לנושאים שאין להם בדוח זמן טיפול מובטח, ולכן הן נספרות בסך הכול אבל לא בהשוואה להבטחה.`);
        if (realMonths().length < 2) gaps.push(oneRealMonthNote());
        $('gapsNote').textContent = gaps.join(' ') || 'אין כרגע מדדים חסרים.';
    }

    function renderAll() {
        // In a demo month every interpreting sentence carries a visible "הדגמה" prefix (CSS)
        document.body.classList.toggle('is-demo', curDemo());
        renderTruth();
        renderAnswers();
        renderPromise();
        renderKept();
        renderWeak();
        renderVoice();
        renderMethod();
    }

    function setHood(name) {
        state.hood = name;
        $('hoodSelect').value = name;
        renderHoodAnswer();
        renderHoodGrid();
    }

    // Opened from the dashboard or the upload page: show a way back (residents never see it)
    function showBackLink() {
        const from = new URLSearchParams(location.search).get('from');
        const back = { dashboard: ['/', 'חזרה לדשבורד'], admin: ['/admin', 'חזרה להעלאת הדוחות'] }[from];
        if (!back) return;
        $('backLink').href = back[0];
        $('backLink').querySelector('span').textContent = back[1];
        $('backLink').hidden = false;
    }

    // Keep the shareable address in step with what is on screen
    function syncUrl() {
        const q = new URLSearchParams(location.search);
        q.set('month', state.current);
        if (state.showDemo) q.set('demo', '1'); else q.delete('demo');
        history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
    }

    function bind() {
        showBackLink();
        const ms = $('monthSelect');
        ms.innerHTML = [...state.index.months].reverse()
            .map(m => `<option value="${m.month}">${esc(m.month_label)}${m.data_status === 'demo' ? ' (הדגמה)' : ' (נתוני אמת)'}</option>`).join('');
        ms.value = state.current;
        ms.addEventListener('change', () => { state.current = ms.value; syncUrl(); renderAll(); });

        const hoods = cur().neighborhoods.rows.map(r => r.name).filter(n => n !== UNASSIGNED);
        const hs = $('hoodSelect');
        hs.innerHTML = [...hoods].sort((a, b) => a.localeCompare(b, 'he')).map(n => `<option>${esc(n)}</option>`).join('');
        state.hood = hoods[0];
        try { const saved = localStorage.getItem('moked106.hood'); if (saved && hoods.includes(saved)) state.hood = saved; } catch { /* storage unavailable */ }
        hs.value = state.hood;
        hs.addEventListener('change', () => { remember(hs.value); setHood(hs.value); });

        $('hoodGrid').addEventListener('click', e => {
            const b = e.target.closest('[data-name]');
            if (!b) return;
            remember(b.dataset.name);
            setHood(b.dataset.name);
            $('hoodDetail').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
        });
        document.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
            state.sort = b.dataset.sort;
            renderHoodGrid();
        }));
        document.querySelectorAll('[data-psort]').forEach(b => b.addEventListener('click', () => {
            state.psort = b.dataset.psort;
            document.querySelectorAll('[data-psort]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            renderPromise();
        }));
        $('demoToggle').addEventListener('click', () => {
            state.showDemo = !state.showDemo;
            syncUrl();
            renderTruth();
            renderKept();
        });
    }

    function remember(name) {
        try { localStorage.setItem('moked106.hood', name); } catch { /* storage unavailable */ }
    }

    load()
        .then(() => { bind(); renderAll(); })
        .catch(err => {
            console.error(err);
            $('demoNotice').hidden = false;
            $('demoNotice').setAttribute('role', 'alert');
            $('demoNotice').textContent = 'לא הצלחנו לטעון את נתוני הדוח. בדקו את החיבור לאינטרנט ורעננו את הדף.';
        });
})();
