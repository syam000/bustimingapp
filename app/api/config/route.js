import { isLiveMode } from "../../../lib/arrivalsService.js";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ mode: isLiveMode() ? "live" : "mock" });
}
