#!/usr/bin/env node
// Simple, dependency-free HTTP server for the SG Bus Timing app.
//
// Routes:
//   GET  /api/config           -> { mode: "live" | "mock" }
//   GET  /api/stops?q=text     -> matching bus stops (local dataset)
//   GET  /api/arrivals?stop=NN -> live or mock bus arrival timings
//   *    static files from ./public
//
// Run with: npm start   (or MOCK=1 npm start to force offline mock data)

import { createServer } from "node:http";
import { readFile, existsSync } from "node:fs";
import { readFile as readFileP } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.js";
import { getBusArrival, LtaApiError } from "./lib/ltaClient.js";
import { getMockArrivals } from "./lib/mock.js";
import { SAMPLE_BUS_STOPS } from "./lib/busStopsSample.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3000;
const ACCOUNT_KEY = process.env.LTA_ACCOUNT_KEY || "";
const FORCE_MOCK = process.env.MOCK === "1";
const LIVE_MODE = Boolean(ACCOUNT_KEY) && !FORCE_MOCK;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Small cache so several browser tabs polling the same stop don't each
// trigger a fresh upstream request; also gentle on LTA's rate limits.
const arrivalCache = new Map(); // stopCode -> { at, data }
const CACHE_MS = 8_000;

let busStopsPromise = null;
async function loadBusStops() {
  if (busStopsPromise) return busStopsPromise;
  busStopsPromise = (async () => {
    const cachedPath = path.join(__dirname, "data", "bus-stops.json");
    if (existsSync(cachedPath)) {
      try {
        const raw = await readFileP(cachedPath, "utf8");
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

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
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
  sendJson(res, 200, { count: results.length, stops: results.slice(0, 50) });
}

async function handleArrivals(req, res, query) {
  const stop = (query.get("stop") || "").trim();
  if (!/^\d{3,5}$/.test(stop)) {
    sendJson(res, 400, { error: "Query param 'stop' must be a numeric bus stop code." });
    return;
  }

  const cached = arrivalCache.get(stop);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    sendJson(res, 200, { ...cached.data, mode: LIVE_MODE ? "live" : "mock", cached: true });
    return;
  }

  try {
    const data = LIVE_MODE
      ? await getBusArrival(ACCOUNT_KEY, stop)
      : getMockArrivals(stop);
    arrivalCache.set(stop, { at: Date.now(), data });
    sendJson(res, 200, { ...data, mode: LIVE_MODE ? "live" : "mock", cached: false });
  } catch (err) {
    const status = err instanceof LtaApiError ? err.status : 502;
    sendJson(res, status, { error: err.message || "Failed to fetch bus arrival data." });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === "/api/config") {
      sendJson(res, 200, { mode: LIVE_MODE ? "live" : "mock" });
    } else if (pathname === "/api/stops") {
      await handleStops(req, res, searchParams);
    } else if (pathname === "/api/arrivals") {
      await handleArrivals(req, res, searchParams);
    } else if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Unknown API route." });
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (err) {
    sendJson(res, 500, { error: "Internal server error", detail: String(err && err.message) });
  }
});

server.listen(PORT, () => {
  console.log(`Bus timing app running at http://localhost:${PORT}`);
  console.log(`Mode: ${LIVE_MODE ? "LIVE (LTA DataMall)" : "MOCK (offline sample data)"}`);
  if (!LIVE_MODE) {
    console.log(
      "Tip: set LTA_ACCOUNT_KEY in .env to use real live arrival data. See .env.example."
    );
  }
});
