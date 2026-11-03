#!/usr/bin/env python3
"""
tools/sample-city-archetypes.py

Samples street-level building archetypes, neighborhood character profiles,
landmark structural specifications, housing density, and tree canopy coverage
for a Go To Anywhere (GTA) city pack by combining:
  1. OpenStreetMap building:material, building:colour, roof:shape, roof:material,
     roof:colour, building:architecture, height/levels, 3D building:part
     sub-volumes, and natural=tree / park / wood coverage from tools/.cache/.
  2. Spatial neighborhood clustering around each city pack's neighborhood areas
     (computing per-neighborhood wall materials, roof shapes, pitches, facade
     palettes, housing density, and tree coverage).
  3. Landmark site inspection around each city pack's landmarks (extracting
     footprint dimensions w/d/h, multi-part 3D massing tiers, architectural
     form, and facade/roof/crown colors).
  4. Google Street View Static API + Maps Static Satellite API sampling (loading
     GOOGLE_MAPS_API_KEY from the environment or ~/.bash_profile), measuring:
       - Street View facade colors (+12 deg pitch for neighborhoods, +22 deg for landmarks)
       - Satellite roof colors (zoom 18 overhead imagery)
       - Street View foliage green-pixel ratio & building wall enclosure ratio
       - Satellite overhead tree canopy ratio & built footprint coverage ratio

Writes the resulting regional, neighborhood, and landmark archetype profile to:
  - tools/.cache/<city>_archetypes.json (for all 20 cities)
  - cities/<city>/data/archetypes.json (when cities/<city>/ exists)
  - Optionally embeds GEO.sampledArchetypes into cities/<city>/city-geodata.js (--write-geodata)

Usage:
  python3 tools/sample-city-archetypes.py --city sanfrancisco
  python3 tools/sample-city-archetypes.py --all --write-geodata
"""

import argparse
import colorsys
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT_DIR, 'tools', '.cache')

MATERIAL_MAP = {
    'wood': 'clapboard',
    'timber_framing': 'clapboard',
    'vinyl': 'clapboard',
    'siding': 'clapboard',
    'weatherboard': 'clapboard',
    'brick': 'brick',
    'stone': 'stone',
    'sandstone': 'stone',
    'limestone': 'stone',
    'granite': 'stone',
    'marble': 'stone',
    'plaster': 'stucco',
    'stucco': 'stucco',
    'render': 'stucco',
    'concrete': 'stucco',
    'cement_block': 'stucco',
    'shingle': 'shake',
}

ROOF_MAP = {
    'flat': 'flat',
    'hipped': 'hip',
    'pyramidal': 'hip',
    'mansard': 'hip',
    'dome': 'hip',
    'gabled': 'gable',
    'skillion': 'gable',
    'half-hipped': 'gable',
    'gambrel': 'gambrel',
}

NAMED_COLORS = {
    'white': 0xf4f0e6,
    'cream': 0xebe4d2,
    'beige': 0xe2d6be,
    'yellow': 0xe4cd85,
    'ochre': 0xd9a85b,
    'orange': 0xd97a4a,
    'terracotta': 0xc85a42,
    'red': 0x9c3e2e,
    'brown': 0x7b5640,
    'maroon': 0x6e2e26,
    'pink': 0xe2b8b0,
    'green': 0x708264,
    'blue': 0x6b88a2,
    'grey': 0x8e9498,
    'gray': 0x8e9498,
    'black': 0x2e3136,
    'tan': 0xc8b391,
    'sandstone': 0xdcc59a,
    'gold': 0xe6be5a,
    'bronze': 0x6e543b,
    'copper': 0x457d68,
    'silver': 0xc8d0d8,
}

# Supplemental metadata for Ann Arbor and New York (which are packaged via package-existing-cities.py)
EXTRA_CITY_CONFIGS = {
    'annarbor': {
        'id': 'annarbor',
        'name': 'Ann Arbor, MI',
        'lat0': 42.2796,
        'lon0': -83.7462,
        'bbox': (42.240, -83.795, 42.315, -83.695),
        'neighborhood_places': [
            ('Main Street', 0, 0, 260),
            ('Kerrytown', 180, -520, 260),
            ('State Street', 680, 140, 260),
            ('Central Campus', 950, 260, 320),
            ('Old West Side', -540, 240, 300),
            ('Burns Park', 1280, 1050, 320),
        ],
        'landmarks_meta': {
            'Michigan Stadium': {'x': -120, 'z': 1760, 'w': 210, 'd': 260, 'h': 36},
            'Burton Memorial Tower': {'x': 740, 'z': 60, 'w': 18, 'd': 18, 'h': 65},
            'Michigan Theater': {'x': 520, 'z': 40, 'w': 36, 'd': 58, 'h': 22},
            'Nickels Arcade': {'x': 660, 'z': 180, 'w': 28, 'd': 82, 'h': 14},
            'Law Quadrangle': {'x': 780, 'z': 460, 'w': 110, 'd': 120, 'h': 24},
            'Huron River': {'x': 450, 'z': -1050, 'w': 60, 'd': 280, 'h': 8},
        },
    },
    'newyork': {
        'id': 'newyork',
        'name': 'New York, NY',
        'lat0': 40.7580,
        'lon0': -73.9855,
        'bbox': (40.700, -74.020, 40.815, -73.930),
        'neighborhood_places': [
            ('Midtown', 0, 0, 450),
            ('Financial District', -1150, 5600, 420),
            ('Greenwich Village', -650, 2850, 380),
            ('SoHo & Tribeca', -820, 3850, 380),
            ('Upper West Side', 650, -2400, 420),
            ('Upper East Side', 1450, -1850, 420),
            ('Harlem', 1950, -5200, 450),
            ('Lower East Side', 320, 3550, 380),
        ],
        'landmarks_meta': {
            'Empire State Building': {'x': 120, 'z': 1150, 'w': 58, 'd': 128, 'h': 381},
            'One World Trade Center': {'x': -1380, 'z': 5450, 'w': 61, 'd': 61, 'h': 541},
            'Chrysler Building': {'x': 680, 'z': 420, 'w': 48, 'd': 60, 'h': 319},
            'Flatiron Building': {'x': -80, 'z': 2080, 'w': 26, 'd': 56, 'h': 87},
            'Central Park': {'x': 1050, 'z': -2100, 'w': 800, 'd': 4000, 'h': 18},
            'Times Square': {'x': -180, 'z': 120, 'w': 70, 'd': 140, 'h': 110},
        },
    },
}

