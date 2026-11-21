// A small, hand-picked sample of real Singapore bus stops, used as a local
// fallback so search works out of the box without an LTA DataMall API key.
//
// For the full ~5,000-stop list, request a free key from
// https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html,
// put it in .env, and run `npm run fetch-stops` to cache the real list
// into data/bus-stops.json (the server prefers that file when present).

export const SAMPLE_BUS_STOPS = [
  { BusStopCode: "83139", RoadName: "Upp Serangoon Rd", Description: "Hougang Ctrl Stn" },
  { BusStopCode: "09048", RoadName: "Orchard Blvd", Description: "Opp Orchard Stn" },
  { BusStopCode: "01012", RoadName: "Victoria St", Description: "Bras Basah Cplx" },
  { BusStopCode: "18141", RoadName: "New Bridge Rd", Description: "Opp People's Park Complex" },
  { BusStopCode: "28009", RoadName: "Woodlands Ave 5", Description: "Causeway Point" },
  { BusStopCode: "44009", RoadName: "Tampines Ave 5", Description: "Tampines Interchange" },
  { BusStopCode: "65191", RoadName: "Ang Mo Kio Ave 3", Description: "AMK Hub" },
  { BusStopCode: "97009", RoadName: "Boon Lay Way", Description: "Boon Lay Bus Interchange" },
  { BusStopCode: "77009", RoadName: "Clementi Ave 3", Description: "Clementi Interchange" },
  { BusStopCode: "59009", RoadName: "Bishan Pl", Description: "Bishan Interchange" },
  { BusStopCode: "46009", RoadName: "Pasir Ris Dr 1", Description: "Pasir Ris Interchange" },
  { BusStopCode: "11009", RoadName: "Toa Payoh Ctrl", Description: "Toa Payoh Interchange" },
  { BusStopCode: "22009", RoadName: "Jurong Gateway Rd", Description: "Jurong East Interchange" },
  { BusStopCode: "84009", RoadName: "Serangoon Ave 3", Description: "Serangoon Interchange" },
  { BusStopCode: "67009", RoadName: "Yishun Ave 2", Description: "Yishun Interchange" },
];
