const TOTAL_CALLS = 21084;

function formatSlaTime(timeStr) {
    if (!timeStr || timeStr === '—') return '—';
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 3) return timeStr;
    const [h, m, s] = parts;
    const totalMinutes = h * 60 + m;

    if (h === 0 && m === 0 && s > 0) return `${s} שניות`;
    if (h === 0 && m > 0) return `${m} דקות`;
    if (h === 1 && m === 0) return 'שעה';
    if (h === 2 && m === 0) return 'שעתיים';
    if (h >= 24) {
        const days = h / 24;
        const daysStr = Number.isInteger(days) ? days : days.toFixed(1);
        return `${h} שעות (${daysStr} ימים)`;
    }
    if (m === 0) return `${h} שעות`;
    return `${h} שעות ו-${m} דקות`;
}

function slaClass(pct) {
    if (pct >= 95) return 'sla-excellent';
    if (pct >= 90) return 'sla-good';
    if (pct >= 80) return 'sla-warn';
    return 'sla-bad';
}

function slaLabel(pct) {
    if (pct >= 80) return 'עומד בתקן';
    return 'חורג מתקן';
}

function changeClass(val) {
    if (val > 0) return 'change-positive';
    if (val < 0) return 'change-negative';
    return 'neutral-value';
}

function fmtChange(val) {
    if (val == null) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val}%`;
}

function pctOf(val, total) {
    if (!total) return '—';
    return ((val / total) * 100).toFixed(1) + '%';
}

const Tables = {
    renderManagers(data) {
        const total = data.reduce((s, m) => s + m.total_calls, 0);
        const tbody = document.querySelector('#managersTable tbody');
        tbody.innerHTML = data.map(m => {
            const pct = pctOf(m.total_calls, total);
            return `<tr>
                <td><strong>${m.name}</strong></td>
                <td class="">${m.total_calls.toLocaleString()}</td>
                <td class="">${pct}</td>
                <td class="${slaClass(m.sla_percent)}">${m.sla_percent}% <small>(${slaLabel(m.sla_percent)})</small></td>
                <td class="${changeClass(m.sla_change)}">${fmtChange(m.sla_change)}</td>
                <td class="${slaClass(m.sla_2025)}">${m.sla_2025}%</td>
                <td class="">${m.overdue_open}</td>
            </tr>`;
        }).join('');
    },

    renderDepartments(data) {
        const tbody = document.querySelector('#deptTable tbody');
        tbody.innerHTML = data.map(d => {
            const pct = pctOf(d.total_calls, TOTAL_CALLS);
            return `<tr>
                <td><strong>${d.name}</strong></td>
                <td class="">${d.total_calls.toLocaleString()}</td>
                <td class="">${pct}</td>
                <td class="${changeClass(d.calls_change_percent)}">${fmtChange(d.calls_change_percent)}</td>
                <td class="${slaClass(d.sla_percent)}">${d.sla_percent}% <small>(${slaLabel(d.sla_percent)})</small></td>
                <td class="${changeClass(d.sla_change)}">${fmtChange(d.sla_change)}</td>
                <td class="">${d.overdue_open}</td>
            </tr>`;
        }).join('');
    },

    renderIssues(data) {
        const tbody = document.querySelector('#issuesTable tbody');
        tbody.innerHTML = data.map((item, i) => {
            const pct = pctOf(item.total_calls, TOTAL_CALLS);
            return `<tr>
                <td class="">${i + 1}</td>
                <td>${item.department}</td>
                <td>${item.issue_name}</td>
                <td class="">${formatSlaTime(item.sla_time)}</td>
                <td class="">${item.total_calls.toLocaleString()}</td>
                <td class="">${pct}</td>
                <td class="${slaClass(item.sla_percent)}">${item.sla_percent}% <small>(${slaLabel(item.sla_percent)})</small></td>
            </tr>`;
        }).join('');
    },

    renderDistricts(data) {
        const tbody = document.querySelector('#districtsTable tbody');
        const totalAll = data.reduce((s, d) => s + d.total_calls, 0);
        const sorted = [...data].sort((a, b) => b.total_calls - a.total_calls);
        tbody.innerHTML = sorted.map(d => {
            const pct = pctOf(d.total_calls, totalAll);
            const per100 = d.population ? ((d.total_calls / d.population) * 100).toFixed(1) : '—';
            return `<tr>
                <td><strong>${d.name}</strong></td>
                <td class="">${d.population ? d.population.toLocaleString() : '—'}</td>
                <td class="">${d.total_calls.toLocaleString()}</td>
                <td class="">${pct}</td>
                <td class="">${per100}</td>
                <td class="${slaClass(d.sla_percent)}">${d.sla_percent}% <small>(${slaLabel(d.sla_percent)})</small></td>
                <td class="">${d.overdue_open}</td>
            </tr>`;
        }).join('');
    }
};
