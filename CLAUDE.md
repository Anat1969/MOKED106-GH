# CLAUDE.md

## A&I logo button
The top bar holds only the app name (links home), content navigation, and ONE logo button "אד' ענת שטיבלמן A&I" (`<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js). Every editing and development action (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, edit mode, add, delete) lives only inside it, never as loose buttons. Standard: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
In this repo: the dashboard (`app/templates/index.html`) and admin page carry `<ai-menu>` in the header ("העלאת דוח חודשי" is a menu item); the public transparency page (`transparency/index.html`) has no top bar and uses `data-auto`.

## Transparency page: promise vs reality (03.11.2026, branch preview)
- Section 1 "הבטחה מול מציאות": per topic, the promised time (`standard_text`) next to the on-time share as a bar against the 80% bar (`GOAL`), plus one sentence (how many waited longer, points above/below). Section 2: city trend and neighbourhoods, with a "מול ההבטחה" ranked view (80% mark + city average mark).
- Rule: every trend, verdict or comparison uses REAL months only (`realPts`/`trend` in `transparency.js`). With one real month the page says so; demo months appear in charts only on "הצגת חודשי ההדגמה" (`?demo=1`), dashed. In a demo month every interpreting sentence is prefixed "הדגמה".
- Fixed layer: IBM Plex Sans Hebrew + Plex Mono labels, square borderless buttons with shadow, `[hidden]` forced (the back link used to show to residents), skip link, visible focus ring.
