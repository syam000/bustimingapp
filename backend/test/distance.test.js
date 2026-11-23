import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm } from "../lib/distance.js";

test("distance from a point to itself is zero", () => {
  assert.equal(distanceKm(1.3521, 103.8198, 1.3521, 103.8198), 0);
});

test("distance is symmetric", () => {
  const a = distanceKm(1.3521, 103.8198, 1.3644, 103.9915);
  const b = distanceKm(1.3644, 103.9915, 1.3521, 103.8198);
  assert.equal(a, b);
});

test("matches the known straight-line distance between two Singapore landmarks", () => {
  // Orchard MRT (1.3041, 103.8318) to Changi Airport T3 (1.3553, 103.9898):
  // roughly 18.5km straight-line, per standard mapping tools.
  const km = distanceKm(1.3041, 103.8318, 1.3553, 103.9898);
  assert.ok(km > 17 && km < 20, `expected ~18.5km, got ${km.toFixed(2)}km`);
});