# Baseline regional calibration priors for tree canopy and housing density across all 20 cities,
# which are blended with live Street View + Satellite + OSM measurements.
CITY_DENSITY_PRIORS = {
    'sanfrancisco': {'canopy': 0.16, 'streetTree': 0.72, 'parkTree': 1.05, 'foliageScale': 0.92, 'form': 'rowhouse', 'bldgKm2': 2850, 'footprint': 0.52, 'infill': 0.15, 'rowhouse': 0.78, 'porch': 0.65, 'shrub': 0.58},
    'oakland':      {'canopy': 0.25, 'streetTree': 0.92, 'parkTree': 1.12, 'foliageScale': 1.04, 'form': 'urban',    'bldgKm2': 1680, 'footprint': 0.34, 'infill': 0.22, 'rowhouse': 0.22, 'porch': 1.08, 'shrub': 1.05},
    'royaloak':     {'canopy': 0.36, 'streetTree': 1.24, 'parkTree': 1.25, 'foliageScale': 1.15, 'form': 'suburban', 'bldgKm2': 1420, 'footprint': 0.24, 'infill': 0.20, 'rowhouse': 0.04, 'porch': 1.22, 'shrub': 1.28},
    'annarbor':     {'canopy': 0.38, 'streetTree': 1.22, 'parkTree': 1.30, 'foliageScale': 1.16, 'form': 'suburban', 'bldgKm2': 1180, 'footprint': 0.22, 'infill': 0.25, 'rowhouse': 0.08, 'porch': 1.24, 'shrub': 1.25},
    'newyork':      {'canopy': 0.12, 'streetTree': 0.54, 'parkTree': 1.08, 'foliageScale': 0.84, 'form': 'highrise', 'bldgKm2': 3200, 'footprint': 0.68, 'infill': 0.10, 'rowhouse': 0.88, 'porch': 0.42, 'shrub': 0.35},
    'pompanobeach': {'canopy': 0.26, 'streetTree': 0.98, 'parkTree': 1.10, 'foliageScale': 1.08, 'form': 'suburban', 'bldgKm2': 1150, 'footprint': 0.26, 'infill': 0.68, 'rowhouse': 0.06, 'porch': 0.95, 'shrub': 1.22},
    'sydney':       {'canopy': 0.24, 'streetTree': 0.88, 'parkTree': 1.15, 'foliageScale': 1.05, 'form': 'urban',    'bldgKm2': 1950, 'footprint': 0.42, 'infill': 0.30, 'rowhouse': 0.52, 'porch': 0.88, 'shrub': 0.92},
    'venice':       {'canopy': 0.05, 'streetTree': 0.24, 'parkTree': 0.55, 'foliageScale': 0.78, 'form': 'rowhouse', 'bldgKm2': 3650, 'footprint': 0.70, 'infill': 0.15, 'rowhouse': 0.94, 'porch': 0.25, 'shrub': 0.28},
    'amsterdam':    {'canopy': 0.22, 'streetTree': 0.94, 'parkTree': 1.08, 'foliageScale': 0.98, 'form': 'rowhouse', 'bldgKm2': 2950, 'footprint': 0.56, 'infill': 0.20, 'rowhouse': 0.90, 'porch': 0.38, 'shrub': 0.52},
    'hongkong':     {'canopy': 0.20, 'streetTree': 0.48, 'parkTree': 1.28, 'foliageScale': 0.86, 'form': 'highrise', 'bldgKm2': 2600, 'footprint': 0.64, 'infill': 0.12, 'rowhouse': 0.82, 'porch': 0.28, 'shrub': 0.42},
    'paris':        {'canopy': 0.19, 'streetTree': 0.86, 'parkTree': 1.06, 'foliageScale': 0.96, 'form': 'rowhouse', 'bldgKm2': 3400, 'footprint': 0.64, 'infill': 0.15, 'rowhouse': 0.92, 'porch': 0.32, 'shrub': 0.45},
    'london':       {'canopy': 0.23, 'streetTree': 0.84, 'parkTree': 1.18, 'foliageScale': 1.02, 'form': 'rowhouse', 'bldgKm2': 2750, 'footprint': 0.54, 'infill': 0.22, 'rowhouse': 0.84, 'porch': 0.52, 'shrub': 0.68},
    'tokyo':        {'canopy': 0.15, 'streetTree': 0.64, 'parkTree': 1.12, 'foliageScale': 0.88, 'form': 'urban',    'bldgKm2': 3800, 'footprint': 0.58, 'infill': 0.28, 'rowhouse': 0.62, 'porch': 0.38, 'shrub': 0.54},
    'barcelona':    {'canopy': 0.21, 'streetTree': 0.92, 'parkTree': 1.02, 'foliageScale': 0.96, 'form': 'rowhouse', 'bldgKm2': 3100, 'footprint': 0.62, 'infill': 0.18, 'rowhouse': 0.88, 'porch': 0.35, 'shrub': 0.48},
    'rio':          {'canopy': 0.32, 'streetTree': 0.96, 'parkTree': 1.38, 'foliageScale': 1.14, 'form': 'urban',    'bldgKm2': 2250, 'footprint': 0.48, 'infill': 0.32, 'rowhouse': 0.58, 'porch': 0.68, 'shrub': 1.08},
    'vancouver':    {'canopy': 0.34, 'streetTree': 1.16, 'parkTree': 1.35, 'foliageScale': 1.15, 'form': 'urban',    'bldgKm2': 1850, 'footprint': 0.36, 'infill': 0.26, 'rowhouse': 0.32, 'porch': 1.04, 'shrub': 1.18},
    'capetown':     {'canopy': 0.24, 'streetTree': 0.82, 'parkTree': 1.12, 'foliageScale': 1.02, 'form': 'urban',    'bldgKm2': 1720, 'footprint': 0.38, 'infill': 0.34, 'rowhouse': 0.48, 'porch': 0.86, 'shrub': 0.95},
    'chicago':      {'canopy': 0.21, 'streetTree': 0.84, 'parkTree': 1.08, 'foliageScale': 0.98, 'form': 'urban',    'bldgKm2': 2450, 'footprint': 0.50, 'infill': 0.22, 'rowhouse': 0.64, 'porch': 0.78, 'shrub': 0.72},
    'boston':        {'canopy': 0.24, 'streetTree': 0.90, 'parkTree': 1.12, 'foliageScale': 1.00, 'form': 'rowhouse', 'bldgKm2': 2680, 'footprint': 0.52, 'infill': 0.20, 'rowhouse': 0.76, 'porch': 0.72, 'shrub': 0.74},
    'seattle':      {'canopy': 0.33, 'streetTree': 1.14, 'parkTree': 1.32, 'foliageScale': 1.14, 'form': 'urban',    'bldgKm2': 1780, 'footprint': 0.35, 'infill': 0.25, 'rowhouse': 0.28, 'porch': 1.06, 'shrub': 1.16},
}


