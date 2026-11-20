// Neon Coast Cover Studio — entrypoint.
// Copies app/ and screenshots/ from this repository into the output directory
// and writes /output/dossier.json with buildDossier from vendor/makefun-app.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { buildDossier } from './vendor/makefun-app.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of ['app', 'screenshots']) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error(`main.ts: missing ${name}/ in the repository`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
