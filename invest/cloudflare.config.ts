import { defineConfig } from "cf/config";
import * as entrypoint from "./worker.js" with { type: "cf-worker" };

// Cloudflare deployment: Vite builds the UI in public/ into static assets,
// and worker.js serves /api/*. Deploy with `npm run deploy`.
export default defineConfig({
	worker: {
		name: "easyinvest",
		compatibilityDate: "2026-11-13",
		entrypoint,
	},
});