def get_google_maps_api_key():
    key = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
    if key:
        return key
    for rc_file in ('~/.bash_profile', '~/.zshrc', '~/.profile', '~/.bashrc'):
        path = os.path.expanduser(rc_file)
        if os.path.isfile(path):
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('#') or 'GOOGLE_MAPS_API_KEY' not in line:
                            continue
                        m = re.search(r'GOOGLE_MAPS_API_KEY\s*=\s*["\']?([^"\'\s#]+)["\']?', line)
                        if m:
                            os.environ['GOOGLE_MAPS_API_KEY'] = m.group(1)
                            return m.group(1)
            except Exception:
                pass
    return ''


def load_city_configs():
    spec = importlib.util.spec_from_file_location(
        'build_city_pack',
        os.path.join(ROOT_DIR, 'tools', 'build-city-pack.py')
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    configs = dict(mod.CITY_CONFIGS)
    for cid, extra in EXTRA_CITY_CONFIGS.items():
        if cid not in configs:
            configs[cid] = extra
    for cid in mod.discover_local_city_packs():
        if cid not in configs:
            try:
                configs[cid] = mod.resolve_local_city_config(cid)
            except Exception:
                pass
    return configs


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '_', str(name).lower()).strip('_')


def parse_color_hex(val):
    if not val:
        return None
    s = str(val).strip().lower()
    if s in NAMED_COLORS:
        return NAMED_COLORS[s]
    m = re.match(r'^#?([0-9a-f]{6})$', s)
    if m:
        return int(m.group(1), 16)
    return None


def parse_height_tag(tags):
    if not tags:
        return None
    for k in ('height', 'est_height', 'building:height'):
        v = tags.get(k)
        if v:
            m = re.search(r'(\d+(?:\.\d+)?)', str(v))
            if m:
                val = float(m.group(1))
                if 'ft' in str(v).lower() or "'" in str(v):
                    val *= 0.3048
                return round(val, 1)
    lv = tags.get('building:levels')
    if lv:
        m = re.search(r'(\d+(?:\.\d+)?)', str(lv))
        if m:
            return round(float(m.group(1)) * 3.5, 1)
    return None


def infer_landmark_form(name, tags, w, d, h):
    nl = name.lower()
    btype = str(tags.get('building') or '').lower()
    man_made = str(tags.get('man_made') or '').lower()
    arch = str(tags.get('building:architecture') or '').lower()
    rshape = str(tags.get('roof:shape') or '').lower()

    if 'opera house' in nl or 'canada place' in nl:
        return 'opera_sails'
    if 'eiffel' in nl or 'tokyo tower' in nl or 'sutro' in nl or 'skytree' in nl or man_made == 'communications_tower':
        return 'lattice_tower'
    if 'space needle' in nl or 'harbour centre' in nl or 'tower eye' in nl:
        return 'observation_needle'
    if 'christ the redeemer' in nl or 'cristo' in nl or 'sugarloaf' in nl:
        return 'mountain_statue'
    if 'eye' in nl or 'wheel' in nl:
        return 'ferris_wheel'
    if 'sagrada' in nl or 'notre-dame' in nl or 'cathedral' in nl or ('basilica' in nl and 'sacre' not in nl and 'mark' not in nl):
        return 'cathedral_spires'
    if 'sacre-coeur' in nl or 'san marco' in nl or 'mark\'s basilica' in nl or 'city hall' in nl or 'state house' in nl or rshape in ('dome', 'onion'):
        return 'dome_palace'
    if 'big ben' in nl or 'campanile' in nl or 'custom house' in nl or 'ferry building' in nl or 'clock' in nl or 'burton' in nl or 'tribune' in nl:
        return 'clock_tower'
    if 'arc de triomphe' in nl or ('arch' in nl and 'bridge' not in nl):
        return 'triumphal_arch'
    if 'senso-ji' in nl or 'torii' in nl or 'dragon gate' in nl or 'meiji' in nl or btype == 'temple':
        return 'torii_temple'
    if 'harbour bridge' in nl or 'rialto' in nl:
        return 'arch_bridge'
    if 'zakim' in nl:
        return 'cable_stayed_bridge'
    if 'michigan ave' in nl or 'bascule' in nl or 'drawbridge' in nl:
        return 'bascule_bridge'
    if 'bridge' in nl:
        return 'suspension_bridge'
    if 'willis' in nl or 'sears' in nl or 'empire state' in nl or 'chrysler' in nl or 'world trade' in nl:
        return 'stepped_bundled_tube'
    if 'bank of china' in nl or 'ifc' in nl or 'shard' in nl or 'transamerica' in nl or 'salesforce' in nl:
        return 'diagrid_prism'
    if 'castle' in nl or 'fort' in nl or 'alcatraz' in nl:
        return 'fortress_bastion'
    if 'stadium' in nl or ('park' in nl and ('fenway' in nl or 'oracle' in nl or 'maracana' in nl)):
        return 'stadium_bowl'
    if 'doge' in nl or 'palazzo' in nl or 'rijksmuseum' in nl or 'anne frank' in nl or 'royal palace' in nl or 'louvre' in nl:
        return 'canal_palazzo'
    if 'bo-kaap' in nl or 'painted ladies' in nl or 'batllo' in nl or 'quincy market' in nl or 'pike place' in nl or 'shibuya' in nl:
        return 'historic_row'
    if h >= 120:
        return 'stepped_bundled_tube'
    if arch in ('neoclassical', 'beaux-arts', 'classical'):
        return 'dome_palace'
    return 'canal_palazzo'


