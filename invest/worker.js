// Cloudflare Workers entry point. Static files (the built UI) are served by
// Workers Static Assets; only requests that don't match a file reach this
// handler, which serves the /api/* routes.
//
// Set the optional FINNHUB_API_KEY secret for live quotes; without it the
// app uses demo prices.

import { handleApi } from "./lib/api.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const result = await handleApi(url, { apiKey: env.FINNHUB_API_KEY || "", forceMock: env.MOCK === "1" });
      if (!result) return new Response("Not found", { status: 404 });
      return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return Response.json({ error: "Internal server error", detail: String(err && err.message) }, { status: 500 });
    }
  },
};
