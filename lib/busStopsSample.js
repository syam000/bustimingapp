// A small, hand-picked sample of real Singapore bus stops, used as a local
// fallback so search works out of the box without an LTA DataMall API key.
//
// For the full ~5,000-stop list, request a free key from
// https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html,
// put it in .env, and run `npm run fetch-stops` to cache the real list
// into data/bus-stops.json (the server prefers that file when present).

export const SAMPLE_BUS_STOPS = [
  { BusStopCode: "83139", RoadName: "Upp Serangoon Rd", Description: "Hougang Ctrl Stn", Latitude: 1.37326, Longitude: 103.89218 },
  { BusStopCode: "09048", RoadName: "Orchard Blvd", Description: "Opp Orchard Stn", Latitude: 1.30246, Longitude: 103.83105 },
  { BusStopCode: "01012", RoadName: "Victoria St", Description: "Bras Basah Cplx", Latitude: 1.29698, Longitude: 103.85312 },
  { BusStopCode: "18141", RoadName: "New Bridge Rd", Description: "Opp People's Park Complex", Latitude: 1.28492, Longitude: 103.84372 },
  { BusStopCode: "28009", RoadName: "Woodlands Ave 5", Description: "Causeway Point", Latitude: 1.43567, Longitude: 103.78630 },
  { BusStopCode: "44009", RoadName: "Tampines Ave 5", Description: "Tampines Interchange", Latitude: 1.35375, Longitude: 103.94498 },
  { BusStopCode: "65191", RoadName: "Ang Mo Kio Ave 3", Description: "AMK Hub", Latitude: 1.36960, Longitude: 103.84860 },
  { BusStopCode: "97009", RoadName: "Boon Lay Way", Description: "Boon Lay Bus Interchange", Latitude: 1.33883, Longitude: 103.70573 },
  { BusStopCode: "77009", RoadName: "Clementi Ave 3", Description: "Clementi Interchange", Latitude: 1.31502, Longitude: 103.76502 },
  { BusStopCode: "59009", RoadName: "Bishan Pl", Description: "Bishan Interchange", Latitude: 1.35088, Longitude: 103.84826 },
  { BusStopCode: "46009", RoadName: "Pasir Ris Dr 1", Description: "Pasir Ris Interchange", Latitude: 1.37301, Longitude: 103.94944 },
  { BusStopCode: "11009", RoadName: "Toa Payoh Ctrl", Description: "Toa Payoh Interchange", Latitude: 1.33262, Longitude: 103.84726 },
  { BusStopCode: "22009", RoadName: "Jurong Gateway Rd", Description: "Jurong East Interchange", Latitude: 1.33333, Longitude: 103.74275 },
  { BusStopCode: "84009", RoadName: "Serangoon Ave 3", Description: "Serangoon Interchange", Latitude: 1.34968, Longitude: 103.87334 },
  { BusStopCode: "67009", RoadName: "Yishun Ave 2", Description: "Yishun Interchange", Latitude: 1.42945, Longitude: 103.83486 },
];