def _iter_rgb_pixels(img):
    raw = img.tobytes()
    return [(raw[i], raw[i + 1], raw[i + 2]) for i in range(0, len(raw), 3)]


def sample_street_view_and_satellite(lat, lon, heading, api_key, pitch=12, fetch_sat=True):
    """
    Fetch a 256x256 Street View crop and optional 256x256 Satellite overhead crop.
    Returns dict with:
      facade_hex, roof_hex, sv_foliage, sv_wall, sat_canopy, sat_built
    """
    try:
        from PIL import Image
    except ImportError:
        return None
    os.makedirs(CACHE_DIR, exist_ok=True)
    out = {
        'facade_hex': None,
        'roof_hex': None,
        'sv_foliage': None,
        'sv_wall': None,
        'sat_canopy': None,
        'sat_built': None,
    }

    # 1. Street View Static API
    cache_sv = os.path.join(CACHE_DIR, f"sv_{lat:.5f}_{lon:.5f}_{int(heading)}_p{int(pitch)}.jpg")
    if not os.path.exists(cache_sv) or os.path.getsize(cache_sv) < 1200:
        url = (
            f"https://maps.googleapis.com/maps/api/streetview"
            f"?size=256x256&location={lat:.6f},{lon:.6f}&radius=150"
            f"&heading={int(heading)}&pitch={int(pitch)}&fov=65&source=outdoor&return_error_code=true&key={api_key}"
        )
        res = subprocess.run(['curl', '-sS', '-f', '-L', '-o', cache_sv, url], check=False)
        if res.returncode != 0 and os.path.exists(cache_sv):
            try:
                os.remove(cache_sv)
            except OSError:
                pass

    if os.path.exists(cache_sv) and os.path.getsize(cache_sv) >= 1200:
        try:
            img = Image.open(cache_sv).convert('RGB')
            w, h = img.size
            band = img.crop((int(w * 0.12), int(h * 0.14), int(w * 0.88), int(h * 0.72))).resize((32, 32))
            pixels = _iter_rgb_pixels(band)
            valid_facade = []
            green_px = 0
            sky_px = 0
            for r, g, b in pixels:
                hue, sat, val = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                deg = hue * 360.0
                if (60 <= deg <= 170 and sat >= 0.10 and 0.08 <= val <= 0.85) or (g >= r and g > b + 6 and 22 < g < 205):
                    green_px += 1
                    continue
                if (185 <= deg <= 245 and sat >= 0.12 and val >= 0.42) or (b > r + 18 and b > g + 8 and b > 115):
                    sky_px += 1
                    continue
                if 85 <= (r + g + b) <= 725:
                    valid_facade.append((r, g, b))
            n = max(1, len(pixels))
            out['sv_foliage'] = round(green_px / n, 3)
            out['sv_wall'] = round(max(0.0, 1.0 - (green_px + sky_px) / n), 3)
            if valid_facade:
                r_avg = int(sum(p[0] for p in valid_facade) / len(valid_facade))
                g_avg = int(sum(p[1] for p in valid_facade) / len(valid_facade))
                b_avg = int(sum(p[2] for p in valid_facade) / len(valid_facade))
                out['facade_hex'] = (r_avg << 16) | (g_avg << 8) | b_avg
        except Exception:
            pass

    # 2. Maps Static API Satellite overhead view (for canopy coverage & roof color)
    if fetch_sat:
        cache_sat = os.path.join(CACHE_DIR, f"sat_{lat:.5f}_{lon:.5f}_z18.png")
        if not os.path.exists(cache_sat) or os.path.getsize(cache_sat) < 1200:
            sat_url = (
                f"https://maps.googleapis.com/maps/api/staticmap"
                f"?center={lat:.6f},{lon:.6f}&zoom=18&size=256x256&maptype=satellite&key={api_key}"
            )
            res = subprocess.run(['curl', '-sS', '-f', '-L', '-o', cache_sat, sat_url], check=False)
            if res.returncode != 0 and os.path.exists(cache_sat):
                try:
                    os.remove(cache_sat)
                except OSError:
                    pass

        if os.path.exists(cache_sat) and os.path.getsize(cache_sat) >= 1200:
            try:
                sat_img = Image.open(cache_sat).convert('RGB')
                w, h = sat_img.size
                # Exclude bottom 26px watermark
                crop_sat = sat_img.crop((0, 0, w, int(h * 0.88))).resize((48, 48))
                sat_pixels = _iter_rgb_pixels(crop_sat)
                canopy_px = 0
                water_px = 0
                roof_candidates = []
                for r, g, b in sat_pixels:
                    hue, sat, val = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                    deg = hue * 360.0
                    if (62 <= deg <= 168 and sat >= 0.11 and 0.08 <= val <= 0.80) or (g >= r and g > b + 5 and 20 < g < 195):
                        canopy_px += 1
                    elif (180 <= deg <= 250 and sat >= 0.18 and val <= 0.55) or (b > r + 15 and b > g + 8 and b < 130):
                        water_px += 1
                    else:
                        if 95 <= (r + g + b) <= 680:
                            roof_candidates.append((r, g, b))
                n_sat = max(1, len(sat_pixels))
                out['sat_canopy'] = round(canopy_px / n_sat, 3)
                out['sat_built'] = round(max(0.0, 1.0 - (canopy_px + water_px) / n_sat), 3)
                if roof_candidates:
                    r_avg = int(sum(p[0] for p in roof_candidates) / len(roof_candidates))
                    g_avg = int(sum(p[1] for p in roof_candidates) / len(roof_candidates))
                    b_avg = int(sum(p[2] for p in roof_candidates) / len(roof_candidates))
                    out['roof_hex'] = (r_avg << 16) | (g_avg << 8) | b_avg
            except Exception:
                pass

    return out


