#!/usr/bin/env node
// Dependency-free local HTTP server for EasyInvest.
//
// Routes:
//   /api/*  -> lib/api.js (shared with the Cloudflare Worker in worker.js)
//   /                 -> index.html
//   /src/*            -> UI code (src/)
//   /lib/allocate.js, /lib/universe.js -> shared logic for the browser
//
// Run with: npm start   (or MOCK=1 npm start to force offline mock prices)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.js";
import { handleApi, isLive } from "./lib/api.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "src");
const SHARED_LIB = new Set(["/lib/allocate.js", "/lib/universe.js"]);
const PORT = Number(process.env.PORT) || 3100;
const API_OPTS = { apiKey: process.env.FINNHUB_API_KEY || "", forceMock: process.env.MOCK === "1" };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function serveFile(res, filePath) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

async function serveStatic(res, pathname) {
  if (pathname === "/" || pathname === "/index.html") return serveFile(res, path.join(__dirname, "index.html"));
  if (SHARED_LIB.has(pathname)) return serveFile(res, path.join(__dirname, pathname));
  const filePath = path.normalize(path.join(__dirname, pathname));
  if (!pathname.startsWith("/src/") || !filePath.startsWith(SRC_DIR + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  return serveFile(res, filePath);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const result = await handleApi(url, API_OPTS);
    if (result) sendJson(res, result.status, result.body);
    else await serveStatic(res, url.pathname);
  } catch (err) {
    sendJson(res, 500, { error: "Internal server error", detail: String(err && err.message) });
  }
});

server.listen(PORT, () => {
  const live = isLive(API_OPTS.apiKey, API_OPTS.forceMock);
  console.log(`EasyInvest running at http://localhost:${PORT}`);
  console.log(`Prices: ${live ? "LIVE (Finnhub)" : "MOCK (offline demo prices)"}`);
  if (!live) console.log("Tip: set FINNHUB_API_KEY in .env for live quotes. See .env.example.");
});
