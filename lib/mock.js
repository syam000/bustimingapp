// Deterministic offline mock for the LTA DataMall v3 BusArrival endpoint.
// Produces a response shaped exactly like the real API so the frontend
// (and server route) don't need to know which mode is active.

const SERVICES_BY_STOP = {
  "83139": ["58", "70", "70M", "103"],
  "09048": ["7", "14", "14e", "36", "170"],
  "01012": ["2", "12", "32", "51", "80"],
  "18141": ["2", "12", "33", "61", "145"],
  "28009": ["856", "858", "911", "913"],
  "44009": ["15", "17", "18", "39"],
  "65191": ["5", "138", "142", "162"],
  "97009": ["78", "179", "182", "198"],
  "77009": ["10", "14", "78", "table"],
  "59009": ["52", "53", "54", "156"],
  "46009": ["3", "12", "21", "354"],
  "11009": ["8", "21", "58", "139"],
  "22009": ["51", "66", "97", "105"],
  "84009": ["61", "62", "63", "80"],
  "67009": ["55", "58", "168", "882"],
};

const OPERATORS = ["SBST", "SMRT", "TTS", "GAS"];
const LOADS = ["SEA", "SDA", "LSD"];
const TYPES = ["SD", "DD", "BD"];

// Simple deterministic pseudo-random generator seeded by a string, so the
// same stop code + minute always produces the same-looking (but slowly
// changing) arrival times, instead of pure Math.random() noise.
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function next() {
    h = (Math.imul(h, 1103515245) + 12345) | 0;
    return ((h >>> 1) % 1000) / 1000;
  };
}

function buildNextBus(rand, minutesFromNow, originCode, destCode) {
  const eta = new Date(Date.now() + minutesFromNow * 60_000);
  return {
    OriginCode: originCode,
    DestinationCode: destCode,
    EstimatedArrival: eta.toISOString(),
    Latitude: "1.3521",
    Longitude: "103.8198",
    VisitNumber: "1",
    Load: LOADS[Math.floor(rand() * LOADS.length)],
    Feature: rand() > 0.3 ? "WAB" : "",
    Type: TYPES[Math.floor(rand() * TYPES.length)],
  };
}

export function getMockArrivals(busStopCode) {
  const serviceNos = SERVICES_BY_STOP[busStopCode] || ["5", "12", "24"];
  // Rotate the "seed minute" every 20 seconds so times slowly tick down,
  // giving a live feel without needing a real backend.
  const tick = Math.floor(Date.now() / 20_000);

  const Services = serviceNos.map((serviceNo, idx) => {
    const rand = seededRandom(`${busStopCode}:${serviceNo}:${tick}`);
    const operator = OPERATORS[Math.floor(rand() * OPERATORS.length)];
    const base = 2 + Math.floor(rand() * 12) + idx; // 2-15ish mins, staggered
    const originCode = String(10000 + Math.floor(rand() * 89999));
    const destCode = String(10000 + Math.floor(rand() * 89999));

    return {
      ServiceNo: serviceNo,
      Operator: operator,
      NextBus: buildNextBus(rand, base, originCode, destCode),
      NextBus2: buildNextBus(rand, base + 8 + Math.floor(rand() * 6), originCode, destCode),
      NextBus3: buildNextBus(rand, base + 18 + Math.floor(rand() * 8), originCode, destCode),
    };
  });

  return {
    "odata.metadata": "mock://BusArrival",
    BusStopCode: busStopCode,
    Services,
  };
}
