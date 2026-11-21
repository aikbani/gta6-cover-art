/**
 * Neon Coast Cover Studio — entrypoint.
 *
 * Copies app/ and screenshots/ from this repository into the
 * output directory and writes the entry dossier there:
 *
 *   - dossier.json — written by buildDossier from vendor/makefun-app.ts,
 *     the kit's library, from the copied app/ and screenshots/.
 *   - manifest.json — a plain listing of every file in the output
 *     directory with its byte size and sha256, sorted by path.
 *
 * Invocation (Node 22, TypeScript runs as-is):
 *
 *   node main.ts
 *
 * The output directory is /output by default; outside the grader
 * MAKEFUN_OUTPUT_DIR stands in for it. The program exits non-zero
 * if anything it needs is missing.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";
import { buildDossier } from "./vendor/makefun-app.ts";

const REPO_ROOT = resolve(import.meta.dirname ?? ".");
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

/* The gate's caps for this competition: the dossier text cap,
   at most four screenshots of at most 256 KiB, app/ at most
   993 files and 48 MiB, every path at most 1,000 UTF-8 bytes. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
} as const;

interface ManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
}

/** Walk a directory depth-first, returning POSIX relative paths. */
function walkFiles(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else if (st.isFile()) {
      out.push(relative(base, full).split("\\").join("/"));
    }
  }
  return out;
}

function sha256Of(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function main(): void {
  const appDir = join(REPO_ROOT, "app");
  const shotsDir = join(REPO_ROOT, "screenshots");
  for (const dir of [appDir, shotsDir]) {
    if (!existsSync(dir)) {
      throw new Error(`main.ts: missing required directory ${dir}`);
    }
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  /* Copy the two trees the dossier is built from. */
  cpSync(appDir, join(OUTPUT_DIR, "app"), { recursive: true });
  cpSync(shotsDir, join(OUTPUT_DIR, "screenshots"), { recursive: true });

  /* The dossier, written by the kit's own library from the copy. */
  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
  writeFileSync(join(OUTPUT_DIR, "dossier.json"), dossier);

  /* A plain manifest of everything handed in, sorted by path. */
  const manifest: ManifestEntry[] = [];
  for (const rel of walkFiles(OUTPUT_DIR, OUTPUT_DIR)) {
    const full = join(OUTPUT_DIR, rel);
    manifest.push({
      path: rel,
      bytes: statSync(full).size,
      sha256: sha256Of(full),
    });
  }
  manifest.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  writeFileSync(
    join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const totalBytes = manifest.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(`Neon Coast Cover Studio: wrote ${manifest.length} files (${totalBytes} bytes) to ${OUTPUT_DIR}`);
  console.log(`dossier.json: ${statSync(join(OUTPUT_DIR, "dossier.json")).size} bytes`);
}

main();
