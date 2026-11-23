import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_BUS_STOPS } from "../lib/busStopsSample.js";

test("sample bus stops each have a code, description and road name", () => {
  assert.ok(SAMPLE_BUS_STOPS.length > 0);
  for (const stop of SAMPLE_BUS_STOPS) {
    assert.match(stop.BusStopCode, /^\d{5}$/);
    assert.ok(stop.Description);
    assert.ok(stop.RoadName);
  }
});
