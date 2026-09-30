// Validates the public data export and content files. Exits non-zero (failing
// the Vercel build) if totals disagree, one metric has two values, a month label
// does not match its data month, a small cell is exposed, or forbidden fields appear.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public_data');
const CONTENT = join(ROOT, 'content');

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי',
  'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const NEIGHBORHOODS = new Set(['רובע א', 'רובע ב', 'רובע ג', 'רובע ד', 'רובע ה', 'רובע הסיטי', 'רובע הקריה',
  'רובע ו', 'רובע ז', 'רובע ח', 'רובע ט', 'רובע ט"ו', 'רובע ט"ז', 'רובע י', 'רובע י"א', 'רובע י"ב',
  'רובע י"ג', 'רובע י"ז', 'רובע מיוחד', 'רובע פארק לכיש', 'מע"ר דרום', 'מרינה', 'רצועת החוף', 'חוף הים',
  'אשדוד ים', 'אזור התעשיה הכבדה', 'אזור התעשיה הצפונית', 'אזור התעשיה הקלה', 'תעשיות עורף הנמל']);
const UNASSIGNED = 'ללא שיוך לרובע';
const FORBIDDEN_KEYS = /street|address|manager|phone|email|resident|caller|id_number|^lat$|^lng$|^lon$/i;
const RATE_TOLERANCE = 0.15; // rounding slack for weighted averages

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const labelFor = (ym) => `${HEB_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

function scanKeys(obj, file, path = '') {
  if (Array.isArray(obj)) return obj.forEach((v, i) => scanKeys(v, file, `${path}[${i}]`));
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (FORBIDDEN_KEYS.test(k)) fail(file, `forbidden field "${path}.${k}" (no street, manager or personal data)`);
      scanKeys(v, file, `${path}.${k}`);
    }
  }
}

function checkTable(d, key, file) {
  const t = d[key];
  if (!t || !Array.isArray(t.rows)) return fail(file, `missing table "${key}"`);
  const min = d.min_cell_size;

  // Totals: every table must reconcile to the city total
  if (t.total !== d.city.total_cases) fail(file, `${key}.total ${t.total} ≠ city.total_cases ${d.city.total_cases}`);
  const visible = t.rows.reduce((s, r) => s + (r.cases ?? 0), 0);
  if (visible + t.suppressed_total !== t.total) {
    fail(file, `${key}: rows (${visible}) + suppressed (${t.suppressed_total}) ≠ total (${t.total})`);
  }

  // Suppression: no visible cell under the minimum; suppressed rows carry no values
  const hidden = t.rows.filter((r) => r.suppressed);
  if (hidden.length === 1) fail(file, `${key}: a single suppressed row can be recovered from the total`);
  for (const r of t.rows) {
    if (r.suppressed) {
      for (const [k, v] of Object.entries(r)) {
        if (!['id', 'name', 'department', 'suppressed'].includes(k) && v !== null) {
          fail(file, `${key} "${r.name}": suppressed row still exposes ${k}`);
        }
      }
    } else if (typeof r.cases !== 'number' || r.cases < min) {
      fail(file, `${key} "${r.name}": ${r.cases} cases is under the ${min}-case minimum`);
    }
    for (const k of ['on_time_rate', 'reopened_rate']) {
      if (r[k] != null && (r[k] < 0 || r[k] > 100)) fail(file, `${key} "${r.name}": ${k} out of range`);
    }
  }

  // Same metric, two values: duplicate names/ids inside a table
  const seen = new Map();
  for (const r of t.rows) {
    const id = r.id ?? r.name;
    if (seen.has(id)) {
      const a = seen.get(id);
      fail(file, `${key} "${r.name}" appears twice (${a.cases}/${a.on_time_rate}% vs ${r.cases}/${r.on_time_rate}%)`);
    }
    seen.set(id, r);
  }
}

function weightedRate(t) {
  const rows = t.rows.filter((r) => r.on_time_rate != null);
  const n = rows.reduce((s, r) => s + r.cases, 0);
  return rows.reduce((s, r) => s + r.cases * r.on_time_rate, 0) / n;
}

// ---- Monthly files ----
if (!existsSync(join(DATA, 'index.json'))) {
  fail('public_data', 'index.json missing');
} else {
  const index = readJson(join(DATA, 'index.json'));
  const files = readdirSync(DATA).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
  const listed = index.months.map((m) => m.month);
  if (JSON.stringify(listed) !== JSON.stringify(files.map((f) => f.slice(0, 7)))) {
    fail('index.json', `month list ${listed.join(',')} ≠ files ${files.join(',')}`);
  }
  if (index.latest !== listed[listed.length - 1]) fail('index.json', `latest ${index.latest} is not the last month`);

  for (const f of files) {
    const d = readJson(join(DATA, f));
    const ym = f.slice(0, 7);
    scanKeys(d, f);

    // Month label must match the data month
    if (d.month !== ym) fail(f, `data month ${d.month} ≠ file name ${ym}`);
    if (d.month_label !== labelFor(d.month)) fail(f, `month label "${d.month_label}" ≠ "${labelFor(d.month)}"`);

    for (const key of ['departments', 'neighborhoods', 'topics']) checkTable(d, key, f);

    for (const r of d.neighborhoods?.rows ?? []) {
      if (r.name !== UNASSIGNED && !NEIGHBORHOODS.has(r.name)) fail(f, `unknown neighborhood "${r.name}"`);
    }

    // Same metric, two values: city on-time rate vs the division breakdown
    // (skipped only if suppression hides enough cases to move the average)
    if (d.departments && d.departments.suppressed_total / d.departments.total < 0.005) {
      const w = weightedRate(d.departments);
      if (Math.abs(w - d.city.on_time_rate) > RATE_TOLERANCE) {
        fail(f, `city on-time ${d.city.on_time_rate}% ≠ division-weighted ${w.toFixed(2)}%`);
      }
    }

    // Same metric, two values: index.json headline vs the month file
    const entry = index.months.find((m) => m.month === d.month);
    if (entry) {
      for (const [k, v] of [['total_cases', d.city.total_cases], ['on_time_rate', d.city.on_time_rate],
        ['month_label', d.month_label], ['data_status', d.data_status]]) {
        if (entry[k] !== v) fail(f, `${k} is ${v} here but ${entry[k]} in index.json`);
      }
    }
  }

  // ---- Content files ----
  const actions = readJson(join(CONTENT, 'actions.json'));
  const latest = readJson(join(DATA, `${index.latest}.json`));
  const topicIds = new Set(latest.topics.rows.map((t) => t.id));
  for (const a of actions.items) {
    if (!topicIds.has(a.topic_id)) fail('actions.json', `topic_id "${a.topic_id}" not in latest data`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.target_date) || isNaN(Date.parse(a.target_date))) {
      fail('actions.json', `"${a.topic_id}": target_date must be YYYY-MM-DD`);
    }
    if (/\d+(\.\d+)?\s*%/.test(a.action)) {
      fail('actions.json', `"${a.topic_id}": do not type rates in content; the page reads them from the data`);
    }
  }
  const weakest = latest.topics.rows.filter((t) => t.id !== 'other' && t.on_time_rate != null)
    .sort((a, b) => a.on_time_rate - b.on_time_rate).slice(0, 3);
  for (const t of weakest) {
    if (!actions.items.some((a) => a.topic_id === t.id)) warn('actions.json', `no action yet for weak topic "${t.name}"`);
  }

  const stories = readJson(join(CONTENT, 'stories.json'));
  for (const [ym, list] of Object.entries(stories.months)) {
    if (!listed.includes(ym)) fail('stories.json', `month ${ym} has no data file`);
    if (list.length > 3) fail('stories.json', `${ym}: at most 3 stories per month (found ${list.length})`);
    for (const s of list) {
      if (s.neighborhood && !NEIGHBORHOODS.has(s.neighborhood)) fail('stories.json', `unknown neighborhood "${s.neighborhood}"`);
      scanKeys(s, 'stories.json');
    }
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR    ${e}`);
  console.error(`\nValidation failed: ${errors.length} error(s).`);
  process.exit(1);
}
console.log('Public data validated: totals, metrics, month labels, suppression and privacy OK.');
