import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as configGet } from "../app/api/config/route.js";
import { GET as stopsGet } from "../app/api/stops/route.js";
import { GET as arrivalsGet } from "../app/api/arrivals/route.js";

function makeRequest(url) {
  return { url };
}

test("GET /api/config reports mock mode when no account key is configured", async () => {
  const prevKey = process.env.LTA_ACCOUNT_KEY;
  delete process.env.LTA_ACCOUNT_KEY;
  try {
    const res = await configGet();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "mock");
  } finally {
    if (prevKey !== undefined) process.env.LTA_ACCOUNT_KEY = prevKey;
  }
});

test("GET /api/stops returns matching stops for a query", async () => {
  const res = await stopsGet(makeRequest("http://localhost/api/stops?q=orchard"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.equal(body.stops[0].BusStopCode, "09048");
});

test("GET /api/stops returns an empty result set for a query matching nothing", async () => {
  const res = await stopsGet(makeRequest("http://localhost/api/stops?q=zzz-no-such-place"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 0);
  assert.deepEqual(body.stops, []);
});

test("GET /api/arrivals rejects a non-numeric stop code with 400", async () => {
  const res = await arrivalsGet(makeRequest("http://localhost/api/arrivals?stop=abc"));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /numeric/);
});

test("GET /api/arrivals returns mock arrival data for a valid stop code", async () => {
  const res = await arrivalsGet(makeRequest("http://localhost/api/arrivals?stop=44009"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.BusStopCode, "44009");
  assert.equal(body.mode, "mock");
  assert.ok(Array.isArray(body.Services));
});
