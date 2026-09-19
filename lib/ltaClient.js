// Thin wrapper around the real LTA DataMall open APIs.
// Docs: https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html

const BASE_URL = "https://datamall2.mytransport.sg/ltaodataservice";

class LtaApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "LtaApiError";
    this.status = status;
  }
}

async function ltaGet(path, accountKey, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    headers: {
      AccountKey: accountKey,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LtaApiError(
      `LTA DataMall request failed (${res.status}): ${body.slice(0, 300)}`,
      res.status
    );
  }

  return res.json();
}

/** GET /v3/BusArrival?BusStopCode=... */
export function getBusArrival(accountKey, busStopCode, serviceNo) {
  return ltaGet("/v3/BusArrival", accountKey, {
    BusStopCode: busStopCode,
    ServiceNo: serviceNo,
  });
}

/** GET /BusStops?$skip=N — paginated, 500 rows per page. */
export function getBusStopsPage(accountKey, skip) {
  return ltaGet("/BusStops", accountKey, { $skip: String(skip) });
}

export { LtaApiError };
