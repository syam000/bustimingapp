import { test } from "node:test";
import assert from "node:assert/strict";
import { getMockArrivals } from "../lib/mock.js";

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

test("getMockArrivals is deterministic across 10k calls within the same tick", () => {
  let failures = 0;
  for (let i = 0; i < 10_000; i++) {
    const a = getMockArrivals("83139");
    const b = getMockArrivals("83139");
    if (a.Services[0].NextBus.EstimatedArrival !== b.Services[0].NextBus.EstimatedArrival) failures++;
  }
  assert.equal(failures, 0);
});

test("getMockArrivals falls back gracefully for unknown stop codes", () => {
  const res = getMockArrivals("99999");
  assert.ok(res.Services.length > 0);
});

test("stop 77009 only has valid-looking numeric service numbers", () => {
  const res = getMockArrivals("77009");
  const serviceNos = res.Services.map((s) => s.ServiceNo);
  assert.deepEqual(serviceNos, ["10", "14", "78", "165"]);
  for (const no of serviceNos) {
    assert.match(no, /^\d+[A-Za-z]?$/);
  }
});
