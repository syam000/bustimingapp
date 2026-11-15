#!/usr/bin/env node
// Dependency-free HTTP server for EasyInvest.
//
// Routes:
//   GET /api/config                 -> { mode: "live" | "mock" }
//   GET /api/search?q=text          -> matching ETFs / stocks
//   GET /api/quotes?symbols=A,B,C   -> { quotes: { A: {price, prevClose, source} } }
//   GET /lib/allocate.js, /lib/universe.js -> shared logic for the browser
//   *   static files from ./public
//
// Run with: npm start   (or MOCK=1 npm start to force offline mock prices)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.js";
import { searchUniverse } from "./lib/universe.js";
import { getMockQuote, getLiveQuote, searchLive, QuoteApiError } from "./lib/quotes.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const SHARED_LIB = new Set(["/lib/allocate.js", "/lib/universe.js"]);
const PORT = Number(process.env.PORT) || 3100;
const API_KEY = process.env.FINNHUB_API_KEY || "";
const LIVE_MODE = Boolean(API_KEY) && API_KEY !== "your-key-here" && process.env.MOCK !== "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const SYMBOL_RE = /^[A-Z0-9.\-]{1,15}$/;
const quoteCache = new Map(); // symbol -> { at, quote }
const QUOTE_CACHE_MS = 60_000;

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
  if (SHARED_LIB.has(pathname)) return serveFile(res, path.join(__dirname, pathname));
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  return serveFile(res, filePath);
}

async function quoteFor(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_CACHE_MS) return cached.quote;
  let quote = null;
  let error = null;
  if (LIVE_MODE) {
    try {
      quote = await getLiveQuote(API_KEY, symbol);
    } catch (err) {
      error = err.message;
    }
  }
  if (!quote) {
    // Fall back to a mock price, clearly labelled, so the app keeps working.
    quote = { ...getMockQuote(symbol), ...(LIVE_MODE ? { fallback: true, error: error || "No live data for this symbol." } : {}) };
  }
  quoteCache.set(symbol, { at: Date.now(), quote });
  return quote;
}

async function handleQuotes(res, query) {
  const symbols = [...new Set((query.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (symbols.length === 0 || symbols.length > 40 || !symbols.every((s) => SYMBOL_RE.test(s))) {
    sendJson(res, 400, { error: "Pass 1-40 comma-separated ticker symbols in 'symbols'." });
    return;
  }
  const entries = await Promise.all(symbols.map(async (s) => [s, await quoteFor(s)]));
  sendJson(res, 200, { mode: LIVE_MODE ? "live" : "mock", asOf: new Date().toISOString(), quotes: Object.fromEntries(entries) });
}

async function handleSearch(res, query) {
  const q = (query.get("q") || "").trim().slice(0, 40);
  const local = searchUniverse(q);
  let remote = [];
  if (LIVE_MODE && q.length >= 2) {
    try {
      remote = await searchLive(API_KEY, q);
    } catch (err) {
      if (!(err instanceof QuoteApiError)) throw err;
    }
  }
  const seen = new Set(local.map((i) => i.symbol));
  const results = [...local, ...remote.filter((r) => !seen.has(r.symbol))].slice(0, 20);
  sendJson(res, 200, { results });
}

const server = createServer(async (req, res) => {
  try {
    const { pathname, searchParams } = new URL(req.url, "http://localhost");
    if (pathname === "/api/config") sendJson(res, 200, { mode: LIVE_MODE ? "live" : "mock" });
    else if (pathname === "/api/quotes") await handleQuotes(res, searchParams);
    else if (pathname === "/api/search") await handleSearch(res, searchParams);
    else if (pathname.startsWith("/api/")) sendJson(res, 404, { error: "Unknown API route." });
    else await serveStatic(res, pathname);
  } catch (err) {
    sendJson(res, 500, { error: "Internal server error", detail: String(err && err.message) });
  }
});

server.listen(PORT, () => {
  console.log(`EasyInvest running at http://localhost:${PORT}`);
  console.log(`Prices: ${LIVE_MODE ? "LIVE (Finnhub)" : "MOCK (offline demo prices)"}`);
  if (!LIVE_MODE) console.log("Tip: set FINNHUB_API_KEY in .env for live quotes. See .env.example.");
});
