import { test } from "node:test";
import assert from "node:assert/strict";
import { getBusArrival, getBusStopsPage, LtaApiError } from "../lib/ltaClient.js";

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

test("getBusArrival requests v3/BusArrival with the account key header and stop code", async () => {
  const calls = [];
  const restore = stubFetch(async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({ BusStopCode: "83139", Services: [] }) };
  });
  try {
    const result = await getBusArrival("test-key", "83139");
    assert.equal(calls.length, 1);
    const requestUrl = new URL(calls[0].url);
    assert.equal(requestUrl.pathname, "/ltaodataservice/v3/BusArrival");
    assert.equal(requestUrl.searchParams.get("BusStopCode"), "83139");
    assert.equal(calls[0].opts.headers.AccountKey, "test-key");
    assert.deepEqual(result, { BusStopCode: "83139", Services: [] });
  } finally {
    restore();
  }
});

test("getBusArrival omits ServiceNo from the query string when not provided", async () => {
  const calls = [];
  const restore = stubFetch(async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({}) };
  });
  try {
    await getBusArrival("test-key", "83139");
    const requestUrl = new URL(calls[0]);
    assert.equal(requestUrl.searchParams.has("ServiceNo"), false);
  } finally {
    restore();
  }
});

test("getBusArrival throws LtaApiError carrying the HTTP status on a non-ok response", async () => {
  const restore = stubFetch(async () => ({
    ok: false,
    status: 401,
    text: async () => "Invalid AccountKey",
  }));
  try {
    await assert.rejects(
      () => getBusArrival("bad-key", "83139"),
      (err) => {
        assert.ok(err instanceof LtaApiError);
        assert.equal(err.status, 401);
        assert.match(err.message, /401/);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test("getBusStopsPage requests BusStops with the $skip pagination param", async () => {
  const calls = [];
  const restore = stubFetch(async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ value: [] }) };
  });
  try {
    await getBusStopsPage("key", 500);
    const requestUrl = new URL(calls[0]);
    assert.equal(requestUrl.pathname, "/ltaodataservice/BusStops");
    assert.equal(requestUrl.searchParams.get("$skip"), "500");
  } finally {
    restore();
  }
});
