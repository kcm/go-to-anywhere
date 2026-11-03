#!/usr/bin/env python3
"""
tools/sample-city-archetypes.py

Samples street-level building archetypes, neighborhood character profiles, and
landmark structural specifications for a Go To Anywhere (GTA) city pack by combining:
  1. OpenStreetMap building:material, building:colour, roof:shape, roof:material,
     roof:colour, building:architecture, height/levels, and 3D building:part
     sub-volumes from tools/.cache/<city>_buildings.json and <city>_infra.json.
  2. Spatial neighborhood clustering around each city pack's neighborhood areas
     (computing per-neighborhood wall materials, roof shapes, pitches, facade
     palettes, and mid-rise height/storefront profiles).
  3. Landmark site inspection around each city pack's landmarks (extracting
     footprint dimensions w/d/h, multi-part 3D massing tiers, architectural
     form, and facade/roof/crown colors).
  4. Optional Google Street View Static API facade & landmark sampling (when
     GOOGLE_MAPS_API_KEY is set in the environment), using +12 deg pitch for
     neighborhood streetscapes and +22 deg pitch aimed at landmark coordinates.

Writes the resulting regional, neighborhood, and landmark archetype profile to:
  - cities/<city>/data/archetypes.json (when cities/<city>/ exists)
  - Optionally embeds GEO.archetypes into cities/<city>/city-geodata.js (--write-geodata)

Usage:
  python3 tools/sample-city-archetypes.py --city sanfrancisco
  GOOGLE_MAPS_API_KEY=... python3 tools/sample-city-archetypes.py --city paris --samples 24
"""

import argparse
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


