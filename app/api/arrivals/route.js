import { getArrivals, isLiveMode, LtaApiError } from "../../../lib/arrivalsService.js";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const stop = (searchParams.get("stop") || "").trim();

  if (!/^\d{3,5}$/.test(stop)) {
    return Response.json(
      { error: "Query param 'stop' must be a numeric bus stop code." },
      { status: 400 }
    );
  }

  try {
    const { data, cached } = await getArrivals(stop);
    return Response.json({ ...data, mode: isLiveMode() ? "live" : "mock", cached });
  } catch (err) {
    const status = err instanceof LtaApiError ? err.status : 502;
    return Response.json(
      { error: err.message || "Failed to fetch bus arrival data." },
      { status }
    );
  }
}
