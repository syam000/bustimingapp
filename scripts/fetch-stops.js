#!/usr/bin/env node
// Fetches the full LTA bus stop list and caches it to data/bus-stops.json.
// Requires LTA_ACCOUNT_KEY (see .env.example). Run with: npm run fetch-stops

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "../lib/env.js";
import { getBusStopsPage } from "../lib/ltaClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const env = loadEnv();
  const key = env.LTA_ACCOUNT_KEY;
  if (!key) {
    console.error(
      "LTA_ACCOUNT_KEY is not set. Add it to .env (see .env.example) and try again."
    );
    process.exit(1);
  }

  const stops = [];
  let skip = 0;
  for (;;) {
    process.stdout.write(`Fetching bus stops (skip=${skip})...\r`);
    const page = await getBusStopsPage(key, skip);
    const batch = page.value || [];
    if (batch.length === 0) break;
    stops.push(...batch);
    skip += 500;
    if (batch.length < 500) break;
  }

  const outPath = path.join(__dirname, "..", "data", "bus-stops.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(stops, null, 2));
  console.log(`\nSaved ${stops.length} bus stops to ${outPath}`);
}

main().catch((err) => {
  console.error("Failed to fetch bus stops:", err.message);
  process.exit(1);
});