def load_city_configs():
    spec = importlib.util.spec_from_file_location(
        'build_city_pack',
        os.path.join(ROOT_DIR, 'tools', 'build-city-pack.py')
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.CITY_CONFIGS


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
    tourism = str(tags.get('tourism') or '').lower()
    arch = str(tags.get('building:architecture') or '').lower()
    rshape = str(tags.get('roof:shape') or '').lower()

    if 'opera house' in nl or 'canada place' in nl:
        return 'opera_sails'
    if 'eiffel' in nl or 'tokyo tower' in nl or 'sutro' in nl or 'skytree' in nl or man_made == 'communications_tower':
        return 'lattice_tower'
    if 'space needle' in nl or 'harbour centre' in nl:
        return 'observation_needle'
    if 'christ the redeemer' in nl or 'cristo' in nl or 'sugarloaf' in nl:
        return 'mountain_statue'
    if 'eye' in nl or 'wheel' in nl:
        return 'ferris_wheel'
    if 'sagrada' in nl or 'notre-dame' in nl or 'cathedral' in nl or 'basilica' in nl and 'sacre' not in nl and 'mark' not in nl:
        return 'cathedral_spires'
    if 'sacre-coeur' in nl or 'st. mark\'s basilica' in nl or 'city hall' in nl or 'state house' in nl or rshape in ('dome', 'onion'):
        return 'dome_palace'
    if 'big ben' in nl or 'campanile' in nl or 'custom house' in nl or 'ferry building' in nl or 'clock' in nl:
        return 'clock_tower'
    if 'arc de triomphe' in nl or 'arch' in nl and 'bridge' not in nl:
        return 'triumphal_arch'
    if 'senso-ji' in nl or 'torii' in nl or 'dragon gate' in nl or 'meiji' in nl or btype == 'temple':
        return 'torii_temple'
    if 'harbour bridge' in nl or 'rialto' in nl:
        return 'arch_bridge'
    if 'zakim' in nl:
        return 'cable_stayed_bridge'
    if 'michigan ave' in nl or 'bascule' in nl:
        return 'bascule_bridge'
    if 'bridge' in nl:
        return 'suspension_bridge'
    if 'willis' in nl or 'sears' in nl or 'empire state' in nl:
        return 'stepped_bundled_tube'
    if 'bank of china' in nl or 'ifc' in nl or 'shard' in nl:
        return 'diagrid_prism'
    if 'castle' in nl or 'fort' in nl:
        return 'fortress_bastion'
    if 'stadium' in nl or 'park' in nl and ('fenway' in nl or 'oracle' in nl or 'maracana' in nl):
        return 'stadium_bowl'
    if 'doge' in nl or 'palazzo' in nl or 'rijksmuseum' in nl or 'anne frank' in nl or 'royal palace' in nl:
        return 'canal_palazzo'
    if 'bo-kaap' in nl or 'painted ladies' in nl or 'batllo' in nl or 'quincy market' in nl or 'pike place' in nl or 'shibuya' in nl:
        return 'historic_row'
    if h >= 120:
        return 'stepped_bundled_tube'
    if arch in ('neoclassical', 'beaux-arts', 'classical'):
        return 'dome_palace'
    return 'canal_palazzo'


def sample_street_view_colors(lat, lon, heading, api_key, pitch=12):
    """Fetch a 256x256 Street View facade crop and return dominant RGB hex."""
    try:
        from PIL import Image
    except ImportError:
        return None
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_img = os.path.join(CACHE_DIR, f"sv_{lat:.5f}_{lon:.5f}_{int(heading)}_p{int(pitch)}.jpg")
    if not os.path.exists(cache_img):
        url = (
            f"https://maps.googleapis.com/maps/api/streetview"
            f"?size=256x256&location={lat:.6f},{lon:.6f}"
            f"&heading={int(heading)}&pitch={int(pitch)}&fov=55&source=outdoor&key={api_key}"
        )
        res = subprocess.run(['curl', '-sS', '-f', '-L', '-o', cache_img, url], check=False)
        if res.returncode != 0 or not os.path.exists(cache_img):
            return None
    try:
        img = Image.open(cache_img).convert('RGB')
        w, h = img.size
        band = img.crop((int(w * 0.2), int(h * 0.22), int(w * 0.8), int(h * 0.70))).resize((16, 16))
        pixels = list(band.getdata())
        valid = []
        for r, g, b in pixels:
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

    def ll_to_xz(lat, lon):
        return (lon - lon0) * lon_m, (lat0 - lat) * lat_m

    def xz_to_ll(x, z):
        return lat0 - z / lat_m, lon0 + x / lon_m

    neighborhoods_cfg = cfg.get('neighborhood_places', []) if cfg else []
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

                # Assign to nearest / containing neighborhood(s)
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

            # Check proximity to any city landmark (both building and building:part)
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

    api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
    sv_colors = []
    if api_key and num_sv_samples > 0:
        # Sample Street View across neighborhoods and landmarks
        for i, (nb_id, nb) in enumerate(list(nb_stats.items())[:num_sv_samples]):
            lat, lon = xz_to_ll(nb['x'], nb['z'])
            c_hex = sample_street_view_colors(lat, lon, (i * 90) % 360, api_key, pitch=12)
            if c_hex is not None:
                sv_colors.append(c_hex)
                wall_colors[c_hex] += 2
                nb['wall_colors'][c_hex] += 2

        for lm_name, lm in lm_stats.items():
            # Sample from 55m south of landmark pitched +22 deg north toward landmark
            lat, lon = xz_to_ll(lm['x'], lm['z'] + 55.0)
            c_hex = sample_street_view_colors(lat, lon, 0, api_key, pitch=22)
            if c_hex is not None:
                lm['colors'][c_hex] += 2

    city_summary = summarize_bucket(wall_counts, roof_counts, wall_colors, roof_colors, all_heights)

    neighborhood_profiles = {}
    for nb_id, nb in nb_stats.items():
        if not nb['heights'] and not nb['walls']:
            continue
        prof = summarize_bucket(nb['walls'], nb['roofs'], nb['wall_colors'], nb['roof_colors'], nb['heights'])
        prof['name'] = nb['name']
        prof['center'] = [nb['x'], nb['z']]
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
        'neighborhoods': neighborhood_profiles,
        'landmarks': landmark_profiles,
    }

    city_data_dir = os.path.join(ROOT_DIR, 'cities', city_id, 'data')
    if os.path.isdir(city_data_dir):
        out_path = os.path.join(city_data_dir, 'archetypes.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Wrote sampled city + neighborhood + landmark archetypes to {out_path}")

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

    print(json.dumps({
        'city': city_id,
        'building_count': result['building_count'],
        'walls': result['walls'],
        'roofs': result['roofs'],
        'neighborhoods_sampled': len(neighborhood_profiles),
        'landmarks_sampled': len(landmark_profiles),
        'sample_neighborhoods': dict(list(neighborhood_profiles.items())[:4]),
        'sample_landmarks': dict(list(landmark_profiles.items())[:5]),
    }, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser(description="Sample city, neighborhood, and landmark archetypes for a Go To Anywhere (GTA) city pack")
    parser.add_argument('--city', default='sanfrancisco', help="City pack ID to sample")
    parser.add_argument('--samples', type=int, default=12, help="Number of Street View facade samples if GOOGLE_MAPS_API_KEY is set")
    parser.add_argument('--write-geodata', action='store_true', help="Embed sampledArchetypes into cities/<city>/city-geodata.js")
    args = parser.parse_args()
    sample_city_archetypes(args.city, args.samples, args.write_geodata)


if __name__ == '__main__':
    main()
