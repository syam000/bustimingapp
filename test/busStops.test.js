import { test } from "node:test";
import assert from "node:assert/strict";
import { searchBusStops, loadBusStops } from "../lib/busStops.js";
import { SAMPLE_BUS_STOPS } from "../lib/busStopsSample.js";

const FIXTURE_STOPS = [
  { BusStopCode: "83139", Description: "Hougang Ctrl Stn", RoadName: "Upp Serangoon Rd" },
  { BusStopCode: "09048", Description: "Opp Orchard Stn", RoadName: "Orchard Blvd" },
];

test("searchBusStops matches by stop code, description, or road name (case-insensitive)", () => {
  assert.deepEqual(searchBusStops(FIXTURE_STOPS, "orchard"), [FIXTURE_STOPS[1]]);
  assert.deepEqual(searchBusStops(FIXTURE_STOPS, "83139"), [FIXTURE_STOPS[0]]);
  assert.deepEqual(searchBusStops(FIXTURE_STOPS, "SERANGOON"), [FIXTURE_STOPS[0]]);
});

test("searchBusStops returns every stop for an empty or whitespace-only query", () => {
  assert.deepEqual(searchBusStops(FIXTURE_STOPS, ""), FIXTURE_STOPS);
  assert.deepEqual(searchBusStops(FIXTURE_STOPS, "   "), FIXTURE_STOPS);
});

test("searchBusStops returns an empty array when nothing matches", () => {
  assert.deepEqual(searchBusStops(FIXTURE_STOPS, "zzz-no-such-stop"), []);
});

test("loadBusStops falls back to the bundled sample when no cached dataset file exists", async () => {
  const stops = await loadBusStops();
  assert.deepEqual(stops, SAMPLE_BUS_STOPS);
});
