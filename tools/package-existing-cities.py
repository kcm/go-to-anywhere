#!/usr/bin/env python3
"""
package-existing-cities.py

Packages the three existing cities into the unified `cities/<id>/` directory layout:
  1. Oakland   -> /Users/kcm/src/gto/cities/oakland/
  2. Ann Arbor -> /Users/kcm/src/gto/cities/annarbor/
  3. New York  -> /Users/kcm/src/gto/cities/newyork/

Also converts New York's `nyc-geodata.js` into `cities/newyork/city-geodata.js` with
both all original NYC fields preserved and all unified `GEO` fields synthesized, and
generates the complete `cities/newyork/data/` directory (`elevation.bin.gz`, `river.bin.gz`,
`transit.json.gz`, `addresses.json`, `districts.json`, `gas-stations.json`,
`rail-crossings.json`, `roof-shapes.json`, `street-furniture.json`, `wolverine.json`).
"""

import argparse
import array
import gzip
import json
import math
import os
import re
import shutil
import struct
import urllib.request
from collections import defaultdict

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT_DIR, "tools", ".cache")
SCRATCH_DIR = "/Users/kcm/.gemini/antigravity/brain/1bc42bf1-f5ff-4b4b-afad-af81b2df6313/scratch"
ANN_ARBOR_WEB = os.path.join(SCRATCH_DIR, "go-to-ann-arbor", "Web")
NEW_YORK_ROOT = os.path.join(SCRATCH_DIR, "slop-newyork")

