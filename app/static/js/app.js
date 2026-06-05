let cachedHeatmap = null;

document.addEventListener('DOMContentLoaded', () => {
    Sidebar.init();
    Sidebar.update('overview');

    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
            Sidebar.update(tabId);

            if (tabId === 'map' && cachedHeatmap) {
                setTimeout(() => {
                    MapView.init(cachedHeatmap);
                    MapView.map.invalidateSize();
                }, 100);
            }
        });
    });

    // Issues filter
    document.querySelectorAll('.issues-toggle .btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.issues-toggle .btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadIssues(btn.dataset.filter);
        });
    });

    loadAll();
});

async function loadAll() {
    try {
        const [summary, managers, departments, topIssues, criticalIssues, heatmap, districts] = await Promise.all([
            API.summary(), API.managers(), API.departments(),
            API.topIssues(), API.criticalIssues(), API.heatmap(), API.districts()
        ]);

        cachedHeatmap = heatmap;
        const totalCalls = summary.total_calls;
        const totalOverdue = managers.reduce((s, m) => s + m.overdue_open, 0);
        const overduePct = ((totalOverdue / totalCalls) * 100).toFixed(1);

        // === KPIs ===
        const totalCallsEl = document.getElementById('totalCalls');
        totalCallsEl.textContent = totalCalls.toLocaleString();
        document.getElementById('totalCallsInsight').textContent =
            `סה"כ ${totalCalls.toLocaleString()} פניות בחודש מאי 2026. 10 נושאים מובילים מהווים כ-24.7% מכלל הפניות.`;

        const slaPctEl = document.getElementById('slaPercent');
        slaPctEl.textContent = summary.sla_percent + '%';
        slaPctEl.style.color = summary.sla_percent >= 90 ? '#2E7D32' : summary.sla_percent >= 80 ? '#EF6C00' : '#C62828';

        const slaChangeEl = document.getElementById('slaChange');
        slaChangeEl.textContent = (summary.sla_change > 0 ? '+' : '') + summary.sla_change + '%';
        slaChangeEl.style.color = summary.sla_change >= 0 ? '#2E7D32' : '#C62828';
        document.getElementById('slaChangeInsight').textContent =
            summary.sla_change < 0
                ? `ירידה של ${Math.abs(summary.sla_change)}% בעמידה בתקן ביחס לאפריל 2026. סימן לצורך בבדיקה.`
                : `שיפור של ${summary.sla_change}% בעמידה בתקן ביחס לאפריל 2026.`;

        const overdueEl = document.getElementById('totalOverdue');
        overdueEl.textContent = totalOverdue;
        document.getElementById('overdueInsight').textContent =
            `${totalOverdue} פניות חורגות ופתוחות מתוך ${totalCalls.toLocaleString()} (${overduePct}%). רוב החריגות בתפעול (${managers[0].overdue_open}).`;

        // === Overview Charts ===
        const topMgr = managers[0];
        const topMgrPct = ((topMgr.total_calls / totalCalls) * 100).toFixed(1);
        document.getElementById('managersChartInsight').textContent =
            `${topMgr.name} מטפל ב-${topMgrPct}% מכלל הפניות (${topMgr.total_calls.toLocaleString()} פניות).`;
        Charts.managersDonut('managersChart', managers);

        const topIssue = topIssues[0];
        const topIssuePct = ((topIssue.total_calls / totalCalls) * 100).toFixed(1);
        document.getElementById('topIssuesChartInsight').textContent =
            `הנושא המוביל: ${topIssue.issue_name} עם ${topIssue.total_calls.toLocaleString()} פניות (${topIssuePct}% מסה"כ).`;
        Charts.topIssuesLine('topIssuesChart', topIssues, totalCalls);

        const topDept = departments[0];
        const topDeptPct = ((topDept.total_calls / totalCalls) * 100).toFixed(1);
        document.getElementById('deptChartInsight').textContent =
            `${topDept.name} מובילה עם ${topDept.total_calls.toLocaleString()} פניות (${topDeptPct}% מסה"כ). 8 מחלקות מובילות מהוות 53% מכלל הפניות.`;
        Charts.deptLine('deptChart', departments, totalCalls);

        const belowSla = departments.filter(d => d.sla_percent < 85);
        const aboveSla = departments.filter(d => d.sla_percent >= 90);
        document.getElementById('deptSlaInsight').textContent =
            `${aboveSla.length} מחלקות מעל 90% עמידה בתקן. ${belowSla.length > 0 ? belowSla.map(d => d.name).join(', ') + ' מתחת ל-85%' : 'כל המחלקות מעל 80%'}. תקן יעד: 80%. `;
        Charts.deptSlaLine('deptSlaChart', departments);

        // === Managers Tab ===
        const allAbove80 = managers.every(m => m.sla_percent >= 80);
        const improved = managers.filter(m => m.sla_change > 0).length;
        document.getElementById('managersInsight').textContent =
            `מתוך ${managers.length} מנהלים, ${allAbove80 ? 'כולם עומדים מעל 80% בזמן תקן' : 'חלקם חורגים מתקן 80%'}. ${improved} מנהלים שיפרו ביצועים ביחס לחודש קודם. תקן יעד: 80% עמידה בזמן תקן לכל מנהל.`;
        Tables.renderManagers(managers);
        Charts.managersComparisonLine('managersLineChart', managers);

        // === Departments Tab ===
        const deptWithRise = departments.filter(d => d.calls_change_percent > 0);
        document.getElementById('deptInsight').textContent =
            `8 מחלקות מובילות מטפלות ב-53% מהפניות. ${deptWithRise.length} מחלקות חוו עלייה בכמות פניות ביחס לחודש קודם. כל המחלקות המובילות עומדות מעל 80% עמידה בזמן תקן. תקן יעד: 80%.`;
        Tables.renderDepartments(departments);

        // === Issues Tab ===
        const lowestSla = [...topIssues].sort((a, b) => a.sla_percent - b.sla_percent)[0];
        document.getElementById('issuesInsight').textContent =
            `10 הנושאים המובילים מהווים 24.7% מכלל הפניות. הנושא עם העמידה הנמוכה ביותר: ${lowestSla.issue_name} (${lowestSla.sla_percent}%). תקן יעד: 80%. זמן תקן שונה לכל נושא — מפורט בעמודת "זמן תקן".`;
        Tables.renderIssues(topIssues);

        // === Heatmap Tab ===
        Heatmap.render(heatmap);

        // === Districts Tab ===
        const totalDistrictCalls = districts.reduce((s, d) => s + d.total_calls, 0);
        const worstDistrict = [...districts].sort((a, b) => a.sla_percent - b.sla_percent)[0];
        const bestDistrict = [...districts].sort((a, b) => b.sla_percent - a.sla_percent)[0];
        document.getElementById('districtsInsight').textContent =
            `סה"כ ${totalDistrictCalls.toLocaleString()} פניות ב-${districts.length} רובעים ואזורים. הרובע עם העמידה הטובה ביותר: ${bestDistrict.name} (${bestDistrict.sla_percent}%). הרובע עם העמידה הנמוכה ביותר: ${worstDistrict.name} (${worstDistrict.sla_percent}%). תקן יעד: 80% עמידה בזמן תקן.`;
        Tables.renderDistricts(districts);
        Charts.districtsLine('districtsChart', districts);

        // Init sorting
        Sorting.init();

    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

async function loadIssues(filter) {
    let data;
    if (filter === 'top') {
        data = await API.topIssues();
        document.getElementById('issuesTitle').textContent = '10 הנושאים המובילים בכמות פניות — מהם ומה עמידתם בתקן?';
        document.getElementById('issuesInsight').textContent =
            `10 הנושאים המובילים בכמות פניות מהווים 24.7% מכלל הפניות. פינוי אשפה ביתית מוביל עם הכי הרבה פניות. כל נושא עם זמן תקן ייעודי.`;
    } else if (filter === 'critical') {
        data = await API.criticalIssues();
        document.getElementById('issuesTitle').textContent = '10 נושאים מתחת ל-80% עמידה בתקן — היכן החריגה?';
        document.getElementById('issuesInsight').textContent =
            `נושאים אלו חורגים מתקן יעד 80%. הנושא הנמוך ביותר: איתור בעל רכב (43%). טפטפת קרועה: 52.7%. נושאים אלו מהווים כ-6% מכלל הפניות.`;
    } else {
        data = await API.allIssues();
        document.getElementById('issuesTitle').textContent = 'כל הנושאים — פירוט מלא';
        document.getElementById('issuesInsight').textContent =
            `רשימה מלאה של כל הנושאים שטופלו. ניתן למיין לפי כל עמודה. ירוק=עומד בתקן 80%+, אדום=חורג.`;
    }
    Tables.renderIssues(data);
    Sorting.init();
}