def compute_tree_and_housing_metrics(city_id, nb_name, sv_foliage_list, sv_wall_list, sat_canopy_list, sat_built_list, bldg_count, area_km2, avg_height):
    prior = CITY_DENSITY_PRIORS.get(city_id, CITY_DENSITY_PRIORS['sanfrancisco'])
    nl = (nb_name or '').lower()

    # Neighborhood-specific adjustments based on urban morphology
    is_park_or_wood = any(k in nl for k in ('park', 'presidio', 'woods', 'botanic', 'zoo', 'golf', 'forest', 'peak', 'mountain', 'lands end', 'meer', 'lagoon', 'lake'))
    is_dense_core = any(k in nl for k in ('downtown', 'financial', 'cbd', 'chinatown', 'midtown', 'central', 'loop', 'union square', 'soma', 'tenderloin', 'causeway bay', 'wan chai', 'tsim sha tsui', 'shibuya', 'shinjuku', 'ginza', 'marunouchi', 'la defense'))
    is_rowhouse_nb = any(k in nl for k in ('alamo', 'haight', 'castro', 'mission', 'north beach', 'russian hill', 'nob hill', 'pacific heights', 'back bay', 'beacon hill', 'north end', 'charlestown', 'jordaan', 'grachtengordel', 'de pijp', 'marais', 'saint-germain', 'latin quarter', 'montmartre', 'eixample', 'gotic', 'soho', 'westminster', 'bloomsbury', 'greenwich', 'upper west', 'upper east', 'harlem', 'bo-kaap', 'rocks', 'paddington', 'san marco', 'cannaregio', 'dorsoduro'))
    is_leafy_suburb = any(k in nl for k in ('vinsetta', 'huntington', 'pleasant ridge', 'berkley', 'normandy', 'burns park', 'old west side', 'rockridge', 'piedmont', 'temescal', 'grand lake', 'sunset', 'richmond', 'noevalley', 'noe valley', 'kitsilano', 'queen anne', 'capitol hill', 'harbor village', 'shores'))

    meas_sv_fol = (sum(sv_foliage_list) / len(sv_foliage_list)) if sv_foliage_list else prior['canopy'] * 0.65
    meas_sat_can = (sum(sat_canopy_list) / len(sat_canopy_list)) if sat_canopy_list else prior['canopy']
    meas_sv_wall = (sum(sv_wall_list) / len(sv_wall_list)) if sv_wall_list else prior['footprint'] * 1.15
    meas_sat_built = (sum(sat_built_list) / len(sat_built_list)) if sat_built_list else prior['footprint']

    # Blended canopy cover (0.04 .. 0.62)
    canopy = 0.50 * prior['canopy'] + 0.30 * meas_sat_can + 0.20 * min(0.55, meas_sv_fol * 1.35)
    if is_park_or_wood:
        canopy = min(0.62, canopy * 1.45 + 0.08)
    elif is_leafy_suburb:
        canopy = min(0.52, canopy * 1.22 + 0.04)
    elif is_dense_core:
        canopy = max(0.04, canopy * 0.62)
    canopy = round(max(0.04, min(0.62, canopy)), 2)

    street_tree_density = prior['streetTree'] * (0.65 + 0.35 * (canopy / max(0.08, prior['canopy'])))
    if is_park_or_wood or is_leafy_suburb:
        street_tree_density = min(1.38, street_tree_density * 1.18)
    elif is_dense_core:
        street_tree_density = max(0.24, street_tree_density * 0.68)
    street_tree_density = round(max(0.20, min(1.38, street_tree_density)), 2)

    street_tree_spacing = round(max(14.5, min(38.0, 22.0 / max(0.45, street_tree_density))), 1)
    park_tree_density = round(max(0.45, min(1.55, prior['parkTree'] * (0.75 + 0.25 * (canopy / max(0.08, prior['canopy']))))), 2)
    foliage_scale = round(max(0.76, min(1.24, prior['foliageScale'] * (0.88 + 0.12 * street_tree_density))), 2)

    tree_coverage = {
        'canopyCover': canopy,
        'streetTreeDensity': street_tree_density,
        'streetTreeSpacing': street_tree_spacing,
        'parkTreeDensity': park_tree_density,
        'foliageScale': foliage_scale,
    }

    # Housing density metrics
    osm_bldg_km2 = round(bldg_count / max(0.25, area_km2)) if bldg_count >= 50 else prior['bldgKm2']
    blended_bldg_km2 = int(round(0.55 * prior['bldgKm2'] + 0.45 * min(4800, max(450, osm_bldg_km2))))
    footprint_cov = 0.55 * prior['footprint'] + 0.25 * min(0.78, meas_sat_built * 0.72) + 0.20 * min(0.75, meas_sv_wall * 0.68)
    if is_dense_core:
        footprint_cov = min(0.76, footprint_cov * 1.24)
    elif is_rowhouse_nb:
        footprint_cov = min(0.68, footprint_cov * 1.12)
    elif is_leafy_suburb:
        footprint_cov = max(0.18, footprint_cov * 0.85)
    footprint_cov = round(max(0.16, min(0.76, footprint_cov)), 2)

    form = prior['form']
    if is_dense_core and avg_height >= 16.0:
        form = 'highrise'
    elif is_rowhouse_nb:
        form = 'rowhouse'
    elif is_leafy_suburb and form != 'rowhouse':
        form = 'suburban'

    rowhouse_attach = prior['rowhouse']
    if is_rowhouse_nb or is_dense_core:
        rowhouse_attach = min(0.95, max(rowhouse_attach, 0.74))
    elif is_leafy_suburb:
        rowhouse_attach = max(0.04, rowhouse_attach * 0.65)
    rowhouse_attach = round(rowhouse_attach, 2)

    porch_scale = prior['porch']
    if is_dense_core:
        porch_scale = round(max(0.25, porch_scale * 0.65), 2)
    elif is_leafy_suburb:
        porch_scale = round(min(1.32, porch_scale * 1.12), 2)
    else:
        porch_scale = round(porch_scale, 2)

    shrub_density = prior['shrub']
    if is_dense_core:
        shrub_density = round(max(0.22, shrub_density * 0.58), 2)
    elif is_leafy_suburb or is_park_or_wood:
        shrub_density = round(min(1.38, shrub_density * 1.15), 2)
    else:
        shrub_density = round(shrub_density, 2)

    max_house_h = 12.2 if form == 'rowhouse' else (8.8 if form == 'highrise' else (10.5 if form == 'urban' else 9.8))
    max_house_fp = 310 if form == 'rowhouse' else (240 if form == 'highrise' else 285)

    housing_density = {
        'form': form,
        'buildingsPerKm2': blended_bldg_km2,
        'footprintCoverage': footprint_cov,
        'wallEnclosure': round(meas_sv_wall, 2),
        'lotInfill': round(prior['infill'], 2),
        'rowhouseAttachment': rowhouse_attach,
        'maxHouseHeight': max_house_h,
        'maxHouseFootprint': max_house_fp,
        'porchProbScale': porch_scale,
        'shrubDensity': shrub_density,
    }

    return tree_coverage, housing_density


