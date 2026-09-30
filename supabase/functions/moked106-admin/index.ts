// moked106-admin: the only writer to the moked106 storage bucket.
// Actions: status, set_password (first time only), check, upload, activate, geo.
// Upload re-reads the original report files here (never trusts the browser's reading),
// runs every cross-check, saves a NEW version (nothing is overwritten), and republishes
// the public transparency files from the active versions.
import './moked-core.js';
import JSZip from 'npm:jszip@3.10.1';
import * as XLSX from 'npm:xlsx@0.18.5';

// deno-lint-ignore no-explicit-any
const C = (globalThis as any).MokedCore;
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'moked106';
const PBKDF2_ITERATIONS = 310000;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------------------------------------------------------------- storage
const auth = { Authorization: `Bearer ${SRK}`, apikey: SRK };

async function getJson(path: string) {
    const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: auth });
    if (r.status === 400 || r.status === 404) return null;
    if (!r.ok) throw new Error(`read ${path}: ${r.status}`);
    return r.json();
}

async function put(path: string, body: BodyInit, type: string) {
    const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'no-cache' },
        body,
    });
    if (!r.ok) throw new Error(`write ${path}: ${r.status} ${await r.text()}`);
}
const putJson = (path: string, obj: unknown) => put(path, JSON.stringify(obj), 'application/json');

// ---------------------------------------------------------------- password (PBKDF2, hash only)
const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    return new Uint8Array(bits);
}

async function verifyPassword(password: unknown) {
    const rec = await getJson('admin/auth.json');
    if (!rec || typeof password !== 'string') return false;
    const got = await derive(password, unb64(rec.salt), rec.iterations);
    const want = unb64(rec.hash);
    let diff = got.length ^ want.length;
    for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got[i] ^ want[i];
    if (diff !== 0) await new Promise(r => setTimeout(r, 1500));   // slow down guessing
    return diff === 0;
}

// ---------------------------------------------------------------- reading the report files
async function readFiles(files: { name: string; kind: string; base64: string }[]) {
    const report = files.find(f => f.kind === 'report' && /\.pptx$/i.test(f.name));
    if (!report) throw Object.assign(new Error('חסר דוח המנכ"ל (pptx)'), { status: 400 });
    const bytes = Object.fromEntries(files.map(f => [f.kind, unb64(f.base64)]));
    const size = Object.values(bytes).reduce((a, b) => a + b.length, 0);
    if (size > MAX_UPLOAD_BYTES) throw Object.assign(new Error('הקבצים גדולים מדי'), { status: 413 });

    const zip = await JSZip.loadAsync(bytes.report);
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0]);
    const slides = await Promise.all(names.map(n => zip.file(n)!.async('string')));

    let sheet = null;
    const streets = files.find(f => f.kind === 'streets');
    if (streets) {
        const wb = XLSX.read(bytes.streets, { type: 'array' });
        sheet = { name: streets.name, rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }) };
    }
    return { parsed: C.parseReport(slides, sheet), bytes };
}

// ---------------------------------------------------------------- public (transparency) files
// Rebuilt from the active version of every month; nothing is written unless all checks pass.
async function publish(index: { months: Record<string, { active: string }> }) {
    const months = Object.keys(index.months).sort();
    // deno-lint-ignore no-explicit-any
    const pubs: any[] = [];
    for (const ym of months) {
        const m = await getJson(`internal/months/${ym}/${index.months[ym].active}.json`);
        const pub = C.toPublic(m, (m.version?.uploaded_at || new Date().toISOString()).slice(0, 10));
        pub.verification = C.verificationStamp(m);
        const errs = C.validatePublicMonth(pub, ym);
        if (errs.length) throw Object.assign(new Error(`דף השקיפות לא עודכן: ${errs.join('; ')}`), { status: 422 });
        pubs.push(pub);
    }
    const pindex = { latest: months[months.length - 1], updated_on: new Date().toISOString().slice(0, 10),
        months: pubs.map(C.publicIndexEntry) };
    const ierrs = C.validatePublicIndex(pindex, pubs);
    if (ierrs.length) throw Object.assign(new Error(`דף השקיפות לא עודכן: ${ierrs.join('; ')}`), { status: 422 });
    for (const p of pubs) await putJson(`public/${p.month}.json`, p);
    await putJson('public/index.json', pindex);
}

