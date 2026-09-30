// The storage function deploys its own copy of the core. Run after editing
// app/static/js/core/moked-core.js:  node scripts/sync_core.mjs
// (the transparency build fails if the copies differ)
import { copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
copyFileSync(join(ROOT, 'app/static/js/core/moked-core.js'), join(ROOT, 'supabase/functions/moked106-admin/moked-core.js'));
console.log('Copied moked-core.js to supabase/functions/moked106-admin/');
