// Report standard is [D]DD:HH:MM (000:16:00 = 16 hours); one reader for the whole app
function formatSlaTime(timeStr) {
    if (!timeStr || timeStr === '—') return '—';
    return MokedCore.standardText(timeStr) || timeStr;
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

function pctOf(val, total) {
    if (!total) return '—';
    return ((val / total) * 100).toFixed(1) + '%';
}

// Green = good direction, red = bad direction. For on-time rates up is good; for calls/overdue up is bad.
function trendArrow(dir, good, text, title = '') {
    if (!dir) return '<span class="trend none" title="אין נתון להשוואה">—</span>';
    if (dir === 'same') return `<span class="trend same" title="${title}">ללא שינוי</span>`;
    return `<span class="trend ${good ? 'good' : 'bad'}" title="${title}">${dir === 'up' ? '▲' : '▼'} <bdi dir="ltr">${text}</bdi></span>`;
}

// A change value printed in the report itself (e.g. "-1.8%")
function reportChangeCell(val, higherIsBetter, unit = '%') {
    if (val == null) return trendArrow(null);
    const dir = val > 0 ? 'up' : val < 0 ? 'down' : 'same';
    return trendArrow(dir, (dir === 'up') === higherIsBetter, `${val > 0 ? '+' : ''}${val}${unit}`, 'לפי הדוח החודשי');
}

// A change computed against the previous month uploaded to the system
function trendCell(ch, unit = '', title = '') {
    if (!ch) return trendArrow(null);
    const n = Math.abs(ch.diff);
    const text = `${ch.diff > 0 ? '+' : '−'}${unit === '%' ? n.toFixed(1) : n.toLocaleString()}${unit}`;
    return trendArrow(ch.dir, ch.good, text, title);
}

const Tables = {
    total: 0,       // total calls of the displayed month
    trends: null,   // MokedCore.compareMonths(current, previous) or null

    renderManagers(data) {
        const tbody = document.querySelector('#managersTable tbody');
        tbody.innerHTML = data.map(m => `<tr>
                <td><strong>${m.name}</strong></td>
                <td data-sort="${m.total_calls}">${m.total_calls.toLocaleString()}</td>
                <td>${pctOf(m.total_calls, this.total)}</td>
                <td class="${slaClass(m.sla_percent)}" data-sort="${m.sla_percent}">${m.sla_percent}% <small>(${slaLabel(m.sla_percent)})</small></td>
                <td data-sort="${m.sla_change ?? ''}">${reportChangeCell(m.sla_change, true)}</td>
                <td class="${m.sla_2025 != null ? slaClass(m.sla_2025) : ''}" data-sort="${m.sla_2025 ?? ''}">${m.sla_2025 != null ? m.sla_2025 + '%' : '—'}</td>
                <td>${m.overdue_open ?? '—'}</td>
            </tr>`).join('');
    },

    renderDepartments(data) {
        const tbody = document.querySelector('#deptTable tbody');
        tbody.innerHTML = data.map(d => `<tr>
                <td><strong>${d.name}</strong></td>
                <td data-sort="${d.total_calls}">${d.total_calls.toLocaleString()}</td>
                <td>${pctOf(d.total_calls, this.total)}</td>
                <td data-sort="${d.calls_change_percent ?? ''}">${reportChangeCell(d.calls_change_percent, false)}</td>
                <td class="${slaClass(d.sla_percent)}" data-sort="${d.sla_percent}">${d.sla_percent}% <small>(${slaLabel(d.sla_percent)})</small></td>
                <td data-sort="${d.sla_change ?? ''}">${reportChangeCell(d.sla_change, true)}</td>
                <td>${d.overdue_open ?? '—'}</td>
            </tr>`).join('');
    },

    renderIssues(data, withAvg = false) {
        const tbody = document.querySelector('#issuesTable tbody');
        const tr = this.trends?.issues || {};
        tbody.innerHTML = data.map((item, i) => {
            const ch = tr[item.issue_name];
            return `<tr>
                <td>${i + 1}</td>
                <td>${item.department}</td>
                <td>${item.issue_name}</td>
                <td data-sort="${MokedCore.parseStandard(item.sla_time || '')?.hours ?? ''}">${formatSlaTime(item.sla_time)}${withAvg && item.avg_handling_time ? `<br><small>ממוצע בפועל: ${item.avg_handling_time}</small>` : ''}</td>
                <td data-sort="${item.total_calls}">${item.total_calls.toLocaleString()} ${ch ? trendCell(ch.calls, '', `לעומת ${this.trends.prev_label}`) : ''}</td>
                <td>${pctOf(item.total_calls, this.total)}</td>
                <td class="${slaClass(item.sla_percent)}" data-sort="${item.sla_percent}">${item.sla_percent}% <small>(${slaLabel(item.sla_percent)})</small> ${ch ? trendCell(ch.sla, '%', `לעומת ${this.trends.prev_label}`) : ''}</td>
            </tr>`;
        }).join('');
    },

    renderDistricts(data) {
        const tbody = document.querySelector('#districtsTable tbody');
        const tr = this.trends?.districts || {};
        const sorted = [...data].sort((a, b) => b.total_calls - a.total_calls);
        tbody.innerHTML = sorted.map(d => {
            const per100 = d.population ? ((d.total_calls / d.population) * 100).toFixed(1) : '—';
            const ch = tr[d.name];
            return `<tr>
                <td><strong>${d.name}</strong></td>
                <td data-sort="${d.population ?? ''}">${d.population ? d.population.toLocaleString() : '—'}</td>
                <td data-sort="${d.total_calls}">${d.total_calls.toLocaleString()}</td>
                <td>${pctOf(d.total_calls, this.total)}</td>
                <td>${per100}</td>
                <td class="${d.sla_percent != null ? slaClass(d.sla_percent) : ''}" data-sort="${d.sla_percent ?? ''}">${d.sla_percent != null ? `${d.sla_percent}% <small>(${slaLabel(d.sla_percent)})</small>` : '—'}</td>
                <td>${d.overdue_open ?? '—'}</td>
                <td>${ch ? trendCell(ch.calls) : trendArrow(null)}</td>
                <td>${ch ? trendCell(ch.sla, '%') : trendArrow(null)}</td>
            </tr>`;
        }).join('');
    },

    // Street-level movement between months (full street list: Excel export or the report's street table)
    renderStreetTrends(month) {
        const box = document.getElementById('streetTrends');
        const t = this.trends;
        if (!month.streets) { box.innerHTML = '<p class="empty-note">בחודש זה לא הועלה פירוט רחובות.</p>'; return; }
        if (!t) { box.innerHTML = `<p class="empty-note">מגמות רחובות יוצגו אחרי שיועלה גם החודש הקודם (${MokedCore.monthLabel(MokedCore.prevMonthOf(month.month))}).</p>`; return; }
        if (!t.streets_comparable) { box.innerHTML = `<p class="empty-note">פירוט הרחובות של ${t.prev_label} בנוי מנושאים או ממקור אחר, ולכן אין השוואה הוגנת בין החודשים.</p>`; return; }
        const rows = month.streets.rows.map(r => ({ ...r, ch: t.streets[r.name] })).filter(r => r.ch);
        const up = [...rows].filter(r => r.ch.diff > 0).sort((a, b) => b.ch.diff - a.ch.diff).slice(0, 10);
        const down = [...rows].filter(r => r.ch.diff < 0).sort((a, b) => a.ch.diff - b.ch.diff).slice(0, 10);
        const list = (items, title) => `<div class="trend-list"><h4>${title}</h4><table><thead><tr><th>רחוב</th><th>רובע</th><th>${month.month_label}</th><th>${t.prev_label}</th><th>שינוי</th></tr></thead><tbody>${
            items.map(r => `<tr><td><strong>${r.name}</strong></td><td>${r.district || '—'}</td><td>${r.total}</td><td>${r.ch.prev}</td><td>${trendCell(r.ch)}</td></tr>`).join('')
            || '<tr><td colspan="5" class="empty-note">אין</td></tr>'}</tbody></table></div>`;
        box.innerHTML = `<p class="section-insight">מקור: ${month.streets.source} (${month.streets.rows.length} רחובות). אדום = יותר פניות מהחודש הקודם, ירוק = פחות.</p>
            <div class="trend-lists">${list(up, 'הכי הרבה עלייה בפניות')}${list(down, 'הכי הרבה ירידה בפניות')}</div>`;
    },
};
