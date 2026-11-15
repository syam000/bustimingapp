import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// index.html + src/ are the UI (also served as-is by the local Node server).
export default defineConfig({
	publicDir: false,
	plugins: [cloudflare()],
});
