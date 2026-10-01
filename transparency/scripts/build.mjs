// Validate, then copy the static site into dist/ for Vercel.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(ROOT, 'scripts', 'validate.mjs')], { stdio: 'inherit' });

const DIST = join(ROOT, 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);
for (const p of ['index.html', 'manifest.webmanifest', 'icons', 'css', 'js', 'public_data', 'content']) {
  cpSync(join(ROOT, p), join(DIST, p), { recursive: true });
}
console.log('Built transparency site -> dist/');
