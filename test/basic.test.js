import { test } from "node:test";
import assert from "node:assert/strict";
import { getMockArrivals } from "../lib/mock.js";
import { SAMPLE_BUS_STOPS } from "../lib/busStopsSample.js";

test("getMockArrivals returns v3 BusArrival-shaped response", () => {
  const res = getMockArrivals("83139");
  assert.equal(res.BusStopCode, "83139");
  assert.ok(Array.isArray(res.Services));
  assert.ok(res.Services.length > 0);
  const svc = res.Services[0];
  assert.ok(svc.ServiceNo);
  assert.ok(svc.NextBus.EstimatedArrival);
  assert.ok(!Number.isNaN(new Date(svc.NextBus.EstimatedArrival).getTime()));
});

test("getMockArrivals is deterministic within the same time window", () => {
  const a = getMockArrivals("83139");
  const b = getMockArrivals("83139");
  assert.equal(a.Services[0].ServiceNo, b.Services[0].ServiceNo);
  assert.equal(a.Services[0].NextBus.EstimatedArrival, b.Services[0].NextBus.EstimatedArrival);
});

test("getMockArrivals falls back gracefully for unknown stop codes", () => {
  const res = getMockArrivals("99999");
  assert.ok(res.Services.length > 0);
});

test("sample bus stops each have a code, description and coordinates", () => {
  assert.ok(SAMPLE_BUS_STOPS.length > 0);
  for (const stop of SAMPLE_BUS_STOPS) {
    assert.match(stop.BusStopCode, /^\d{5}$/);
    assert.ok(stop.Description);
    assert.equal(typeof stop.Latitude, "number");
    assert.equal(typeof stop.Longitude, "number");
  }
});