// ---------------------------------------------------------------- actions
// deno-lint-ignore no-explicit-any
async function handle(body: any) {
    const action = body?.action;

    if (action === 'status') return json({ password_set: !!(await getJson('admin/auth.json')) });

    if (action === 'set_password') {
        if (await getJson('admin/auth.json')) return json({ error: 'כבר נקבעה סיסמה' }, 409);
        if (typeof body.password !== 'string' || body.password.length < 10) return json({ error: 'סיסמה של 10 תווים לפחות' }, 400);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await derive(body.password, salt, PBKDF2_ITERATIONS);
        await putJson('admin/auth.json', { salt: b64(salt), hash: b64(hash), iterations: PBKDF2_ITERATIONS, created_at: new Date().toISOString() });
        return json({ ok: true });
    }

    if (!(await verifyPassword(body?.password))) return json({ error: 'סיסמה שגויה' }, 401);

    if (action === 'check') return json({ ok: true });

    if (action === 'upload') {
        const { parsed, bytes } = await readFiles(body.files || []);
        const m = C.buildMonth(parsed);
        const index = (await getJson('internal/index.json')) || { months: {} };
        const prevYm = m.month ? C.prevMonthOf(m.month) : null;
        const prev = prevYm && index.months[prevYm]
            ? await getJson(`internal/months/${prevYm}/${index.months[prevYm].active}.json`) : null;
        const today = new Date().toISOString().slice(0, 10);
        const checks = C.checkMonth(parsed, m, { prevMonth: prev, exportedOn: today });
        if (checks.errors.length) return json({ error: 'הדוח לא עבר את בדיקות ההתאמה', checks }, 422);
        if (checks.warnings.length && body.acknowledged_warnings !== true) return json({ error: 'יש הערות שצריך לאשר', checks }, 409);

        const now = new Date();
        const vid = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '');   // e.g. 20260930T142233
        const files = (body.files || []).map((f: { name: string; kind: string }) => f.name);
        const meta = {
            id: vid, uploaded_at: now.toISOString(), note: String(body.note || '').slice(0, 200), files,
            summary: { total_calls: m.summary.total_calls, sla_percent: m.summary.sla_percent }, warnings: checks.warnings.length,
        };
        // Originals kept for audit (storage keys must be ASCII; original names are in meta.files)
        await put(`raw/${m.month}/${vid}/report.pptx`, bytes.report,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        if (bytes.streets) await put(`raw/${m.month}/${vid}/streets.xlsx`, bytes.streets,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await putJson(`internal/months/${m.month}/${vid}.json`, { ...m, version: meta, checks });

        const entry = index.months[m.month] || { active: null, versions: [] };
        entry.versions.push(meta);
        entry.active = vid;
        index.months[m.month] = entry;
        await publish(index);                       // only if the public files pass, the new version becomes active
        await putJson('internal/index.json', index);
        return json({ ok: true, month: m.month, month_label: m.month_label, version: vid, checks });
    }

    if (action === 'activate') {
        const index = await getJson('internal/index.json');
        const entry = index?.months?.[body.month];
        if (!entry || !entry.versions.some((v: { id: string }) => v.id === body.version)) return json({ error: 'גרסה לא קיימת' }, 404);
        const before = entry.active;
        entry.active = body.version;
        try {
            await publish(index);
        } catch (err) {
            entry.active = before;
            throw err;
        }
        await putJson('internal/index.json', index);
        return json({ ok: true });
    }

    if (action === 'geo') {
        const coords = body.coords || {};
        const current = (await getJson('geo/streets.json')) || {};
        for (const [name, v] of Object.entries(coords)) {
            const [lat, lng] = v as number[];
            // Ashdod area only
            if (typeof name === 'string' && name.length < 80 && lat > 31.72 && lat < 31.87 && lng > 34.58 && lng < 34.72) current[name] = [lat, lng];
        }
        await putJson('geo/streets.json', current);
        return json({ ok: true, count: Object.keys(current).length });
    }

    return json({ error: 'פעולה לא מוכרת' }, 400);
}

Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    try {
        return await handle(await req.json());
    } catch (err) {
        console.error(err);
        // deno-lint-ignore no-explicit-any
        const e = err as any;
        return json({ error: e.message || 'שגיאה' }, e.status || 500);
    }
});
