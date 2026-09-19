// Loads the local bus stop dataset: prefers the full cached list at
// data/bus-stops.json (populated by `npm run fetch-stops` when an API key
// is available), falling back to the small bundled sample otherwise.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SAMPLE_BUS_STOPS } from "./busStopsSample.js";

const CACHED_PATH = path.join(process.cwd(), "data", "bus-stops.json");

let busStopsPromise = null;

export function loadBusStops() {
  if (busStopsPromise) return busStopsPromise;
  busStopsPromise = (async () => {
    if (existsSync(CACHED_PATH)) {
      try {
        const raw = await readFile(CACHED_PATH, "utf8");
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

export function searchBusStops(stops, query) {
  const q = query.trim().toLowerCase();
  if (!q) return stops;
  return stops.filter((s) => {
    const code = String(s.BusStopCode || "").toLowerCase();
    const desc = String(s.Description || "").toLowerCase();
    const road = String(s.RoadName || "").toLowerCase();
    return code.includes(q) || desc.includes(q) || road.includes(q);
  });
}
