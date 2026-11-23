import { test } from "node:test";
import assert from "node:assert/strict";
import { findNearbyStops } from "../lib/nearby.js";

const STOPS = [
  { BusStopCode: "A", RoadName: "Road A", Description: "Near", Latitude: 1.3000, Longitude: 103.8000 },
  { BusStopCode: "B", RoadName: "Road B", Description: "Mid", Latitude: 1.3100, Longitude: 103.8100 },
  { BusStopCode: "C", RoadName: "Road C", Description: "Far", Latitude: 1.5000, Longitude: 104.2000 },
];

test("returns only stops within the radius, closest first", () => {
  const results = findNearbyStops(STOPS, 1.3000, 103.8000, 5);
  assert.deepEqual(results.map((s) => s.code), ["A", "B"]);
  assert.ok(results[0].distanceKm < results[1].distanceKm);
});

test("respects the limit parameter", () => {
  const results = findNearbyStops(STOPS, 1.3000, 103.8000, 100, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].code, "A");
});

test("returns an empty list when nothing is within radius", () => {
  const results = findNearbyStops(STOPS, 10, 10, 1);
  assert.deepEqual(results, []);
});

test("each result carries code/road/desc/lat/lng/distanceKm and nothing else", () => {
  const results = findNearbyStops(STOPS, 1.3000, 103.8000, 5);
  assert.deepEqual(Object.keys(results[0]).sort(), ["code", "desc", "distanceKm", "lat", "lng", "road"]);
});
