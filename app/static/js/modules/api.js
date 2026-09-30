// Month data for the dashboard. Source of truth: the monthly report uploads in
// Supabase storage (bucket moked106). If storage is empty or unreachable, falls back
// to the months bundled with the app (static/data/).
const STORAGE = {
    url: 'https://cbhexpybdggwzyakgagd.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGV4cHliZGdnd3p5YWtnYWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkzMjksImV4cCI6MjA5MTMyNTMyOX0.X1b7pLyig-bGfxM7XjmwH0TqiuhqoS_o-Czg5qdsN6o',
    bucket: 'moked106',
    functionName: 'moked106-admin',
};

const API = {
    index: null,        // { months: { 'YYYY-MM': { active, versions: [...] } } }
    source: null,       // 'storage' | 'bundled'
    cache: {},

    async storageGet(path) {
        const res = await fetch(`${STORAGE.url}/storage/v1/object/authenticated/${STORAGE.bucket}/${path}`, {
            headers: { apikey: STORAGE.key, Authorization: `Bearer ${STORAGE.key}` }, cache: 'no-cache',
        });
        if (res.status === 400 || res.status === 404) return null;
        if (!res.ok) throw new Error(`storage ${path}: ${res.status}`);
        return res.json();
    },

    async bundledGet(path) {
        const res = await fetch(`/static/data/${path}`, { cache: 'no-cache' });
        return res.ok ? res.json() : null;
    },

    async loadIndex() {
        try {
            const idx = await this.storageGet('internal/index.json');
            if (idx && Object.keys(idx.months || {}).length) {
                this.index = idx;
                this.source = 'storage';
                return idx;
            }
        } catch (err) {
            console.warn('Storage unavailable, using bundled data', err);
        }
        this.index = await this.bundledGet('index.json');
        this.source = 'bundled';
        return this.index;
    },

    months() {
        return Object.keys(this.index?.months || {}).sort();
    },

    // Active version of a month (or a specific version id)
    async month(ym, versionId) {
        const entry = this.index?.months?.[ym];
        if (!entry) return null;
        const vid = versionId || entry.active;
        const key = `${ym}/${vid}`;
        if (!this.cache[key]) {
            this.cache[key] = this.source === 'storage'
                ? await this.storageGet(`internal/months/${ym}/${vid}.json`)
                : await this.bundledGet(`${ym}.json`);
        }
        return this.cache[key];
    },

    async streetCoords() {
        try { return (this.source === 'storage' && await this.storageGet('geo/streets.json')) || {}; }
        catch { return {}; }
    },
};

// Shapes the dashboard modules were built on, derived from one month model
const View = {
    summary: m => ({ month: m.month_label, total_calls: m.summary.total_calls, sla_percent: m.summary.sla_percent,
        sla_change: m.summary.sla_change, overdue_open: m.summary.overdue_open, sla_prev_year: m.summary.sla_prev_year }),
    managers: m => [...m.managers].sort((a, b) => b.total_calls - a.total_calls)
        .map(r => ({ ...r, sla_2025: r.sla_prev_year })),
    departments: m => [...m.departments].sort((a, b) => b.total_calls - a.total_calls),
    topIssues: m => m.issues_top,
    criticalIssues: m => m.issues_below80,
    coreIssues: m => m.issues_core,
    heatmap: m => m.heatmap ? {
        issues: m.heatmap.topics,
        data: [...m.heatmap.rows].sort((a, b) => a.total - b.total)
            .map(r => ({ street: r.name, total: r.total, ...Object.fromEntries(m.heatmap.topics.map(t => [t, r.counts[t] || 0])) })),
    } : { issues: [], data: [] },
    districts: m => m.districts.map(d => ({ ...d,
        calls_per_100_residents: d.population ? Math.round(d.total_calls * 10000 / d.population) / 100 : 0 })),
};
