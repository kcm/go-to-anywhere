# Go To Anywhere (GTA)

A 3D WebGPU multi-city driving, walking, cycling, flying, and kayaking engine built at 1:1 scale from real streets, buildings, trees, hills, railways, transit schedules, and waterways.

Adapted from [Go To Ann Arbor](https://github.com/mrubens/go-to-ann-arbor) by [@mrubens](https://github.com/mrubens) and [Mr.doob](https://github.com/mrdoob)'s [*Slop New York*](https://mrdoob.github.io/slop-newyork/).

---

## Local City Packs (like npm packages)

**Go To Anywhere (GTA)** keeps the repository lightweight by separating the **3D multi-city engine** from **city geodata packs** (`cities/<id>/`, which is gitignored just like `node_modules/`). When you want to explore or add a city, you download and build its geodata locally on your machine.

### 1. List Available City Packs

```bash
npm run city:list
```

| City ID | Display Name | Coverage & Highlights |
| :--- | :--- | :--- |
| `sanfrancisco` *(default)* | **San Francisco, CA** | Full **7x7 mile** City & County of San Francisco (`14.0 km x 13.4 km`): **Golden Gate Bridge**, **Union Square**, **Transamerica Pyramid**, **Salesforce Tower**, **Ferry Building & Embarcadero**, **Coit Tower**, **Lombard Street**, **Palace of Fine Arts**, **Golden Gate Park**, **Haight-Ashbury**, **The Castro**, **Mission District**, **Twin Peaks & Sutro Tower**, **Ocean Beach**, **Lake Merced**, **SF City Hall** & SF Muni |
| `royaloak` | **Royal Oak, MI** | 10 Mile Rd (I-696) north to **14 Mile Rd** (`7.22 km x 5.92 km`), Downtown Main & 4th, Woodward Ave (M-1), Shrine of the Little Flower Basilica, Royal Oak Music Theatre, Detroit Zoo, SMART buses & Amtrak Wolverine (`ROY`) |
| `oakland` | **Oakland, CA** | Downtown Oakland (14th & Broadway), Lake Merritt, Jack London Square, Oakland Estuary, Port of Oakland cranes, Tribune Tower, City Hall, Fox Theater, Cathedral of Christ the Light, AC Transit & BART |
| `annarbor` | **Ann Arbor, MI** | University of Michigan Diag, Michigan Stadium (The Big House), Burton Memorial Tower, Huron River & Argo Cascades, TheRide buses & Amtrak Wolverine (`ARB`) |
| `newyork` | **New York, NY** | Manhattan grid & Broadway, Central Park, Hudson & East Rivers, Empire State Building, Chrysler Building, One WTC, Brooklyn/Manhattan/Williamsburg/Queensboro/GWB bridges, Staten Island Ferry & MTA Subway |
| `pompanobeach` | **Pompano Beach, FL** | Atlantic Ocean & **Fisher Family Pier**, **Hillsboro Inlet Lighthouse**, **Intracoastal Waterway & Finger Canals**, **Pompano Beach Airpark (`KPMP`) & Goodyear Blimp**, Civic Center & Amphitheater ("The Amp"), Broward County Transit & FEC/Brightline |
| `sydney` | **Sydney, Australia** | **Sydney Opera House**, **Sydney Harbour Bridge**, Circular Quay, The Rocks, Barangaroo, Martin Place CBD, Royal Botanic Garden, Darling Harbour & Sydney Trains / Ferries |
| `venice` | **Venice, Italy** | **Grand Canal**, **Ponte di Rialto**, **Piazza San Marco & Campanile**, Doge's Palace, Accademia Bridge, Arsenale, Giudecca, San Giorgio Maggiore & ACTV Vaporetto routes |
| `amsterdam` | **Amsterdam, Netherlands** | UNESCO **Grachtengordel (Canal Ring)**, **Dam Square & Royal Palace**, **Rijksmuseum**, Westerkerk & Jordaan, Vondelpark, Amstel River & GVB Trams |
| `hongkong` | **Hong Kong** | **Victoria Harbour**, Central & **IFC**, **Bank of China Tower**, **Victoria Peak**, Star Ferry, Wan Chai, Causeway Bay, **Tsim Sha Tsui** & West Kowloon |
| `paris` | **Paris, France** | **Tour Eiffel**, **River Seine** bridges, **Musee du Louvre**, **Cathedrale Notre-Dame**, Place de la Concorde, **Champs-Elysees & Arc de Triomphe** & Haussmann boulevards |
| `london` | **London, UK** | **Big Ben (Elizabeth Tower) & Westminster**, **River Thames**, **London Eye**, Trafalgar Square, Buckingham Palace, Covent Garden, **St Paul's Cathedral** & The Shard |
| `tokyo` | **Tokyo, Japan** | **Tokyo Tower & Shiba Park**, **Imperial Palace & Moat**, **Ginza**, **Tokyo Station & Marunouchi**, **Roppongi Hills**, Toranomon & JR Yamanote / Shinkansen |
| `barcelona` | **Barcelona, Spain** | **Sagrada Familia**, Cerda's **Eixample octagonal blocks**, **Passeig de Gracia**, Placa de Catalunya, **Barri Gotic & La Rambla**, Port Vell & **Barceloneta Beach** |
| `rio` | **Rio de Janeiro, Brazil** | **Copacabana Beach**, **Sugarloaf Mountain (`Pao de Acucar`)**, **Corcovado & Christ the Redeemer**, **Ipanema**, Lagoa Rodrigo de Freitas & Botafogo Bay |
| `vancouver` | **Vancouver, Canada** | **Stanley Park Seawall**, **Lions Gate Bridge**, **Canada Place**, Coal Harbour, Gastown, **False Creek & Science World**, Granville Island & English Bay |
| `capetown` | **Cape Town, South Africa** | **Table Mountain**, **Lion's Head & Signal Hill**, **V&A Waterfront**, **Bo-Kaap** colourful terraces, City Bowl & Atlantic Seaboard |
| `chicago` | **Chicago, IL** | **The Loop** elevated L, **Willis (Sears) Tower**, **Chicago River** bascule bridges, **Millennium Park & Cloud Gate**, **Navy Pier** & Magnificent Mile |
| `boston` | **Boston, MA** | **Boston Common & State House**, Beacon Hill, **Back Bay** brownstones, **Zakim Bunker Hill Bridge**, **Faneuil Hall**, Custom House Tower & **Charles River** |
| `seattle` | **Seattle, WA** | **Space Needle & Seattle Center**, **Pike Place Market**, **Elliott Bay Waterfront & Piers**, Columbia Center, Pioneer Square, **South Lake Union** & Capitol Hill |
| `tampa` | **Tampa, FL** | **Tampa Riverwalk & Curtis Hixon Park**, **Plant Hall Silver Minarets**, **Ybor City Historic 7th Ave**, **Water Street & Amalie Arena**, Rivergate Tower, **100 North Tampa** & Hillsborough Bay |

### 2. Install / Build a City Pack Locally

Install a single city pack or all 21 starter-pack cities:

```bash
# Install San Francisco, CA (default city - fetches 2x2 tiled OpenStreetMap + AWS Terrain Tiles + SF Muni)
npm run city:install -- sanfrancisco

# Or install any of the 21 worldwide cities on demand:
npm run city:install -- sydney
npm run city:install -- venice
npm run city:install -- amsterdam
npm run city:install -- hongkong
npm run city:install -- paris
npm run city:install -- london
npm run city:install -- tokyo
npm run city:install -- barcelona
npm run city:install -- rio
npm run city:install -- vancouver
npm run city:install -- capetown
npm run city:install -- chicago
npm run city:install -- boston
npm run city:install -- seattle
npm run city:install -- tampa

# Or install all 21 city packs at once:
npm run city:install -- all
```

*(Under the hood, `npm run city:install` runs [`tools/build-city-pack.py`](tools/build-city-pack.py), automatically using `.venv` or `uv` if available, and caches raw OpenStreetMap Overpass responses, terrain tiles, and GTFS feeds in `tools/.cache/` so rebuilds run offline in seconds.)*

### 3. Start the Local Server

```bash
npm start
```

Then open a WebGPU-capable browser (Chrome, Edge, or Safari):
- **San Francisco, CA (default)**: `http://localhost:8000/` or `http://localhost:8000/?city=sanfrancisco`
- **Royal Oak, MI**: `http://localhost:8000/?city=royaloak`
- **Oakland, CA**: `http://localhost:8000/?city=oakland`
- **Ann Arbor, MI**: `http://localhost:8000/?city=annarbor`
- **New York, NY**: `http://localhost:8000/?city=newyork`
- **Pompano Beach, FL**: `http://localhost:8000/?city=pompanobeach`

You can also switch cities anytime from the top-left **Go To Anywhere (GTA)** HUD dropdown or inside the full-screen street map (`M`).

---

## Five Ways to Explore

- **Walk (`1`)**: Stroll sidewalks, parks, plazas, and pedestrian trails.
- **Drive (`2`)**: Cruise in your city signature car (or press `F` to hop into any parked or passing car, transit bus, motorcycle, dump truck, or excavator).
- **Cycle (`3`)**: Ride bike lanes, greenways, and park paths.
- **Fly (`4`)**: Pilot a helicopter off rooftops and over city skylines.
- **Paddle (`5`)**: Kayak across rivers, lakes, canals, and harbors.

---

## Adding Your Own Local City Pack (No Repo Sync Required)

You can build and play your own custom local city pack(s) without modifying any git-tracked files. Everything inside `cities/` (except `cities/README.md`) is gitignored, including `cities/<your-city-id>/` and `cities/local-packs.json`.

### Option A: Build Directly from Coordinates (One Command)

Pass any custom city slug (`--city`), display name (`--name`), and center coordinates (`--lat`, `--lon`):

```bash
npm run city:build -- --city traversecity --name "Traverse City, MI" --lat 44.7631 --lon -85.6206 --radius-km 2.5
```

This automatically:
1. Fetches OpenStreetMap roads, buildings, parks, waterways, and AWS Terrain elevation tiles around `(lat, lon)`.
2. Discovers local landmarks, parks, and neighborhoods from OpenStreetMap.
3. Writes `cities/traversecity/city-pack.json` and registers the pack in `cities/local-packs.json` so it appears in the in-game city selector dropdown (`#city-select`) and `npm run city:list`.
4. Loads directly at `http://localhost:8000/?city=traversecity`.

### Option B: Use a Local JSON Config File (`cities/<id>/city-pack.json`)

Create `cities/<your-city-id>/city-pack.json` (or pass `--config path/to/my-city.json`) with your custom coordinates, bounding box, or custom landmarks/branding:

```json
{
  "id": "traversecity",
  "displayName": "Traverse City, MI",
  "stateCode": "MI",
  "timeZone": "America/Detroit",
  "lat": 44.7631,
  "lon": -85.6206,
  "radiusKm": 2.5
}
```

Then build and optionally sample Street View / Satellite archetypes:

```bash
npm run city:build -- traversecity
GOOGLE_MAPS_API_KEY="your-api-key" npm run city:archetypes -- --city traversecity --write-geodata
```

> **Optional `GOOGLE_MAPS_API_KEY` for Street View & Satellite Calibration:**
> - Core city pack builds (`npm run city:install` / `npm run city:build`) only use public OpenStreetMap Overpass and AWS Terrain Tiles—no API key is required.
> - To calibrate neighborhood facade palettes, roof colors, housing density, and tree canopy coverage from real imagery via `npm run city:archetypes` ([`tools/sample-city-archetypes.py`](tools/sample-city-archetypes.py)), set `GOOGLE_MAPS_API_KEY` in your environment (with **Street View Static API** and **Maps Static API** enabled on the key). Without a key, `city:archetypes` automatically falls back to OpenStreetMap building/material/tree tags.

See [`cities/README.md`](cities/README.md) for the full specification of `cities/<id>/city-pack.json`, `cities/local-packs.json`, and the binary formats (`NYB1`, `NYT2`, `ELV2`, `RIV1`).

---

## Credits & Licenses

- **Map Data**: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL).
- **Elevation Data**: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) on AWS, derived from the USGS 3D Elevation Program (3DEP).
- **Live Weather & Stream Gauges**: [National Weather Service](https://www.weather.gov/) and [USGS Water Services](https://waterservices.usgs.gov/).
- **Code**: Adapted from [Go To Ann Arbor](https://github.com/mrubens/go-to-ann-arbor) and [Mr.doob](https://github.com/mrdoob)'s *Slop New York* (MIT License - see [`LICENSE-slop-newyork`](LICENSE-slop-newyork)).
- **Three.js**: MIT License - see [`LICENSE-three`](LICENSE-three).
