# Local City Packs (`cities/<id>/`)

Like `node_modules/` in npm, **Go To Anywhere (GTA)** stores compiled city geodata packs locally inside `cities/<id>/` rather than tracking multi-megabyte binary/JSON blobs in Git.

## Listing & Installing City Packs

List available city packs and see which ones are installed on your machine:

```bash
npm run city:list
```

Download and build a city pack locally:

```bash
# Install San Francisco, CA (default city - 7x7 mile SF, Golden Gate Bridge, Union Square, Coit Tower & Muni)
npm run city:install -- sanfrancisco

# Install Royal Oak, MI (10 Mile to 14 Mile Rd, OSM + AWS Terrain Tiles + SMART GTFS)
npm run city:install -- royaloak

# Install Oakland, CA (OSM + AWS Terrain Tiles + AC Transit / BART)
npm run city:install -- oakland

# Install Ann Arbor, MI
npm run city:install -- annarbor

# Install New York, NY (Manhattan Grid + Central Park + MTA Subway)
npm run city:install -- newyork

# Install Pompano Beach, FL (Fisher Family Pier, Hillsboro Lighthouse, Intracoastal Canals & Airpark)
npm run city:install -- pompanobeach

# Or install all 6 city packs at once
npm run city:install -- all
```

## City Pack Directory Layout

Each installed city pack in `cities/<id>/` contains:

```text
cities/<id>/
├── city-geodata.js            # ES module exporting GEO (roads, roadGraph, blocks, parks, water, rail, controls, etc.)
├── building-geodata.bin.gz    # NYB1 gzipped binary building footprints, heights, and use kinds
├── tree-geodata.bin.gz        # NYT2 gzipped binary street & park trees
└── data/
    ├── elevation.bin.gz       # ELV2 gzipped binary terrain heightmap (centimeters)
    ├── river.bin.gz           # RIV1 gzipped binary riverbed dig mask + water surface levels
    ├── transit.json.gz        # Bus routes, stops, polylines, and trip timetables
    ├── wolverine.json         # Passenger rail station + schedule
    ├── addresses.json         # Street address numbers
    ├── districts.json         # Neighborhood / landuse district polygons
    ├── gas-stations.json      # Fuel station canopy placements
    ├── rail-crossings.json    # Grade crossings along railway corridors
    ├── roof-shapes.json       # Explicit OSM building roof shapes & churches
    └── street-furniture.json  # Fire hydrants, park benches, picnic tables, shelters, and sports courts
```

## Adding Your Own Local City Pack (Without Syncing to Git)

All files and folders inside `cities/` (except this `README.md`) are gitignored (`cities/*`), so you can create, customize, or drop in your own local city pack(s) without touching any repo-tracked files.

### 1. One-Command Build from Coordinates

```bash
npm run city:build -- --city traversecity --name "Traverse City, MI" --lat 44.7631 --lon -85.6206 --radius-km 2.5
```

Or specify an explicit bounding box `south_lat,west_lon,north_lat,east_lon`:

```bash
python3 tools/build-city-pack.py --city traversecity --name "Traverse City, MI" --bbox 44.740,-85.655,44.785,-85.585
```

### 2. Local Config File (`cities/<id>/city-pack.json`)

You can also create `cities/<id>/city-pack.json` (or pass `--config path/to/spec.json`) to customize any `CITY_PACK` fields (`landmarks`, `areas`, `police`, `plate`, `transit`, `ownCar`, `archetypes`):

```json
{
  "id": "traversecity",
  "displayName": "Traverse City, MI",
  "stateCode": "MI",
  "stateLabel": "Michigan",
  "timeZone": "America/Detroit",
  "lat": 44.7631,
  "lon": -85.6206,
  "radiusKm": 2.5,
  "weatherStation": "KTVC"
}
```

Then run:

```bash
npm run city:build -- traversecity
```

The builder automatically generates all 13 city pack files in `cities/<id>/`, writes the complete descriptor to `cities/<id>/city-pack.json`, and registers `<id>` in `cities/local-packs.json` so it appears in the in-game city switcher dropdown and `npm run city:list`.

### 3. Dropping In a Prebuilt Local City Pack Folder

If you copy a prebuilt `cities/<id>/` directory onto your machine:
- Open `http://localhost:8000/?city=<id>` directly in your browser (it loads immediately even before registration), or
- Run `python3 tools/build-city-pack.py --register-local` to add all local folders in `cities/*/` to `cities/local-packs.json` so they appear in the UI dropdown.
