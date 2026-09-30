# דוח שקיפות לתושבים – מוקד 106

A public page, separate from the internal dashboard. Address: **https://moked106.vercel.app/shkifut/**

The page reads **only** from summarized monthly files (neighborhood / division / topic) and from content files:
- Months published from report uploads (Supabase storage, `moked106/public/`) — every month that is uploaded replaces the bundled month.
- `public_data/` in the project – a backup: May 2026 (read from the report with the engine) and 11 demo months.
- `content/actions.json` – "איפה עוד לא": problem, action and target date for each weak topic. **Edited by hand.**
- `content/stories.json` – "אמרתם, עשינו": up to 3 stories per month. **Edited by hand.**

## Monthly update

1. In the director's dashboard, click **"העלאת דוח חודשי"** (address `/admin`).
2. Drag in the director's monthly report (pptx), plus the "10 נושאים לפי רחובות" file (xlsx) if you have it.
3. The page reads the files and shows all the cross-checks: errors (you can't save), notes (gaps in the source report that you need to acknowledge), and checks that passed.
4. **"שמירה ופרסום"** with the admin password. The storage function reads the files again itself, runs the same checks, and saves **a new version** — nothing is deleted.
   The director's dashboard and the transparency page update from the active version. You can switch to an earlier version from the "גרסאות לפי חודש" table.
5. Content (`content/actions.json`, `content/stories.json`) is edited by hand + commit.

Storage — Supabase project ASHDODMAP, `moked106` folder:
`internal/` (months and versions for the dashboard) · `public/` (transparency page files) · `raw/` (the original files of each version) · `geo/` (map locations) · `admin/` (password hash only, locked for reading).

## One engine for everything

`app/static/js/core/moked-core.js` — reading the report, the cross-checks, building the public file and validating it.
It's used by the upload page, the storage function (`supabase/functions/moked106-admin`) and the validation script here.
The function uses a copy: after any change to the engine, run `node scripts/sync_core.mjs` (the build fails if the copies differ).

## Automatic check (fails the publish)

On every upload (in the function) and on every build (`scripts/validate.mjs`), the publish stops if:
- The total number of requests isn't identical across all tables (neighborhoods / divisions / topics) and in the summary.
- A metric appears with two different values (a topic twice, a city value vs. the division breakdown, a monthly file vs. the month list).
- The month label doesn't match the data month (or the month chosen in the upload).
- A cell with fewer than 5 requests is exposed, or a single hidden cell that can be derived from the total.
- A forbidden field appears (street, address, manager, phone, etc.) or an unknown neighborhood.
- In the report itself: the neighborhoods table isn't aligned (requests ÷ residents doesn't match the percentage in the report), a row in a street table doesn't add up to its total, an invalid number or an unrecognized standard time.
- Content: a topic that doesn't exist, a wrong date, a percentage typed into the content, more than 3 stories per month.

## Demo data (temporary)

Only May 2026 is real. `scripts/make_demo_history.py` created 11 earlier months (including a reopened-requests rate) as **demo data** (`data_status: "demo"`), and the page labels them clearly.
The reopened-requests rate isn't collected yet for real months, and it appears as "טרם נאסף".
Once real months accumulate: delete the demo files from `public_data/` and don't run the script again.
