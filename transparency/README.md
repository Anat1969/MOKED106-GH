# דוח שקיפות לתושבים – מוקד 106

A public page, separate from the internal dashboard. Address: **https://moked106.vercel.app/shkifut/**

The page reads **only** from:
- `public_data/YYYY-MM.json` – a summarized monthly file (neighborhood / division / topic). Created by a script, not edited by hand.
- `public_data/index.json` – list of the months (updated automatically by the script).
- `content/actions.json` – "איפה עוד לא": problem, action and target date for each weak topic. **Edited by hand.**
- `content/stories.json` – "אמרתם, עשינו": up to 3 stories per month. **Edited by hand.**

## Monthly update

1. Update the internal data (the existing system) for the new month.
2. Generate the public file:
   ```
   python scripts/export_public_data.py
   ```
3. Update the content: stories for the new month in `content/stories.json`, and actions in `content/actions.json` if the weak topics changed.
4. Check:
   ```
   cd transparency && node scripts/validate.mjs
   ```
5. Commit + push → Vercel runs the check again and only publishes if it passes.

## Automatic check (fails the publish)

`scripts/validate.mjs` runs on every build and stops the publish if:
- The total number of requests isn't identical across all tables (neighborhoods / divisions / topics) and in the summary.
- A metric appears with two different values (a topic twice, a city value vs. the division breakdown, a monthly file vs. `index.json`).
- The month label doesn't match the data month (or the file name).
- A cell with fewer than 5 requests is exposed, or a single hidden cell that can be derived from the total.
- A forbidden field appears (street, address, manager, phone, etc.) or an unknown neighborhood.
- Content: a topic that doesn't exist, a wrong date, a percentage typed into the content, more than 3 stories per month.

## Demo data (temporary)

Only May 2026 is real. `scripts/make_demo_history.py` created 11 earlier months and a reopened-requests rate as **demo data** (`data_status: "demo"`), and the page labels them clearly.
Once real months accumulate: delete the demo files from `public_data/`, don't run the script again, and add the reopened-requests rate to the export once it's collected in the system.
