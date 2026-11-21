/**
 * Neon Coast Cover Studio — local preview server.
 *
 * Serves this repository's root over HTTP so app/index.html runs
 * the way a static host serves it (exports are blocked on
 * file:// by Chromium, so always preview over HTTP).
 *
 *   node serve.ts            # http://localhost:8080
 *   PORT=4173 node serve.ts  # http://localhost:4173
 *
 * Graceful shutdown on SIGINT / SIGTERM. HTML, CSS and JS are
 * served fresh (no-cache); images and fonts get a one-hour
 * cache. No logging of request bodies, no uploads, no writes.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".");
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "127.0.0.1";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/* HTML, CSS and JS change while you edit: always revalidate.
   Images and fonts are content-stable: cache them for an hour. */
function cacheControl(ext: string): string {
  switch (ext) {
    case ".html":
    case ".css":
    case ".js":
    case ".mjs":
    case ".json":
      return "no-cache";
    default:
      return "public, max-age=3600";
  }
}

function sendError(res: ServerResponse, code: number, message: string): void {
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
  res.end(`${code} ${message}\n`);
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendError(res, 405, "Method Not Allowed");
    return;
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/app/index.html";

  /* Resolve inside ROOT only; a path climbing out is refused. */
  const file = resolve(join(ROOT, normalize(pathname)));
  if (!file.startsWith(ROOT + "/") && file !== ROOT) {
    sendError(res, 403, "Forbidden");
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    sendError(res, 404, "Not Found");
    return;
  }

  const ext = extname(file).toLowerCase();
  const headers: Record<string, string> = {
    "content-type": MIME[ext] ?? "application/octet-stream",
    "cache-control": cacheControl(ext),
    "content-length": String(statSync(file).size),
  };
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

const server = createServer(handle);

function shutdown(signal: string): void {
  console.log(`serve.ts: ${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  /* Do not hang on a slow connection: force out after 5 s. */
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, HOST, () => {
  console.log(`Neon Coast Cover Studio preview at http://${HOST}:${PORT}/app/index.html`);
});
