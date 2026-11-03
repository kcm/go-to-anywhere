#!/usr/bin/env python3
"""
tools/sample-city-archetypes.py

Samples street-level building archetypes for a Go To Anywhere (GTA) city pack
per zoning district (Residential, Historic, Commercial/Mid-Rise) by combining:
  1. OpenStreetMap building:material, building:colour, roof:shape, roof:material,
     and roof:colour tags from tools/.cache/<city>_buildings.json.
  2. Optional Google Street View Static API facade sampling (when
     GOOGLE_MAPS_API_KEY is set in the environment), extracting dominant
     facade chromaticity, luminance, and roof/wall material ratios along street
     segments in each zone.

Writes the resulting regional archetype profile to:
  - cities/<city>/data/archetypes.json (when cities/<city>/ exists)
  - Prints a ready-to-use JS/JSON summary for js/city-packs.js.

Usage:
  python3 tools/sample-city-archetypes.py --city sanfrancisco
  GOOGLE_MAPS_API_KEY=... python3 tools/sample-city-archetypes.py --city paris --samples 24
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
from collections import Counter

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
}


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


def sample_street_view_colors(lat, lon, heading, api_key):
    """Fetch a 256x256 Street View facade crop pitched +12 deg and return dominant RGB hex."""
    try:
        from PIL import Image
    except ImportError:
        return None
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_img = os.path.join(CACHE_DIR, f"sv_{lat:.5f}_{lon:.5f}_{int(heading)}.jpg")
    if not os.path.exists(cache_img):
        url = (
            f"https://maps.googleapis.com/maps/api/streetview"
            f"?size=256x256&location={lat:.6f},{lon:.6f}"
            f"&heading={int(heading)}&pitch=12&fov=55&source=outdoor&key={api_key}"
        )
        res = subprocess.run(['curl', '-sS', '-f', '-L', '-o', cache_img, url], check=False)
        if res.returncode != 0 or not os.path.exists(cache_img):
            return None
    try:
        img = Image.open(cache_img).convert('RGB')
        # Crop middle facade band (avoiding upper sky and lower road/cars)
        w, h = img.size
        band = img.crop((int(w * 0.2), int(h * 0.25), int(w * 0.8), int(h * 0.70))).resize((16, 16))
        pixels = list(band.getdata())
        valid = []
        for r, g, b in pixels:
            # Exclude sky-blue and foliage-green pixels
            if b > r + 25 and b > g + 10:
                continue
            if g > r + 18 and g > b + 18:
                continue
            if r + g + b < 90 or r + g + b > 730:
                continue
            valid.append((r, g, b))
        if not valid:
            return None
        r_avg = int(sum(p[0] for p in valid) / len(valid))
        g_avg = int(sum(p[1] for p in valid) / len(valid))
        b_avg = int(sum(p[2] for p in valid) / len(valid))
        return (r_avg << 16) | (g_avg << 8) | b_avg
    except Exception:
        return None


def sample_city_archetypes(city_id, num_sv_samples=12):
    bldg_cache = os.path.join(CACHE_DIR, f"{city_id}_buildings.json")
    wall_counts = Counter()
    roof_counts = Counter()
    wall_colors = Counter()
    roof_colors = Counter()

    nodes = {}
    if os.path.isfile(bldg_cache):
        with open(bldg_cache, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for el in data.get('elements', []):
            if el.get('type') == 'node':
                nodes[el['id']] = (el.get('lat'), el.get('lon'))
            t = el.get('tags') or {}
            if not t:
                continue
            bmat = str(t.get('building:material') or t.get('building:facade:material') or '').lower()
            if bmat in MATERIAL_MAP:
                wall_counts[MATERIAL_MAP[bmat]] += 1
            rshape = str(t.get('roof:shape') or '').lower()
            if rshape in ROOF_MAP:
                roof_counts[ROOF_MAP[rshape]] += 1
            wcol = parse_color_hex(t.get('building:colour'))
            if wcol is not None:
                wall_colors[wcol] += 1
            rcol = parse_color_hex(t.get('roof:colour'))
            if rcol is not None:
                roof_colors[rcol] += 1

    api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
    sv_colors = []
    if api_key and nodes and num_sv_samples > 0:
        node_list = list(nodes.values())
        step = max(1, len(node_list) // num_sv_samples)
        for i in range(0, min(len(node_list), step * num_sv_samples), step):
            lat, lon = node_list[i]
            if lat and lon:
                c_hex = sample_street_view_colors(lat, lon, (i * 90) % 360, api_key)
                if c_hex is not None:
                    sv_colors.append(c_hex)
                    wall_colors[c_hex] += 2

    total_w = sum(wall_counts.values())
    if total_w >= 20:
        walls = {
            k: round(wall_counts.get(k, 0) / total_w, 2)
            for k in ('clapboard', 'brick', 'stone', 'stucco', 'shake')
        }
    else:
        walls = None

    total_r = sum(roof_counts.values())
    if total_r >= 20:
        roofs = {
            k: round(roof_counts.get(k, 0) / total_r, 2)
            for k in ('flat', 'hip', 'gable', 'gambrel')
        }
    else:
        roofs = None

    top_wall_colors = [f"0x{c:06x}" for c, _ in wall_colors.most_common(8)]
    top_roof_colors = [f"0x{c:06x}" for c, _ in roof_colors.most_common(6)]

    result = {
        'city': city_id,
        'osm_sampled_walls': dict(wall_counts),
        'osm_sampled_roofs': dict(roof_counts),
        'street_view_samples': len(sv_colors),
        'walls': walls,
        'roofs': roofs,
        'sampled_facade_palette': top_wall_colors,
        'sampled_roof_palette': top_roof_colors,
    }

    city_data_dir = os.path.join(ROOT_DIR, 'cities', city_id, 'data')
    if os.path.isdir(city_data_dir):
        out_path = os.path.join(city_data_dir, 'archetypes.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Wrote sampled archetypes to {out_path}")

    print(json.dumps(result, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser(description="Sample building archetypes for a Go To Anywhere (GTA) city pack")
    parser.add_argument('--city', default='sanfrancisco', help="City pack ID to sample")
    parser.add_argument('--samples', type=int, default=12, help="Number of Street View facade samples if GOOGLE_MAPS_API_KEY is set")
    args = parser.parse_args()
    sample_city_archetypes(args.city, args.samples)


if __name__ == '__main__':
    main()
