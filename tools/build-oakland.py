#!/usr/bin/env python3
"""
Build Oakland, CA geodata for Go To Oakland (from OpenStreetMap + AWS Terrain Tiles):
  - js/city-geodata.js         (GEO: streets, roadGraph, blocks, parks, water, rail, bridges, places, signs, lawns, etc.)
  - js/building-geodata.bin.gz (NYB1 binary building footprints, heights, and kinds)
  - js/tree-geodata.bin.gz     (NYT2 binary street & park trees with species and heights)
  - data/elevation.bin.gz      (ELV2 binary terrain heightmap from AWS Terrain Tiles)
  - data/river.bin.gz          (RIV1 binary bed dig mask + water surface levels for Lake Merritt & Oakland Estuary)
  - data/addresses.json        (house numbers along streets)
  - data/districts.json        (historic districts & landuse polygons)
  - data/gas-stations.json     (fuel station canopies)
  - data/rail-crossings.json   (grade crossings along Embarcadero & Port rail lines)
  - data/roof-shapes.json      (pitched/hipped/gabled/dome roof shapes)
  - data/street-furniture.json (fire hydrants, park benches/tables/shelters, sports courts)
  - data/wolverine.json        (Amtrak Capitol Corridor & Coast Starlight timetable at Jack London Square OKJ)
  - data/actransit.json.gz     (AC Transit bus routes, stops, and trips across Central Oakland)

Coordinate system matches the game:
  - 1 world unit = 1 metre
  - Origin (0, 0) = 14th St & Broadway, Downtown Oakland (37.8044, -122.2712)
  - +X = East, -X = West
  - +Z = South, -Z = North (true north up, bearingDeg = 0)
"""

import csv
import gzip
import io
import json
import math
import os
import random
import re
import struct
import subprocess
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from heapq import heappop, heappush

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import linemerge, polygonize, unary_union
from shapely.prepared import prep

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(os.path.join(ROOT_DIR, 'js'), exist_ok=True)
os.makedirs(os.path.join(ROOT_DIR, 'data'), exist_ok=True)

# 14th St & Broadway, Downtown Oakland
LAT0 = 37.8044
LON0 = -122.2712
BBOX = (37.785, -122.308, 37.8545, -122.230)  # S, W, N, E (extended 1 mile north through Rockridge & North Oakland)

A_EARTH, E2_EARTH = 6378137.0, 6.69437999014e-3
phi = math.radians(LAT0)
LON_M = math.pi / 180.0 * A_EARTH / math.sqrt(1.0 - E2_EARTH * math.sin(phi) ** 2) * math.cos(phi)
LAT_M = math.pi / 180.0 * A_EARTH * (1.0 - E2_EARTH) / (1.0 - E2_EARTH * math.sin(phi) ** 2) ** 1.5

r1 = lambda v: round(float(v), 1)


def ll_to_xz(lat, lon):
    return round((lon - LON0) * LON_M, 1), round(-(lat - LAT0) * LAT_M, 1)