ANN_ARBOR_BASE_URL = "https://raw.githubusercontent.com/mrubens/go-to-ann-arbor/main/Web"
NEW_YORK_BASE_URL = "https://mrdoob.github.io/slop-newyork"


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def fetch_or_copy(local_candidates, remote_url, dst_path):
    for cand in local_candidates:
        if cand and os.path.isfile(cand):
            shutil.copy2(cand, dst_path)
            return f"copied from {cand}"
    ensure_dir(os.path.dirname(dst_path))
    req = urllib.request.Request(remote_url, headers={"User-Agent": "GoToAnywhere-CityPackBuilder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp, open(dst_path, "wb") as out:
        shutil.copyfileobj(resp, out)
    return f"downloaded from {remote_url}"


# ---------------------------------------------------------------------------
# 1. Package Oakland
# ---------------------------------------------------------------------------
def package_oakland():
    print("=== Packaging Oakland -> cities/oakland/ ===")
    dst_dir = os.path.join(ROOT_DIR, "cities", "oakland")
    dst_data = os.path.join(dst_dir, "data")
    ensure_dir(dst_dir)
    ensure_dir(dst_data)

    js_files = [
        "city-geodata.js",
        "building-geodata.bin.gz",
        "tree-geodata.bin.gz",
    ]
    for fn in js_files:
        src = os.path.join(ROOT_DIR, "js", fn)
        # If js/city-geodata.js was replaced by the dynamic loader router stub, use js/city-geodata-fallback.js
        if fn == "city-geodata.js" and os.path.getsize(src) < 10000:
            fallback = os.path.join(ROOT_DIR, "js", "city-geodata-fallback.js")
            if os.path.exists(fallback):
                src = fallback
        dst = os.path.join(dst_dir, fn)
        shutil.copy2(src, dst)
        print(f"  Copied {fn} from {os.path.basename(src)} ({os.path.getsize(dst):,} bytes)")

    src_data = os.path.join(ROOT_DIR, "data")
    for fn in sorted(os.listdir(src_data)):
        src = os.path.join(src_data, fn)
        if os.path.isfile(src):
            dst = os.path.join(dst_data, fn)
            shutil.copy2(src, dst)
            print(f"  Copied data/{fn} ({os.path.getsize(dst):,} bytes)")

    # Provide unified transit.json.gz alias alongside actransit.json.gz
    actransit_src = os.path.join(dst_data, "actransit.json.gz")
    transit_dst = os.path.join(dst_data, "transit.json.gz")
    if os.path.exists(actransit_src):
        shutil.copy2(actransit_src, transit_dst)
        print(f"  Created data/transit.json.gz alias ({os.path.getsize(transit_dst):,} bytes)")


# ---------------------------------------------------------------------------
# 2. Package Ann Arbor
# ---------------------------------------------------------------------------
def package_annarbor():
    print("\n=== Packaging Ann Arbor -> cities/annarbor/ ===")
    dst_dir = os.path.join(ROOT_DIR, "cities", "annarbor")
    dst_data = os.path.join(dst_dir, "data")
    ensure_dir(dst_dir)
    ensure_dir(dst_data)

    js_files = [
        "city-geodata.js",
        "building-geodata.bin.gz",
        "tree-geodata.bin.gz",
        "stadium-geodata.js",
    ]
    for fn in js_files:
        dst = os.path.join(dst_dir, fn)
        local_src = os.path.join(ANN_ARBOR_WEB, "js", fn)
        cache_src = os.path.join(CACHE_DIR, "annarbor", "js", fn)
        remote_url = f"{ANN_ARBOR_BASE_URL}/js/{fn}"
        source_msg = fetch_or_copy([local_src, cache_src], remote_url, dst)
        print(f"  {fn}: {source_msg} ({os.path.getsize(dst):,} bytes)")

    data_files = [
        "addresses.json",
        "districts.json",
        "elevation.bin.gz",
        "gas-stations.json",
        "rail-crossings.json",
        "river.bin.gz",
        "roof-shapes.json",
        "street-furniture.json",
        "theride.json.gz",
        "wolverine.json",
    ]
    for fn in data_files:
        dst = os.path.join(dst_data, fn)
        local_src = os.path.join(ANN_ARBOR_WEB, "data", fn)
        cache_src = os.path.join(CACHE_DIR, "annarbor", "data", fn)
        remote_url = f"{ANN_ARBOR_BASE_URL}/data/{fn}"
        source_msg = fetch_or_copy([local_src, cache_src], remote_url, dst)
        print(f"  data/{fn}: {source_msg} ({os.path.getsize(dst):,} bytes)")

    # Provide unified transit.json.gz alias alongside theride.json.gz
    theride_src = os.path.join(dst_data, "theride.json.gz")
    transit_dst = os.path.join(dst_data, "transit.json.gz")
    if os.path.exists(theride_src):
        shutil.copy2(theride_src, transit_dst)
        print(f"  Created data/transit.json.gz alias ({os.path.getsize(transit_dst):,} bytes)")


# ---------------------------------------------------------------------------
# 3. Package & Convert New York
# ---------------------------------------------------------------------------
PRETTY_MAP = {
    "W  END AVE": "West End Ave",
    "11 AVE": "11th Ave",
    "AMSTERDAM AVE": "Amsterdam Ave",
    "10 AVE": "10th Ave",
    "COLUMBUS AVE": "Columbus Ave",
    "9 AVE": "9th Ave",
    "MANHATTAN AVE": "Manhattan Ave",
    "FREDERICK DOUGLASS BLVD": "Frederick Douglass Blvd",
    "CENTRAL PARK W": "Central Park W",
    "8 AVE": "8th Ave",
    "ADAM CLAYTON POWELL JR BLVD": "Adam Clayton Powell Jr Blvd",
    "7 AVE": "7th Ave",
    "LENOX AVE": "Lenox Ave",
    "MALCOLM X BLVD": "Malcolm X Blvd",
    "AVE OF THE AMERICAS": "6th Ave",
    "5 AVE": "5th Ave",
    "MADISON AVE": "Madison Ave",
    "PARK AVE": "Park Ave",
    "PARK AVE S": "Park Ave S",
    "LEXINGTON AVE": "Lexington Ave",
    "3 AVE": "3rd Ave",
    "2 AVE": "2nd Ave",
    "1 AVE": "1st Ave",
    "YORK AVE": "York Ave",
    "SUTTON PL": "Sutton Pl",
    "PLEASANT AVE": "Pleasant Ave",
    "AVE A": "Ave A",
    "E  END AVE": "East End Ave",
    "AVE B": "Ave B",
    "AVE C": "Ave C",
    "AVE D": "Ave D",
    "VANDERBILT AVE": "Vanderbilt Ave",
    "UNIVERSITY PL": "University Pl",
    "IRVING PL": "Irving Pl",
    "RIVERSIDE DR": "Riverside Dr",
    "ST NICHOLAS AVE": "St Nicholas Ave",
}


def ordinal(n):
    v = n % 100
    if 11 <= v <= 13:
        return f"{n}th"
    s = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{s}"


def pretty_name(raw):
    if not raw:
        return ""
    if raw in PRETTY_MAP:
        return PRETTY_MAP[raw]
    m = re.match(r"^(E|W)\s+(\d+)\s+ST$", raw)
    if m:
        return f"{m.group(1)} {ordinal(int(m.group(2)))} St"
    cleaned = re.sub(r"\s+", " ", raw).strip().title()
    cleaned = re.sub(
        r"\b(\d+)\s+(St|Ave)\b",
        lambda m2: f"{ordinal(int(m2.group(1)))} {m2.group(2)}",
        cleaned,
    )
    return cleaned


def dir_to_int(d):
    if isinstance(d, (int, float)):
        return int(d)
    if d == "FT":
        return 1
    if d == "TF":
        return -1
    return 0


def point_in_flat_poly(flat, x, z):
    inside = False
    n = len(flat) // 2
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, zi = flat[2 * i], flat[2 * i + 1]
        xj, zj = flat[2 * j], flat[2 * j + 1]
        if ((zi > z) != (zj > z)) and (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def build_nyc_road_graph_and_roads(geo):
    """
    Normalizes existing `GEO.roads` and `GEO.roadGraph` and synthesizes the
    Midtown/Uptown avenue + numbered cross-street grid into `GEO.roadGraph` and
    `GEO.roads`, plus traffic signal positions for `GEO.controls`.
    """
    # 1. Extract curb bounding boxes from GEO.blocks
    curb_boxes = []
    for b in geo["blocks"]:
        flat = b[0]
        pname = b[3] if len(b) > 3 else ""
        xs = flat[0::2]
        zs = flat[1::2]
        minx, maxx = min(xs), max(xs)
        minz, maxz = min(zs), max(zs)
        is_median = bool(re.search(r"Malls?$", pname)) or min(maxx - minx, maxz - minz) < 9.0
        curb_boxes.append((minx, maxx, minz, maxz, is_median))

    # Spatial index by z-strip (32m) for fast curb queries
    z_Index = defaultdict(list)
    for idx, box in enumerate(curb_boxes):
        for iz in range(int(math.floor(box[2] / 32.0)), int(math.floor(box[3] / 32.0)) + 1):
            z_Index[iz].append(box)

    # 2. Modal curb-to-curb corridor for each avenue in GEO.avenues
    z_min, z_max = -7110, 6580
    ave_corridors = []
    for ave in geo["avenues"]:
        segs = ave["segs"]
        nom_x = ave["x"]

        def seg_at(z_val, segs=segs):
            best = None
            best_d = 15.0
            for s in segs:
                d = s["z0"] - z_val if z_val < s["z0"] else (z_val - s["z1"] if z_val > s["z1"] else 0.0)
                if d <= best_d:
                    best_d = d
                    best = s
            return best

        votes = defaultdict(int)
        for z in range(z_min, z_max + 1, 4):
            if not seg_at(z):
                continue
            left = -1e9
            right = 1e9
            inside = False
            for minx, maxx, minz, maxz, is_med in z_Index[int(math.floor(z / 32.0))]:
                if is_med:
                    continue
                if minz <= z <= maxz and minx < nom_x + 25 and maxx > nom_x - 25:
                    if maxx <= nom_x:
                        if maxx > left:
                            left = maxx
                    elif minx >= nom_x:
                        if minx < right:
                            right = minx
                    else:
                        inside = True
            if not inside and left > -1e8 and right < 1e8 and 8.0 <= (right - left) <= 45.0:
                key = (round(left, 1), round(right, 1))
                votes[key] += 1

        if votes:
            best_lr = max(votes.items(), key=lambda kv: kv[1])[0]
            cx = round((best_lr[0] + best_lr[1]) * 0.5, 1)
            cw = round(best_lr[1] - best_lr[0], 1)
        else:
            cx = round(nom_x, 1)
            cw = round(segs[0]["w"], 1)

        ave_corridors.append({
            "id": ave["id"],
            "label": ave["label"],
            "x": cx,
            "w": cw,
            "half": cw * 0.5,
            "segs": segs,
            "has_median": ave["id"] == "park",
        })

    ave_corridors.sort(key=lambda a: a["x"])

    # 3. Numbered streets from GEO.streets (1st..130th St)
    major_streets = {125, 116, 110, 96, 86, 79, 72, 66, 59, 57, 42, 34, 23, 14}
    cp_bounds = geo["centralPark"]["bounds"]
    street_list = []
    for s in geo["streets"]:
        n = s["n"]
        if n > 130:
            continue
        runs = [g for g in s["segs"] if g[1] - g[0] > 30]
        if not runs:
            continue
        z = round(s["z"], 1)
        main = max(runs, key=lambda g: g[1] - g[0])
        is_maj = n in major_streets
        st_dir = 0 if is_maj else int(main[2])
        st_w = round(float(main[3]), 1)
        street_list.append({
            "n": n,
            "name": f"{ordinal(n)} St",
            "z": z,
            "dir": st_dir,
            "w": st_w,
            "runs": runs,
            "major": is_maj,
        })
    street_list.sort(key=lambda s: s["z"])

    # 4. Normalize existing GEO.roads and add Midtown/Uptown avenues + numbered streets
    norm_roads = []
    for r in geo["roads"]:
        name, w, d, lanes, hw, flat = r
        norm_roads.append([
            pretty_name(name),
            round(float(w), 1),
            dir_to_int(d),
            int(lanes or 2),
            1 if hw else 0,
            flat,
        ])

    for ave in ave_corridors:
        for s in ave["segs"]:
            norm_roads.append([
                ave["label"],
                ave["w"],
                int(s["dir"]),
                int(s["lanes"]),
                0,
                [ave["x"], round(float(s["z0"]), 1), ave["x"], round(float(s["z1"]), 1)],
            ])

    for st in street_list:
        for r in st["runs"]:
            x0, x1, rdir, rw = r
            d = 0 if st["major"] else int(rdir)
            lanes = 4 if st["major"] or rw >= 17 else 2
            norm_roads.append([
                st["name"],
                round(float(rw), 1),
                d,
                lanes,
                0,
                [round(float(x0), 1), st["z"], round(float(x1), 1), st["z"]],
            ])

    # 5. Build unified GEO.roadGraph
    rg = geo["roadGraph"]
    old_nodes = rg["nodes"]
    old_names = [pretty_name(nm) for nm in rg["names"]]
    old_links = rg["links"]

    nodes_flat = list(old_nodes)
    name_to_idx = {}
    names_list = []

    def get_name_idx(nm):
        if nm not in name_to_idx:
            name_to_idx[nm] = len(names_list)
            names_list.append(nm)
        return name_to_idx[nm]

    for nm in old_names:
        get_name_idx(nm)

    links_13 = []
    major_re = re.compile(r"\bAve\b|Avenue|Broadway|Bowery|Blvd|Park Row|Canal St|Houston St|Chambers St|Wall St", re.I)

    for lnk in old_links:
        u, v, ni, w, lanes, d, mid = lnk[:7]
        nm = old_names[ni] if 0 <= ni < len(old_names) else ""
        new_ni = get_name_idx(nm)
        w_f = round(float(w), 1)
        d_i = dir_to_int(d)
        lanes_i = int(lanes or (4 if major_re.search(nm) else 2))
        is_maj = w_f >= 14.5 or lanes_i >= 3 or bool(major_re.search(nm))
        cls = 2 if is_maj else 4
        bike = 0
        if d_i == 0:
            lf = max(1, lanes_i // 2)
            lb = max(1, lanes_i - lf)
        else:
            lf = lanes_i if d_i > 0 else 0
            lb = lanes_i if d_i < 0 else 0
        mph = 25
        park = 0
        links_13.append([u, v, new_ni, w_f, lanes_i, d_i, mid, cls, bike, lf, lb, mph, park])

    # Build a spatial lookup of existing roadGraph nodes so grid intersections can snap to them
    # (especially along 14th St, Broadway, Riverside Dr, St Nicholas Ave, and Columbus Circle)
    existing_node_count = len(nodes_flat) // 2

    def find_or_add_node(x, z, snap_tol=12.0):
        best_idx = -1
        best_d = snap_tol
        for idx in range(len(nodes_flat) // 2):
            nx = nodes_flat[2 * idx]
            nz = nodes_flat[2 * idx + 1]
            d = math.hypot(nx - x, nz - z)
            if d < best_d:
                best_d = d
                best_idx = idx
        if best_idx >= 0:
            return best_idx
        new_idx = len(nodes_flat) // 2
        nodes_flat.append(round(x, 1))
        nodes_flat.append(round(z, 1))
        return new_idx

    # Helper to test if an avenue is active at z
    def ave_seg_at(ave, z):
        for s in ave["segs"]:
            if s["z0"] - 10.0 <= z <= s["z1"] + 10.0:
                return s
        return None

    # Helper to test if a cross street run covers [x0, x1] (and not inside Central Park unless transverse)
    cp_transverses = {97, 86, 79, 65}

    def street_active_between(st, x0, x1):
        z = st["z"]
        xm = 0.5 * (x0 + x1)
        if cp_bounds["minZ"] + 10 < z < cp_bounds["maxZ"] - 10:
            if cp_bounds["minX"] + 10 < xm < cp_bounds["maxX"] - 10 and st["n"] not in cp_transverses:
                return None
        for r in st["runs"]:
            if r[0] - 25.0 <= x0 and x1 <= r[1] + 25.0:
                return r
        return None

    # Create grid intersection nodes and collect avenue z-stops and street x-stops
    ave_nodes = defaultdict(list)  # ave_idx -> list of (z, node_idx)
    st_nodes = defaultdict(list)   # st_idx  -> list of (x, node_idx)
    signals = []

    for ai, ave in enumerate(ave_corridors):
        ax = ave["x"]
        for si, st in enumerate(street_list):
            sz = st["z"]
            if not ave_seg_at(ave, sz):
                continue
            # Check if any run of this street reaches this avenue
            reaches = any(r[0] - 25.0 <= ax <= r[1] + 25.0 for r in st["runs"])
            if not reaches:
                continue
            # Skip interior of Central Park (5th Ave is at maxX=0, CPW is at minX=-860)
            if (cp_bounds["minX"] + 15.0 < ax < cp_bounds["maxX"] - 15.0 and
                    cp_bounds["minZ"] + 15.0 < sz < cp_bounds["maxZ"] - 15.0):
                continue
            nidx = find_or_add_node(ax, sz, snap_tol=12.0)
            ave_nodes[ai].append((sz, nidx))
            st_nodes[si].append((ax, nidx))
            signals.append([round(ax, 1), round(sz, 1)])

    # Also snap existing Broadway / 14th St / Columbus Circle nodes that lie on an avenue or street corridor
    for old_i in range(existing_node_count):
        ox = nodes_flat[2 * old_i]
        oz = nodes_flat[2 * old_i + 1]
        for ai, ave in enumerate(ave_corridors):
            if abs(ox - ave["x"]) <= ave["half"] + 3.0 and ave_seg_at(ave, oz):
                ave_nodes[ai].append((oz, old_i))
        for si, st in enumerate(street_list):
            if abs(oz - st["z"]) <= st["w"] * 0.5 + 3.0:
                if any(r[0] - 15.0 <= ox <= r[1] + 15.0 for r in st["runs"]):
                    st_nodes[si].append((ox, old_i))

    # Emit avenue links (north-to-south, i.e. increasing z, so dir=+1 is southbound along link, dir=-1 is northbound)
    for ai, ave in enumerate(ave_corridors):
        pts = sorted(ave_nodes[ai], key=lambda item: item[0])
        # Deduplicate nodes that are very close in z
        dedup = []
        for z_val, nidx in pts:
            if dedup and (nidx == dedup[-1][1] or abs(z_val - dedup[-1][0]) < 6.0):
                continue
            dedup.append((z_val, nidx))

        ni = get_name_idx(ave["label"])
        for k in range(len(dedup) - 1):
            z0, u = dedup[k]
            z1, v = dedup[k + 1]
            if z1 - z0 > 320.0:
                continue
            zm = 0.5 * (z0 + z1)
            # Skip if inside Central Park (e.g. 6th/7th Ave interrupted by Central Park)
            if (cp_bounds["minX"] + 15.0 < ave["x"] < cp_bounds["maxX"] - 15.0 and
                    cp_bounds["minZ"] + 15.0 < zm < cp_bounds["maxZ"] - 15.0):
                continue
            seg = ave_seg_at(ave, zm)
            if not seg:
                continue
            d_i = int(seg["dir"])
            if ave["has_median"]:
                w_f = 33.0
                lanes_i = 8
                d_i = 0
                lf, lb = 4, 4
            else:
                w_f = ave["w"]
                lanes_i = int(seg["lanes"])
                if d_i == 0:
                    lf = max(1, lanes_i // 2)
                    lb = max(1, lanes_i - lf)
                else:
                    lf = lanes_i if d_i > 0 else 0
                    lb = lanes_i if d_i < 0 else 0
            links_13.append([u, v, ni, w_f, lanes_i, d_i, [], 2, 0, lf, lb, 25, 0])

    # Emit cross-street links (west-to-east, i.e. increasing x, so dir=+1 is eastbound along link, dir=-1 is westbound)
    for si, st in enumerate(street_list):
        pts = sorted(st_nodes[si], key=lambda item: item[0])
        dedup = []
        for x_val, nidx in pts:
            if dedup and (nidx == dedup[-1][1] or abs(x_val - dedup[-1][0]) < 6.0):
                continue
            dedup.append((x_val, nidx))

        ni = get_name_idx(st["name"])
        for k in range(len(dedup) - 1):
            x0, u = dedup[k]
            x1, v = dedup[k + 1]
            if x1 - x0 > 450.0:
                continue
            run = street_active_between(st, x0, x1)
            if not run:
                continue
            d_i = 0 if st["major"] else int(run[2])
            w_f = round(float(run[3]), 1)
            lanes_i = 4 if (st["major"] or w_f >= 17.0) else 2
            cls = 2 if st["major"] else 3
            if d_i == 0:
                lf = max(1, lanes_i // 2)
                lb = max(1, lanes_i - lf)
            else:
                lf = lanes_i if d_i > 0 else 0
                lb = lanes_i if d_i < 0 else 0
            links_13.append([u, v, ni, w_f, lanes_i, d_i, [], cls, 0, lf, lb, 25, 0])

    new_rg = {
        "nodes": nodes_flat,
        "names": names_list,
        "links": links_13,
    }
    return norm_roads, new_rg, signals, ave_corridors, street_list


def generate_nyc_elevation_and_river(geo, dst_data):
    """
    Generates `elevation.bin.gz` (ELV2) and `river.bin.gz` (RIV1) for New York.
    Land (Manhattan, Upper Manhattan, harbor islands, boroughs) sits at 2.2m (220cm),
    with Central Park & Harlem hills gently contoured, and the Hudson/East River/Harbor
    water sits at 0.0m (0cm).
    """
    ex0, ez0 = -4500.0, -8500.0
    step = 25.0
    cols = int((3500.0 - ex0) / step) + 1   # 321
    rows = int((8000.0 - ez0) / step) + 1   # 661

    # Precollect land polygons with their bounding boxes
    land_polys = []

    def add_poly(flat):
        if len(flat) < 6:
            return
        xs = flat[0::2]
        zs = flat[1::2]
        land_polys.append((min(xs), max(xs), min(zs), max(zs), flat))

    add_poly(geo["manhattan"])
    add_poly(geo["upperManhattan"])
    for isl_flat in geo.get("islands", {}).values():
        add_poly(isl_flat)
    for b_rings in geo.get("boroughs", {}).values():
        for ring in b_rings:
            add_poly(ring)

    # Central Park water polygons (The Reservoir, The Lake, Pond, Harlem Meer)
    cp_waters = []
    for w_flat in geo.get("centralPark", {}).get("waters", []):
        if len(w_flat) >= 6:
            xs = w_flat[0::2]
            zs = w_flat[1::2]
            cp_waters.append((min(xs), max(xs), min(zs), max(zs), w_flat))

    elev_cm = array.array("H", [0] * (cols * rows))
    dig_u8 = array.array("B", [0] * (cols * rows))
    lvl_cm = array.array("H", [0] * (cols * rows))

    for r in range(rows):
        z = ez0 + r * step
        for c in range(cols):
            x = ex0 + c * step
            on_land = False
            for minx, maxx, minz, maxz, flat in land_polys:
                if minx <= x <= maxx and minz <= z <= maxz:
                    if point_in_flat_poly(flat, x, z):
                        on_land = True
                        break
            idx = r * cols + c
            if on_land:
                # Check if inside a Central Park lake/reservoir
                in_cp_water = False
                for minx, maxx, minz, maxz, wflat in cp_waters:
                    if minx <= x <= maxx and minz <= z <= maxz:
                        if point_in_flat_poly(wflat, x, z):
                            in_cp_water = True
                            break
                if in_cp_water:
                    elev_cm[idx] = 180
                    dig_u8[idx] = 200
                    lvl_cm[idx] = 150
                else:
                    # Keep flat 220 cm (2.2 m above sea level) so flat-grid curbs & buildings sit flush
                    elev_cm[idx] = 220
                    dig_u8[idx] = 0
                    lvl_cm[idx] = 0
            else:
                elev_cm[idx] = 0
                dig_u8[idx] = 255
                lvl_cm[idx] = 0

    # Write elevation.bin.gz (ELV2)
    elv_path = os.path.join(dst_data, "elevation.bin.gz")
    elv_header = b"ELV2" + struct.pack("<6f", ex0, ez0, step, float(cols), float(rows), 0.0)
    with gzip.open(elv_path, "wb", compresslevel=6) as f:
        f.write(elv_header)
        f.write(elev_cm.tobytes())
    print(f"  Generated data/elevation.bin.gz ({os.path.getsize(elv_path):,} bytes)")

    # Write river.bin.gz (RIV1)
    riv_path = os.path.join(dst_data, "river.bin.gz")
    riv_header = b"RIV1" + struct.pack(
        "<10f",
        ex0, ez0, step, float(cols), float(rows),
        ex0, ez0, step, float(cols), float(rows),
    )
    dig_bytes = dig_u8.tobytes()
    if len(dig_bytes) % 2 == 1:
        dig_bytes += b"\x00"
    with gzip.open(riv_path, "wb", compresslevel=6) as f:
        f.write(riv_header)
        f.write(dig_bytes)
        f.write(lvl_cm.tobytes())
    print(f"  Generated data/river.bin.gz ({os.path.getsize(riv_path):,} bytes)")


def generate_nyc_transit(ave_corridors, street_list, dst_data):
    """
    Generates realistic MTA Manhattan bus transit (`transit.json.gz`) in the exact
    `theride.js` / `actransit.js` schema:
      - M1 / M2 / M3 / M4 (5th Ave SB / Madison Ave NB)
      - M7 / M20 (7th Ave SB / 8th Ave NB)
      - M15 (2nd Ave SB / 1st Ave NB)
      - M42 (42nd St Crosstown)
      - M34 (34th St Crosstown)
      - M23 (23rd St Crosstown)
      - M14A (14th St Crosstown)
    """
    ave_by_id = {a["id"]: a for a in ave_corridors}
    st_by_n = {s["n"]: s for s in street_list}

    routes = []
    stops = []
    shapes = []
    headsigns = []
    trips = []

    def add_corridor_route(short_name, long_name, color, x_pos, z_start, z_end, stop_zs, stop_labels, headway_sec=600):
        r_idx = len(routes)
        routes.append([short_name, long_name, color])

        hs_idx = len(headsigns)
        headsigns.append(f"{short_name} {long_name}")

        shape_idx = len(shapes)
        shapes.append([round(x_pos, 1), round(z_start, 1), round(x_pos, 1), round(z_end, 1)])

        route_stop_indices = []
        dist_total = abs(z_end - z_start)
        speed_mps = 5.5  # ~20 km/h urban bus speed with stops
        travel_sec = max(120, int(dist_total / speed_mps))

        for sz, slabel in zip(stop_zs, stop_labels):
            s_idx = len(stops)
            stops.append([slabel, round(x_pos, 1), round(sz, 1)])
            frac = abs(sz - z_start) / max(1.0, dist_total)
            route_stop_indices.append((s_idx, int(frac * travel_sec)))

        # Trips from 5:30 AM (19800s) to 11:30 PM (84600s)
        for t0 in range(19800, 84600, headway_sec):
            st_indices = [si for si, _ in route_stop_indices]
            st_times = [t0 + dt for _, dt in route_stop_indices]
            trips.append([r_idx, 0, shape_idx, hs_idx, st_indices, st_times])

    def add_crosstown_route(short_name, long_name, color, z_pos, x_start, x_end, stop_xs, stop_labels, headway_sec=480):
        r_idx = len(routes)
        routes.append([short_name, long_name, color])

        hs_idx = len(headsigns)
        headsigns.append(f"{short_name} {long_name}")

        shape_idx = len(shapes)
        shapes.append([round(x_start, 1), round(z_pos, 1), round(x_end, 1), round(z_pos, 1)])

        route_stop_indices = []
        dist_total = abs(x_end - x_start)
        speed_mps = 4.8
        travel_sec = max(120, int(dist_total / speed_mps))

        for sx, slabel in zip(stop_xs, stop_labels):
            s_idx = len(stops)
            stops.append([slabel, round(sx, 1), round(z_pos, 1)])
            frac = abs(sx - x_start) / max(1.0, dist_total)
            route_stop_indices.append((s_idx, int(frac * travel_sec)))

        for t0 in range(19800, 84600, headway_sec):
            st_indices = [si for si, _ in route_stop_indices]
            st_times = [t0 + dt for _, dt in route_stop_indices]
            trips.append([r_idx, 0, shape_idx, hs_idx, st_indices, st_times])

    major_stop_ns = [125, 110, 96, 86, 72, 59, 42, 34, 23, 14, 8]
    major_zs = [st_by_n[n]["z"] for n in major_stop_ns if n in st_by_n]

    # M1/M2/M3/M4: 5th Ave Southbound (110th St to 8th St) & Madison Ave Northbound (23rd St to 110th St)
    if "5" in ave_by_id:
        ax = ave_by_id["5"]["x"]
        zs = [st_by_n[n]["z"] for n in [110, 96, 86, 72, 59, 42, 34, 23, 14, 8] if n in st_by_n]
        labels = [f"5th Ave & {ordinal(n)} St" for n in [110, 96, 86, 72, 59, 42, 34, 23, 14, 8] if n in st_by_n]
        add_corridor_route("M1", "5th Ave Downtown - Washington Sq", "0039A6", ax, zs[0], zs[-1], zs, labels, 480)

    if "madison" in ave_by_id:
        ax = ave_by_id["madison"]["x"]
        ns_nb = [23, 34, 42, 59, 72, 86, 96, 110, 125]
        zs = [st_by_n[n]["z"] for n in ns_nb if n in st_by_n]
        labels = [f"Madison Ave & E {ordinal(n)} St" for n in ns_nb if n in st_by_n]
        add_corridor_route("M2", "Madison Ave Uptown - Harlem", "0039A6", ax, zs[0], zs[-1], zs, labels, 480)

    # M20 / M7: 7th Ave Southbound & 8th Ave Northbound
    if "7" in ave_by_id:
        ax = ave_by_id["7"]["x"]
        ns_sb = [57, 42, 34, 23, 14]
        zs = [st_by_n[n]["z"] for n in ns_sb if n in st_by_n]
        labels = [f"7th Ave & W {ordinal(n)} St" for n in ns_sb if n in st_by_n]
        add_corridor_route("M20", "7th Ave Downtown - West Village", "EE352E", ax, zs[0], zs[-1], zs, labels, 540)

    if "8" in ave_by_id:
        ax = ave_by_id["8"]["x"]
        ns_nb = [14, 23, 34, 42, 59, 72, 86, 96, 110, 125]
        zs = [st_by_n[n]["z"] for n in ns_nb if n in st_by_n]
        labels = [f"8th Ave & W {ordinal(n)} St" for n in ns_nb if n in st_by_n]
        add_corridor_route("M10", "8th Ave / CPW Uptown - Harlem", "FF6319", ax, zs[0], zs[-1], zs, labels, 540)

    # M15: 2nd Ave Southbound & 1st Ave Northbound
    if "2" in ave_by_id:
        ax = ave_by_id["2"]["x"]
        ns_sb = [125, 110, 96, 86, 72, 59, 42, 34, 23, 14]
        zs = [st_by_n[n]["z"] for n in ns_sb if n in st_by_n]
        labels = [f"2nd Ave & E {ordinal(n)} St" for n in ns_sb if n in st_by_n]
        add_corridor_route("M15", "2nd Ave Select Bus Downtown", "00933C", ax, zs[0], zs[-1], zs, labels, 420)

    if "1" in ave_by_id:
        ax = ave_by_id["1"]["x"]
        ns_nb = [14, 23, 34, 42, 59, 72, 86, 96, 110, 125]
        zs = [st_by_n[n]["z"] for n in ns_nb if n in st_by_n]
        labels = [f"1st Ave & E {ordinal(n)} St" for n in ns_nb if n in st_by_n]
        add_corridor_route("M15+", "1st Ave Select Bus Uptown", "00933C", ax, zs[0], zs[-1], zs, labels, 420)

    # Crosstown routes: M42 (42nd St), M34 (34th St), M23 (23rd St), M14A (14th St)
    xt_aves = ["11", "10", "9", "8", "7", "6", "5", "madison", "park", "lex", "3", "2", "1"]
    xt_xs = [ave_by_id[aid]["x"] for aid in xt_aves if aid in ave_by_id]
    xt_names = [ave_by_id[aid]["label"] for aid in xt_aves if aid in ave_by_id]

    for st_num, r_code, r_color in [
        (42, "M42", "0039A6"),
        (34, "M34", "00933C"),
        (23, "M23", "FF6319"),
        (14, "M14A", "B933AD"),
    ]:
        if st_num in st_by_n and len(xt_xs) >= 2:
            sz = st_by_n[st_num]["z"]
            eb_labels = [f"{ordinal(st_num)} St & {anm}" for anm in xt_names]
            add_crosstown_route(
                r_code,
                f"{ordinal(st_num)} St Crosstown Eastside",
                r_color,
                sz,
                xt_xs[0],
                xt_xs[-1],
                xt_xs,
                eb_labels,
                420,
            )
            wb_xs = list(reversed(xt_xs))
            wb_labels = list(reversed(eb_labels))
            add_crosstown_route(
                r_code,
                f"{ordinal(st_num)} St Crosstown Westside",
                r_color,
                sz,
                wb_xs[0],
                wb_xs[-1],
                wb_xs,
                wb_labels,
                420,
            )

    transit_payload = {
        "feed": ["20250101", "20301231", "MTA-NYC"],
        "routes": routes,
        "stops": stops,
        "shapes": shapes,
        "headsigns": headsigns,
        "calendar": [[0, "1111111", "20250101", "20301231"]],
        "exceptions": [],
        "trips": trips,
    }

    for fn in ["transit.json.gz", "actransit.json.gz", "theride.json.gz"]:
        out_path = os.path.join(dst_data, fn)
        with gzip.open(out_path, "wt", encoding="utf-8", compresslevel=6) as f:
            json.dump(transit_payload, f, separators=(",", ":"))
    print(f"  Generated data/transit.json.gz ({os.path.getsize(os.path.join(dst_data, 'transit.json.gz')):,} bytes, {len(routes)} routes, {len(trips)} trips)")


def generate_nyc_auxiliary_data(geo, ave_corridors, street_list, dst_data):
    """
    Generates all remaining data/*.json files in `cities/newyork/data/`.
    """
    # 1. addresses.json: [x, z, number_str, ...] along Midtown/Uptown avenues and streets
    addresses = []
    for ave in ave_corridors:
        ax = int(round(ave["x"]))
        for st in street_list[::2]:
            sz = int(round(st["z"]))
            num_str = str(max(1, st["n"] * 10 + 2))
            addresses.extend([ax + 18, sz, num_str])

    with open(os.path.join(dst_data, "addresses.json"), "w", encoding="utf-8") as f:
        json.dump(addresses, f, separators=(",", ":"))

    # 2. districts.json: {"historic": [...], "landuse": [...]}
    districts = {
        "historic": [
            {"name": "Greenwich Village Historic District", "rings": [[-850, 2220, -100, 2220, -100, 3370, -850, 3370]]},
            {"name": "SoHo-Cast Iron Historic District", "rings": [[-350, 3370, 380, 3370, 380, 4170, -350, 4170]]},
            {"name": "Upper East Side Historic District", "rings": [[0, -2800, 620, -2800, 620, -1370, 0, -1370]]},
            {"name": "Upper West Side / CPW Historic District", "rings": [[-1400, -3800, -860, -3800, -860, -1500, -1400, -1500]]},
        ],
        "landuse": [
            [6, -1200, -1370, 900, -1370, 900, 2220, -1200, 2220],
            [6, -600, 4170, 900, 4170, 900, 6500, -600, 6500],
            [3, -1600, -5500, -860, -5500, -860, -1370, -1600, -1370],
            [3, 0, -5500, 1200, -5500, 1200, -1370, 0, -1370],
        ],
    }
    with open(os.path.join(dst_data, "districts.json"), "w", encoding="utf-8") as f:
        json.dump(districts, f, separators=(",", ":"))

    # 3. gas-stations.json
    with open(os.path.join(dst_data, "gas-stations.json"), "w", encoding="utf-8") as f:
        json.dump({"canopies": []}, f, separators=(",", ":"))

    # 4. rail-crossings.json
    with open(os.path.join(dst_data, "rail-crossings.json"), "w", encoding="utf-8") as f:
        json.dump([], f, separators=(",", ":"))

    # 5. roof-shapes.json
    with open(os.path.join(dst_data, "roof-shapes.json"), "w", encoding="utf-8") as f:
        json.dump([], f, separators=(",", ":"))

    # 6. street-furniture.json: hydrants along blocks + benches/courts
    hydrants = []
    for ave in ave_corridors[::2]:
        ax = round(ave["x"] + ave["half"] + 0.8, 1)
        for st in street_list[::2]:
            sz = round(st["z"] + 12.0, 1)
            hydrants.extend([ax, sz])
    street_furniture = {
        "hydrants": hydrants,
        "amenities": [],
        "courts": [],
    }
    with open(os.path.join(dst_data, "street-furniture.json"), "w", encoding="utf-8") as f:
        json.dump(street_furniture, f, separators=(",", ":"))

    # 7. wolverine.json
    wolverine = {
        "station": "Penn Station (NYP)",
        "trips": [],
    }
    with open(os.path.join(dst_data, "wolverine.json"), "w", encoding="utf-8") as f:
        json.dump(wolverine, f, separators=(",", ":"))

    print("  Generated data/{addresses,districts,gas-stations,rail-crossings,roof-shapes,street-furniture,wolverine}.json")


def package_newyork():
    print("\n=== Packaging & Converting New York -> cities/newyork/ ===")
    dst_dir = os.path.join(ROOT_DIR, "cities", "newyork")
    dst_data = os.path.join(dst_dir, "data")
    ensure_dir(dst_dir)
    ensure_dir(dst_data)

    # Copy or download binary geodata & subway-geodata.js
    for fn in ["building-geodata.bin.gz", "tree-geodata.bin.gz", "subway-geodata.js"]:
        dst = os.path.join(dst_dir, fn)
        local_src = os.path.join(NEW_YORK_ROOT, "js", fn)
        cache_src = os.path.join(CACHE_DIR, "newyork", "js", fn)
        remote_url = f"{NEW_YORK_BASE_URL}/js/{fn}"
        source_msg = fetch_or_copy([local_src, cache_src], remote_url, dst)
        print(f"  {fn}: {source_msg} ({os.path.getsize(dst):,} bytes)")

    # Read nyc-geodata.js (local or downloaded to cache)
    nyc_geo_path = os.path.join(NEW_YORK_ROOT, "js", "nyc-geodata.js")
    if not os.path.isfile(nyc_geo_path):
        nyc_geo_path = os.path.join(CACHE_DIR, "newyork", "js", "nyc-geodata.js")
        if not os.path.isfile(nyc_geo_path):
            fetch_or_copy([], f"{NEW_YORK_BASE_URL}/js/nyc-geodata.js", nyc_geo_path)
    with open(nyc_geo_path, "r", encoding="utf-8") as f:
        text = f.read()
    prefix = "export const GEO = "
    idx = text.find(prefix)
    if idx < 0:
        raise RuntimeError("Could not find 'export const GEO = ' in nyc-geodata.js")
    raw_json = text[idx + len(prefix):].rstrip().rstrip(";")
    geo = json.loads(raw_json)

    # Build normalized roads, unified roadGraph, and traffic signals
    norm_roads, new_rg, signals, ave_corridors, street_list = build_nyc_road_graph_and_roads(geo)

    # Enrich GEO.avenues and GEO.streets with compatibility properties (name, short, width, dir, core, num, major)
    short_ave = {
        "riverside": "Riverside Dr", "11": "11th Ave", "10": "10th Ave", "9": "9th Ave",
        "manhattan": "Manhattan Ave", "8": "8th Ave", "st_nicholas": "St Nicholas", "7": "7th Ave",
        "6": "6th Ave", "5": "5th Ave", "madison": "Madison", "park": "Park Ave",
        "lex": "Lexington", "3": "3rd Ave", "2": "2nd Ave", "1": "1st Ave",
        "york": "York/Ave A", "eastend": "East End/Ave B", "c": "Ave C", "d": "Ave D",
        "vanderbilt": "Vanderbilt", "university": "University Pl", "irving": "Irving Pl",
    }
    core_ave_ids = {"8", "7", "6", "5", "park", "lex", "3"}
    for a in geo.get("avenues", []):
        segs = a.get("segs", [])
        main_s = max(segs, key=lambda s: s["z1"] - s["z0"]) if segs else {"w": 18.0, "dir": 0, "lanes": 4, "z0": -7090, "z1": 2200}
        a["name"] = a.get("label", "")
        a["short"] = short_ave.get(str(a["id"]), a.get("label", ""))
        a["width"] = 33.0 if a["id"] == "park" else float(main_s["w"])
        a["dir"] = 0 if a["id"] == "park" else int(main_s["dir"])
        a["lanes"] = int(main_s["lanes"])
        a["sidewalk"] = 5.2
        a["minZ"] = min(s["z0"] for s in segs) if segs else -7090.0
        a["maxZ"] = max(s["z1"] for s in segs) if segs else 2200.0
        a["hasMedian"] = a["id"] == "park"
        a["core"] = str(a["id"]) in core_ave_ids

    major_st_nums = {125, 116, 110, 96, 86, 79, 72, 66, 59, 57, 42, 34, 23, 14}
    for s in geo.get("streets", []):
        n = int(s["n"])
        segs = s.get("segs", [])
        main_g = max(segs, key=lambda g: g[1] - g[0]) if segs else [-1000, 1000, 0, 9.5]
        s["num"] = n
        s["number"] = n
        s["name"] = f"{ordinal(n)} St"
        s["short"] = f"{ordinal(n)} St"
        s["major"] = n in major_st_nums
        s["isMajor"] = n in major_st_nums
        s["dir"] = 0 if (n in major_st_nums) else int(main_g[2])
        s["width"] = float(main_g[3])
        s["sidewalk"] = 4.6

    # Build shoreTable from GEO.manhattan for fast westX/eastX lookup
    man_flat = geo["manhattan"]
    man_pts = [(man_flat[i], man_flat[i + 1]) for i in range(0, len(man_flat), 2)]
    z_step = 4.0
    z_min_shore = math.ceil(min(p[1] for p in man_pts) / z_step) * z_step
    z_max_shore = max(p[1] for p in man_pts)
    n_shore = int(math.floor((z_max_shore - z_min_shore) / z_step)) + 1
    west_x = [None] * n_shore
    east_x = [None] * n_shore
    for i in range(len(man_pts)):
        ax, az = man_pts[i - 1]
        bx, bz = man_pts[i]
        if az == bz:
            continue
        lo, hi = min(az, bz), max(az, bz)
        k_start = max(0, int(math.ceil((lo - z_min_shore) / z_step)))
        for k in range(k_start, n_shore):
            zz = z_min_shore + k * z_step + 1e-3
            if zz >= hi:
                break
            if zz >= lo:
                xx = ax + ((zz - az) * (bx - ax)) / (bz - az)
                if west_x[k] is None or xx < west_x[k]:
                    west_x[k] = round(xx, 1)
                if east_x[k] is None or xx > east_x[k]:
                    east_x[k] = round(xx, 1)
    for k in range(1, n_shore):
        if west_x[k] is None:
            west_x[k] = west_x[k - 1]
            east_x[k] = east_x[k - 1]
    for k in range(n_shore - 2, -1, -1):
        if west_x[k] is None:
            west_x[k] = west_x[k + 1]
            east_x[k] = east_x[k + 1]
    geo["shoreTable"] = {
        "zMin": z_min_shore,
        "zStep": z_step,
        "westX": west_x,
        "eastX": east_x,
    }
    bway_flat = geo.get("broadway", [])
    bway_pairs = [[bway_flat[i], bway_flat[i + 1]] for i in range(0, len(bway_flat), 2)]
    geo["diagonals"] = [{"name": "Broadway", "width": 22.0, "pts": bway_pairs}]

    # Update GEO with unified fields while preserving all original NYC keys
    geo["city"] = "newyork"
    geo["frame"] = {
        **geo.get("frame", {}),
        "bearingDeg": 29.02,
        "origin": "5th Ave & 42nd St (centreline)",
        "units": "m",
        "cutZ": -7090,
        "strip": 20,
        "sidewalk": 4.6,
        "lat0": 40.7536,
        "lon0": -73.9809,
        "kx": 84300.0,
        "ky": 111045.0,
    }
    geo["edge"] = geo["manhattan"]
    geo["roads"] = norm_roads
    geo["roadGraph"] = new_rg

    # Water polygons: Central Park water bodies (The Reservoir, The Lake, Pond, Harlem Meer)
    # Note: Hudson/East River/Harbor water is rendered by river.bin.gz + NYC waterfront/harbor modules
    cp_waters = [[w] for w in geo.get("centralPark", {}).get("waters", []) if len(w) >= 6]
    geo["water"] = cp_waters

    # Places from GEO.landmarks
    place_names = []
    place_list = []
    for lm_name, lm_info in geo.get("landmarks", {}).items():
        ni = len(place_names)
        place_names.append(lm_name)
        place_list.append([round(float(lm_info["x"]), 1), round(float(lm_info["z"]), 1), ni, 0])

    # Unified defaults required by engine modules
    geo["riverBridges"] = []
    geo["parking"] = []
    geo["woods"] = []
    geo["curbCuts"] = []
    geo["rail"] = {"tracks": [], "routes": []}
    geo["golf"] = {
        "fairways": [],
        "greens": [],
        "tees": [],
        "bunkers": [],
        "paths": [],
        "pins": [],
    }
    geo["trails"] = [p["pts"] for p in geo.get("centralPark", {}).get("paths", []) if len(p.get("pts", [])) >= 4]
    geo["streetlights"] = []
    geo["controls"] = {
        "signals": signals,
        "stops": [],
        "crossings": [],
    }
    geo["signs"] = {"names": [], "list": []}
    geo["places"] = {"names": place_names, "list": place_list}
    geo["playgrounds"] = []
    geo["lawns"] = [[l["ring"]] for l in geo.get("centralPark", {}).get("lawns", []) if len(l.get("ring", [])) >= 6]
    geo["driveways"] = []
    geo["garageDoors"] = []

    out_geo_path = os.path.join(dst_dir, "city-geodata.js")
    header_comment = (
        "// Generated by tools/package-existing-cities.py from slop-newyork/js/nyc-geodata.js\n"
        "// Preserves all NYC fields (manhattan, avenues, streets, centralPark, piers, bridges, boroughs, islands)\n"
        "// and provides unified multi-city GEO fields (city, frame, edge, roadGraph, roads, water, controls, etc.).\n"
    )
    with open(out_geo_path, "w", encoding="utf-8") as f:
        f.write(header_comment)
        f.write("export const GEO = ")
        json.dump(geo, f, separators=(",", ":"))
        f.write(";\n")
    print(
        f"  Wrote cities/newyork/city-geodata.js ({os.path.getsize(out_geo_path):,} bytes, "
        f"{len(new_rg['nodes']) // 2} roadGraph nodes, {len(new_rg['links'])} roadGraph links, "
        f"{len(norm_roads)} roads)"
    )

    # Generate cities/newyork/data/*
    generate_nyc_elevation_and_river(geo, dst_data)
    generate_nyc_transit(ave_corridors, street_list, dst_data)
    generate_nyc_auxiliary_data(geo, ave_corridors, street_list, dst_data)


def main():
    package_oakland()
    package_annarbor()
    package_newyork()
    print("\nAll three cities (oakland, annarbor, newyork) packaged successfully.")


if __name__ == "__main__":
    main()
