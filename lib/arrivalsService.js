// Shared arrival-fetching logic used by the /api/arrivals route: decides
// live vs. mock mode, and caches results briefly so multiple browser tabs
// polling the same stop don't each trigger a fresh upstream request.

import { getBusArrival, LtaApiError } from "./ltaClient.js";
import { getMockArrivals } from "./mock.js";

const CACHE_MS = 8_000;
const cache = new Map(); // stopCode -> { at, data }

export function isLiveMode() {
  const accountKey = process.env.LTA_ACCOUNT_KEY || "";
  const forceMock = process.env.MOCK === "1";
  return Boolean(accountKey) && !forceMock;
}

export async function getArrivals(stopCode) {
  const cached = cache.get(stopCode);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { data: cached.data, cached: true };
  }

  const live = isLiveMode();
  const data = live
    ? await getBusArrival(process.env.LTA_ACCOUNT_KEY, stopCode)
    : getMockArrivals(stopCode);

  cache.set(stopCode, { at: Date.now(), data });
  return { data, cached: false };
}

export { LtaApiError };
