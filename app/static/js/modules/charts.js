Chart.defaults.font.family = "'Segoe UI', Tahoma, Arial, sans-serif";

function slaColor(pct) {
    if (pct >= 90) return '#2E7D32';
    if (pct >= 80) return '#EF6C00';
    return '#C62828';
}

// Plugin: draws colored SLA background zones on charts with y-axis SLA scale
const slaZonesPlugin = {
    id: 'slaZones',
    beforeDraw(chart) {
        if (!chart.options.plugins.slaZones?.enabled) return;
        const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;

        const zones = [
            { min: 90, max: y.max, color: 'rgba(46,125,50,0.07)' },
            { min: 80, max: 90, color: 'rgba(239,108,0,0.07)' },
            { min: y.min, max: 80, color: 'rgba(198,40,40,0.07)' },
        ];

        zones.forEach(z => {
            const yTop = y.getPixelForValue(Math.min(z.max, y.max));
            const yBot = y.getPixelForValue(Math.max(z.min, y.min));
            if (yBot <= yTop) return;
            ctx.fillStyle = z.color;
            ctx.fillRect(left, yTop, right - left, yBot - yTop);
        });
    }
};
Chart.register(slaZonesPlugin);

const Charts = {
    instances: {},

    destroy(id) {
        if (this.instances[id]) { this.instances[id].destroy(); delete this.instances[id]; }
    },

    managersDonut(canvasId, data) {
        this.destroy(canvasId);
        const total = data.reduce((s, d) => s + d.total_calls, 0);
        const ctx = document.getElementById(canvasId);
        this.instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => `${d.name} (${((d.total_calls/total)*100).toFixed(1)}%)`),
                datasets: [{
                    data: data.map(d => d.total_calls),
                    backgroundColor: data.map(d => slaColor(d.sla_percent)),
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'right', rtl: true, labels: { font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const d = data[ctx.dataIndex];
                                return `${d.name}: ${d.total_calls.toLocaleString()} פניות (${((d.total_calls/total)*100).toFixed(1)}%) | תקן: ${d.sla_percent}%`;
                            }
                        }
                    }
                }
            }
        });
    },

    topIssuesLine(canvasId, data, totalAll) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        this.instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.issue_name.length > 18 ? d.issue_name.substring(0, 18) + '…' : d.issue_name),
                datasets: [{
                    label: 'כמות פניות',
                    data: data.map(d => d.total_calls),
                    borderColor: '#333',
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointBackgroundColor: '#333',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const d = data[ctx.dataIndex];
                                const pct = ((d.total_calls / totalAll) * 100).toFixed(1);
                                return `${d.total_calls.toLocaleString()} פניות (${pct}% מסה"כ) | תקן: ${d.sla_percent}% | זמן תקן: ${d.sla_time || '—'}`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#F0EBE0' } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 30 } }
                }
            }
        });
    },

    deptLine(canvasId, data, totalAll) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        this.instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.name),
                datasets: [{
                    label: 'כמות פניות',
                    data: data.map(d => d.total_calls),
                    borderColor: '#333',
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointBackgroundColor: '#333',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const d = data[ctx.dataIndex];
                                const pct = ((d.total_calls / totalAll) * 100).toFixed(1);
                                return `${d.total_calls.toLocaleString()} פניות (${pct}% מסה"כ) | תקן: ${d.sla_percent}% | שינוי: ${d.sla_change > 0 ? '+' : ''}${d.sla_change}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#F0EBE0' } },
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }
        });
    },

    deptSlaLine(canvasId, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        this.instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.name),
                datasets: [
                    {
                        label: '% עמידה בתקן',
                        data: data.map(d => d.sla_percent),
                        borderColor: '#333',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 7,
                        pointBackgroundColor: data.map(d => slaColor(d.sla_percent)),
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderWidth: 2
                    },
                    {
                        label: 'יעד תקן 80%',
                        data: data.map(() => 80),
                        borderColor: '#C62828',
                        borderDash: [8, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    slaZones: { enabled: true },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.datasetIndex === 1) return 'יעד תקן: 80%';
                                const d = data[ctx.dataIndex];
                                const status = d.sla_percent >= 80 ? 'עומד בתקן' : 'חורג מהתקן';
                                return `${d.name}: ${d.sla_percent}% (${status}) | שינוי: ${d.sla_change > 0 ? '+' : ''}${d.sla_change}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { min: 70, max: 102, grid: { color: '#F0EBE0' } },
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }
        });
    },

    managersComparisonLine(canvasId, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        this.instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.name),
                datasets: [
                    {
                        label: 'מאי 2026',
                        data: data.map(d => d.sla_percent),
                        borderColor: '#333',
                        tension: 0.3,
                        pointRadius: 7,
                        pointBackgroundColor: data.map(d => slaColor(d.sla_percent)),
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderWidth: 2.5
                    },
                    {
                        label: 'ממוצע 2025',
                        data: data.map(d => d.sla_2025),
                        borderColor: '#999',
                        tension: 0.3,
                        pointRadius: 6,
                        pointBackgroundColor: data.map(d => slaColor(d.sla_2025)),
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderWidth: 2,
                        borderDash: [6, 3]
                    },
                    {
                        label: 'יעד תקן 80%',
                        data: data.map(() => 80),
                        borderColor: '#C62828',
                        borderDash: [8, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    slaZones: { enabled: true },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.datasetIndex === 2) return 'יעד: 80%';
                                const d = data[ctx.dataIndex];
                                const val = ctx.datasetIndex === 0 ? d.sla_percent : d.sla_2025;
                                const period = ctx.datasetIndex === 0 ? 'מאי 2026' : '2025';
                                return `${d.name} (${period}): ${val}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { min: 50, max: 102, grid: { color: '#F0EBE0' } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    districtsLine(canvasId, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        const sorted = [...data].sort((a, b) => b.total_calls - a.total_calls);
        const totalAll = sorted.reduce((s, d) => s + d.total_calls, 0);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sorted.map(d => d.name),
                datasets: [{
                    label: 'סה"כ פניות',
                    data: sorted.map(d => d.total_calls),
                    borderColor: '#333',
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointBackgroundColor: sorted.map(d => slaColor(d.sla_percent)),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const d = sorted[ctx.dataIndex];
                                const pct = ((d.total_calls / totalAll) * 100).toFixed(1);
                                const pop = d.population ? ` | ${d.population.toLocaleString()} תושבים` : '';
                                return `${d.total_calls.toLocaleString()} פניות (${pct}% מסה"כ) | תקן: ${d.sla_percent}%${pop}`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#F0EBE0' } },
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 60, minRotation: 40 } }
                }
            }
        });
    }
};
