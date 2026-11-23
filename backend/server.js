#!/usr/bin/env node
// Small local backend for the SG Bus Timing Android app. The app never
// talks to LTA DataMall directly - it calls this server, which holds the
// API key and does the real/mock switch, and the backend trims each
// response down to just the fields the app needs before sending it back,
// to keep the phone's mobile data usage low.
//
// Routes:
//   GET  /api/config               -> { mode: "live" | "mock" }
//   GET  /api/stops?q=text         -> matching bus stops (local dataset), slim shape
//   GET  /api/stops/nearby?lat=&lng=&radiusKm=  -> stops within radiusKm, closest first, with coordinates
//   GET  /api/arrivals?stop=NN     -> live or mock bus arrival timings, slim shape
//
// Run with: npm start   (or MOCK=1 npm start to force offline mock data)

import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.js";
import { getBusArrival, LtaApiError } from "./lib/ltaClient.js";
import { getMockArrivals } from "./lib/mock.js";
import { SAMPLE_BUS_STOPS } from "./lib/busStopsSample.js";
import { slimStop, slimArrivals } from "./lib/slim.js";
import { findNearbyStops, DEFAULT_RADIUS_KM } from "./lib/nearby.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ACCOUNT_KEY = process.env.LTA_ACCOUNT_KEY || "";
const FORCE_MOCK = process.env.MOCK === "1";
const LIVE_MODE = Boolean(ACCOUNT_KEY) && !FORCE_MOCK;

// Short in-memory cache so repeated polling of the same stop (one phone,
// or several) doesn't each trigger a fresh upstream request, and so a
// quick re-poll from the app costs no extra mobile data round trip.
const arrivalCache = new Map(); // stopCode -> { at, data }
const CACHE_MS = 8_000;

let busStopsPromise = null;
async function loadBusStops() {
  if (busStopsPromise) return busStopsPromise;
  busStopsPromise = (async () => {
    const cachedPath = path.join(__dirname, "data", "bus-stops.json");
    if (existsSync(cachedPath)) {
      try {
        const raw = await readFile(cachedPath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fall through to sample data
      }
    }
    return SAMPLE_BUS_STOPS;
  })();
  return busStopsPromise;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function handleStops(req, res, query) {
  const q = (query.get("q") || "").trim().toLowerCase();
  const stops = await loadBusStops();
  let results = stops;
  if (q) {
    results = stops.filter((s) => {
      const code = String(s.BusStopCode || "").toLowerCase();
      const desc = String(s.Description || "").toLowerCase();
      const road = String(s.RoadName || "").toLowerCase();
      return code.includes(q) || desc.includes(q) || road.includes(q);
    });
  }
  sendJson(res, 200, { count: results.length, stops: results.slice(0, 50).map(slimStop) });
}

async function handleNearbyStops(req, res, query) {
  const lat = Number(query.get("lat"));
  const lng = Number(query.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendJson(res, 400, { error: "Query params 'lat' and 'lng' must both be numbers." });
    return;
  }
  const radiusKm = Number(query.get("radiusKm")) || DEFAULT_RADIUS_KM;

  const stops = await loadBusStops();
  const results = findNearbyStops(stops, lat, lng, radiusKm);
  sendJson(res, 200, { count: results.length, radiusKm, stops: results });
}

async function handleArrivals(req, res, query) {
  const stop = (query.get("stop") || "").trim();
  if (!/^\d{3,5}$/.test(stop)) {
    sendJson(res, 400, { error: "Query param 'stop' must be a numeric bus stop code." });
    return;
  }

  const cached = arrivalCache.get(stop);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    sendJson(res, 200, slimArrivals(cached.data, LIVE_MODE ? "live" : "mock"));
    return;
  }

  try {
    const data = LIVE_MODE
      ? await getBusArrival(ACCOUNT_KEY, stop)
      : getMockArrivals(stop);
    arrivalCache.set(stop, { at: Date.now(), data });
    sendJson(res, 200, slimArrivals(data, LIVE_MODE ? "live" : "mock"));
  } catch (err) {
    const status = err instanceof LtaApiError ? err.status : 502;
    sendJson(res, status, { error: err.message || "Failed to fetch bus arrival data." });
  }
}

const server = createServer(async (req, res) => {
  try {
    // Use a fixed base: routing only needs the request path and query, and
    // a malformed Host header would otherwise throw before this try block.
    const url = new URL(req.url, "http://localhost");
    const { pathname, searchParams } = url;

    if (pathname === "/api/config") {
      sendJson(res, 200, { mode: LIVE_MODE ? "live" : "mock" });
    } else if (pathname === "/api/stops") {
      await handleStops(req, res, searchParams);
    } else if (pathname === "/api/stops/nearby") {
      await handleNearbyStops(req, res, searchParams);
    } else if (pathname === "/api/arrivals") {
      await handleArrivals(req, res, searchParams);
    } else {
      sendJson(res, 404, { error: "Unknown route." });
    }
  } catch (err) {
    sendJson(res, 500, { error: "Internal server error", detail: String(err && err.message) });
  }
});

server.listen(PORT, () => {
  console.log(`Bus timing backend running at http://localhost:${PORT}`);
  console.log(`Mode: ${LIVE_MODE ? "LIVE (LTA DataMall)" : "MOCK (offline sample data)"}`);
  if (!LIVE_MODE) {
    console.log(
      "Tip: set LTA_ACCOUNT_KEY in .env to use real live arrival data. See .env.example."
    );
  }
});
