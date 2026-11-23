// Maps full LTA-DataMall-shaped objects down to the minimal JSON the
// Android app actually renders, to keep the app's mobile data usage low.

/** Slims a BusStop down to just what the app shows/sends back when adding a stop. */
export function slimStop(stop) {
  return {
    code: String(stop.BusStopCode || ""),
    road: stop.RoadName || "",
    desc: stop.Description || "",
  };
}

/** Slims a NextBus down to just its ETA; drops it entirely if there's no estimate. */
export function slimEta(nextBus) {
  return nextBus && nextBus.EstimatedArrival ? nextBus.EstimatedArrival : null;
}

/** Slims a full (LTA-shaped) BusArrivalResponse down to what the app renders. */
export function slimArrivals(data, mode) {
  return {
    stop: data.BusStopCode,
    mode,
    services: (data.Services || []).map((svc) => ({
      no: svc.ServiceNo,
      operator: svc.Operator || "",
      etas: [svc.NextBus, svc.NextBus2, svc.NextBus3].map(slimEta).filter(Boolean),
    })),
  };
}
