// Finds bus stops within a radius of a given point, sorted closest-first.
// Kept as a plain function (no HTTP) so it's directly unit-testable.

import { distanceKm } from "./distance.js";

const DEFAULT_RADIUS_KM = 10;
const DEFAULT_LIMIT = 20;

/**
 * @param {Array} stops - full (LTA-shaped) bus stop objects with
 *   Latitude/Longitude.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusKm]
 * @param {number} [limit]
 * @returns slim {code, road, desc, lat, lng, distanceKm} objects within
 *   radiusKm, closest first, capped at `limit` results.
 */
export function findNearbyStops(stops, lat, lng, radiusKm = DEFAULT_RADIUS_KM, limit = DEFAULT_LIMIT) {
  return stops
    .map((stop) => ({
      code: String(stop.BusStopCode || ""),
      road: stop.RoadName || "",
      desc: stop.Description || "",
      lat: stop.Latitude,
      lng: stop.Longitude,
      distanceKm: distanceKm(lat, lng, stop.Latitude, stop.Longitude),
    }))
    .filter((stop) => Number.isFinite(stop.distanceKm) && stop.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export { DEFAULT_RADIUS_KM, DEFAULT_LIMIT };
