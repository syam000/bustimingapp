// The /api/* routes, written against plain URL + JSON so the same code runs
// in the local Node server (server.js) and on Cloudflare Workers (worker.js).
// No Node-only imports here.

import { searchUniverse } from "./universe.js";
import { getMockQuote, getLiveQuote, searchLive, QuoteApiError } from "./quotes.js";

const SYMBOL_RE = /^[A-Z0-9.\-]{1,15}$/;
const QUOTE_CACHE_MS = 60_000;
const quoteCache = new Map(); // symbol -> { at, quote } (per process / isolate)

export function isLive(apiKey, forceMock = false) {
  return Boolean(apiKey) && apiKey !== "your-key-here" && !forceMock;
}

async function quoteFor(symbol, apiKey, live) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_CACHE_MS) return cached.quote;
  let quote = null;
  let error = null;
  if (live) {
    try {
      quote = await getLiveQuote(apiKey, symbol);
    } catch (err) {
      error = err.message;
    }
  }
  if (!quote) {
    // Fall back to a clearly labelled estimate so the app keeps working.
    quote = { ...getMockQuote(symbol), ...(live ? { fallback: true, error: error || "No live data for this symbol." } : {}) };
  }
  quoteCache.set(symbol, { at: Date.now(), quote });
  return quote;
}

/**
 * Handle an /api/* request. Returns { status, body } (body is a JSON-able
 * object), or null if the path isn't an API route.
 */
export async function handleApi(url, { apiKey = "", forceMock = false } = {}) {
  const { pathname, searchParams } = url;
  if (!pathname.startsWith("/api/")) return null;
  const live = isLive(apiKey, forceMock);
  const mode = live ? "live" : "mock";

  if (pathname === "/api/config") return { status: 200, body: { mode } };

  if (pathname === "/api/quotes") {
    const symbols = [...new Set((searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (symbols.length === 0 || symbols.length > 40 || !symbols.every((s) => SYMBOL_RE.test(s))) {
      return { status: 400, body: { error: "Pass 1-40 comma-separated ticker symbols in 'symbols'." } };
    }
    const entries = await Promise.all(symbols.map(async (s) => [s, await quoteFor(s, apiKey, live)]));
    return { status: 200, body: { mode, asOf: new Date().toISOString(), quotes: Object.fromEntries(entries) } };
  }

  if (pathname === "/api/search") {
    const q = (searchParams.get("q") || "").trim().slice(0, 40);
    const local = searchUniverse(q);
    let remote = [];
    if (live && q.length >= 2) {
      try {
        remote = await searchLive(apiKey, q);
      } catch (err) {
        if (!(err instanceof QuoteApiError)) throw err;
      }
    }
    const seen = new Set(local.map((i) => i.symbol));
    return { status: 200, body: { results: [...local, ...remote.filter((r) => !seen.has(r.symbol))].slice(0, 20) } };
  }

  return { status: 404, body: { error: "Unknown API route." } };
}
