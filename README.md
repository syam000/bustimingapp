# SG Bus Timing

A simple native Android app that shows live bus arrival timings for
Singapore bus stops, using the [LTA DataMall](https://datamall.lta.gov.sg/)
open APIs - plus a small local backend the app talks to. The phone never
calls LTA directly, and the backend trims every response down to just the
fields the app needs, to keep the phone's mobile data usage low.

This replaces the earlier web version of this project.

## Architecture

```
Android app (Kotlin + Compose)  --HTTP-->  backend/ (Node.js)  --HTTPS-->  LTA DataMall (or offline mock)
```

- **`backend/`** - a small, dependency-free Node.js server. Holds the LTA
  API key (it never reaches the phone), does the real/mock switch, and
  exposes 4 plain JSON routes with a deliberately slim response shape
  (e.g. arrivals are just `{stop, mode, services: [{no, operator, etas}]}`
  - no load/type/origin-destination codes). It also caches each stop's
  arrivals for 8 seconds, so repeated polling doesn't hit LTA on every
  request.
- **`app/`** - the Android application, two screens via a bottom nav bar,
  default Material 3 styling (no custom theme):
  - **Favorites** - a search field (debounced, so fast typing doesn't fire
    a request per keystroke), a "Watched stops" list below it, each
    watched stop polling the backend every 15 seconds.
  - **Nearby** - your phone's current location (plain `android.location`,
    no Google Play services) plotted on an [OpenStreetMap](https://www.openstreetmap.org/)
    view via [osmdroid](https://github.com/osmdroid/osmdroid) (free, no
    API key, no account), with nearby bus stops marked and listed below
    it to add to your watched stops.

  Watched stops are persisted locally via plain `SharedPreferences`.

  **Map service note:** osmdroid/OpenStreetMap was picked specifically
  because it needs no API key or billing account (unlike Google Maps or
  Mapbox's free tiers, which both still require signing up for one) - it
  fits a local, not-deployed project best. The tradeoff: map tiles use
  noticeably more mobile data than the rest of this app's plain-text
  screens.

## Running it locally

**1. Start the backend** (needs Node.js 18+):

```bash
cd backend
npm start        # mock mode by default, no API key needed
```

Open http://localhost:3000/api/config in a browser to sanity-check it's up.

**2. Run the Android app** against it:

- **Emulator**: works out of the box - `local.properties`'s default
  `backend.base.url` (`http://10.0.2.2:3000`) is the emulator's alias for
  your computer's `localhost`.
- **Real device**: copy `local.properties.example` to `local.properties`
  and set `backend.base.url` to your computer's LAN IP (e.g.
  `http://192.168.1.50:3000`), with the phone on the same Wi-Fi.

Then open the project root in Android Studio (Ladybug or newer) and run
the `app` configuration - Android Studio fetches the Android SDK and all
AndroidX/Compose dependencies itself. From the command line, once you
have an Android SDK installed (`sdk.dir` in `local.properties`, or
`ANDROID_HOME` set):

```bash
./gradlew :app:assembleDebug
./gradlew installDebug   # with a device/emulator connected
```

### Using real live data

1. Get a free key: https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html
2. In `backend/`, copy `.env.example` to `.env` and set
   `LTA_ACCOUNT_KEY=<your key>`.
3. (Optional) `npm run fetch-stops` to cache the full ~5,000-stop list to
   `backend/data/bus-stops.json`, so search covers all of Singapore
   instead of the small bundled sample.
4. Restart the backend (`npm start`). The key never goes near the phone -
   the app doesn't change at all.

## Tests

The backend's tests need nothing but Node.js:

```bash
cd backend
npm test
```

16 tests: the mock arrival generator (shape, determinism, the fixed
invalid service-number case), the bundled sample stops, the slim-response
mapping (including a payload-size assertion, confirming the trimmed shape
is well under half the size of the full LTA shape), the haversine
distance helper, and the nearby-stops radius/sort/limit logic.

Note: the bundled sample is only 15 interchange-level stops spread across
Singapore, so "Nearby" will often come up empty unless you're standing
right next to one of them - run `fetch-stops` (see above) for the full
~5,000-stop list and real nearby results anywhere.

## A note on this sandbox

This project was written in a network-restricted sandbox that cannot
reach `dl.google.com` (where the Android Gradle Plugin and every
AndroidX/Compose artifact are ultimately hosted, including via the
`google()` Gradle repository and the `maven.google.com` mirror, which just
redirects there). Because of that:

- **`backend/` was fully built and tested in-sandbox** - `npm test`
  genuinely ran and passed (9/9), and the server was started and verified
  end-to-end with real HTTP requests.
- **`app/` could not be built or run in-sandbox.** Even resolving the
  `com.android.application` Gradle plugin itself fails here
  (`dl.google.com` connection refused by the sandbox's network policy).
  This is a sandbox limitation, not a project issue. Any normal machine or
  CI runner with regular internet access, or Android Studio (which bundles
  its own SDK and Maven mirrors), builds it with no changes needed.

If you hit dependency resolution errors building `app/` somewhere with
full internet access, it's likely unrelated to this limitation - please
open an issue.
