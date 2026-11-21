import { test } from "node:test";
import assert from "node:assert/strict";
import { slimStop, slimEta, slimArrivals } from "../lib/slim.js";
import { getMockArrivals } from "../lib/mock.js";

test("slimStop keeps only code/road/desc", () => {
  const slim = slimStop({ BusStopCode: "83139", RoadName: "Upp Serangoon Rd", Description: "Hougang Ctrl Stn", Latitude: 1.37, Longitude: 103.89 });
  assert.deepEqual(slim, { code: "83139", road: "Upp Serangoon Rd", desc: "Hougang Ctrl Stn" });
});

test("slimEta returns the ISO timestamp, or null when there is no estimate", () => {
  assert.equal(slimEta({ EstimatedArrival: "2026-01-01T00:00:00.000Z" }), "2026-01-01T00:00:00.000Z");
  assert.equal(slimEta({ EstimatedArrival: "" }), null);
  assert.equal(slimEta(undefined), null);
});

test("slimArrivals drops coordinates/load/feature/type and keeps just no/operator/etas", () => {
  const full = getMockArrivals("83139");
  const slim = slimArrivals(full, "mock");

  assert.equal(slim.stop, "83139");
  assert.equal(slim.mode, "mock");
  assert.ok(Array.isArray(slim.services));
  assert.equal(slim.services.length, full.Services.length);

  const slimSvc = slim.services[0];
  assert.deepEqual(Object.keys(slimSvc).sort(), ["etas", "no", "operator"]);
  assert.equal(slimSvc.etas.length, 3);
  for (const eta of slimSvc.etas) {
    assert.ok(!Number.isNaN(new Date(eta).getTime()));
  }
});

test("slimArrivals is meaningfully smaller on the wire than the full LTA shape", () => {
  const full = getMockArrivals("83139");
  const slim = slimArrivals(full, "mock");
  const fullBytes = JSON.stringify(full).length;
  const slimBytes = JSON.stringify(slim).length;
  assert.ok(slimBytes < fullBytes * 0.6, `expected slim (${slimBytes}B) to be well under full (${fullBytes}B)`);
});
