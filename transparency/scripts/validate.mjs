// Validates the bundled public data and content files with the SAME rules the
// storage function applies on every upload (app/static/js/core/moked-core.js).
// Exits non-zero (failing the Vercel build) if totals disagree, a metric has two
// values, a month label does not match its data, a small cell is exposed, a
// forbidden field appears, or the function's copy of the core has drifted.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');
const CORE = join(REPO, 'app/static/js/core/moked-core.js');
await import(pathToFileURL(CORE).href);
const C = globalThis.MokedCore;

const DATA = join(ROOT, 'public_data');
const CONTENT = join(ROOT, 'content');
const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// The storage function must run exactly the same core as the dashboard and this build
const fnCopy = join(REPO, 'supabase/functions/moked106-admin/moked-core.js');
if (existsSync(fnCopy) && readFileSync(fnCopy, 'utf8') !== readFileSync(CORE, 'utf8')) {
  fail('moked-core.js', 'the storage function copy differs from app/static/js/core — run: node scripts/sync_core.mjs');
}

const index = readJson(join(DATA, 'index.json'));
const files = readdirSync(DATA).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
const months = files.map((f) => readJson(join(DATA, f)));
for (const e of C.validatePublicIndex(index, months)) fail('index.json', e);

for (const [i, d] of months.entries()) {
  const f = files[i];
  for (const e of C.validatePublicMonth(d, f.slice(0, 7))) fail(f, e);
  if (!['real', 'demo'].includes(d.data_status)) fail(f, `unknown data_status "${d.data_status}"`);
}

// ---- Content files ----
const listed = index.months.map((m) => m.month);
const latest = months[months.length - 1];
const actions = readJson(join(CONTENT, 'actions.json'));
for (const a of actions.items) {
  if (!latest.topics.rows.some((t) => t.id === a.topic_id)) fail('actions.json', `topic_id "${a.topic_id}" not in latest data`);
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
  if (!/^\d{4}-\d{2}$/.test(ym)) fail('stories.json', `bad month key ${ym}`);
  else if (!listed.includes(ym)) warn('stories.json', `month ${ym} is not in the bundled data (fine if it comes from storage)`);
  if (list.length > 3) fail('stories.json', `${ym}: at most 3 stories per month (found ${list.length})`);
  for (const s of list) {
    if (s.neighborhood && !C.NEIGHBORHOODS.includes(s.neighborhood)) fail('stories.json', `unknown neighborhood "${s.neighborhood}"`);
    for (const k of Object.keys(s)) if (/street|address|phone|email|name_of/i.test(k)) fail('stories.json', `forbidden field "${k}"`);
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR    ${e}`);
  console.error(`\nValidation failed: ${errors.length} error(s).`);
  process.exit(1);
}
console.log('Public data validated with the shared core: totals, metrics, month labels, suppression and privacy OK.');
