# Local City Packs (`cities/<id>/`)

Like `node_modules/` in npm, **Go To Anywhere (GTA)** stores compiled city geodata packs locally inside `cities/<id>/` rather than tracking multi-megabyte binary/JSON blobs in Git.

## Listing & Installing City Packs

List available city packs and see which ones are installed on your machine:

```bash
npm run city:list
```

Download and build a city pack locally:

```bash
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

# Install San Francisco, CA (Union Square, Transamerica, Coit Tower, Ferry Bldg, Lombard St & Muni)
npm run city:install -- sanfrancisco

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

## Adding Your Own City

1. Add your city's bounding box, origin `(lat0, lon0)`, highways, waterways, and transit corridors to `CITY_CONFIGS` in [`../tools/build-city-pack.py`](../tools/build-city-pack.py).
2. Add your city's runtime descriptor (landmarks, camera presets, scenic starts, radio stations) to `CITY_PACKS` in [`../js/city-packs.js`](../js/city-packs.js).
3. Build your city pack locally:
   ```bash
   npm run city:build -- <your-city-id>
   ```
4. Open `http://localhost:8000/?city=<your-city-id>`.