W_X, N_Z = ll_to_xz(BBOX[2], BBOX[1])
E_X, S_Z = ll_to_xz(BBOX[0], BBOX[3])
CLIP_BOX = box(W_X, N_Z, E_X, S_Z)
SIDEWALK = 4.6
print(f"Oakland world bounds: X=[{W_X}, {E_X}] ({E_X - W_X:.0f}m), Z=[{N_Z}, {S_Z}] ({S_Z - N_Z:.0f}m)")

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def fetch_overpass(cache_name, query):
    cache_path = os.path.join(CACHE_DIR, cache_name)
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 100:
        print(f"  Using cached {cache_name} ({os.path.getsize(cache_path) / (1024*1024):.1f} MB)")
        with open(cache_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"  Querying {endpoint} for {cache_name} ...")
            res = subprocess.run(
                [
                    'curl', '-sS', '-f', '--max-time', '240',
                    '-A', 'go-to-oakland-builder/1.0',
                    '--data-urlencode', f'data={query}',
                    endpoint,
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            raw = res.stdout
            parsed = json.loads(raw)
            with open(cache_path, 'w', encoding='utf-8') as f:
                f.write(raw)
            print(f"  Saved {cache_name} ({len(parsed.get('elements', []))} elements)")
            return parsed
        except Exception as e:
            print(f"  Warning: {endpoint} failed ({e}), trying next...")
            time.sleep(2)
    raise RuntimeError(f"All Overpass endpoints failed for {cache_name}")


S, W, N, E = BBOX

INFRA_QUERY = f"""
[out:json][timeout:180];
(
  way["highway"]({S},{W},{N},{E});
  way["waterway"]({S},{W},{N},{E});
  way["natural"~"^(water|wood|tree_row|coastline|beach|wetland|scrub|grassland)$"]({S},{W},{N},{E});
  relation["natural"~"^(water|wood|wetland)$"]({S},{W},{N},{E});
  way["landuse"~"^(park|grass|meadow|recreation_ground|village_green|cemetery|forest|retail|commercial|industrial|residential|railway|port|basin|reservoir|education|institutional|religious)$"]({S},{W},{N},{E});
  relation["landuse"~"^(park|grass|meadow|recreation_ground|cemetery|forest|retail|commercial|industrial|residential)$"]({S},{W},{N},{E});
  way["leisure"~"^(park|garden|playground|golf_course|nature_reserve|pitch|track|stadium|marina|slipway|dog_park|fitness_station|swimming_pool)$"]({S},{W},{N},{E});
  relation["leisure"~"^(park|garden|golf_course|nature_reserve|stadium)$"]({S},{W},{N},{E});
  way["amenity"~"^(parking|school|university|college|hospital|place_of_worship|community_centre|library|fire_station|police|townhall|courthouse|theatre|cinema|arts_centre|marketplace|ferry_terminal|bus_station|fuel)$"]({S},{W},{N},{E});
  way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|abandoned|disused|platform)$"]({S},{W},{N},{E});
  way["man_made"~"^(pier|breakwater|groyne|bridge)$"]({S},{W},{N},{E});
  way["historic"]({S},{W},{N},{E});
  node["natural"="tree"]({S},{W},{N},{E});
  node["highway"~"^(street_lamp|traffic_signals|stop|give_way|crossing|motorway_junction)$"]({S},{W},{N},{E});
  node["railway"~"^(level_crossing|station|halt|tram_stop)$"]({S},{W},{N},{E});
  node["emergency"="fire_hydrant"]({S},{W},{N},{E});
  node["amenity"]({S},{W},{N},{E});
  node["shop"]({S},{W},{N},{E});
  node["tourism"]({S},{W},{N},{E});
  node["leisure"]({S},{W},{N},{E});
  node["historic"]({S},{W},{N},{E});
);
out body;
>;
out skel qt;
"""

BUILDINGS_QUERY = f"""
[out:json][timeout:180];
(
  way["building"]({S},{W},{N},{E});
  relation["building"]({S},{W},{N},{E});
  node["addr:housenumber"]({S},{W},{N},{E});
);
out body;
>;
out skel qt;
"""

TRANSIT_QUERY = f"""
[out:json][timeout:60];
(
  node["highway"="bus_stop"]({S},{W},{N},{E});
  node["public_transport"="platform"]({S},{W},{N},{E});
);
out body;
"""

print("Step 1: Loading OpenStreetMap & City of Oakland civic GIS data...")
infra_osm = fetch_overpass("oakland_infra.json", INFRA_QUERY)
bldg_osm = fetch_overpass("oakland_buildings.json", BUILDINGS_QUERY)
transit_osm = fetch_overpass("oakland_transit.json", TRANSIT_QUERY)


def fetch_arcgis(cache_name, url, where="1=1", out_fields="*", return_geometry=True, use_bbox=True):
    cache_path = os.path.join(CACHE_DIR, cache_name)
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 50:
        with open(cache_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"  Using cached {cache_name} ({len(data)} features)")
        return data
    features = []
    offset = 0
    page_size = 2000
    geom_env = f"{W},{S},{E},{N}"
    try:
        while True:
            q = {
                'where': where,
                'outFields': out_fields,
                'returnGeometry': 'true' if return_geometry else 'false',
                'outSR': '4326',
                'resultOffset': str(offset),
                'resultRecordCount': str(page_size),
                'f': 'json',
            }
            if use_bbox:
                q.update({
                    'geometry': geom_env,
                    'geometryType': 'esriGeometryEnvelope',
                    'inSR': '4326',
                    'spatialRel': 'esriSpatialRelIntersects',
                })
            req = urllib.request.Request(
                f"{url}?{urllib.parse.urlencode(q)}",
                headers={'User-Agent': 'go-to-oakland-builder/1.0'}
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read().decode('utf-8'))
            batch = d.get('features', [])
            features.extend(batch)
            if not d.get('exceededTransferLimit') and len(batch) < page_size:
                break
            offset += len(batch)
            if not batch:
                break
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(features, f)
        print(f"  Fetched {cache_name} ({len(features)} features)")
    except Exception as e:
        print(f"  Warning: Could not fetch {cache_name}: {e}")
    return features


def arcgis_rings_to_polys(geom):
    if not geom or 'rings' not in geom:
        return []
    polys = []
    for ring in geom['rings']:
        if len(ring) < 4:
            continue
        pts = [ll_to_xz(pt[1], pt[0]) for pt in ring]
        try:
            p = Polygon(pts).buffer(0)
            if not p.is_empty:
                polys.extend(parts(p))
        except Exception:
            pass
    if not polys:
        return []
    return parts(unary_union(polys).buffer(0))


civic_zoning = fetch_arcgis("oakland_civic_zoning.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/Zoning_base_Eff20241217_Ordxxxxx_shp/FeatureServer/0/query", out_fields="BASEZONE,ZNLABEL")
civic_general_plan = fetch_arcgis("oakland_civic_general_plan.json", "https://gismaps.oaklandca.gov/server/rest/services/Planning_Layers/MapServer/14/query", out_fields="GPLANCODE,CLASSIFN")
civic_heights = fetch_arcgis("oakland_civic_heights.json", "https://gismaps.oaklandca.gov/server/rest/services/Planning_Layers/MapServer/0/query", out_fields="MAXHEIGHT")
civic_historic_api = fetch_arcgis("oakland_civic_historic_api.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/HistoricDistrict_API_shp/FeatureServer/0/query", out_fields="DISCRIPTIO,DISTCODE,HtLevel_Wl,HtLevel_Rf")
civic_neighborhoods = fetch_arcgis("oakland_civic_neighborhoods.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/oakland_neighborhoods/FeatureServer/0/query", out_fields="*")
civic_parks = fetch_arcgis("oakland_civic_parks.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/Oakland_Parks_with_Names/FeatureServer/0/query", out_fields="NAME,ALIAS_NAME")
civic_hydrants = fetch_arcgis("oakland_civic_hydrants.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/Project_FireHydrants/FeatureServer/0/query", out_fields="*")
civic_speed_25 = fetch_arcgis("oakland_civic_speed_25mph.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/OaklandStreets_ArterialCollector_25MPH/FeatureServer/0/query", out_fields="*")
civic_speed_30 = fetch_arcgis("oakland_civic_speed_30mph.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/OaklandStreets_ArterialCollector_30MPH/FeatureServer/0/query", out_fields="*")
civic_bikeways = fetch_arcgis("oakland_civic_bikeways.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/BikeNetwork_Summer2024/FeatureServer/0/query", out_fields="*")
civic_signals = fetch_arcgis("oakland_civic_signals.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/TrafficSignals/FeatureServer/0/query", out_fields="*")
civic_necklace_lights = fetch_arcgis("oakland_civic_necklace_lights.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/LakeMerritt_Decorative_Lights/FeatureServer/0/query", out_fields="*")
civic_streetlights = fetch_arcgis("oakland_civic_streetlights.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/Street_Lights/FeatureServer/0/query", where=f"LAT >= {S} AND LAT <= {N} AND LON >= {W} AND LON <= {E}", out_fields="LAT,LON,FXTR_TYPE,REMOVED", return_geometry=False, use_bbox=False)
civic_trees = fetch_arcgis("oakland_civic_trees.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/Oakland_Public_Tree_Inventory_/FeatureServer/0/query", where=f"Latitude >= {S} AND Latitude <= {N} AND Longitude >= {W} AND Longitude <= {E}", out_fields="Latitude,Longitude,Species___genus,Species___common,DBH", return_geometry=False, use_bbox=False)
civic_addresses = fetch_arcgis("oakland_civic_addresses.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/OaklandAddresses_Dec2022/FeatureServer/0/query", where=f"UnitNbr = 0 AND Latitude >= {S} AND Latitude <= {N} AND Longitude >= {W} AND Longitude <= {E}", out_fields="StreetNumb,Street,Latitude,Longitude", return_geometry=False, use_bbox=False)
civic_curb_ramps = fetch_arcgis("oakland_civic_curb_ramps.json", "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/CurbRamps/FeatureServer/0/query", where=f"Latitude >= {S} AND Latitude <= {N} AND Longitude >= {W} AND Longitude <= {E}", out_fields="Latitude,Longitude,CORNER,MATCOLOR,CONDITION", return_geometry=False, use_bbox=False)

nodes = {}
ways = {}
relations = []

for dataset in (infra_osm, bldg_osm):
    for el in dataset.get('elements', []):
        t = el['type']
        if t == 'node':
            x, z = ll_to_xz(el['lat'], el['lon'])
            if el['id'] not in nodes or 'tags' in el:
                prev_tags = nodes.get(el['id'], (0, 0, {}))[2]
                nodes[el['id']] = (x, z, el.get('tags') or prev_tags)
        elif t == 'way':
            if el['id'] not in ways or 'tags' in el:
                ways[el['id']] = el
        elif t == 'relation':
            relations.append(el)

print(f"Loaded {len(nodes)} nodes, {len(ways)} ways, {len(relations)} relations")


def parts(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    if hasattr(g, 'geoms'):
        return [p for c in g.geoms for p in parts(c)]
    return []


def flat(coords):
    out = []
    for x, z in coords:
        out.append(r1(x))
        out.append(r1(z))
    return out


def way_coords(w):
    pts = []
    for nid in w.get('nodes', []):
        if nid in nodes:
            pts.append((nodes[nid][0], nodes[nid][1]))
    return pts


def rdp(pts, eps=0.5):
    if len(pts) < 3:
        return pts
    ls = LineString(pts).simplify(eps, preserve_topology=False)
    return [(r1(x), r1(z)) for x, z in ls.coords]


def poly_to_rings(poly, tol=1.0, min_area=20.0):
    out = []
    for p in parts(poly):
        p = p.intersection(CLIP_BOX)
        for sp in parts(p):
            if sp.area < min_area:
                continue
            sp = sp.simplify(tol, preserve_topology=True)
            if sp.is_empty or sp.geom_type != 'Polygon' or sp.area < min_area:
                continue
            sp = orient(sp, -1.0)
            ext = list(sp.exterior.coords)[:-1]
            if len(ext) < 3:
                continue
            holes = [flat(list(h.coords)[:-1]) for h in sp.interiors if Polygon(h).area >= min_area and len(h.coords) >= 4]
            out.append([flat(ext)] + holes)
    return out


def relation_to_polygons(rel):
    outers, inners = [], []
    for m in rel.get('members', []):
        if m['type'] != 'way' or m['ref'] not in ways:
            continue
        pts = way_coords(ways[m['ref']])
        if len(pts) < 2:
            continue
        role = m.get('role', 'outer')
        (inners if role == 'inner' else outers).append(pts)
    if not outers:
        return []

    def build_rings(lines):
        closed, open_segs = [], []
        for pts in lines:
            if len(pts) >= 4 and pts[0] == pts[-1]:
                try:
                    p = Polygon(pts).buffer(0)
                    if not p.is_empty:
                        closed.append(p)
                except Exception:
                    pass
            elif len(pts) >= 2:
                open_segs.append(LineString(pts))
        if open_segs:
            try:
                for p in polygonize(unary_union(open_segs)):
                    closed.append(p.buffer(0))
            except Exception:
                pass
        return closed

    op = build_rings(outers)
    ip = build_rings(inners)
    if not op:
        return []
    u = unary_union(op)
    if ip:
        u = u.difference(unary_union(ip))
    return parts(u)


# ---------------------------------------------------------------------------
# 2. Streets, Road Graph, Water, Parks, Bridges, Rail, Trails
# ---------------------------------------------------------------------------
print("Step 2: Processing streets, roadGraph, water, parks, bridges, and railways...")

DRIVE = {
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'unclassified', 'residential', 'living_street',
    'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
}
ABBR = [
    ('Street', 'St'), ('Avenue', 'Ave'), ('Boulevard', 'Blvd'), ('Drive', 'Dr'),
    ('Road', 'Rd'), ('Place', 'Pl'), ('Court', 'Ct'), ('Lane', 'Ln'),
    ('Parkway', 'Pkwy'), ('Circle', 'Cir'), ('Terrace', 'Ter'), ('Highway', 'Hwy'),
    ('North ', 'N '), ('South ', 'S '), ('East ', 'E '), ('West ', 'W ')
]


def short_name(n):
    for a, b in ABBR:
        n = n.replace(a, b) if not a.endswith(' ') else (b + n[len(a):] if n.startswith(a) else n)
    return n


def bike_spec(t, oneway):
    def kind(v):
        return 1 if v in ('lane', 'opposite_lane', 'track', 'opposite_track') else 4 if v == 'shared_lane' else 0
    r = l = 0
    if t.get('cycleway:both'):
        r = l = kind(t['cycleway:both'])
    if t.get('cycleway'):
        k = kind(t['cycleway'])
        r = r or k
        if not oneway:
            l = l or k
    if t.get('cycleway:right'):
        r = kind(t['cycleway:right'])
    if t.get('cycleway:left'):
        l = kind(t['cycleway:left'])
    buf = any(v == 'yes' for k, v in t.items() if k.startswith('cycleway') and 'buffer' in k)
    return (1 if r == 1 else 4 if r == 4 else 0) | (2 if l == 1 else 8 if l == 4 else 0) | (16 if buf and (r == 1 or l == 1) else 0)


def road_class(t):
    hw = t['highway']
    if t.get('lane_markings') == 'no':
        return 6
    if hw.endswith('_link'):
        return 5
    return {'motorway': 0, 'trunk': 0, 'primary': 1, 'secondary': 2, 'tertiary': 3}.get(hw, 4)


def int_tag(t, k):
    try:
        return int(str(t.get(k, '')).split(';')[0])
    except ValueError:
        return 0


def norm_street_key(s):
    s = short_name((s or '').strip()).upper()
    s = re.sub(r'\bAV\b', 'AVE', s)
    s = re.sub(r'\bBL\b', 'BLVD', s)
    return re.sub(r'\s+', ' ', s).strip()


oakdot_speed_by_street = {}
for feat in civic_speed_25:
    at = feat.get('attributes') or {}
    k = norm_street_key(at.get('NAME') or '')
    if k:
        oakdot_speed_by_street[k] = int(at.get('POSTED_SPD') or 25)
for feat in civic_speed_30:
    at = feat.get('attributes') or {}
    k = norm_street_key(at.get('NAME') or '')
    if k:
        oakdot_speed_by_street[k] = int(at.get('POSTED_SPD') or 30)

oakdot_bike_by_street = {}
for feat in civic_bikeways:
    at = feat.get('attributes') or {}
    cl = str(at.get('EXISTINGCL') or '').strip()
    if not cl or cl in ('0', '0.0'):
        continue
    k = norm_street_key(at.get('ROADWAY') or '')
    if not k:
        continue
    if cl.startswith(('2B', '4')):
        oakdot_bike_by_street[k] = 19  # buffered / protected bike lane (1 | 2 | 16)
    elif cl.startswith('2'):
        oakdot_bike_by_street[k] = max(oakdot_bike_by_street.get(k, 0), 3)  # standard bike lane (1 | 2)
    elif cl.startswith('3'):
        oakdot_bike_by_street[k] = max(oakdot_bike_by_street.get(k, 0), 12)  # sharrows (4 | 8)


def mph_tag(t, name=''):
    v = str(t.get('maxspeed', ''))
    try:
        n = float(v.split()[0])
        return round(n if 'mph' in v else n / 1.609)
    except (ValueError, IndexError):
        pass
    if name:
        k = norm_street_key(name)
        if k in oakdot_speed_by_street:
            return oakdot_speed_by_street[k]
    hw = t.get('highway', '')
    if hw in ('motorway', 'trunk'):
        return 55
    if hw == 'primary':
        return 30
    return 25


def road_spec(t, name=''):
    hw = t['highway']
    link = hw.endswith('_link')
    base = hw.replace('_link', '')
    oneway = t.get('oneway') in ('yes', 'true', '1') or hw in ('motorway',) or t.get('junction') == 'roundabout'
    rev = t.get('oneway') in ('-1', 'reverse')
    lanes = int_tag(t, 'lanes')
    if not lanes:
        lanes = 1 if (link or (oneway and base in ('residential', 'unclassified', 'living_street', 'tertiary'))) else \
            {'motorway': 3, 'trunk': 4, 'primary': 4, 'secondary': 2}.get(base, 2)
    if link:
        w = max(6.5, lanes * 3.6 + 1.5)
    elif base in ('motorway', 'trunk'):
        w = lanes * 3.7 + 3.0
    elif base == 'primary':
        w = max(13.0, lanes * 3.4 + 1.5)
    elif base == 'secondary':
        w = max(11.0, lanes * 3.4 + 1.5)
    elif base == 'tertiary':
        w = max(9.5, lanes * 3.3 + 1.5)
    else:
        w = 6.5 if (oneway or rev) else 8.5
    try:
        tw = float(str(t.get('width', '')).replace('m', '').strip().split()[0])
        if 5.0 <= tw <= 40.0:
            w = tw
    except (ValueError, IndexError):
        pass
    d = (-1 if rev else 1) if (oneway or rev) else 0
    bike = bike_spec(t, oneway or rev)
    if not bike and name and not hw.endswith('_link') and base not in ('motorway', 'trunk'):
        bk = oakdot_bike_by_street.get(norm_street_key(name), 0)
        if bk:
            if oneway or rev:
                bike = (1 | (16 if (bk & 16) else 0)) if (bk & 3) else 4
            else:
                bike = bk
    if 'width' not in t:
        w += sum(1.7 for b in (1, 2) if bike & b) + (0.6 if bike & 16 else 0)
    hw_flag = base in ('motorway', 'trunk') or (link and base in ('motorway', 'trunk'))
    return round(w, 1), lanes, d, hw_flag, bike


METERED_OAKLAND = re.compile(
    r'^(Broadway|Telegraph Ave|Grand Ave|Lakeshore Ave|Piedmont Ave|College Ave|San Pablo Ave|International Blvd|'
    r'Franklin St|Webster St|Harrison St|Jackson St|Washington St|Clay St|[789]th St|1[0-9]th St|2[0-9]th St)$'
)

drive = []
trails_raw = []
rail_tracks = []
rail_by_name = defaultdict(list)
water_polys = []
water_lines = []
green_spaces = []
parking_polys = []
playground_ways = []
pier_polys = []
coastline_lines = []
driveway_ways = []

for wid, w in ways.items():
    t = w.get('tags', {})
    if not t:
        continue
    pts = way_coords(w)
    if len(pts) < 2:
        continue
    is_closed = len(pts) >= 4 and pts[0] == pts[-1]

    hw = t.get('highway')
    if hw in DRIVE and t.get('area') != 'yes' and t.get('access') not in ('private', 'no'):
        if t.get('tunnel') in ('yes', 'building_passage'):
            continue
        name = short_name(t.get('name', '') or t.get('ref', ''))
        wd, lanes, d, hw_flag, bike = road_spec(t, name)
        mx, mz = pts[len(pts) // 2]
        in_town = (-900 < mx < 1200 and -1200 < mz < 900)
        park_lanes = 0
        if not hw_flag and in_town and METERED_OAKLAND.match(name) and hw in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified'):
            park_lanes = 3 if d == 0 else 1
            if 'width' not in t:
                wd = round(wd + 2.4 * ((park_lanes & 1) + (park_lanes >> 1)), 1)
        drive.append({
            'id': wid,
            'nodes': [nid for nid in w['nodes'] if nid in nodes],
            'pts': pts,
            'w': wd,
            'lanes': lanes,
            'dir': d,
            'hw': hw_flag,
            'name': name,
            'bridge': t.get('bridge') in ('yes', 'viaduct', 'cantilever', 'movable', 'trestle'),
            'cls': road_class(t),
            'bike': bike,
            'lf': int_tag(t, 'lanes:forward'),
            'lb': int_tag(t, 'lanes:backward'),
            'mph': mph_tag(t, name),
            'park': park_lanes,
        })
    elif hw == 'service' and t.get('service') == 'driveway':
        driveway_ways.append(pts)
    elif hw in ('path', 'footway', 'cycleway', 'pedestrian', 'track', 'bridleway'):
        if t.get('area') != 'yes' and t.get('footway') not in ('sidewalk', 'crossing') and t.get('cycleway') != 'crossing' and t.get('tunnel') not in ('yes', 'building_passage'):
            trails_raw.append((t, pts))

    # Railways
    if t.get('railway') in ('rail', 'light_rail') and t.get('tunnel') != 'yes' and t.get('usage') != 'test':
        ls = LineString(pts).intersection(CLIP_BOX.buffer(-5))
        for seg in ([ls] if ls.geom_type == 'LineString' else getattr(ls, 'geoms', [])):
            if seg.is_empty or seg.length < 2:
                continue
            seg = seg.simplify(0.4)
            is_br = 1 if t.get('bridge') in ('yes', 'viaduct') else 0
            is_main = 0 if t.get('service') in ('yard', 'spur', 'siding', 'crossover') else 1
            rail_tracks.append([flat(seg.coords), is_br, is_main])
            if is_main:
                rname = t.get('name', 'Niles Subdivision')
                rail_by_name[rname].append(seg)

    # Waterways & Coastline (Lake Merritt, Lake Merritt Channel, and Oakland Estuary only; exclude hill creeks, fountains, wetlands, and covered reservoirs)
    wwy = t.get('waterway')
    if t.get('natural') == 'coastline':
        coastline_lines.append(LineString(pts))

    if not is_closed and t.get('man_made') == 'pier':
        try:
            pier_polys.append(LineString(pts).buffer(3.5))
        except Exception:
            pass

    if is_closed:
        try:
            poly = Polygon(pts).buffer(0)
        except Exception:
            poly = None
        if poly and not poly.is_empty:
            nat = t.get('natural')
            lu = t.get('landuse')
            leis = t.get('leisure')
            amen = t.get('amenity')
            mm = t.get('man_made')
            name = t.get('name', '')

            if nat == 'water' and 'Lake Merritt' in name and not t.get('layer') and t.get('intermittent') != 'yes' and poly.bounds[3] > -850:
                water_polys.append(poly)
            elif leis == 'playground':
                playground_ways.append(poly)
            elif leis == 'golf_course':
                green_spaces.append({'name': t.get('name', 'Lake Chabot Golf'), 'kind': 'golf', 'geom': poly.intersection(CLIP_BOX)})
            elif leis in ('park', 'nature_reserve', 'garden', 'recreation_ground', 'common', 'dog_park') or lu in ('park', 'grass', 'meadow', 'recreation_ground', 'village_green'):
                g_c = poly.intersection(CLIP_BOX)
                if g_c.area >= 150:
                    green_spaces.append({'name': t.get('name', ''), 'kind': 'park', 'geom': g_c})
            elif nat in ('wood', 'scrub') or lu == 'forest':
                g_c = poly.intersection(CLIP_BOX)
                if g_c.area >= 150:
                    green_spaces.append({'name': t.get('name', ''), 'kind': 'wood', 'geom': g_c})
            elif lu == 'cemetery':
                g_c = poly.intersection(CLIP_BOX)
                if g_c.area >= 150:
                    green_spaces.append({'name': t.get('name', 'Mountain View Cemetery'), 'kind': 'cemetery', 'geom': g_c})
            elif amen == 'parking' and t.get('parking') not in ('underground', 'multi-storey', 'rooftop'):
                if poly.area > 120:
                    parking_polys.append(poly)
            elif mm in ('pier', 'breakwater', 'groyne'):
                pier_polys.append(poly)

for rel in relations:
    t = rel.get('tags', {})
    if not t:
        continue
    nat = t.get('natural')
    lu = t.get('landuse')
    leis = t.get('leisure')
    name = t.get('name', '')
    if not (nat in ('water', 'wood', 'wetland', 'bay') or lu in ('park', 'grass', 'meadow', 'recreation_ground', 'cemetery', 'forest', 'basin', 'reservoir') or leis in ('park', 'garden', 'golf_course', 'nature_reserve')):
        continue
    for poly in relation_to_polygons(rel):
        if nat == 'water' and 'Lake Merritt' in name and not t.get('layer') and t.get('intermittent') != 'yes' and poly.bounds[3] > -850:
            water_polys.append(poly)
        elif leis == 'golf_course':
            green_spaces.append({'name': t.get('name', ''), 'kind': 'golf', 'geom': poly.intersection(CLIP_BOX)})
        elif leis in ('park', 'garden', 'nature_reserve') or lu in ('park', 'grass', 'meadow', 'recreation_ground'):
            g_c = poly.intersection(CLIP_BOX)
            if g_c.area >= 200:
                green_spaces.append({'name': t.get('name', ''), 'kind': 'park', 'geom': g_c})
        elif lu == 'cemetery':
            g_c = poly.intersection(CLIP_BOX)
            if g_c.area >= 200:
                green_spaces.append({'name': t.get('name', 'Mountain View Cemetery'), 'kind': 'cemetery', 'geom': g_c})
        elif nat == 'wood' or lu == 'forest':
            g_c = poly.intersection(CLIP_BOX)
            if g_c.area >= 200:
                green_spaces.append({'name': t.get('name', ''), 'kind': 'wood', 'geom': g_c})

# Merge official City of Oakland Parks (Oakland_Parks_with_Names)
for feat in civic_parks:
    at = feat.get('attributes') or {}
    pname = (at.get('ALIAS_NAME') or at.get('NAME') or '').strip()
    if not pname:
        continue
    for p in arcgis_rings_to_polys(feat.get('geometry')):
        g_c = p.intersection(CLIP_BOX)
        if g_c.area < 150:
            continue
        matched = False
        for gs in green_spaces:
            if gs['kind'] == 'park' and gs['geom'].intersects(g_c):
                inter_a = gs['geom'].intersection(g_c).area
                if inter_a > 0.35 * min(gs['geom'].area, g_c.area):
                    if not gs['name']:
                        gs['name'] = pname
                    matched = True
                    break
        if not matched:
            green_spaces.append({'name': pname, 'kind': 'park', 'geom': g_c})

# Construct Oakland Estuary & San Francisco Bay water polygons from OSM coastline.
# In OSM, natural=coastline ways are oriented with land on the left and water on the right.
# In our coordinate frame (+X = East, +Z = South), the right-hand (water) normal of segment
# (dx, dz) is (-dz / L, dx / L), and the left-hand (land) normal is (dz / L, -dx / L).
if coastline_lines:
    try:
        water_side_probes = []
        land_side_probes = []
        for ls in coastline_lines:
            cs = list(ls.coords)
            step = max(1, len(cs) // 25)
            for i in range(0, len(cs) - 1, step):
                x0, z0 = cs[i]
                x1, z1 = cs[i + 1]
                dx, dz = x1 - x0, z1 - z0
                L = math.hypot(dx, dz)
                if L < 1.0:
                    continue
                mx, mz = 0.5 * (x0 + x1), 0.5 * (z0 + z1)
                if not (W_X <= mx <= E_X and N_Z <= mz <= S_Z):
                    continue
                rx, rz = -dz / L, dx / L
                water_side_probes.append(Point(mx + rx * 15.0, mz + rz * 15.0))
                land_side_probes.append(Point(mx - rx * 15.0, mz - rz * 15.0))
        origin_pt = Point(0.0, 0.0)
        for cand in polygonize(unary_union(coastline_lines + [CLIP_BOX.exterior])):
            if cand.contains(origin_pt):
                continue
            w_hits = sum(1 for p in water_side_probes if cand.contains(p))
            l_hits = sum(1 for p in land_side_probes if cand.contains(p))
            if w_hits > l_hits:
                water_polys.append(cand)
    except Exception as e:
        print(f"Coastline polygonize warning: {e}")

water = unary_union(water_polys).buffer(0).intersection(CLIP_BOX.buffer(300)) if water_polys else Polygon()
if pier_polys and not water.is_empty:
    water = water.difference(unary_union(pier_polys).buffer(0))

# Build roadGraph in exact Ann Arbor schema:
# nodes: flat [x0, z0, x1, z1, ...]
# links: [[a, b, name_idx, w, lanes, dir, flat(line[1:-1]), cls, bike, lf, lb, mph, park], ...]
# names: [name0, name1, ...]
use_count = defaultdict(int)
for r in drive:
    for nid in r['nodes']:
        use_count[nid] += 1

gnodes, gnode_id, gnames, gname_id, glinks = [], {}, [], {}, []


def get_gnode(nid, pt):
    if nid not in gnode_id:
        gnode_id[nid] = len(gnodes)
        gnodes.append(pt)
    return gnode_id[nid]


def get_gname(n):
    if n not in gname_id:
        gname_id[n] = len(gnames)
        gnames.append(n)
    return gname_id[n]


for r in drive:
    ns, ps = r['nodes'], r['pts']
    if len(ns) < 2 or len(ps) != len(ns):
        continue
    start = 0
    for i in range(1, len(ns)):
        if i == len(ns) - 1 or use_count[ns[i]] > 1:
            seg = ps[start:i + 1]
            if len(seg) >= 2 and ns[start] != ns[i]:
                a = get_gnode(ns[start], seg[0])
                b = get_gnode(ns[i], seg[-1])
                line = rdp(seg, 0.4)
                glinks.append([
                    a, b, get_gname(r['name']), r['w'], r['lanes'], r['dir'],
                    flat(line[1:-1]), r['cls'], r['bike'], r['lf'], r['lb'], r['mph'], r['park']
                ])
            start = i

roadGraph = {
    'nodes': [v for p in gnodes for v in (r1(p[0]), r1(p[1]))],
    'links': glinks,
    'names': gnames,
}
roads_out = [
    [r['name'], r['w'], r['dir'], r['lanes'], 1 if r['hw'] else 0, flat(rdp(r['pts'], 0.5))]
    for r in drive if r['name']
]
print(f"roadGraph: {len(gnodes)} nodes, {len(glinks)} links; {len(roads_out)} named roads")

# Bridges over Lake Merritt & the Lake Merritt Channel (exclude freeway viaducts)
river_bridges = []
if not water.is_empty:
    channel_water = water.intersection(box(350, -820, 2150, 1520))
    if not channel_water.is_empty:
        w_prep = prep(channel_water.buffer(4.0))
        for r in drive:
            if r['bridge'] and not r['hw']:
                ls = LineString(r['pts'])
                if ls.length < 320 and w_prep.intersects(ls):
                    r['is_river_bridge'] = True
                    river_bridges.append([0, r['w']] + flat(r['pts']))
        for tr_flat, is_br, _ in rail_tracks:
            if is_br:
                pts = list(zip(tr_flat[0::2], tr_flat[1::2]))
                if len(pts) >= 2:
                    ls = LineString(pts)
                    if ls.length < 320 and w_prep.intersects(ls):
                        river_bridges.append([1, 5.0] + tr_flat)
        for t_tags, pts in trails_raw:
            if t_tags.get('bridge') in ('yes', 'boardwalk', 'viaduct'):
                ls = LineString(pts)
                if ls.length < 320 and w_prep.intersects(ls):
                    river_bridges.append([2, 2.8] + flat(pts))

# Road union & water_open (subtract all roads except those with raised decks in river_bridges)
surface = [LineString(r['pts']).buffer(r['w'] / 2, quad_segs=3) for r in drive if not r.get('is_river_bridge')]
road_union = unary_union(surface).buffer(0) if surface else Polygon()
water_open = water.difference(road_union.buffer(1.5)).intersection(CLIP_BOX) if not water.is_empty else Polygon()

# Merge railway routes for Capitol Corridor & Union Pacific freight trains
all_main_rail = []
for rname, segs in rail_by_name.items():
    all_main_rail.extend(segs)
rail_routes = []
if all_main_rail:
    merged_r = linemerge(unary_union(all_main_rail))
    runs = [merged_r] if merged_r.geom_type == 'LineString' else list(getattr(merged_r, 'geoms', []))
    runs.sort(key=lambda l: -l.length)
    route_names = ['Capitol Corridor', 'Union Pacific Niles Subdivision', 'Port of Oakland Belt Line']
    for idx, run in enumerate(runs[:3]):
        if run.length > 500:
            rail_routes.append([route_names[idx], flat(run.simplify(0.5).coords)])

print(f"Railway tracks: {len(rail_tracks)}, active train routes: {[r[0] for r in rail_routes]}")

# ---------------------------------------------------------------------------
# 3. Buildings (NYB1), Addresses, Roof Shapes, Gas Stations
# ---------------------------------------------------------------------------
print("Step 3: Processing Oakland buildings (NYB1), addresses, roof shapes, and fuel canopies...")


def map_basezone_to_landuse(bz):
    bz = (bz or '').strip().upper()
    if not bz:
        return 0
    if bz.startswith(('RD-', 'RH-', 'RM-1')):
        return 1  # SINGLE_FAMILY
    if bz.startswith(('RM-2', 'RM-3')):
        return 2  # TWO_FAMILY
    if bz.startswith(('RM-4', 'RU-', 'D-LM-1', 'D-DT-R', 'S-15')):
        return 3  # APARTMENTS
    if bz.startswith(('CN-', 'CC-', 'CR-', 'D-BV-')):
        return 5  # SHOPS
    if bz.startswith(('CBD-P', 'CBD-C', 'D-DT-P', 'D-DT-C', 'D-KP-')):
        return 6  # OFFICES
    if bz.startswith(('CBD-X', 'CBD-R', 'D-DT-CX', 'D-DT-RX', 'D-LM-2', 'D-LM-3', 'D-LM-4', 'HBX-', 'C-40', 'C-45', 'D-OK-')):
        return 7  # MIXED_USE
    if bz.startswith(('S-1', 'S-2', 'D-DT-CP', 'D-GI')):
        return 8  # CIVIC / MEDICAL / INSTITUTIONAL
    if bz.startswith(('CIX-', 'IG', 'IO', 'M-', 'D-CE-')):
        return 10  # INDUSTRY
    if bz.startswith('OS'):
        return 11  # RECREATION
    return 0


def map_gplan_to_landuse(cl):
    cl = (cl or '').strip().lower()
    if 'detached' in cl:
        return 1
    if 'mixed housing' in cl:
        return 2
    if 'urban residential' in cl:
        return 3
    if 'neighborhood center' in cl or 'community commercial' in cl or 'regional commercial' in cl or 'retail' in cl:
        return 5
    if 'central business' in cl:
        return 6
    if 'mixed use' in cl or 'business mix' in cl:
        return 7
    if 'institutional' in cl:
        return 8
    if 'industry' in cl or 'warehouse' in cl or 'produce' in cl:
        return 10
    if 'park' in cl or 'conservation' in cl:
        return 11
    return 0


ZCELL = 150.0
zoning_grid = defaultdict(list)
civic_landuse_polys = []

for feat in civic_zoning:
    at = feat.get('attributes') or {}
    lu_code = map_basezone_to_landuse(at.get('BASEZONE'))
    if not lu_code:
        continue
    for p in arcgis_rings_to_polys(feat.get('geometry')):
        p_c = p.intersection(CLIP_BOX)
        for sp in parts(p_c):
            if sp.area < 150:
                continue
            sp_s = sp.simplify(1.2, preserve_topology=True)
            if sp_s.is_empty or sp_s.geom_type != 'Polygon':
                continue
            civic_landuse_polys.append((lu_code, sp_s))
            minx, minz, maxx, maxz = sp_s.bounds
            sp_prep = prep(sp_s)
            for ix in range(int(minx // ZCELL), int(maxx // ZCELL) + 1):
                for iz in range(int(minz // ZCELL), int(maxz // ZCELL) + 1):
                    zoning_grid[(ix, iz)].append((lu_code, minx, minz, maxx, maxz, sp_prep))

for feat in civic_general_plan:
    at = feat.get('attributes') or {}
    lu_code = map_gplan_to_landuse(at.get('CLASSIFN'))
    if not lu_code:
        continue
    for p in arcgis_rings_to_polys(feat.get('geometry')):
        p_c = p.intersection(CLIP_BOX)
        for sp in parts(p_c):
            if sp.area < 250:
                continue
            sp_s = sp.simplify(1.5, preserve_topology=True)
            if sp_s.is_empty or sp_s.geom_type != 'Polygon':
                continue
            minx, minz, maxx, maxz = sp_s.bounds
            sp_prep = prep(sp_s)
            for ix in range(int(minx // ZCELL), int(maxx // ZCELL) + 1):
                for iz in range(int(minz // ZCELL), int(maxz // ZCELL) + 1):
                    zoning_grid[(ix, iz)].append((lu_code, minx, minz, maxx, maxz, sp_prep))

height_grid = defaultdict(list)
for feat in civic_heights:
    at = feat.get('attributes') or {}
    m = re.match(r'(\d+)', str(at.get('MAXHEIGHT') or '').strip())
    if not m:
        continue
    max_ft = float(m.group(1))
    max_m = max_ft * 0.3048
    if max_m < 8.0:
        continue
    for p in arcgis_rings_to_polys(feat.get('geometry')):
        p_c = p.intersection(CLIP_BOX)
        for sp in parts(p_c):
            if sp.area < 100:
                continue
            minx, minz, maxx, maxz = sp.bounds
            sp_prep = prep(sp)
            for ix in range(int(minx // ZCELL), int(maxx // ZCELL) + 1):
                for iz in range(int(minz // ZCELL), int(maxz // ZCELL) + 1):
                    height_grid[(ix, iz)].append((max_m, minx, minz, maxx, maxz, sp_prep))


def zoning_at(x, z):
    pt = None
    for lu_code, minx, minz, maxx, maxz, sp_prep in zoning_grid.get((int(x // ZCELL), int(z // ZCELL)), ()):
        if minx <= x <= maxx and minz <= z <= maxz:
            if pt is None:
                pt = Point(x, z)
            if sp_prep.contains(pt):
                return lu_code
    return 0


def max_height_m_at(x, z):
    pt = None
    for max_m, minx, minz, maxx, maxz, sp_prep in height_grid.get((int(x // ZCELL), int(z // ZCELL)), ()):
        if minx <= x <= maxx and minz <= z <= maxz:
            if pt is None:
                pt = Point(x, z)
            if sp_prep.contains(pt):
                return max_m
    return 0.0


def parse_height_m(tags, kind, area, cx, cz):
    if 'height' in tags:
        s = str(tags['height']).lower().strip()
        m = re.match(r'([\d.]+)', s)
        if m:
            val = float(m.group(1))
            if 'ft' in s or "'" in s:
                val *= 0.3048
            if 2.5 <= val <= 200.0:
                return val
    if 'building:levels' in tags:
        m = re.match(r'([\d.]+)', str(tags['building:levels']))
        if m:
            lv = float(m.group(1))
            if 1 <= lv <= 60:
                floor_h = 3.8 if kind in (2, 3, 5, 6) else 3.1
                return max(3.5, min(180.0, lv * floor_h + 1.2))
    h_seed = int(abs(cx * 37 + cz * 101 + area * 0.5)) % 1000
    in_downtown = (-650 <= cx <= 550 and -850 <= cz <= 550)
    z_cap = max_height_m_at(cx, cz)
    b_tag = tags.get('building', 'yes')
    if kind == 1:
        if b_tag in ('apartments', 'dormitory', 'terrace') or area > 260:
            h = 11.0 + (h_seed % 4) * 3.0
            return min(h, z_cap) if z_cap >= 10.5 else h
        if area < 175 and (h_seed % 10 < 6):
            return 4.2
        return 4.2 if (h_seed % 10 < 4) else 8.0
    elif kind == 3:
        if in_downtown and area > 500:
            h = 28.0 + (h_seed % 12) * 5.0
            return min(h, z_cap) if z_cap >= 18.0 else h
        h = 14.0 + (h_seed % 5) * 4.0
        return min(h, z_cap) if z_cap >= 12.0 else h
    elif kind == 2:
        if in_downtown and area > 700:
            h = 16.0 + (h_seed % 6) * 4.0
            return min(h, z_cap) if z_cap >= 12.0 else h
        h = 7.5 + (h_seed % 3) * 3.0
        return min(h, z_cap) if z_cap >= 9.0 else h
    elif kind in (4, 5, 6):
        return 11.0 + (h_seed % 5) * 3.5
    return 8.0


def classify_building(tags, area, cx, cz):
    b = tags.get('building', 'yes')
    amen = tags.get('amenity', '')
    off = tags.get('office', '')
    shop = tags.get('shop', '')
    leis = tags.get('leisure', '')
    tourism = tags.get('tourism', '')

    if b in ('civic', 'government', 'public', 'train_station', 'transportation') or amen in ('townhall', 'courthouse', 'library', 'police', 'fire_station', 'post_office', 'ferry_terminal'):
        return 6
    if b in ('university', 'college', 'school', 'hospital', 'kindergarten') or amen in ('university', 'college', 'school', 'hospital', 'research_institute'):
        return 5
    if b in ('church', 'cathedral', 'chapel', 'temple', 'synagogue', 'mosque', 'stadium', 'grandstand') or amen in ('place_of_worship', 'theatre', 'arts_centre', 'community_centre', 'museum') or tourism in ('museum', 'attraction') or leis == 'stadium':
        return 4
    if b in ('office',) or off:
        return 3
    if b in ('commercial', 'retail', 'supermarket', 'warehouse', 'industrial', 'hotel', 'mixed_use') or shop or tourism == 'hotel' or amen in ('restaurant', 'cafe', 'bar', 'bank', 'fast_food', 'fuel', 'cinema', 'nightclub'):
        return 2
    if b in ('house', 'detached', 'residential', 'semidetached_house', 'terrace', 'bungalow', 'hut', 'garage', 'garages', 'shed', 'carport', 'apartments', 'dormitory'):
        return 1
    z_lu = zoning_at(cx, cz)
    if z_lu == 6:
        return 3 if area > 450 else 2
    if z_lu in (5, 7, 10) and area > 110:
        return 2
    if z_lu == 8 and area > 250:
        return 5
    if z_lu in (1, 2, 3):
        return 1
    if (-800 <= cx <= 750 and -1150 <= cz <= 850) and area > 140:
        return 2 if area < 650 else 3
    if area > 380:
        return 2
    return 1


ROOF_SHAPE_CODES = {
    'gabled': 1, 'hipped': 2, 'pyramidal': 2, 'flat': 3,
    'gambrel': 4, 'half-hipped': 5, 'skillion': 6
}

buildings = []
roof_shapes = []
fuel_canopies = []
addresses = []
seen_addr = set()

for wid, w in ways.items():
    tags = w.get('tags', {})
    if not tags:
        continue
    pts = way_coords(w)
    if len(pts) < 4 or pts[0] != pts[-1]:
        continue
    cx = sum(p[0] for p in pts[:-1]) / (len(pts) - 1)
    cz = sum(p[1] for p in pts[:-1]) / (len(pts) - 1)
    if not (W_X <= cx <= E_X and N_Z <= cz <= S_Z):
        continue

    if 'addr:housenumber' in tags:
        m = re.match(r'^(\d+)', str(tags['addr:housenumber']).strip())
        if m:
            num = int(m.group(1))
            if 0 < num < 99999:
                key = (round(cx / 3), round(cz / 3), num)
                if key not in seen_addr:
                    seen_addr.add(key)
                    addresses.extend([r1(cx), r1(cz), num])

    if 'building' not in tags or tags.get('building') in ('no', 'bridge', 'construction', 'ruins'):
        continue

    try:
        poly = Polygon(pts)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if not isinstance(poly, Polygon) or poly.is_empty or poly.area < 10.0 or poly.area > 120000.0:
            continue
    except Exception:
        continue

    area = poly.area
    kind = classify_building(tags, area, cx, cz)
    height = max(3, min(180, int(round(parse_height_m(tags, kind, area, cx, cz)))))

    rshape = ROOF_SHAPE_CODES.get(tags.get('roof:shape', ''))
    if rshape:
        roof_shapes.extend([r1(cx), r1(cz), rshape])

    if tags.get('building') == 'roof' and tags.get('amenity') == 'fuel':
        rect = poly.minimum_rotated_rectangle
        rc = list(rect.exterior.coords)
        if len(rc) >= 4:
            dx1, dz1 = rc[1][0] - rc[0][0], rc[1][1] - rc[0][1]
            dx2, dz2 = rc[2][0] - rc[1][0], rc[2][1] - rc[1][1]
            l1, l2 = math.hypot(dx1, dz1), math.hypot(dx2, dz2)
            ang = math.atan2(dz1, dx1) if l1 >= l2 else math.atan2(dz2, dx2)
            L, W_can = (l1, l2) if l1 >= l2 else (l2, l1)
            fuel_canopies.extend([r1(cx), r1(cz), round(ang, 3), r1(L), r1(W_can), 1])

    buildings.append({
        'geom': poly,
        'cx': cx,
        'cz': cz,
        'height': height,
        'kind': kind,
        'name': (tags.get('name') or '').strip(),
    })

for rel in relations:
    tags = rel.get('tags', {})
    if 'building' not in tags or tags.get('building') in ('no', None):
        continue
    polys = [p for p in relation_to_polygons(rel) if 12.0 <= p.area <= 120000.0]
    if not polys:
        continue
    mp = MultiPolygon(polys) if len(polys) > 1 else polys[0]
    c = mp.centroid
    if not (W_X <= c.x <= E_X and N_Z <= c.y <= S_Z):
        continue
    kind = classify_building(tags, mp.area, c.x, c.y)
    height = max(4, min(180, int(round(parse_height_m(tags, kind, mp.area, c.x, c.y)))))
    buildings.append({
        'geom': mp,
        'cx': c.x,
        'cz': c.y,
        'height': height,
        'kind': kind,
        'name': (tags.get('name') or '').strip(),
    })

for nid, (x, z, tags) in nodes.items():
    if tags and 'addr:housenumber' in tags and (W_X <= x <= E_X and N_Z <= z <= S_Z):
        m = re.match(r'^(\d+)', str(tags['addr:housenumber']).strip())
        if m:
            num = int(m.group(1))
            if 0 < num < 99999:
                key = (round(x / 3), round(z / 3), num)
                if key not in seen_addr:
                    seen_addr.add(key)
                    addresses.extend([r1(x), r1(z), num])

# Merge official City of Oakland Address Points (OaklandAddresses_Dec2022, UnitNbr = 0)
for feat in civic_addresses:
    at = feat.get('attributes') or {}
    lat = at.get('Latitude')
    lon = at.get('Longitude')
    num = at.get('StreetNumb')
    if lat is None or lon is None or not num:
        continue
    try:
        num = int(num)
    except (ValueError, TypeError):
        continue
    if not (0 < num < 99999):
        continue
    ax, az = ll_to_xz(float(lat), float(lon))
    if not (W_X <= ax <= E_X and N_Z <= az <= S_Z):
        continue
    key = (round(ax / 3), round(az / 3), num)
    if key not in seen_addr:
        seen_addr.add(key)
        addresses.extend([r1(ax), r1(az), num])


def canonical_ring(ring):
    pts = []
    for x, z in list(ring.coords)[:-1]:
        p = (round(x * 2), round(z * 2))
        if not pts or pts[-1] != p:
            pts.append(p)
    if len(pts) > 1 and pts[-1] == pts[0]:
        pts.pop()
    if len(pts) < 3:
        return []
    s = min(range(len(pts)), key=pts.__getitem__)
    return pts[s:] + pts[:s]


def quantize_bldg(geom):
    out = []
    for p in parts(geom):
        p = orient(p, sign=1.0)
        o = canonical_ring(p.exterior)
        if not o:
            continue
        hs = [canonical_ring(h) for h in p.interiors]
        out.append([o] + sorted(h for h in hs if h))
    return out


def morton(x, z):
    ix, iz = int(x / 16) + 4096, int(z / 16) + 4096
    k = 0
    for i in range(14):
        k |= ((ix >> i) & 1) << (2 * i) | ((iz >> i) & 1) << (2 * i + 1)
    return k


packed_bldgs = []
for b in buildings:
    polys = quantize_bldg(b['geom'].simplify(0.25))
    if polys:
        packed_bldgs.append((morton(b['cx'], b['cz']), b['height'], b['kind'], polys))
packed_bldgs.sort(key=lambda t: t[0])


def uint_var(d, v):
    while v > 127:
        d.append((v & 127) | 128)
        v >>= 7
    d.append(v)


def sint_var(d, v):
    uint_var(d, v * 2 if v >= 0 else -v * 2 - 1)


meta_b, xs_b, zs_b = bytearray(), bytearray(), bytearray()
uint_var(meta_b, len(packed_bldgs))
px = pz = 0
for _, h, kind, polys in packed_bldgs:
    uint_var(meta_b, h)
    uint_var(meta_b, kind)
    uint_var(meta_b, len(polys))
    for poly in polys:
        uint_var(meta_b, len(poly))
        for ring in poly:
            uint_var(meta_b, len(ring))
            for x, z in ring:
                sint_var(xs_b, x - px)
                sint_var(zs_b, z - pz)
                px, pz = x, z

nyb1_data = struct.pack('<4sII', b'NYB1', len(meta_b), len(xs_b)) + bytes(meta_b) + bytes(xs_b) + bytes(zs_b)
bldg_gz_path = os.path.join(ROOT_DIR, 'js', 'building-geodata.bin.gz')
with gzip.open(bldg_gz_path, 'wb', 9) as f:
    f.write(nyb1_data)
print(f"Wrote {bldg_gz_path} ({len(packed_bldgs)} buildings, {os.path.getsize(bldg_gz_path) // 1024} KB)")

# ---------------------------------------------------------------------------
# 4. City Blocks, Lawns, Parks, Trails, Streetlights, Controls, Signs, Places
# ---------------------------------------------------------------------------
print("Step 4: Computing blocks, lawns, trails, controls, signs, and places...")
DOWNTOWN_BOX = box(-750, -950, 650, 650)
blocks_geom = CLIP_BOX.difference(water_open).difference(road_union)
parks_union = unary_union([g['geom'] for g in green_spaces]) if green_spaces else Polygon()
parking_union = unary_union(parking_polys).intersection(CLIP_BOX) if parking_polys else Polygon()


def split_holes(p, depth=0):
    if (not p.interiors and p.area <= 180000) or depth > 14:
        return [p]
    minx, miny, maxx, maxy = p.bounds
    if p.interiors:
        hx = Polygon(p.interiors[0]).centroid.x
        halves = (box(minx - 1, miny - 1, hx, maxy + 1), box(hx, miny - 1, maxx + 1, maxy + 1))
    elif (maxx - minx) >= (maxy - miny):
        mx = 0.5 * (minx + maxx)
        halves = (box(minx - 1, miny - 1, mx, maxy + 1), box(mx, miny - 1, maxx + 1, maxy + 1))
    else:
        my = 0.5 * (miny + maxy)
        halves = (box(minx - 1, miny - 1, maxx + 1, my), box(minx - 1, my, maxx + 1, maxy + 1))
    out = []
    for half in halves:
        for q in parts(p.intersection(half)):
            out += split_holes(q, depth + 1)
    return out


def tiled(polys, cell=120.0):
    for p in polys:
        if p.area < cell * cell * 0.8 and len(p.exterior.coords) < 300:
            yield p
            continue
        x0, z0, x1, z1 = p.bounds
        for i in range(int(math.floor(x0 / cell)), int(math.ceil(x1 / cell))):
            for j in range(int(math.floor(z0 / cell)), int(math.ceil(z1 / cell))):
                yield from parts(p.intersection(box(i * cell, j * cell, (i + 1) * cell, (j + 1) * cell)))


blocks = []
lawn_polys = []
parking_list = [(pk.bounds, pk) for pk in parts(parking_union)]
for p in parts(blocks_geom):
    for q in split_holes(p):
        if q.area < 40:
            continue
        q = q.simplify(0.5, preserve_topology=True)
        if q.is_empty or q.geom_type != 'Polygon' or q.area < 40:
            continue
        q_ccw = orient(q, sign=1.0)
        q_cw = orient(q, sign=-1.0)
        ring = list(q_cw.exterior.coords)[:-1]
        is_rect = 0  # Always 0 on hilly terrain so sidewalks use ringSlab / subdivided terrain-draped meshes
        c = q.centroid
        paved = DOWNTOWN_BOX.contains(c) or (c.x < -1100 and c.y > 200)  # Downtown & Port industrial paved
        has_lawn = 0 if paved else 1
        blocks.append([flat(ring), [], 0.0, '', is_rect, None, has_lawn])
        if has_lawn:
            inner = q_ccw.buffer(-SIDEWALK, join_style=2)
            if not inner.is_empty:
                ib = inner.bounds
                near_pk = [
                    pk for (px0, pz0, px1, pz1), pk in parking_list
                    if px1 > ib[0] and px0 < ib[2] and pz1 > ib[1] and pz0 < ib[3]
                ]
                if near_pk:
                    inner = inner.difference(unary_union(near_pk))
                for ip in tiled(parts(inner.simplify(0.6))):
                    if ip.area >= 25:
                        ip = orient(ip, -1.0)
                        lawn_polys.append([flat(list(ip.exterior.coords)[:-1])] + [flat(list(r.coords)[:-1]) for r in ip.interiors if Polygon(r).area > 20])

print(f"Blocks: {len(blocks)}, Lawns: {len(lawn_polys)}")

# Trails in Ann Arbor schema: [soft_0_or_1, width, x0, z0, x1, z1, ...]
SOFT_SURF = {'dirt', 'ground', 'unpaved', 'gravel', 'fine_gravel', 'compacted', 'woodchips', 'grass', 'earth', 'mud', 'sand'}
trails = []
for t_tags, pts in trails_raw:
    if len(pts) < 2:
        continue
    sf = t_tags.get('surface')
    soft = 1 if (sf in SOFT_SURF or (sf is None and t_tags.get('highway') in ('path', 'track', 'bridleway'))) else 0
    wd = 2.4 if t_tags.get('highway') == 'cycleway' else (1.5 if soft else 2.0)
    spts = rdp(pts, 0.5)
    if len(spts) >= 2:
        trails.append([soft, wd] + flat(spts))

# Playgrounds: [ring_flat, cx, cz, angle, L, W]
playgrounds = []
for pg in playground_ways:
    for p in parts(pg.intersection(CLIP_BOX)):
        if p.area < 30:
            continue
        rr = list(p.minimum_rotated_rectangle.exterior.coords)[:4]
        e1 = (rr[1][0] - rr[0][0], rr[1][1] - rr[0][1])
        e2 = (rr[2][0] - rr[1][0], rr[2][1] - rr[1][1])
        l1, l2 = math.hypot(*e1), math.hypot(*e2)
        L, W_p, ax = (l1, l2, e1) if l1 >= l2 else (l2, l1, e2)
        c = p.centroid
        p_o = orient(p.simplify(0.4), -1.0)
        playgrounds.append([flat(list(p_o.exterior.coords)[:-1]), r1(c.x), r1(c.y), round(math.atan2(ax[1], ax[0]), 3), r1(L), r1(W_p)])

# Controls: {'signals': [x, z, ...], 'stops': [x, z, kind, ...], 'crossings': [x, z, marked, ...]}
controls = {'signals': [], 'stops': [], 'crossings': []}
streetlights = []
hydrants = []
park_amenities = []

AMENITY_PARK_CODES = {
    'bench': 0, 'waste_basket': 1, 'picnic_table': 2,
    'bbq': 3, 'drinking_water': 4, 'fountain': 4,
    'bicycle_parking': 5, 'shelter': 6, 'toilets': 6
}


def hash_yaw(x, z):
    h = math.sin(x * 12.9898 + z * 78.233) * 43758.5453
    return round((h - math.floor(h)) * math.tau, 2)


SIGN_CATS = {
    'restaurant': 0, 'fast_food': 0, 'food_court': 0,
    'cafe': 1, 'ice_cream': 1, 'bakery': 1,
    'bar': 2, 'pub': 2, 'biergarten': 2, 'nightclub': 2,
    'bank': 4, 'pharmacy': 4, 'dentist': 4, 'clinic': 4, 'doctors': 4, 'post_office': 4, 'hotel': 4, 'fitness_centre': 4,
    'theatre': 5, 'cinema': 5, 'library': 5, 'arts_centre': 5, 'museum': 5, 'gallery': 5,
}
sign_names, sign_name_id, signs_out = [], {}, []
place_names, place_name_id, places_out = [], {}, []

for nid, (x, z, t) in nodes.items():
    if not t or not (W_X <= x <= E_X and N_Z <= z <= S_Z):
        continue
    hw = t.get('highway')
    if hw == 'traffic_signals':
        controls['signals'] += [r1(x), r1(z)]
    elif hw in ('stop', 'give_way'):
        controls['stops'] += [r1(x), r1(z), 2 if hw == 'give_way' else (1 if t.get('stop') == 'all' else 0)]
    elif hw == 'crossing':
        c, m = t.get('crossing'), t.get('crossing:markings')
        marked = 0 if c == 'unmarked' or m == 'no' else 1 if (m and m != 'no') or c in ('marked', 'zebra', 'traffic_signals', 'uncontrolled') else 2
        controls['crossings'] += [r1(x), r1(z), marked]
    elif hw == 'street_lamp':
        streetlights += [r1(x), r1(z), 0, 0]

    if t.get('emergency') == 'fire_hydrant':
        hydrants += [r1(x), r1(z)]

    amen = t.get('amenity')
    if amen in AMENITY_PARK_CODES:
        park_amenities += [r1(x), r1(z), AMENITY_PARK_CODES[amen], hash_yaw(x, z)]
    elif t.get('leisure') == 'picnic_table':
        park_amenities += [r1(x), r1(z), 2, hash_yaw(x, z)]

    name = (t.get('name') or '').strip()
    if name and len(name) <= 34:
        cat = SIGN_CATS.get(amen) if amen else None
        if cat is None and t.get('tourism') in ('hotel', 'museum', 'gallery'):
            cat = SIGN_CATS[t['tourism']]
        if cat is None and t.get('shop'):
            cat = 1 if t['shop'] in ('bakery', 'coffee', 'confectionery', 'pastry') else 3
        if cat is not None:
            if name not in sign_name_id:
                sign_name_id[name] = len(sign_names)
                sign_names.append(name)
            w_sign = min(7.5, max(2.4, 0.42 * len(name) + 0.8))
            signs_out += [r1(x), r1(z), int(abs(x * 7 + z * 13)) % 360, r1(w_sign), 3.4, sign_name_id[name], cat]

# Merge official OakDOT Traffic Signals (TrafficSignals)
sig_grid = {(round(controls['signals'][i] / 18), round(controls['signals'][i + 1] / 18)) for i in range(0, len(controls['signals']), 2)}
for feat in civic_signals:
    g = feat.get('geometry') or {}
    if 'x' in g and 'y' in g:
        sx, sz = ll_to_xz(float(g['y']), float(g['x']))
        if W_X <= sx <= E_X and N_Z <= sz <= S_Z:
            sk = (round(sx / 18), round(sz / 18))
            if sk not in sig_grid:
                sig_grid.add(sk)
                controls['signals'] += [r1(sx), r1(sz)]

# Merge official City of Oakland Fire Hydrants (Project_FireHydrants)
hyd_grid = {(round(hydrants[i] / 8), round(hydrants[i + 1] / 8)) for i in range(0, len(hydrants), 2)}
for feat in civic_hydrants:
    g = feat.get('geometry') or {}
    if 'x' in g and 'y' in g:
        hx, hz = ll_to_xz(float(g['y']), float(g['x']))
        if W_X <= hx <= E_X and N_Z <= hz <= S_Z:
            hk = (round(hx / 8), round(hz / 8))
            if hk not in hyd_grid:
                hyd_grid.add(hk)
                hydrants += [r1(hx), r1(hz)]

# Merge official Lake Merritt Necklace of Lights & City of Oakland Streetlights (Street_Lights)
lamp_grid = {(round(streetlights[i] / 16), round(streetlights[i + 1] / 16)) for i in range(0, len(streetlights), 4)}
for feat in civic_necklace_lights:
    at = feat.get('attributes') or {}
    if str(at.get('REMOVED') or '').strip().upper() == 'Y':
        continue
    lat = at.get('LAT')
    lon = at.get('LON')
    if lat is None or lon is None:
        g = feat.get('geometry') or {}
        lon, lat = g.get('x'), g.get('y')
    if lat is None or lon is None:
        continue
    lx, lz = ll_to_xz(float(lat), float(lon))
    if W_X <= lx <= E_X and N_Z <= lz <= S_Z:
        lk = (round(lx / 10), round(lz / 10))
        if lk not in lamp_grid:
            lamp_grid.add(lk)
            streetlights += [r1(lx), r1(lz), 1, 0]

for feat in civic_streetlights:
    at = feat.get('attributes') or {}
    if str(at.get('REMOVED') or '').strip().upper() == 'Y':
        continue
    lat = at.get('LAT')
    lon = at.get('LON')
    if lat is None or lon is None:
        continue
    lx, lz = ll_to_xz(float(lat), float(lon))
    if W_X <= lx <= E_X and N_Z <= lz <= S_Z:
        lk = (round(lx / 18), round(lz / 18))
        if lk not in lamp_grid:
            lamp_grid.add(lk)
            fxtr = str(at.get('FXTR_TYPE') or '').lower()
            style = 1 if ('pendant' in fxtr or 'acorn' in fxtr or 'post' in fxtr or 'pedestrian' in fxtr) else 0
            heading = int(abs(lx * 13 + lz * 29)) % 360
            streetlights += [r1(lx), r1(lz), style, heading]

# Named buildings & official Oakland Neighborhoods -> GEO.places
for b in buildings:
    n = b['name']
    if not n or n[0].isdigit() or len(n) > 48:
        continue
    if n not in place_name_id:
        place_name_id[n] = len(place_names)
        place_names.append(n)
    minx, minz, maxx, maxz = b['geom'].bounds
    places_out += [r1(b['cx']), r1(b['cz']), r1(max(maxx - minx, maxz - minz) / 2), place_name_id[n]]

for feat in civic_neighborhoods:
    at = feat.get('attributes') or {}
    nb_name = (at.get('NEIGHBHD') or '').strip()
    if not nb_name or len(nb_name) > 48:
        continue
    for p in arcgis_rings_to_polys(feat.get('geometry')):
        p_c = p.intersection(CLIP_BOX)
        if p_c.is_empty or p_c.area < 25000:
            continue
        c = p_c.centroid
        if not (W_X + 100 <= c.x <= E_X - 100 and N_Z + 100 <= c.y <= S_Z - 100):
            continue
        if nb_name not in place_name_id:
            place_name_id[nb_name] = len(place_names)
            place_names.append(nb_name)
        minx, minz, maxx, maxz = p_c.bounds
        places_out += [r1(c.x), r1(c.y), r1(min(280.0, max(maxx - minx, maxz - minz) / 3)), place_name_id[nb_name]]

# ---------------------------------------------------------------------------
# 5. Trees (NYT2) & GEO.woods
# ---------------------------------------------------------------------------
print("Step 5: Generating Oakland street trees (NYT2) & park/wood trees from Oakland Public Tree Inventory...")
rng = random.Random(510)
tree_dict = {}
woods_flat = []

bldg_boxes = defaultdict(list)
for b in buildings:
    minx, minz, maxx, maxz = b['geom'].bounds
    for bx in range(int(minx // 40), int(maxx // 40) + 1):
        for bz in range(int(minz // 40), int(maxz // 40) + 1):
            bldg_boxes[(bx, bz)].append((minx - 2.0, minz - 2.0, maxx + 2.0, maxz + 2.0))


def hits_building(x, z):
    for minx, minz, maxx, maxz in bldg_boxes.get((int(x // 40), int(z // 40)), ()):
        if minx <= x <= maxx and minz <= z <= maxz:
            return True
    return False


GENUS_TO_SPECIES = {
    # 0: London plane / Sycamore
    'platanus': 0, 'liriodendron': 0, 'catalpa': 0, 'morus': 0, 'populus': 0, 'alnus': 0,
    # 1: Honey locust / compound-leaf lacy crown
    'gleditsia': 1, 'acacia': 1, 'robinia': 1, 'jacaranda': 1, 'albizia': 1, 'sophora': 1,
    'koelreuteria': 1, 'schinus': 1, 'ailanthus': 1, 'tipuana': 1, 'cassia': 1, 'geijera': 1,
    # 2: American elm / tall arching crown
    'ulmus': 2, 'zelkova': 2, 'celtis': 2, 'eucalyptus': 2, 'salix': 2, 'casuarina': 2,
    # 3: Maple / Sweetgum / Pistache / Ginkgo / Ash (fall color)
    'acer': 3, 'liquidambar': 3, 'pistacia': 3, 'ginkgo': 3, 'fraxinus': 3, 'tilia': 3,
    'carpinus': 3, 'betula': 3, 'nyssa': 3, 'sapium': 3, 'triadica': 3, 'fagus': 3,
    # 4: Oak / Magnolia / Broad evergreen-deciduous
    'quercus': 4, 'magnolia': 4, 'arbutus': 4, 'aesculus': 4, 'juglans': 4, 'carya': 4,
    'umbellularia': 4, 'laurus': 4, 'olea': 4, 'cinnamomum': 4, 'persea': 4, 'ceratonia': 4,
    'ficus': 4, 'agonis': 4, 'corymbia': 4, 'angophora': 4, 'maytenus': 4,
    # 5: Flowering / small street tree
    'pyrus': 5, 'prunus': 5, 'lagerstroemia': 5, 'tristaniopsis': 5, 'cercis': 5, 'crataegus': 5,
    'pittosporum': 5, 'malus': 5, 'callistemon': 5, 'metrosideros': 5, 'lophostemon': 5,
    'eriobotrya': 5, 'ligustrum': 5, 'photinia': 5, 'prunus': 5, 'cornus': 5, 'chionanthus': 5,
    'tabebuia': 5, 'handroanthus': 5, 'hymenosporum': 5, 'melaleuca': 5, 'leptospermum': 5,
    'michelia': 5, 'citrus': 5, 'cordyline': 5,
    # 6: Evergreen conifer / Redwood / Pine / Cedar / Cypress
    'sequoia': 6, 'pinus': 6, 'podocarpus': 6, 'afrocarpus': 6, 'cupressus': 6, 'hesperocyparis': 6,
    'cedrus': 6, 'washingtonia': 6, 'phoenix': 6, 'syagrus': 6, 'trachycarpus': 6, 'picea': 6,
    'abies': 6, 'pseudotsuga': 6, 'calocedrus': 6, 'thuja': 6, 'juniperus': 6, 'taxodium': 6,
    'metasequoia': 6, 'araucaria': 6,
}

water_prep_trees = prep(water_open.buffer(3.0)) if not water_open.is_empty else None
parks_prep_trees = prep(parks_union.buffer(-2.0)) if not parks_union.is_empty else None
surveyed_tree_cells = set()

for feat in civic_trees:
    at = feat.get('attributes') or {}
    lat = at.get('Latitude')
    lon = at.get('Longitude')
    if lat is None or lon is None:
        continue
    genus_raw = str(at.get('Species___genus') or '').strip().lower()
    common_raw = str(at.get('Species___common') or '').strip().lower()
    if genus_raw in ('stump', 'vacant', 'dead', 'removed', 'none', 'n/a') or 'stump' in common_raw or 'vacant' in common_raw:
        continue
    tx, tz = ll_to_xz(float(lat), float(lon))
    if not (W_X + 10 <= tx <= E_X - 10 and N_Z + 10 <= tz <= S_Z - 10):
        continue
    if hits_building(tx, tz):
        continue
    if water_prep_trees and water_prep_trees.contains(Point(tx, tz)):
        continue
    sp = GENUS_TO_SPECIES.get(genus_raw)
    if sp is None:
        sp = abs(int(tx * 17 + tz * 31)) % 6
    try:
        dbh = float(at.get('DBH') or 0)
    except (ValueError, TypeError):
        dbh = 0.0
    if dbh <= 0:
        dbh = 8.0 + (abs(int(tx * 13 + tz * 29)) % 14)
    if sp == 5:
        h_m = max(5.0, min(11.5, 4.8 + dbh * 0.34))
    elif sp == 6:
        h_m = max(7.5, min(26.0, 6.5 + dbh * 0.55))
    else:
        h_m = max(6.0, min(22.0, 5.5 + dbh * 0.48))
    h_q = min(255, int(round(h_m * 4.0)))
    if parks_prep_trees and parks_prep_trees.contains(Point(tx, tz)):
        woods_flat += [r1(tx), r1(tz), 0 if sp == 6 else 1]
    else:
        qx, qz = int(round(tx * 2)), int(round(tz * 2))
        tree_dict[(qx, qz)] = (sp, h_q)
        surveyed_tree_cells.add((int(tx // 45), int(tz // 45)))

for nid, (x, z, tags) in nodes.items():
    if tags and tags.get('natural') == 'tree' and (W_X <= x <= E_X and N_Z <= z <= S_Z):
        if not hits_building(x, z):
            qx, qz = int(round(x * 2)), int(round(z * 2))
            if (qx, qz) not in tree_dict:
                k = abs(qx * 17 + qz * 31) % 7
                h_q = min(255, int(round((10.0 + (abs(qx * 13 + qz * 29) % 36) * 0.25) * 4)))
                tree_dict[(qx, qz)] = (k, h_q)
            woods_flat += [r1(x), r1(z), 1]

# Fill in residential/arterial blocks that weren't covered by the Oakland Public Tree Inventory
for r in drive:
    if r['bridge'] or r['cls'] not in (2, 3, 4):
        continue
    pts = r['pts']
    spacing = 22.0 if r['cls'] == 4 else 28.0
    offset = r['w'] * 0.5 + 2.0
    for i in range(len(pts) - 1):
        x0, z0 = pts[i]
        x1, z1 = pts[i + 1]
        seg_len = math.hypot(x1 - x0, z1 - z0)
        if seg_len < 15.0:
            continue
        tx, tz = (x1 - x0) / seg_len, (z1 - z0) / seg_len
        nx, nz = -tz, tx
        steps = int(seg_len // spacing)
        for s in range(1, steps + 1):
            d = s * spacing - spacing * 0.4
            bx, bz = x0 + tx * d, z0 + tz * d
            if (int(bx // 45), int(bz // 45)) in surveyed_tree_cells:
                continue
            for side in (-1, 1):
                if rng.random() < 0.35:
                    continue
                px = bx + nx * offset * side + rng.uniform(-0.3, 0.3)
                pz = bz + nz * offset * side + rng.uniform(-0.3, 0.3)
                if not (W_X + 20 <= px <= E_X - 20 and N_Z + 20 <= pz <= S_Z - 20):
                    continue
                if hits_building(px, pz):
                    continue
                if water_prep_trees and water_prep_trees.contains(Point(px, pz)):
                    continue
                qx, qz = int(round(px * 2)), int(round(pz * 2))
                if (qx, qz) not in tree_dict:
                    sp = rng.choice([0, 0, 1, 2, 3, 4, 5, 6])
                    h_q = int(round(rng.uniform(7.5, 16.5) * 4))
                    tree_dict[(qx, qz)] = (sp, h_q)

for gs in green_spaces:
    gp = gs['geom']
    if gp.is_empty or gp.area < 400:
        continue
    density = 0.0018 if gs['kind'] == 'wood' else 0.0005
    minx, minz, maxx, maxz = gp.bounds
    n_trees = min(400, int(gp.area * density))
    gp_prep = prep(gp)
    w_kind = 0 if gs['kind'] == 'wood' else 1
    for _ in range(n_trees):
        px = rng.uniform(minx, maxx)
        pz = rng.uniform(minz, maxz)
        if not (W_X + 10 <= px <= E_X - 10 and N_Z + 10 <= pz <= S_Z - 10):
            continue
        if gp_prep.contains(Point(px, pz)) and not hits_building(px, pz):
            if water_prep_trees and water_prep_trees.contains(Point(px, pz)):
                continue
            woods_flat += [r1(px), r1(pz), w_kind]

street_trees = sorted(tree_dict.keys(), key=lambda p: morton(p[0] / 2, p[1] / 2))
txs, tzs = bytearray(), bytearray()
px = pz = 0
for x, z in street_trees:
    sint_var(txs, x - px)
    sint_var(tzs, z - pz)
    px, pz = x, z
tkinds = bytes(tree_dict[p][0] for p in street_trees)
theights = bytes(tree_dict[p][1] for p in street_trees)
nyt2_data = struct.pack('<III', 0x3254594e, len(street_trees), len(txs)) + bytes(txs) + bytes(tzs) + tkinds + theights
tree_gz_path = os.path.join(ROOT_DIR, 'js', 'tree-geodata.bin.gz')
with gzip.open(tree_gz_path, 'wb', 9) as f:
    f.write(nyt2_data)
print(f"Wrote {tree_gz_path} ({len(street_trees)} street trees, {len(woods_flat)//3} park/wood trees)")

# ---------------------------------------------------------------------------
# 6. Elevation (ELV2) & River/Lake/Estuary Bed (RIV1)
# ---------------------------------------------------------------------------
print("Step 6: Building elevation.bin.gz (ELV2) and river.bin.gz (RIV1)...")
Z_TILE = 14
PAD = 3000.0
STEP = 10.0
tile_cache = {}


def get_terrarium_tile(tx, ty):
    if (tx, ty) not in tile_cache:
        t_cache = os.path.join(CACHE_DIR, f"terrarium_{Z_TILE}_{tx}_{ty}.png")
        if not os.path.exists(t_cache):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z_TILE}/{tx}/{ty}.png"
            subprocess.run(['curl', '-sS', '-f', '-L', '-o', t_cache, url], check=True)
        img = np.asarray(Image.open(t_cache).convert('RGB'), dtype=np.float64)
        tile_cache[(tx, ty)] = (img[:, :, 0] * 256.0 + img[:, :, 1] + img[:, :, 2] / 256.0) - 32768.0
    return tile_cache[(tx, ty)]


ex0 = math.floor((W_X - PAD) / STEP) * STEP
ez0 = math.floor((N_Z - PAD) / STEP) * STEP
cols = int(round((E_X + PAD - ex0) / STEP)) + 1
rows = int(round((S_Z + PAD - ez0) / STEP)) + 1
gx, gz = np.meshgrid(ex0 + np.arange(cols) * STEP, ez0 + np.arange(rows) * STEP)
lon_grid = LON0 + gx / LON_M
lat_grid = LAT0 - gz / LAT_M
n_tiles = 1 << Z_TILE
fx = (lon_grid + 180.0) / 360.0 * n_tiles * 256.0
fy = (1.0 - np.log(np.tan(np.radians(lat_grid)) + 1.0 / np.cos(np.radians(lat_grid))) / math.pi) / 2.0 * n_tiles * 256.0
ix, iy = np.floor(fx - 0.5).astype(int), np.floor(fy - 0.5).astype(int)
ax, ay = fx - 0.5 - ix, fy - 0.5 - iy


def sample_pixels(px_, py_):
    out = np.zeros(px_.shape, dtype=np.float64)
    tx, ty = px_ // 256, py_ // 256
    for key in set(zip(tx.ravel().tolist(), ty.ravel().tolist())):
        sel = (tx == key[0]) & (ty == key[1])
        t = get_terrarium_tile(*key)
        out[sel] = t[py_[sel] % 256, px_[sel] % 256]
    return out


H = (
    (sample_pixels(ix, iy) * (1.0 - ax) + sample_pixels(ix + 1, iy) * ax) * (1.0 - ay) +
    (sample_pixels(ix, iy + 1) * (1.0 - ax) + sample_pixels(ix + 1, iy + 1) * ax) * ay
)
k_gauss = np.exp(-0.5 * (np.arange(-4, 5) / 1.5) ** 2)
k_gauss /= k_gauss.sum()
H = np.apply_along_axis(lambda r: np.convolve(np.pad(r, 4, mode='edge'), k_gauss, 'valid'), 1, H)
H = np.apply_along_axis(lambda r: np.convolve(np.pad(r, 4, mode='edge'), k_gauss, 'valid'), 0, H)
inside = (gx > W_X) & (gx < E_X) & (gz > N_Z) & (gz < S_Z)
BASE = max(0.0, float(np.percentile(H[inside], 0.5)))
elev = np.clip(H - BASE + 2.45, 2.45, 600.0)
cm_elev = np.clip(np.round(elev * 100.0), 0, 65535).astype('<u2')
elv_header = b'ELV2' + struct.pack('<6f', ex0, ez0, STEP, cols, rows, 0.0)
elv_path = os.path.join(ROOT_DIR, 'data', 'elevation.bin.gz')
with gzip.open(elv_path, 'wb', compresslevel=9) as f:
    f.write(elv_header + cm_elev.tobytes())

DSTEP = 2.0
wbounds = water_open.bounds if not water_open.is_empty else (-100, -100, 100, 100)
dx0 = math.floor(wbounds[0] / STEP) * STEP - 20.0
dz0 = math.floor(wbounds[1] / STEP) * STEP - 20.0
dcols = int((wbounds[2] - dx0) / DSTEP) + 21
drows = int((wbounds[3] - dz0) / DSTEP) + 21

mask_img = Image.new('L', (dcols, drows), 0)
draw = ImageDraw.Draw(mask_img)
for wp in parts(water_open):
    ext_px = [((x - dx0) / DSTEP, (z - dz0) / DSTEP) for x, z in wp.exterior.coords]
    if len(ext_px) >= 3:
        draw.polygon(ext_px, fill=255)
    for h in wp.interiors:
        h_px = [((x - dx0) / DSTEP, (z - dz0) / DSTEP) for x, z in h.coords]
        if len(h_px) >= 3:
            draw.polygon(h_px, fill=0)

wet = np.asarray(mask_img) > 0


def chamfer_dist(src, cap):
    d = np.where(src, 0.0, cap)
    for _ in range(int(cap / DSTEP) + 2):
        p = np.pad(d, 1, mode='edge')
        for oy, ox, c in ((0, 1, 1.0), (2, 1, 1.0), (1, 0, 1.0), (1, 2, 1.0), (0, 0, 1.414), (0, 2, 1.414), (2, 0, 1.414), (2, 2, 1.414)):
            d = np.minimum(d, p[oy:oy + drows, ox:ox + dcols] + c * DSTEP)
    return np.minimum(d, cap)


def ease_step(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


dig = ease_step((chamfer_dist(~wet, 9.0) - 0.5) / 7.5) * wet
dig_u8 = np.round(dig * 255.0).astype(np.uint8)

lc0, lr0 = int(round((dx0 - ex0) / STEP)), int(round((dz0 - ez0) / STEP))
lcols, lrows = int(dcols * DSTEP / STEP) + 2, int(drows * DSTEP / STEP) + 2
pad_l = 5
sub = elev[max(0, lr0 - pad_l):lr0 + lrows + pad_l, max(0, lc0 - pad_l):lc0 + lcols + pad_l]
low = sub.copy()
for _ in range(4):
    p = np.pad(low, 1, mode='edge')
    low = np.minimum.reduce([p[oy:oy + low.shape[0], ox:ox + low.shape[1]] for oy in range(3) for ox in range(3)])
lvl = low - 0.45
for _ in range(3):
    p = np.pad(lvl, 1, mode='edge')
    lvl = np.minimum(sum(p[oy:oy + lvl.shape[0], ox:ox + lvl.shape[1]] for oy in range(3) for ox in range(3)) / 9.0, low - 0.45)
oy_l, ox_l = lr0 - max(0, lr0 - pad_l), lc0 - max(0, lc0 - pad_l)
level = np.clip(lvl[oy_l:oy_l + lrows, ox_l:ox_l + lcols], 1.85, 600.0)

cm_level = np.clip(np.round(level * 100.0), 0, 65535).astype('<u2')
riv_header = b'RIV1' + struct.pack('<10f', dx0, dz0, DSTEP, dcols, drows, ex0 + lc0 * STEP, ez0 + lr0 * STEP, STEP, level.shape[1], level.shape[0])
dig_bytes = dig_u8.tobytes()
if len(dig_bytes) % 2:
    dig_bytes += b'\x00'
riv_path = os.path.join(ROOT_DIR, 'data', 'river.bin.gz')
with gzip.open(riv_path, 'wb', compresslevel=9) as f:
    f.write(riv_header + dig_bytes + cm_level.tobytes())

# ---------------------------------------------------------------------------
# 7. Write js/city-geodata.js and data/*.json(.gz)
# ---------------------------------------------------------------------------
print("Step 7: Writing js/city-geodata.js and data/*.json(.gz)...")

land_ring = flat(list(orient(CLIP_BOX, -1.0).exterior.coords)[:-1])

parks_out = [
    {
        'name': g['name'],
        'cat': g['kind'],
        'acres': round(g['geom'].area / 4046.86, 1),
        'rings': [flat(list(p.exterior.coords)[:-1]) for p in parts(g['geom'].simplify(1.0)) if len(p.exterior.coords) >= 4],
    }
    for g in green_spaces if g['name']
]

landmarks_meta = {
    'Tribune Tower': {'x': 106, 'z': 144, 'w': 28, 'd': 26, 'h': 93, 'area': 728, 'ring': [92, 131, 120, 131, 120, 157, 92, 157]},
    'Oakland City Hall': {'x': -114, 'z': -100, 'w': 56, 'd': 38, 'h': 97, 'area': 2128, 'ring': [-142, -119, -86, -119, -86, -81, -142, -81]},
    'Fox Theater': {'x': 70, 'z': -400, 'w': 48, 'd': 38, 'h': 36, 'area': 1824, 'ring': [46, -419, 94, -419, 94, -381, 46, -381]},
    'Cathedral of Christ the Light': {'x': 774, 'z': -610, 'w': 68, 'd': 68, 'h': 38, 'area': 3630, 'ring': [740, -644, 808, -644, 808, -576, 740, -576]},
    'Lake Merritt Pergola': {'x': 1794, 'z': -710, 'w': 48, 'd': 48, 'h': 10, 'area': 1800, 'ring': [1770, -734, 1818, -734, 1818, -686, 1770, -686]},
    'Port of Oakland Cranes': {'x': -2460, 'z': 580, 'w': 220, 'd': 90, 'h': 58, 'area': 19800, 'ring': [-2570, 535, -2350, 535, -2350, 625, -2570, 625]},
    'Lake Merritt Amphitheater': {'x': 1073, 'z': 688, 'w': 96, 'd': 112, 'h': 6, 'area': 8400, 'ring': [1025, 632, 1121, 632, 1121, 744, 1025, 744]},
}

GEO = {
    'version': 1,
    'city': 'oakland',
    'frame': {
        'bearingDeg': 0,
        'origin': '14th St & Broadway (centreline)',
        'units': 'm',
        'cutZ': N_Z,
        'strip': 0,
        'sidewalk': SIDEWALK,
        'lat0': LAT0,
        'lon0': LON0,
        'kx': LON_M,
        'ky': LAT_M,
    },
    'edge': land_ring,
    'roads': roads_out,
    'roadGraph': roadGraph,
    'blocks': blocks,
    'parks': parks_out,
    'riverBridges': river_bridges,
    'water': poly_to_rings(water_open, tol=0.8, min_area=30.0),
    'parking': poly_to_rings(parking_union.intersection(blocks_geom), tol=0.6, min_area=100.0),
    'woods': woods_flat,
    'curbCuts': [],
    'rail': {'tracks': rail_tracks, 'routes': rail_routes},
    'golf': {'fairways': [], 'greens': [], 'tees': [], 'bunkers': [], 'paths': [], 'pins': []},
    'trails': trails,
    'streetlights': streetlights,
    'controls': controls,
    'signs': {'names': sign_names, 'list': signs_out},
    'places': {'names': place_names, 'list': places_out},
    'playgrounds': playgrounds,
    'lawns': lawn_polys,
    'driveways': [],
    'garageDoors': [],
    'landmarks': landmarks_meta,
}

geodata_js_path = os.path.join(ROOT_DIR, 'js', 'city-geodata.js')
with open(geodata_js_path, 'w', encoding='utf-8') as f:
    f.write('// js/city-geodata.js - GENERATED by tools/build-oakland.py from OpenStreetMap (ODbL).\n')
    f.write('export const GEO = ')
    json.dump(GEO, f, separators=(',', ':'))
    f.write(';\n')
print(f"Wrote {geodata_js_path} ({os.path.getsize(geodata_js_path) // 1024} KB)")

with open(os.path.join(ROOT_DIR, 'data', 'addresses.json'), 'w') as f:
    json.dump(addresses[:108000], f, separators=(',', ':'))

with open(os.path.join(ROOT_DIR, 'data', 'roof-shapes.json'), 'w') as f:
    json.dump(roof_shapes, f, separators=(',', ':'))

with open(os.path.join(ROOT_DIR, 'data', 'gas-stations.json'), 'w') as f:
    json.dump({'canopies': fuel_canopies}, f, separators=(',', ':'))

rail_crossings = []
for nid, (x, z, tags) in nodes.items():
    if tags and tags.get('railway') == 'level_crossing' and (W_X <= x <= E_X and N_Z <= z <= S_Z):
        gates = 0 if tags.get('crossing:barrier') == 'no' else 1
        rail_crossings.extend([r1(x), r1(z), gates])
with open(os.path.join(ROOT_DIR, 'data', 'rail-crossings.json'), 'w') as f:
    json.dump(rail_crossings, f, separators=(',', ':'))

# Street furniture: courts is flat [sport, cx, cz, angle, length, width, ...]
SPORTS = {
    'tennis': (0, 34.0, 16.5),
    'basketball': (1, 26.0, 14.0),
    'pickleball': (2, 13.4, 6.1),
    'beachvolleyball': (3, 16.0, 8.0),
    'volleyball': (3, 16.0, 8.0),
    'soccer': (4, 0, 0),
}
courts_flat = []
for wid, w in ways.items():
    t = w.get('tags', {})
    sp_name = (t.get('sport') or '').split(';')[0]
    if t.get('leisure') == 'pitch' and sp_name in SPORTS and t.get('indoor') != 'yes':
        pts = way_coords(w)
        if len(pts) >= 4 and pts[0] == pts[-1]:
            try:
                poly = Polygon(pts).buffer(0)
                if poly.is_empty or poly.area < 40:
                    continue
                c = poly.centroid
                if not (W_X <= c.x <= E_X and N_Z <= c.y <= S_Z):
                    continue
                rc = list(poly.minimum_rotated_rectangle.exterior.coords)[:4]
                e0 = (rc[1][0] - rc[0][0], rc[1][1] - rc[0][1])
                e1 = (rc[2][0] - rc[1][0], rc[2][1] - rc[1][1])
                L0, L1 = math.hypot(*e0), math.hypot(*e1)
                long_, short, ax = (L0, L1, e0) if L0 >= L1 else (L1, L0, e1)
                sport, _, _ = SPORTS[sp_name]
                angle = math.atan2(ax[1], ax[0])
                courts_flat += [sport, r1(c.x), r1(c.y), round(angle, 3), r1(long_), r1(short)]
            except Exception:
                pass

with open(os.path.join(ROOT_DIR, 'data', 'street-furniture.json'), 'w') as f:
    json.dump({'hydrants': hydrants, 'amenities': park_amenities, 'courts': courts_flat}, f, separators=(',', ':'))

# Districts: {'historic': [{'name': ..., 'rings': [[x, z, ...]]}], 'landuse': [[use, x, z, ...]]}
LANDUSE_MAP = {
    'residential': 1, 'retail': 5, 'commercial': 6,
    'education': 8, 'institutional': 8, 'religious': 9,
    'industrial': 10, 'port': 10, 'railway': 12, 'cemetery': 14
}
landuse_out = []
for lu_code, sp_s in civic_landuse_polys:
    coords = list(sp_s.exterior.coords)[:-1]
    if len(coords) >= 3:
        landuse_out.append([lu_code] + flat(coords))

for wid, w in ways.items():
    t = w.get('tags', {})
    use = LANDUSE_MAP.get(t.get('landuse'))
    if use:
        pts = way_coords(w)
        if len(pts) >= 4 and pts[0] == pts[-1]:
            try:
                p = Polygon(pts).intersection(CLIP_BOX).simplify(1.5, preserve_topology=True)
                if p.geom_type == 'Polygon' and p.area >= 200:
                    landuse_out.append([use] + flat(list(p.exterior.coords)[:-1]))
            except Exception:
                pass

historic_by_name = defaultdict(list)
for feat in civic_historic_api:
    at = feat.get('attributes') or {}
    hname = (at.get('DISCRIPTIO') or '').strip()
    if not hname:
        continue
    if 'historic' not in hname.lower() and 'district' not in hname.lower():
        hname = f"{hname} Historic District"
    for p in arcgis_rings_to_polys(feat.get('geometry')):
        p_c = p.intersection(CLIP_BOX).simplify(1.2, preserve_topology=True)
        for sp in parts(p_c):
            if sp.area >= 200 and len(sp.exterior.coords) >= 4:
                historic_by_name[hname].append(flat(list(sp.exterior.coords)[:-1]))

historic_out = [
    {'name': 'Old Oakland Historic District', 'rings': [[-450, 120, -50, 120, -50, 420, -450, 420]]},
    {'name': 'Oakland Chinatown', 'rings': [[-10, 40, 480, 40, 480, 460, -10, 460]]},
    {'name': 'Uptown Arts & Entertainment District', 'rings': [[-220, -850, 280, -850, 280, -250, -220, -250]]},
    {'name': 'Preservation Park Historic District', 'rings': [[-620, -180, -320, -180, -320, 80, -620, 80]]},
]
for hname, rings in sorted(historic_by_name.items()):
    if rings:
        historic_out.append({'name': hname, 'rings': rings})

with open(os.path.join(ROOT_DIR, 'data', 'districts.json'), 'w') as f:
    json.dump({'historic': historic_out, 'landuse': landuse_out[:1200]}, f, separators=(',', ':'))

# Amtrak Capitol Corridor & Coast Starlight timetable at Oakland Jack London Square (OKJ) from official Amtrak GTFS
capitol_corridor_trips = []
amtrak_zip_path = os.path.join(CACHE_DIR, 'amtrak_gtfs.zip')
if not os.path.exists(amtrak_zip_path):
    try:
        subprocess.run(
            ['curl', '-sS', '-f', '-L', '--max-time', '30', '-o', amtrak_zip_path, 'https://content.amtrak.com/content/gtfs/GTFS.zip'],
            check=True,
        )
    except Exception as e:
        print(f"  Warning: Could not download Amtrak GTFS ({e}), using fallback schedule")

if os.path.exists(amtrak_zip_path) and os.path.getsize(amtrak_zip_path) > 10000:
    try:
        with zipfile.ZipFile(amtrak_zip_path, 'r') as zf:
            am_routes = {
                r['route_id']: r
                for r in csv.DictReader(io.TextIOWrapper(zf.open('routes.txt'), encoding='utf-8-sig'))
            }
            am_cal = {
                r['service_id']: r
                for r in csv.DictReader(io.TextIOWrapper(zf.open('calendar.txt'), encoding='utf-8-sig'))
            }
            am_trips = {
                r['trip_id']: r
                for r in csv.DictReader(io.TextIOWrapper(zf.open('trips.txt'), encoding='utf-8-sig'))
            }
            seen_okj = set()
            for r in csv.DictReader(io.TextIOWrapper(zf.open('stop_times.txt'), encoding='utf-8-sig')):
                if r.get('stop_id') != 'OKJ':
                    continue
                tr = am_trips.get(r['trip_id'])
                if not tr:
                    continue
                rt = am_routes.get(tr.get('route_id', ''))
                if not rt or str(rt.get('route_type', '')) != '2':
                    continue
                c = am_cal.get(tr.get('service_id', ''))
                if not c:
                    continue
                days = ''.join(c.get(d, '0') for d in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
                if '1' not in days:
                    continue

                def hms_to_sec(s):
                    p = [int(x) for x in str(s).strip().split(':')]
                    return p[0] * 3600 + p[1] * 60 + (p[2] if len(p) > 2 else 0)

                arr_sec = hms_to_sec(r['arrival_time'])
                dep_sec = max(hms_to_sec(r['departure_time']), arr_sec + 90)
                short_num = (tr.get('trip_short_name') or r['trip_id']).strip()
                head = (tr.get('trip_headsign') or rt.get('route_long_name') or 'Sacramento').strip()
                way = 'west' if (tr.get('direction_id') == '1' or any(k in head for k in ('Sacramento', 'Auburn', 'Seattle'))) else 'east'
                key = (short_num, arr_sec, days)
                if key in seen_okj:
                    continue
                seen_okj.add(key)
                start_d = min(str(c.get('start_date') or '20250101'), '20250101')
                end_d = max(str(c.get('end_date') or '20301231'), '20301231')
                capitol_corridor_trips.append([short_num, way, head, arr_sec, dep_sec, days, start_d, end_d])
        capitol_corridor_trips.sort(key=lambda x: x[3])
        print(f"  Loaded {len(capitol_corridor_trips)} official Amtrak GTFS rail trips at OKJ")
    except Exception as e:
        print(f"  Warning: Failed to parse amtrak_gtfs.zip ({e})")

if not capitol_corridor_trips:
    west_times = [6*3600+25*60, 7*3600+38*60, 8*3600+42*60, 9*3600+55*60, 11*3600+25*60, 13*3600+15*60, 14*3600+55*60, 16*3600+20*60, 17*3600+30*60, 18*3600+45*60, 20*3600+15*60, 21*3600+50*60]
    east_times = [6*3600+50*60, 8*3600+10*60, 9*3600+15*60, 10*3600+35*60, 12*3600+20*60, 14*3600+10*60, 15*3600+40*60, 16*3600+55*60, 18*3600+5*60, 19*3600+25*60, 21*3600+5*60]
    for idx, t_sec in enumerate(west_times):
        capitol_corridor_trips.append([f"5{21 + idx*2}", "west", "Sacramento / Auburn", t_sec, t_sec + 90, "1111111", "20250101", "20301231"])
    for idx, t_sec in enumerate(east_times):
        capitol_corridor_trips.append([f"5{22 + idx*2}", "east", "San Jose Diridon", t_sec, t_sec + 90, "1111111", "20250101", "20301231"])
with open(os.path.join(ROOT_DIR, 'data', 'wolverine.json'), 'w') as f:
    json.dump({'station': 'Oakland Jack London Square (OKJ)', 'trips': capitol_corridor_trips}, f, separators=(',', ':'))

# AC Transit bus schedule in exact theride.js schema:
# routes: [[short, long, "#hex"], ...]
# stops: [[name, x, z], ...]
# shapes: [[x0, z0, ...], ...]
# headsigns: [head0, ...]
# calendar: [[0, "1111111", "20250101", "20301231"]]
# exceptions: []
# trips: [[route_ix, shape_ix, head_ix, service_ix, block_id, stop_ix, arr, dep, ...], ...]
adj = defaultdict(list)
for link in glinks:
    u, v, name_idx, w, lanes, d_dir, mid_flat, cls = link[:8]
    if cls <= 3:
        ux, uz = gnodes[u]
        vx, vz = gnodes[v]
        coords = [(ux, uz)] + list(zip(mid_flat[0::2], mid_flat[1::2])) + [(vx, vz)]
        length = sum(math.hypot(coords[i+1][0]-coords[i][0], coords[i+1][1]-coords[i][1]) for i in range(len(coords)-1))
        cost = length * (0.7 if cls <= 2 else 1.0)
        if d_dir >= 0:
            adj[u].append((v, cost, coords))
        if d_dir <= 0:
            adj[v].append((u, cost, list(reversed(coords))))


def nearest_gnode(tx, tz):
    best_i = 0
    best_d = 1e18
    for idx, (nx, nz) in enumerate(gnodes):
        if not adj[idx]:
            continue
        d = (nx - tx) ** 2 + (nz - tz) ** 2
        if d < best_d:
            best_d = d
            best_i = idx
    return best_i


def shortest_road_path(u_start, u_goal):
    dist = {u_start: 0.0}
    prev = {}
    pq = [(0.0, u_start)]
    while pq:
        d, u = heappop(pq)
        if u == u_goal:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, cost, seg_coords in adj[u]:
            nd = d + cost
            if nd < dist.get(v, 1e18):
                dist[v] = nd
                prev[v] = (u, seg_coords)
                heappush(pq, (nd, v))
    if u_goal not in prev:
        return []
    path_coords = []
    cur = u_goal
    segs = []
    while cur != u_start:
        p_u, seg = prev[cur]
        segs.append(seg)
        cur = p_u
    segs.reverse()
    for seg in segs:
        if not path_coords:
            path_coords.extend(seg)
        else:
            path_coords.extend(seg[1:])
    return path_coords


corridor_waypoints = [
    ("51A", "Broadway - College Ave", "Rockridge BART", "Jack London Square", "#00a591",
     [(-280, 1150), (-80, 400), (0, 0), (180, -800), (480, -1800), (880, -3100), (1265, -4440), (1230, -5300)]),
    ("6", "Telegraph Avenue", "Downtown Berkeley", "Downtown Oakland", "#007a5e",
     [(-80, 260), (0, 0), (-40, -650), (-120, -1800), (-220, -3300), (-290, -5300)]),
    ("1T", "Tempo International BRT", "San Leandro BART", "Uptown Transit Center", "#00a591",
     [(90, -520), (0, 0), (350, 280), (1400, 950), (2600, 1650)]),
    ("12", "Grand Ave - Piedmont Ave", "Piedmont & MacArthur", "West Oakland BART", "#007a5e",
     [(-1950, 180), (-600, 80), (0, 0), (380, -520), (1350, -780), (1050, -1850), (1733, -2564), (2100, -3500)]),
    ("14", "14th Street - San Antonio", "Fruitvale BART", "West Oakland", "#1b7f5c",
     [(-2000, -150), (-800, -50), (0, 0), (650, 180), (1750, 620), (2750, 900)]),
    ("72", "San Pablo Avenue", "Richmond Contra Costa", "Jack London Square", "#007a5e",
     [(-320, 1050), (-180, 250), (-120, 0), (-650, -900), (-1350, -2400), (-1750, -3300), (-2250, -5300)]),
    ("18", "Lake Merritt - Shattuck", "University Village", "Lakeshore & Lake Merritt", "#2e8b57",
     [(1650, 200), (1150, -250), (350, -300), (90, -520), (-100, -2000), (-260, -3400), (-580, -5300)]),
    ("NL", "MacArthur Transbay", "Eastmont Transit Ctr", "Downtown Oakland", "#1d63b8",
     [(-400, -100), (180, -520), (1250, -680), (2200, -850), (3050, -650)]),
]

routes = []
stops = []
shapes = []
headsigns = []
trips = []

for r_num, r_long, head_fwd, head_rev, col_str, wps in corridor_waypoints:
    r_ix = len(routes)
    routes.append([r_num, r_long, col_str])
    full_pts = []
    for i in range(len(wps) - 1):
        u = nearest_gnode(*wps[i])
        v = nearest_gnode(*wps[i + 1])
        seg = shortest_road_path(u, v)
        if seg:
            if not full_pts:
                full_pts.extend(seg)
            else:
                full_pts.extend(seg[1:])
    if len(full_pts) < 4:
        full_pts = list(wps)

    for head_str, pts_dir in ((head_fwd, full_pts), (head_rev, list(reversed(full_pts)))):
        sh_ix = len(shapes)
        shapes.append(flat(pts_dir))
        h_ix = len(headsigns)
        headsigns.append(head_str)

        dists = [0.0]
        for i in range(len(pts_dir) - 1):
            dists.append(dists[-1] + math.hypot(pts_dir[i+1][0] - pts_dir[i][0], pts_dir[i+1][1] - pts_dir[i][1]))
        total_len = max(100.0, dists[-1])
        dur_sec = int(round(total_len / 7.2))
        n_stops = 8
        route_stop_indices = []
        for k in range(n_stops):
            frac = k / (n_stops - 1)
            target_d = frac * total_len
            si = 0
            while si + 1 < len(dists) and dists[si + 1] < target_d:
                si += 1
            px, pz = pts_dir[si]
            st_ix = len(stops)
            stops.append([f"{r_long} Stop {k+1}", r1(px), r1(pz)])
            route_stop_indices.append((st_ix, frac))

        for blk_num, dep_t in enumerate(range(5 * 3600 + 30 * 60 + r_ix * 90, 23 * 3600 + 30 * 60, 12 * 60)):
            seq = []
            for st_ix, frac in route_stop_indices:
                arr = int(round(dep_t + frac * dur_sec))
                dep = arr + (15 if 0 < frac < 1 else 0)
                seq.extend([st_ix, arr, dep])
            trips.append([r_ix, sh_ix, h_ix, 0, f"ac_{r_ix}_{sh_ix}_{blk_num}", *seq])

trips.sort(key=lambda r: r[6])
actransit_out = {
    'feed': ['oakland-ac-transit-1', '20250101', '20301231'],
    'routes': routes,
    'stops': stops,
    'shapes': shapes,
    'headsigns': headsigns,
    'calendar': [[0, '1111111', '20250101', '20301231']],
    'exceptions': [],
    'trips': trips,
}
actransit_gz_path = os.path.join(ROOT_DIR, 'data', 'actransit.json.gz')
with gzip.open(actransit_gz_path, 'wt', encoding='utf-8', compresslevel=9) as f:
    json.dump(actransit_out, f, separators=(',', ':'))
print(f"Wrote {actransit_gz_path} ({len(routes)} routes, {len(stops)} stops, {len(trips)} trips)")
print("Done! All Oakland geodata files built in exact schema.")
