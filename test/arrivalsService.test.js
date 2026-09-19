import { test } from "node:test";
import assert from "node:assert/strict";
import { isLiveMode, getArrivals } from "../lib/arrivalsService.js";

function withEnv(overrides, fn) {
  const prev = {};
  for (const key of Object.keys(overrides)) prev[key] = process.env[key];
  Object.assign(process.env, overrides);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (prev[key] === undefined) delete process.env[key];
        else process.env[key] = prev[key];
      }
    });
}

test("isLiveMode is false when no account key is configured", async () => {
  await withEnv({ LTA_ACCOUNT_KEY: undefined, MOCK: undefined }, () => {
    delete process.env.LTA_ACCOUNT_KEY;
    delete process.env.MOCK;
    assert.equal(isLiveMode(), false);
  });
});

test("isLiveMode is true once an account key is set", async () => {
  await withEnv({ LTA_ACCOUNT_KEY: "some-key" }, () => {
    delete process.env.MOCK;
    assert.equal(isLiveMode(), true);
  });
});

test("isLiveMode stays false when MOCK=1 forces offline mode, even with a key set", async () => {
  await withEnv({ LTA_ACCOUNT_KEY: "some-key", MOCK: "1" }, () => {
    assert.equal(isLiveMode(), false);
  });
});

test("getArrivals returns mock-shaped data when not in live mode", async () => {
  await withEnv({ LTA_ACCOUNT_KEY: undefined }, async () => {
    delete process.env.LTA_ACCOUNT_KEY;
    const { data, cached } = await getArrivals("65191");
    assert.equal(cached, false);
    assert.equal(data.BusStopCode, "65191");
    assert.ok(Array.isArray(data.Services));
    assert.ok(data.Services.length > 0);
  });
});

test("getArrivals caches results for the same stop code within the cache window", async () => {
  await withEnv({ LTA_ACCOUNT_KEY: undefined }, async () => {
    delete process.env.LTA_ACCOUNT_KEY;
    const first = await getArrivals("11009");
    const second = await getArrivals("11009");
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.deepEqual(second.data, first.data);
  });
});
