// Price quotes: deterministic offline mock prices, or live quotes from
// Finnhub (https://finnhub.io) when FINNHUB_API_KEY is set. The key stays on
// the server; the browser only ever talks to this app's /api routes.

import { getInstrument } from "./universe.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small deterministic wobble so mock prices move day to day but are stable
// within a day (and in tests).
function wobble(symbol, day) {
  const x = Math.sin(hash(symbol) * 0.0001 + day * 0.7) * 10000;
  return x - Math.floor(x); // 0..1
}

export function getMockQuote(symbol, now = new Date()) {
  const sym = String(symbol).toUpperCase();
  const inst = getInstrument(sym);
  const base = inst ? inst.mockPrice : 20 + (hash(sym) % 28000) / 100;
  const day = Math.floor(now.getTime() / 86_400_000);
  const price = base * (0.97 + 0.06 * wobble(sym, day));
  const prevClose = base * (0.97 + 0.06 * wobble(sym, day - 1));
  return {
    symbol: sym,
    price: Math.round(price * 100) / 100,
    prevClose: Math.round(prevClose * 100) / 100,
    currency: "USD",
    source: "mock",
    known: Boolean(inst),
  };
}

export class QuoteApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function finnhubGet(apiKey, pathAndQuery, fetchImpl) {
  const url = `${FINNHUB_BASE}${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}token=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (res.status === 401 || res.status === 403) throw new QuoteApiError("Finnhub rejected the API key, or this symbol needs a paid plan.", res.status);
  if (res.status === 429) throw new QuoteApiError("Finnhub rate limit reached; try again in a minute.", 429);
  if (!res.ok) throw new QuoteApiError(`Finnhub request failed (HTTP ${res.status}).`);
  return res.json();
}

/** Live quote for one symbol; returns null if Finnhub has no data for it. */
export async function getLiveQuote(apiKey, symbol, fetchImpl = fetch) {
  const sym = String(symbol).toUpperCase();
  const inst = getInstrument(sym);
  const remote = (inst && inst.liveSymbol) || sym;
  const data = await finnhubGet(apiKey, `/quote?symbol=${encodeURIComponent(remote)}`, fetchImpl);
  // Finnhub returns zeros for symbols it doesn't cover.
  if (!data || !(Number(data.c) > 0)) return null;
  return {
    symbol: sym,
    price: Number(data.c),
    prevClose: Number(data.pc) || null,
    currency: "USD",
    source: "live",
    known: Boolean(inst),
  };
}

export async function searchLive(apiKey, query, fetchImpl = fetch) {
  const data = await finnhubGet(apiKey, `/search?q=${encodeURIComponent(query)}`, fetchImpl);
  const items = Array.isArray(data && data.result) ? data.result : [];
  return items
    .filter((r) => r.symbol && !r.symbol.includes(":"))
    .slice(0, 10)
    .map((r) => ({
      symbol: String(r.symbol).toUpperCase(),
      name: r.description || r.symbol,
      type: /ETF|ETP/i.test(r.type || "") ? "ETF" : r.type === "Common Stock" ? "Stock" : r.type || "Other",
      category: "",
      expenseRatio: null,
    }));
}
