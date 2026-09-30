// Director's dashboard. Every number shown is derived from the selected month's
// report upload (API.month); nothing month-specific is hardcoded here.
const State = { month: null, prev: null, trends: null, heatmap: null, coords: {} };

document.addEventListener('DOMContentLoaded', () => {
    Sidebar.init();

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
            Sidebar.update(tabId);

            if (tabId === 'map' && State.heatmap) {
                setTimeout(() => {
                    MapView.init(State.heatmap);
                    MapView.map.invalidateSize();
                }, 100);
            }
        });
    });

    document.querySelectorAll('.issues-toggle .btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.issues-toggle .btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderIssues(btn.dataset.filter);
        });
    });

    document.getElementById('monthSelect').addEventListener('change', e => {
        const url = new URL(location.href);
        url.searchParams.set('month', e.target.value);
        history.replaceState(null, '', url);
        showMonth(e.target.value);
    });

    start();
});

function setInsight(id, html) {
    document.getElementById(id).innerHTML = html;
}

const fmtN = n => (n == null ? '—' : Number(n).toLocaleString());
const share = (part, total) => (total ? `${(part / total * 100).toFixed(1)}%` : '—');

async function start() {
    try {
        await API.loadIndex();
        const months = API.months();
        const sel = document.getElementById('monthSelect');
        sel.innerHTML = [...months].reverse().map(ym => `<option value="${ym}">${MokedCore.monthLabel(ym)}</option>`).join('');
        const wanted = new URLSearchParams(location.search).get('month');
        const ym = months.includes(wanted) ? wanted : months[months.length - 1];
        sel.value = ym;
        State.coords = await API.streetCoords();
        await showMonth(ym);
    } catch (err) {
        console.error('Failed to load data:', err);
        document.getElementById('sourceBadge').textContent = 'שגיאה בטעינת הנתונים';
    }
}

async function showMonth(ym) {
    const m = await API.month(ym);
    const prevYm = MokedCore.prevMonthOf(ym);
    const prev = API.months().includes(prevYm) ? await API.month(prevYm) : null;
    State.month = m;
    State.prev = prev;
    State.trends = MokedCore.compareMonths(m, prev);
    Tables.total = m.summary.total_calls;
    Tables.trends = State.trends;
    Charts.labels = { current: m.month_label, prevYear: m.summary.prev_year ? `ממוצע ${m.summary.prev_year}` : 'שנה קודמת' };
    renderAll(m, prev, State.trends);
}

