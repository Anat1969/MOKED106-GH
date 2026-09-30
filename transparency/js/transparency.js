// Public transparency page. Reads ONLY monthly aggregated exports: the ones published
// by the upload function (storage public/) and the bundled ones (public_data/, demo
// history until real months accumulate), plus the editable content files (content/).
// Never reads internal data.
(() => {
    const STORAGE_PUBLIC = 'https://cbhexpybdggwzyakgagd.supabase.co/storage/v1/object/authenticated/moked106/public/';
    const STORAGE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGV4cHliZGdnd3p5YWtnYWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkzMjksImV4cCI6MjA5MTMyNTMyOX0.X1b7pLyig-bGfxM7XjmwH0TqiuhqoS_o-Czg5qdsN6o';
    const GOAL = 80;              // minimum on-time rate the city reports against
    const TREND_MONTHS = 12;
    const IMPROVE_POINTS = 1;     // change (in points) that counts as "improving"/"declining"
    const UNASSIGNED = 'ללא שיוך לרובע';
    const SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
    const LONG = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    const $ = id => document.getElementById(id);
    const num = n => n.toLocaleString('he-IL');
    const pct = v => (v == null ? '—' : `${v.toFixed(1)}%`);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const shortLabel = ym => `${SHORT[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
    const dateLabel = iso => { const d = new Date(iso); return `${d.getDate()} ב${LONG[d.getMonth()]} ${d.getFullYear()}`; };
    const monthYear = iso => `${LONG[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

    const state = { index: null, months: {}, actions: null, stories: null, current: null, hood: null, sort: 'cases' };

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
        state.current = [...months].reverse().find(m => m.data_status === 'real')?.month || state.index.latest;
    }

    // The 12 months ending at the selected month (only those that exist)
    function window12() {
        const all = state.index.months.map(m => m.month);
        const end = all.indexOf(state.current);
        return all.slice(Math.max(0, end - TREND_MONTHS + 1), end + 1).map(ym => state.months[ym]);
    }
    const isDemo = (d, metric) => d.data_status === 'demo' || d.provenance[metric] === 'demo';
    const series = (pick, metric) => window12().map(d => ({
        label: shortLabel(d.month), full: d.month_label, value: pick(d), demo: isDemo(d, metric),
    }));
    const findRow = (d, table, key) => d[table].rows.find(r => (r.id ?? r.name) === key);

    function renderNotice() {
        const months = window12();
        const demoMonths = months.filter(d => d.data_status === 'demo').length;
        const cur = state.months[state.current];
        const parts = [];
        if (cur.data_status === 'demo') parts.push(`נתוני ${cur.month_label} הם נתוני הדגמה.`);
        else if (demoMonths) parts.push(`גרסת הדגמה: נתוני ${cur.month_label} אמיתיים; ${demoMonths} החודשים שלפניו הם נתוני הדגמה עד שיצטברו נתוני אמת.`);
        if (cur.provenance.reopened_rate === 'demo' && cur.data_status !== 'demo') parts.push('שיעור הפניות שנפתחו מחדש עדיין אינו נאסף במערכת ומוצג כנתון הדגמה.');
        if (cur.provenance.reopened_rate === 'not_collected') parts.push('שיעור הפניות שנפתחו מחדש עדיין אינו נאסף במערכת המוקד; בגרף שלו מופיעים רק ערכי הדגמה של חודשים קודמים.');
        if (state.actions.draft || state.stories.draft) parts.push('התכנים בסעיפים 3 ו-4 הם טיוטה לאישור.');
        $('demoNotice').hidden = !parts.length;
        $('demoNotice').textContent = parts.join(' ');
    }

    function renderAnswers() {
        const d = state.months[state.current];
        $('aHeard').textContent = num(d.city.total_cases);
        $('aHeardSub').textContent = `פניות התקבלו במוקד ב${d.month_label}`;
        $('aKept').textContent = pct(d.city.on_time_rate);
        const reo = d.city.reopened_rate;
        $('aKeptSub').textContent = `טופלו בזמן שהבטחנו` + (reo != null ? ` · ${pct(reo)} נפתחו מחדש${isDemo(d, 'reopened_rate') ? ' (הדגמה)' : ''}` : '');
        renderHoodAnswer();
    }

    function hoodTrend(name) {
        return series(d => findRow(d, 'neighborhoods', name)?.on_time_rate ?? null, 'on_time_rate');
    }

    function verdict(name) {
        const pts = hoodTrend(name).filter(p => p.value != null);
        if (pts.length < 2) return { text: 'אין עדיין מספיק חודשים להשוואה', cls: '' };
        const first = pts[0], last = pts[pts.length - 1];
        const diff = last.value - first.value;
        const size = Math.abs(diff).toFixed(1);
        const since = `לעומת ${first.full}`;
        if (diff >= IMPROVE_POINTS) return { short: 'משתפרת', detail: `עלייה של ${size} נקודות ${since}`, text: `כן – עלייה של ${size} נקודות ${since}` };
        if (diff <= -IMPROVE_POINTS) return { short: 'יורדת', detail: `ירידה של ${size} נקודות ${since}`, text: `עדיין לא – ירידה של ${size} נקודות ${since}` };
        const detail = diff === 0 ? `ללא שינוי ${since}` : `${diff > 0 ? 'עלייה' : 'ירידה'} קלה של ${size} נקודות ${since}`;
        return { short: 'יציבה', detail, text: `יציבה – ${detail}` };
    }

    function renderHoodAnswer() {
        const d = state.months[state.current];
        const row = findRow(d, 'neighborhoods', state.hood);
        const v = verdict(state.hood);
        $('aHood').textContent = row?.suppressed ? 'מוסתר' : (v.short || pct(row?.on_time_rate));
        $('aHoodSub').textContent = row?.suppressed
            ? 'פחות מ-5 פניות החודש'
            : `${pct(row?.on_time_rate)} טופלו בזמן ב${d.month_label}` + (v.detail ? ` · ${v.detail}` : '');
    }

    function renderPromise() {
        const d = state.months[state.current];
        const topics = d.topics.rows.filter(t => t.id !== 'other' && !t.suppressed && t.standard_text);
        $('promiseList').innerHTML = topics.map(t => `
            <li>
              <span class="t-name">${esc(t.name)}<span class="t-dept">${esc(t.department)}</span></span>
              <span class="t-std"><small>נטפל תוך</small>${esc(t.standard_text)}</span>
            </li>`).join('');
    }

    function rateCell(v) {
        if (v == null) return '<span class="rate">—</span>';
        const below = v < GOAL ? ' below' : '';
        return `<span class="rate${below}">${pct(v)}${below ? '<small>מתחת לרף</small>' : ''}</span>
                <div class="meter${below}"><i style="width:${v}%"></i><b></b></div>`;
    }

    function renderKept() {
        Charts.line($('cityOnTime'), series(d => d.city.on_time_rate, 'on_time_rate'),
            { goal: GOAL, max: 100, fmt: v => `${v}%`, label: 'אחוז הפניות שטופלו בזמן, 12 חודשים' });
        Charts.line($('cityReopened'), series(d => d.city.reopened_rate, 'reopened_rate'),
            { min: 0, fmt: v => `${v}%`, gold: true, label: 'אחוז הפניות שנפתחו מחדש, 12 חודשים' });

        const d = state.months[state.current];
        const reoDemo = isDemo(d, 'reopened_rate');
        $('cityOnTimeNow').textContent = `${shortLabel(d.month)}: ${pct(d.city.on_time_rate)}`;
        $('cityReopenedNow').textContent = `${shortLabel(d.month)}: ${d.city.reopened_rate == null ? 'טרם נאסף' : pct(d.city.reopened_rate)}`;
        $('reoTag').hidden = !reoDemo;
        const rows = d.topics.rows.filter(t => t.id !== 'other');
        $('topicRows').innerHTML = rows.map((t, i) => t.suppressed
            ? `<tr><td>${esc(t.name)}</td><td colspan="3" class="empty">פחות מ-5 פניות – מוסתר</td></tr>`
            : `<tr>
                <td>${esc(t.name)}</td>
                <td>${rateCell(t.on_time_rate)}</td>
                <td>${t.reopened_rate == null ? '<span class="empty">טרם נאסף</span>' : `<span class="rate">${pct(t.reopened_rate)}</span>`}</td>
                <td class="spark" data-i="${i}"></td>
              </tr>`).join('');
        rows.forEach((t, i) => {
            const cell = document.querySelector(`#topicRows td.spark[data-i="${i}"]`);
            if (cell) Charts.spark(cell, series(m => findRow(m, 'topics', t.id)?.on_time_rate ?? null, 'on_time_rate'),
                { goal: GOAL, label: `מגמת טיפול בזמן: ${t.name}` });
        });
        renderHoodGrid();
    }

    function renderHoodGrid() {
        const d = state.months[state.current];
        const hoods = d.neighborhoods.rows.filter(r => r.name !== UNASSIGNED);
        const maxCases = Math.max(...hoods.map(h => h.cases || 0));
        const sorted = [...hoods].sort((a, b) => state.sort === 'cases'
            ? (b.cases ?? -1) - (a.cases ?? -1)
            : (a.on_time_rate ?? 101) - (b.on_time_rate ?? 101));
        $('hoodGrid').innerHTML = sorted.map(h => {
            if (h.suppressed) {
                return `<button type="button" class="hood" data-name="${esc(h.name)}"><span class="h-name">${esc(h.name)}</span><span class="h-meta">פחות מ-5 פניות</span></button>`;
            }
            // Pulse: 5 shades, darker = more cases (sqrt spreads the many small neighborhoods)
            const step = Math.min(4, Math.floor(Math.sqrt(h.cases / maxCases) * 5));
            const dark = step >= 3 ? ' dark' : '';
            const below = h.on_time_rate != null && h.on_time_rate < GOAL ? ' below' : '';
            const sel = h.name === state.hood ? ' selected' : '';
            return `<button type="button" class="hood p${step}${dark}${below}${sel}" data-name="${esc(h.name)}" aria-pressed="${!!sel}">
                      <span class="h-name">${esc(h.name)}</span>
                      <span class="h-meta">${num(h.cases)} פניות · <span class="h-rate">${pct(h.on_time_rate)}</span></span>
                    </button>`;
        }).join('');
        const un = d.neighborhoods.rows.find(r => r.name === UNASSIGNED);
        $('hoodDetail').dataset.unassigned = un && !un.suppressed
            ? `בנוסף, ${num(un.cases)} פניות ב${d.month_label} לא שויכו לרובע.` : '';
        renderHoodDetail();
    }

    function renderHoodDetail() {
        const d = state.months[state.current];
        const row = findRow(d, 'neighborhoods', state.hood);
        const v = verdict(state.hood);
        const box = $('hoodDetail');
        box.innerHTML = `
            <h4>${esc(state.hood)}</h4>
            <p class="verdict">${row?.suppressed ? 'פחות מ-5 פניות החודש – הנתונים מוסתרים.' : `האם הרובע משתפר? ${esc(v.text)}.`}</p>
            <div class="stats">
              <span><strong>${row?.suppressed ? '—' : num(row.cases)}</strong> פניות</span>
              <span><strong>${pct(row?.on_time_rate)}</strong> טופלו בזמן</span>
              <span>${row?.reopened_rate == null ? 'נפתחו מחדש: טרם נאסף' : `<strong>${pct(row.reopened_rate)}</strong> נפתחו מחדש${isDemo(d, 'reopened_rate') ? ' (הדגמה)' : ''}`}</span>
            </div>
            <div class="charts-2">
              <figure class="chart-card"><figcaption>טופלו בזמן – 12 חודשים <span class="fig-now">${pct(row?.on_time_rate)}</span></figcaption><div id="hoodRate"></div></figure>
              <figure class="chart-card"><figcaption>כמות פניות – 12 חודשים <span class="fig-now">${row?.suppressed ? '—' : num(row.cases)}</span></figcaption><div id="hoodCases"></div></figure>
            </div>
            <p class="legend">${esc(box.dataset.unassigned || '')}</p>`;
        Charts.line($('hoodRate'), hoodTrend(state.hood), { goal: GOAL, max: 100, fmt: x => `${x}%`, label: `טיפול בזמן ב${state.hood}` });
        Charts.bars($('hoodCases'), series(m => findRow(m, 'neighborhoods', state.hood)?.cases ?? null, 'cases'),
            { label: `כמות פניות ב${state.hood}` });
    }

    function renderWeak() {
        const d = state.months[state.current];
        const weakest = d.topics.rows
            .filter(t => t.id !== 'other' && t.on_time_rate != null)
            .sort((a, b) => a.on_time_rate - b.on_time_rate)
            .slice(0, 3);
        const draft = state.actions.draft ? '<span class="tag">טיוטה</span>' : '';
        $('weakList').innerHTML = weakest.map(t => {
            const a = state.actions.items.find(x => x.topic_id === t.id);
            return `<article class="weak">
                <h4>${esc(t.name)}${draft}</h4>
                <p class="w-rate">טופלו בזמן: <strong${t.on_time_rate < GOAL ? ' class="bad"' : ''}>${pct(t.on_time_rate)}</strong> · ההבטחה: תוך ${esc(t.standard_text)}</p>
                ${a ? `<dl>
                    <dt>מה הבעיה</dt><dd>${esc(a.problem)}</dd>
                    <dt>מה עושים</dt><dd>${esc(a.action)}</dd>
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
              <p class="s-where">${esc(s.neighborhood)} · ${esc(s.topic)}${draft}</p>
              <p><span class="s-label">אמרתם:</span>${esc(s.you_said)}</p>
              <p class="s-did"><span class="s-label">עשינו:</span>${esc(s.we_did)}</p>
            </article>`).join('');
    }

    function renderMethod() {
        const d = state.months[state.current];
        $('minCell').textContent = d.min_cell_size;
        $('updatedOn').textContent = `${dateLabel(state.index.updated_on)} · נתוני ${d.month_label} הופקו ב-${dateLabel(d.exported_on)}`;
    }

    function renderAll() {
        renderNotice();
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

    function bind() {
        const ms = $('monthSelect');
        ms.innerHTML = [...state.index.months].reverse()
            .map(m => `<option value="${m.month}">${esc(m.month_label)}${m.data_status === 'demo' ? ' (הדגמה)' : ''}</option>`).join('');
        ms.value = state.current;
        ms.addEventListener('change', () => { state.current = ms.value; renderAll(); });

        const hoods = state.months[state.current].neighborhoods.rows.map(r => r.name).filter(n => n !== UNASSIGNED);
        const hs = $('hoodSelect');
        hs.innerHTML = [...hoods].sort((a, b) => a.localeCompare(b, 'he')).map(n => `<option>${esc(n)}</option>`).join('');
        state.hood = hoods[0];
        try { const saved = localStorage.getItem('moked106.hood'); if (saved && hoods.includes(saved)) state.hood = saved; } catch { /* storage unavailable */ }
        hs.value = state.hood;
        hs.addEventListener('change', () => { remember(hs.value); setHood(hs.value); });

        $('hoodGrid').addEventListener('click', e => {
            const b = e.target.closest('.hood');
            if (!b) return;
            remember(b.dataset.name);
            setHood(b.dataset.name);
            $('hoodDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        document.querySelectorAll('.sort-row button').forEach(b => b.addEventListener('click', () => {
            state.sort = b.dataset.sort;
            document.querySelectorAll('.sort-row button').forEach(x => x.classList.toggle('on', x === b));
            renderHoodGrid();
        }));
    }

    function remember(name) {
        try { localStorage.setItem('moked106.hood', name); } catch { /* storage unavailable */ }
    }

    load()
        .then(() => { bind(); renderAll(); })
        .catch(err => {
            console.error(err);
            $('demoNotice').hidden = false;
            $('demoNotice').textContent = 'לא הצלחנו לטעון את נתוני הדוח. נסו לרענן את הדף.';
        });
})();
