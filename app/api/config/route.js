import { NextResponse } from "next/server";
import { isLiveMode } from "../../../lib/arrivalsService.js";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ mode: isLiveMode() ? "live" : "mock" });
}