function versionText(m) {
    const v = m.version || {};
    if (API.source === 'bundled') return 'גרסה מובנית באפליקציה (עד העלאה ראשונה)';
    const when = v.uploaded_at ? new Date(v.uploaded_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const count = API.index.months[m.month]?.versions?.length || 1;
    return `גרסה שהועלתה ${when}${count > 1 ? ` (מתוך ${count} גרסאות)` : ''}`;
}

function renderAll(m, prev, t) {
    const summary = View.summary(m);
    const managers = View.managers(m);
    const departments = View.departments(m);
    const topIssues = View.topIssues(m);
    const critical = View.criticalIssues(m);
    const heatmap = View.heatmap(m);
    const districts = View.districts(m);
    const total = summary.total_calls;
    State.heatmap = heatmap;

    // === Header / sources ===
    const period = m.period ? `${m.period}` : '';
    document.getElementById('sourceBadge').textContent = `מקור: דוח מוקד עירוני ${m.month_label} · ${versionText(m)}`;
    document.getElementById('overviewSource').textContent = `דוח מוקד עירוני 106, ${m.month_label}${period ? ` (${period})` : ''}. ${(m.version?.files || []).join(' · ')}`;
    document.getElementById('footerText').textContent = `מוקד עירוני 106 אשדוד — דשבורד ניהולי | ${m.month_label}${period ? ` (${period})` : ''}`;
    document.getElementById('prevYearTh').textContent = summary.sla_prev_year != null && m.summary.prev_year ? `תקן ${m.summary.prev_year}` : 'תקן שנה קודמת';

    // === KPIs ===
    const topShare = share(topIssues.reduce((s, x) => s + x.total_calls, 0), total);
    document.getElementById('totalCalls').textContent = fmtN(total);
    document.getElementById('totalCallsLabel').textContent = `סה"כ פניות ב${m.month_label}`;
    const callsCh = t?.summary.calls;
    setInsight('totalCallsInsight',
        `<strong>מטרה: מעקב אחר נפח הפניות החודשי.</strong><br>` +
        `סה"כ ${fmtN(total)} פניות ב${m.month_label}.<br>` +
        (callsCh
            ? `${trendCell(callsCh)} <span>ביחס ל${t.prev_label} (${fmtN(callsCh.prev)}).</span><br>`
            : `<span class="muted">השוואה לחודש קודם תוצג אחרי העלאת ${MokedCore.monthLabel(MokedCore.prevMonthOf(m.month))}.</span><br>`) +
        `${topIssues.length} נושאים מובילים מהווים ${topShare} מכלל הפניות.`
    );

    const slaPctEl = document.getElementById('slaPercent');
    slaPctEl.textContent = summary.sla_percent + '%';
    slaPctEl.style.color = summary.sla_percent >= 90 ? '#2E7D32' : summary.sla_percent >= 80 ? '#EF6C00' : '#C62828';
    setInsight('slaInsight', `תקן יעד: 80% לכל מנהל. ממוצע כלל הפניות.` +
        (t?.summary.sla ? `<br>${trendCell(t.summary.sla, '%')} ביחס ל${t.prev_label} במערכת.` : ''));

    const slaChangeEl = document.getElementById('slaChange');
    slaChangeEl.innerHTML = summary.sla_change == null ? '—' : reportChangeCell(summary.sla_change, true);
    setInsight('slaChangeInsight', summary.sla_change == null ? 'הדוח לא כולל שינוי מחודש קודם.'
        : summary.sla_change < 0
            ? `ירידה של ${Math.abs(summary.sla_change)}% בעמידה בתקן ביחס לחודש הקודם (לפי הדוח).<br>סימן לצורך בבדיקה.`
            : `שיפור של ${summary.sla_change}% בעמידה בתקן ביחס לחודש הקודם (לפי הדוח).`);

    const totalOverdue = summary.overdue_open ?? managers.reduce((s, x) => s + (x.overdue_open || 0), 0);
    document.getElementById('totalOverdue').textContent = fmtN(totalOverdue);
    const topOverdue = [...managers].sort((a, b) => (b.overdue_open || 0) - (a.overdue_open || 0))[0];
    setInsight('overdueInsight',
        `${fmtN(totalOverdue)} פניות חורגות ופתוחות מתוך ${fmtN(total)} (${share(totalOverdue, total)}).<br>` +
        `רוב החריגות ב${topOverdue.name} (${fmtN(topOverdue.overdue_open)}).` +
        (t?.summary.overdue ? `<br>${trendCell(t.summary.overdue)} ביחס ל${t.prev_label}.` : ''));

    // === Overview charts ===
    const topMgr = managers[0];
    setInsight('managersChartInsight',
        `<strong>מטרה: הבנת חלוקת העומס בין המנהלים.</strong><br>` +
        `${topMgr.name} מטפל ב-${share(topMgr.total_calls, total)} מכלל הפניות (${fmtN(topMgr.total_calls)} פניות).`);
    Charts.managersDonut('managersChart', managers);

    const topIssue = [...topIssues].sort((a, b) => b.total_calls - a.total_calls)[0];
    setInsight('topIssuesChartInsight',
        `<strong>מטרה: זיהוי הנושאים עם הכי הרבה פניות.</strong><br>` +
        `הנושא המוביל: ${topIssue.issue_name} עם ${fmtN(topIssue.total_calls)} פניות (${share(topIssue.total_calls, total)} מסה"כ).`);
    Charts.topIssuesLine('topIssuesChart', topIssues, total);

    const deptShare = share(departments.reduce((s, d) => s + d.total_calls, 0), total);
    if (departments.length) {
        const topDept = departments[0];
        setInsight('deptChartInsight',
            `<strong>מטרה: זיהוי המחלקות שנושאות את עיקר העומס.</strong><br>` +
            `${topDept.name} מובילה עם ${fmtN(topDept.total_calls)} פניות (${share(topDept.total_calls, total)} מסה"כ).<br>` +
            `${departments.length} מחלקות מובילות מהוות ${deptShare} מכלל הפניות.`);
        const below85 = departments.filter(d => d.sla_percent < 85);
        const above90 = departments.filter(d => d.sla_percent >= 90);
        const below80 = departments.filter(d => d.sla_percent < 80);
        setInsight('deptSlaInsight',
            `<strong>מטרה: מי עומד ביעד 80% ומי חורג.</strong><br>` +
            `${above90.length} מחלקות מעל 90% עמידה בתקן.<br>` +
            `${below80.length ? below80.map(d => d.name).join(', ') + ' מתחת ל-80%.' : below85.length ? below85.map(d => d.name).join(', ') + ' מתחת ל-85%.' : 'כל המחלקות מעל 85%.'}<br>` +
            `תקן יעד: 80%.`);
    } else {
        setInsight('deptChartInsight', 'בדוח של חודש זה לא נמצא דוח 20/80 מחלקות.');
        setInsight('deptSlaInsight', '');
    }
    Charts.deptLine('deptChart', departments, total);
    Charts.deptSlaLine('deptSlaChart', departments);

    // === Managers ===
    const allAbove80 = managers.every(x => x.sla_percent >= 80);
    const improved = managers.filter(x => x.sla_change > 0).length;
    setInsight('managersInsight',
        `<strong>מטרה: מעקב ביצועי מנהלים ועמידה בתקן 80%.</strong><br>` +
        `מתוך ${managers.length} מנהלים, ${allAbove80 ? 'כולם עומדים מעל 80% בזמן תקן' : `${managers.filter(x => x.sla_percent < 80).map(x => x.name).join(', ')} מתחת ל-80%`}.<br>` +
        `${improved} מנהלים שיפרו ביצועים ביחס לחודש קודם (לפי הדוח).`);
    document.getElementById('managersCompareTitle').textContent =
        `השוואת עמידה בתקן: ${m.month_label} מול ${Charts.labels.prevYear} — מי השתפר ומי ירד?`;
    document.getElementById('managersCompareNote').textContent =
        `גרף קו המשווה את ביצועי כל מנהל בין ${m.month_label} ל${Charts.labels.prevYear}. קו מקווקו אדום = תקן יעד 80%.`;
    Tables.renderManagers(managers);
    Charts.managersComparisonLine('managersLineChart', managers);

    // === Departments ===
    document.getElementById('deptTitle').textContent =
        `דוח 20/80 — ${departments.length} מחלקות שמטפלות ב-${deptShare} מכלל הפניות`;
    const deptRise = departments.filter(d => d.calls_change_percent > 0);
    setInsight('deptInsight',
        `<strong>מטרה: ניתוח 20/80 — אילו מחלקות נושאות את רוב העומס.</strong><br>` +
        `${departments.length} מחלקות מובילות מטפלות ב-${deptShare} מהפניות.<br>` +
        `${deptRise.length} מחלקות חוו עלייה בכמות פניות ביחס לחודש קודם (חץ אדום).<br>` +
        `${departments.every(d => d.sla_percent >= 80) ? 'כל המחלקות המובילות עומדות מעל 80% עמידה בזמן תקן.' : `מתחת ל-80%: ${departments.filter(d => d.sla_percent < 80).map(d => d.name).join(', ')}.`}`);
    Tables.renderDepartments(departments);

    // === Issues ===
    renderIssues(document.querySelector('.issues-toggle .btn.active')?.dataset.filter || 'top');

    // === Heatmap + street trends ===
    const heatTotal = heatmap.data.reduce((s, r) => s + (r.total || 0), 0);
    const heatMin = heatmap.data.length ? Math.min(...heatmap.data.map(r => r.total)) : 0;
    setInsight('heatmapInsight', heatmap.data.length
        ? `הטבלה מציגה ${heatmap.data.length} רחובות עם ריבוי פניות, מחולקים ל-${heatmap.issues.length} נושאים. תאים בצהוב = ריכוז גבוה (70%+ מהמקסימום בעמודה). סה"כ ${fmtN(heatTotal)} פניות. המטרה: לזהות מוקדי בעיה גיאוגרפיים.`
        : 'בדוח של חודש זה לא נמצאה מפת חום לפי רחובות.');
    document.getElementById('heatmapSource').textContent = m.heatmap ? `דוח מוקד עירוני ${m.month_label}, ${m.heatmap.source} (מפת חום).` : '—';
    Heatmap.render(heatmap, heatmapTrend(m, prev));
    Tables.renderStreetTrends(m);

    // === Map ===
    document.getElementById('mapSource').textContent = `דוח מוקד 106, ${m.month_label}.`;
    MapView.setMonth(heatmap, m, State.coords);
    if (document.getElementById('tab-map').classList.contains('active')) MapView.init(heatmap);

    // === Districts ===
    const dTotal = districts.reduce((s, d) => s + d.total_calls, 0);
    const rated = districts.filter(d => d.sla_percent != null);
    const worst = [...rated].sort((a, b) => a.sla_percent - b.sla_percent)[0];
    const best = [...rated].sort((a, b) => b.sla_percent - a.sla_percent)[0];
    setInsight('districtsInsight',
        `<strong>מטרה: מיפוי גיאוגרפי של הפניות ועמידה בתקן לפי רובע.</strong><br>` +
        `${fmtN(dTotal)} פניות שויכו ל-${districts.length} רובעים ואזורים (${fmtN(total - dTotal)} פניות ללא שיוך לרובע).<br>` +
        (best ? `הרובע עם העמידה הטובה ביותר: ${best.name} (${best.sla_percent}%).<br>הרובע עם העמידה הנמוכה ביותר: ${worst.name} (${worst.sla_percent}%).` : '') +
        (t ? `<br>החיצים בעמודות האחרונות: שינוי לעומת ${t.prev_label}.` : `<br><span class="muted">חיצי שינוי לפי רובע יוצגו אחרי העלאת החודש הקודם.</span>`));
    document.getElementById('districtsSource').textContent = `דוח מוקד עירוני 106 — פילוח פניות ביחס לרובעי העיר, ${m.month_label}`;
    Tables.renderDistricts(districts);
    Charts.districtsLine('districtsChart', districts);

    // === Sidebar legend numbers ===
    Sidebar.stats = {
        monthLabel: m.month_label, period: period || '—', total: fmtN(total), versionNote: versionText(m),
        prevNote: t ? `${t.prev_label} (במערכת)` : 'לפי עמודות השינוי שבדוח',
        managersCount: managers.length, deptCount: departments.length, deptShare,
        topCount: topIssues.length, topShare, belowCount: critical.length,
        belowShare: share(critical.reduce((s, x) => s + x.total_calls, 0), total),
        prevYear: m.summary.prev_year || 'שנה קודמת',
        slaExamples: topIssues.slice(0, 4).map(x => `<div class="sb-item">${x.issue_name}: <span class="sb-val">${formatSlaTime(x.sla_time)}</span></div>`).join(''),
        heatStreets: heatmap.data.length, heatTopics: heatmap.issues.length, heatTotal: fmtN(heatTotal), heatMin,
        heatSource: m.heatmap ? `מפת חום, ${m.heatmap.source}` : '—',
        districtsCount: districts.length, districtsTotal: fmtN(dTotal),
    };
    Sidebar.update();
    Sorting.init();
}

// Heatmap arrows only when last month's heatmap covered the same topics
function heatmapTrend(m, prev) {
    if (!prev?.heatmap || !m.heatmap) return null;
    const a = m.heatmap.topics, b = prev.heatmap.topics;
    if (a.length !== b.length || !a.every(x => b.some(y => MokedCore.sameTopic(x, y)))) return null;
    const prevRows = Object.fromEntries(prev.heatmap.rows.map(r => [r.name, r.total]));
    const byStreet = {};
    for (const r of m.heatmap.rows) {
        byStreet[r.name] = prevRows[r.name] == null ? null : { diff: r.total - prevRows[r.name], prev: prevRows[r.name],
            dir: r.total > prevRows[r.name] ? 'up' : r.total < prevRows[r.name] ? 'down' : 'same', good: r.total < prevRows[r.name] };
    }
    return { label: prev.month_label, byStreet };
}

function renderIssues(filter) {
    const m = State.month;
    if (!m) return;
    const total = m.summary.total_calls;
    let data;
    if (filter === 'critical') {
        data = View.criticalIssues(m);
        const lowest = [...data].sort((a, b) => a.sla_percent - b.sla_percent)[0];
        document.getElementById('issuesTitle').textContent = `${data.length} נושאים מתחת ל-80% עמידה בתקן — היכן החריגה?`;
        setInsight('issuesInsight',
            `<strong>מטרה: זיהוי הנושאים החורגים מתקן יעד 80%.</strong><br>` +
            (lowest ? `הנושא הנמוך ביותר: ${lowest.issue_name} (${lowest.sla_percent}%).<br>` : '') +
            `נושאים אלו מהווים ${share(data.reduce((s, x) => s + x.total_calls, 0), total)} מכלל הפניות.`);
        Tables.renderIssues(data);
    } else if (filter === 'core') {
        data = View.coreIssues(m);
        document.getElementById('issuesTitle').textContent = 'ליבת הפעילות — הנושאים שמהווים 80% מהפניות במחלקות המובילות';
        setInsight('issuesInsight',
            `<strong>מטרה: פירוט הנושאים בכל מחלקה מובילה, כולל זמן טיפול ממוצע בפועל.</strong><br>` +
            `${data.length} נושאים. הכמויות כאן נספרות בתוך המחלקה, ולכן יכולות להיות שונות מטבלת 10 המובילים.`);
        Tables.renderIssues(data, true);
    } else {
        data = View.topIssues(m);
        const lowest = [...data].sort((a, b) => a.sla_percent - b.sla_percent)[0];
        document.getElementById('issuesTitle').textContent = `${data.length} הנושאים המובילים בכמות פניות — מהם ומה עמידתם בתקן?`;
        setInsight('issuesInsight',
            `<strong>מטרה: זיהוי הנושאים המובילים ורמת השירות בכל אחד.</strong><br>` +
            `${data.length} הנושאים המובילים מהווים ${share(data.reduce((s, x) => s + x.total_calls, 0), total)} מכלל הפניות.<br>` +
            (lowest ? `הנושא עם העמידה הנמוכה ביותר: ${lowest.issue_name} (${lowest.sla_percent}%).<br>` : '') +
            (State.trends ? `החיצים: שינוי לעומת ${State.trends.prev_label}.` : `זמן תקן שונה לכל נושא — מפורט בעמודת "זמן תקן".`));
        Tables.renderIssues(data);
    }
    Sorting.init();
}