def summarize_bucket(wall_counts, roof_counts, wall_colors, roof_colors, heights):
    total_w = sum(wall_counts.values())
    walls = {
        k: round(wall_counts.get(k, 0) / total_w, 2)
        for k in ('clapboard', 'brick', 'stone', 'stucco', 'shake')
    } if total_w >= 5 else None

    total_r = sum(roof_counts.values())
    roofs = {
        k: round(roof_counts.get(k, 0) / total_r, 2)
        for k in ('flat', 'hip', 'gable', 'gambrel')
    } if total_r >= 5 else None

    avg_h = round(sum(heights) / len(heights), 1) if heights else 9.0
    max_h = round(max(heights), 1) if heights else 18.0
    return {
        'building_count': len(heights),
        'avg_height_m': avg_h,
        'max_height_m': max_h,
        'walls': walls,
        'roofs': roofs,
        'sampled_facade_palette': [f"0x{c:06x}" for c, _ in wall_colors.most_common(6)],
        'sampled_roof_palette': [f"0x{c:06x}" for c, _ in roof_colors.most_common(4)],
    }


def sample_city_archetypes(city_id, num_sv_samples=12, write_geodata=False):
    configs = load_city_configs()
    cfg = configs.get(city_id)
    lat0 = cfg['lat0'] if cfg else 37.7879
    lon0 = cfg['lon0'] if cfg else -122.4075
    lat_m = 111132.0
    lon_m = 111320.0 * math.cos(math.radians(lat0))

    bbox = cfg.get('bbox') if cfg else None
    if bbox:
        s_lat, w_lon, n_lat, e_lon = bbox
        area_km2 = max(1.0, abs(n_lat - s_lat) * 111.132 * abs(e_lon - w_lon) * (111.320 * math.cos(math.radians(lat0))))
    else:
        area_km2 = 25.0

    def ll_to_xz(lat, lon):
        return (lon - lon0) * lon_m, (lat0 - lat) * lat_m

    def xz_to_ll(x, z):
        return lat0 - z / lat_m, lon0 + x / lon_m

    neighborhoods_cfg = list(cfg.get('neighborhood_places', [])) if cfg else []
    if not neighborhoods_cfg and city_id == 'oakland':
        neighborhoods_cfg = [
            ('Downtown Oakland', 0, 0, 320),
            ('Uptown', 60, -450, 280),
            ('Old Oakland', -250, 260, 240),
            ('Chinatown', 235, 250, 240),
            ('Lake Merritt & Adams Point', 1350, -350, 420),
            ('Grand Lake & Lakeshore', 1950, -780, 340),
            ('Piedmont Avenue', 1100, -2100, 340),
            ('Temescal', 180, -2400, 360),
            ('Rockridge', 880, -3800, 380),
            ('West Oakland', -1600, -150, 420),
            ('Jack London Square', -280, 950, 300),
        ]
    landmarks_cfg = cfg.get('landmarks_meta', {}) if cfg else {}

    bldg_cache = os.path.join(CACHE_DIR, f"{city_id}_buildings.json")
    wall_counts = Counter()
    roof_counts = Counter()
    wall_colors = Counter()
    roof_colors = Counter()
    all_heights = []

    nb_stats = {
        slugify(nb_name): {
            'name': nb_name,
            'x': nbx,
            'z': nbz,
            'radius': max(320, nbr * 1.4),
            'walls': Counter(),
            'roofs': Counter(),
            'wall_colors': Counter(),
            'roof_colors': Counter(),
            'heights': [],
            'sv_foliage': [],
            'sv_wall': [],
            'sat_canopy': [],
            'sat_built': [],
        }
        for nb_name, nbx, nbz, nbr in neighborhoods_cfg
    }

    lm_stats = {
        lm_name: {
            'name': lm_name,
            'x': meta['x'],
            'z': meta['z'],
            'w': meta.get('w', 40),
            'd': meta.get('d', 40),
            'h': meta.get('h', 35),
            'matched_elements': 0,
            'parts_count': 0,
            'max_osm_height': meta.get('h', 35),
            'materials': Counter(),
            'roof_shapes': Counter(),
            'colors': Counter(),
            'roof_colors': Counter(),
            'tags': {},
            'parts': [],
        }
        for lm_name, meta in landmarks_cfg.items()
    }

    nodes = {}
    if os.path.isfile(bldg_cache):
        with open(bldg_cache, 'r', encoding='utf-8') as f:
            data = json.load(f)
        elements = data.get('elements', [])
        for el in elements:
            if el.get('type') == 'node' and 'lat' in el and 'lon' in el:
                nodes[el['id']] = ll_to_xz(el['lat'], el['lon'])

        for el in elements:
            if el.get('type') not in ('way', 'relation'):
                continue
            t = el.get('tags') or {}
            if not t:
                continue
            pts = [nodes[nid] for nid in el.get('nodes', []) if nid in nodes]
            if not pts:
                continue
            cx = sum(p[0] for p in pts) / len(pts)
            cz = sum(p[1] for p in pts) / len(pts)
            xs = [p[0] for p in pts]
            zs = [p[1] for p in pts]
            bw = max(4.0, max(xs) - min(xs))
            bd = max(4.0, max(zs) - min(zs))

            bmat = str(t.get('building:material') or t.get('building:facade:material') or '').lower()
            mapped_mat = MATERIAL_MAP.get(bmat)
            rshape = str(t.get('roof:shape') or '').lower()
            mapped_roof = ROOF_MAP.get(rshape)
            wcol = parse_color_hex(t.get('building:colour'))
            rcol = parse_color_hex(t.get('roof:colour'))
            h_val = parse_height_tag(t)

            if 'building' in t:
                if mapped_mat:
                    wall_counts[mapped_mat] += 1
                if mapped_roof:
                    roof_counts[mapped_roof] += 1
                if wcol is not None:
                    wall_colors[wcol] += 1
                if rcol is not None:
                    roof_colors[rcol] += 1
                if h_val is not None:
                    all_heights.append(h_val)
                else:
                    all_heights.append(8.5)

                for nb_id, nb in nb_stats.items():
                    if math.hypot(cx - nb['x'], cz - nb['z']) <= nb['radius']:
                        if mapped_mat:
                            nb['walls'][mapped_mat] += 1
                        if mapped_roof:
                            nb['roofs'][mapped_roof] += 1
                        if wcol is not None:
                            nb['wall_colors'][wcol] += 1
                        if rcol is not None:
                            nb['roof_colors'][rcol] += 1
                        nb['heights'].append(h_val if h_val is not None else 8.5)

            for lm_name, lm in lm_stats.items():
                reach = max(lm['w'], lm['d']) * 0.75 + 55.0
                dist = math.hypot(cx - lm['x'], cz - lm['z'])
                name_match = (t.get('name') and (lm_name.lower() in t['name'].lower() or t['name'].lower() in lm_name.lower()))
                if dist <= reach or name_match:
                    lm['matched_elements'] += 1
                    if h_val and h_val > lm['max_osm_height']:
                        lm['max_osm_height'] = h_val
                    if bmat:
                        lm['materials'][bmat] += 1
                    if rshape:
                        lm['roof_shapes'][rshape] += 1
                    if wcol is not None:
                        lm['colors'][wcol] += 1
                    if rcol is not None:
                        lm['roof_colors'][rcol] += 1
                    if name_match or dist < 35.0:
                        for k in ('building', 'building:architecture', 'building:material', 'roof:shape', 'man_made', 'tourism', 'historic'):
                            if t.get(k) and k not in lm['tags']:
                                lm['tags'][k] = t[k]
                    if 'building:part' in t or (dist <= max(lm['w'], lm['d']) * 0.6 and h_val and h_val >= 8):
                        lm['parts_count'] += 1
                        if len(lm['parts']) < 12:
                            lm['parts'].append({
                                'dx': round(cx - lm['x'], 1),
                                'dz': round(cz - lm['z'], 1),
                                'w': round(bw, 1),
                                'd': round(bd, 1),
                                'h': round(h_val or lm['h'] * 0.6, 1),
                                'roofShape': rshape or 'flat',
                                'color': f"0x{wcol:06x}" if wcol is not None else None,
                            })

    api_key = get_google_maps_api_key()
    sv_colors = []
    city_sv_foliage = []
    city_sv_wall = []
    city_sat_canopy = []
    city_sat_built = []

    if api_key and num_sv_samples > 0:
        tasks = []
        for i, (nb_id, nb) in enumerate(list(nb_stats.items())[:num_sv_samples]):
            lat, lon = xz_to_ll(nb['x'], nb['z'])
            tasks.append(('nb', nb_id, lat, lon, (i * 90 + 45) % 360, 12, True))
        for lm_name, lm in lm_stats.items():
            lat, lon = xz_to_ll(lm['x'], lm['z'] + 55.0)
            tasks.append(('lm', lm_name, lat, lon, 0, 22, False))

        def _run_task(t):
            kind, key, lat, lon, hdg, pitch, fetch_sat = t
            return kind, key, sample_street_view_and_satellite(lat, lon, hdg, api_key, pitch=pitch, fetch_sat=fetch_sat)

        with ThreadPoolExecutor(max_workers=8) as pool:
            for kind, key, sample in pool.map(_run_task, tasks):
                if not sample:
                    continue
                if kind == 'nb':
                    nb = nb_stats[key]
                    if sample['facade_hex'] is not None:
                        sv_colors.append(sample['facade_hex'])
                        wall_colors[sample['facade_hex']] += 2
                        nb['wall_colors'][sample['facade_hex']] += 2
                    if sample['roof_hex'] is not None:
                        roof_colors[sample['roof_hex']] += 2
                        nb['roof_colors'][sample['roof_hex']] += 2
                    if sample['sv_foliage'] is not None:
                        nb['sv_foliage'].append(sample['sv_foliage'])
                        city_sv_foliage.append(sample['sv_foliage'])
                    if sample['sv_wall'] is not None:
                        nb['sv_wall'].append(sample['sv_wall'])
                        city_sv_wall.append(sample['sv_wall'])
                    if sample['sat_canopy'] is not None:
                        nb['sat_canopy'].append(sample['sat_canopy'])
                        city_sat_canopy.append(sample['sat_canopy'])
                    if sample['sat_built'] is not None:
                        nb['sat_built'].append(sample['sat_built'])
                        city_sat_built.append(sample['sat_built'])
                elif kind == 'lm':
                    lm = lm_stats[key]
                    if sample['facade_hex'] is not None:
                        sv_colors.append(sample['facade_hex'])
                        lm['colors'][sample['facade_hex']] += 2

    city_summary = summarize_bucket(wall_counts, roof_counts, wall_colors, roof_colors, all_heights)
    city_tree_cov, city_housing_dens = compute_tree_and_housing_metrics(
        city_id,
        '',
        city_sv_foliage,
        city_sv_wall,
        city_sat_canopy,
        city_sat_built,
        city_summary['building_count'],
        area_km2,
        city_summary['avg_height_m'],
    )

    neighborhood_profiles = {}
    for nb_id, nb in nb_stats.items():
        prof = summarize_bucket(nb['walls'], nb['roofs'], nb['wall_colors'], nb['roof_colors'], nb['heights'])
        nb_area_km2 = math.pi * ((nb['radius'] / 1000.0) ** 2)
        nb_tree_cov, nb_housing_dens = compute_tree_and_housing_metrics(
            city_id,
            nb['name'],
            nb['sv_foliage'],
            nb['sv_wall'],
            nb['sat_canopy'],
            nb['sat_built'],
            prof['building_count'],
            nb_area_km2,
            prof['avg_height_m'],
        )
        prof['name'] = nb['name']
        prof['center'] = [nb['x'], nb['z']]
        prof['treeCoverage'] = nb_tree_cov
        prof['housingDensity'] = nb_housing_dens
        neighborhood_profiles[nb_id] = prof

    landmark_profiles = {}
    for lm_name, lm in lm_stats.items():
        form = infer_landmark_form(lm_name, lm['tags'], lm['w'], lm['d'], lm['max_osm_height'])
        top_cols = [f"0x{c:06x}" for c, _ in lm['colors'].most_common(3)]
        top_rcols = [f"0x{c:06x}" for c, _ in lm['roof_colors'].most_common(2)]
        landmark_profiles[lm_name] = {
            'form': form,
            'x': lm['x'],
            'z': lm['z'],
            'w': lm['w'],
            'd': lm['d'],
            'h': lm['max_osm_height'],
            'matched_osm_elements': lm['matched_elements'],
            'parts_count': lm['parts_count'],
            'dominant_materials': [m for m, _ in lm['materials'].most_common(3)],
            'dominant_roof_shapes': [r for r, _ in lm['roof_shapes'].most_common(2)],
            'sampled_colors': top_cols,
            'sampled_roof_colors': top_rcols,
            'tags': lm['tags'],
            'parts': lm['parts'][:8],
        }

    result = {
        'city': city_id,
        'osm_sampled_walls': dict(wall_counts),
        'osm_sampled_roofs': dict(roof_counts),
        'street_view_samples': len(sv_colors),
        **city_summary,
        'treeCoverage': city_tree_cov,
        'housingDensity': city_housing_dens,
        'neighborhoods': neighborhood_profiles,
        'landmarks': landmark_profiles,
    }

    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_out_path = os.path.join(CACHE_DIR, f"{city_id}_archetypes.json")
    with open(cache_out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)

    city_data_dir = os.path.join(ROOT_DIR, 'cities', city_id, 'data')
    if os.path.isdir(city_data_dir):
        out_path = os.path.join(city_data_dir, 'archetypes.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Wrote sampled city + neighborhood + landmark archetypes to {out_path}")

    local_pack_json = os.path.join(ROOT_DIR, 'cities', city_id, 'city-pack.json')
    if os.path.isfile(local_pack_json):
        try:
            with open(local_pack_json, 'r', encoding='utf-8') as f:
                pack_meta = json.load(f)
            arch = dict(pack_meta.get('archetypes') or {})
            arch['treeCoverage'] = result['treeCoverage']
            arch['housingDensity'] = result['housingDensity']
            if result.get('residential'):
                arch['residential'] = result['residential']
            if result.get('midrise'):
                arch['midrise'] = result['midrise']
            pack_meta['archetypes'] = arch
            with open(local_pack_json, 'w', encoding='utf-8') as f:
                json.dump(pack_meta, f, indent=2)
        except Exception:
            pass

    if write_geodata:
        geodata_path = os.path.join(ROOT_DIR, 'cities', city_id, 'city-geodata.js')
        if os.path.isfile(geodata_path):
            with open(geodata_path, 'r', encoding='utf-8') as f:
                raw = f.read()
            m = re.search(r'export const GEO\s*=\s*(\{.*\});?\s*$', raw, re.DOTALL)
            if m:
                geo_obj = json.loads(m.group(1).rstrip(';'))
                geo_obj['sampledArchetypes'] = result
                with open(geodata_path, 'w', encoding='utf-8') as f:
                    f.write(f"// cities/{city_id}/city-geodata.js - GENERATED by tools/build-city-pack.py from OpenStreetMap (ODbL).\n")
                    f.write('export const GEO = ')
                    json.dump(geo_obj, f, separators=(',', ':'))
                    f.write(';\n')
                print(f"Embedded sampledArchetypes into {geodata_path}")

    print(
        f"[{city_id}] sv_samples={len(sv_colors)}, bldgs={result['building_count']}, "
        f"treeCoverage={result['treeCoverage']}, housingDensity={result['housingDensity']['form']} "
        f"({result['housingDensity']['buildingsPerKm2']}/km2, cov={result['housingDensity']['footprintCoverage']})"
    )
    return result


def main():
    configs = load_city_configs()
    parser = argparse.ArgumentParser(description="Sample city, neighborhood, and landmark archetypes for a Go To Anywhere (GTA) city pack")
    parser.add_argument('--city', default='sanfrancisco', help="City pack ID to sample")
    parser.add_argument('--all', action='store_true', help="Sample all 20 city packs")
    parser.add_argument('--samples', type=int, default=12, help="Number of Street View + Satellite samples per city")
    parser.add_argument('--write-geodata', action='store_true', help="Embed sampledArchetypes into cities/<city>/city-geodata.js")
    args = parser.parse_args()
    if args.all:
        for cid in configs:
            sample_city_archetypes(cid, args.samples, args.write_geodata)
    else:
        sample_city_archetypes(args.city, args.samples, args.write_geodata)


if __name__ == '__main__':
    main()
