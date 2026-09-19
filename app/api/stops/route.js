import { NextResponse } from "next/server";
import { loadBusStops, searchBusStops } from "../../../lib/busStops.js";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const stops = await loadBusStops();
  const results = searchBusStops(stops, q);
  return NextResponse.json({ count: results.length, stops: results.slice(0, 50) });
}
