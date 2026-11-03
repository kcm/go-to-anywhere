#!/usr/bin/env python3
"""
Build or install local city geodata packs for Go To Anywhere (GTA) (`cities/<city>/` and `cities/<city>/data/`)
from OpenStreetMap (Overpass API) + AWS Terrain Tiles + GTFS:
  - cities/<city>/city-geodata.js         (GEO: streets, roadGraph, blocks, parks, water, rail, bridges, places, signs, lawns, landmarks, etc.)
  - cities/<city>/building-geodata.bin.gz (NYB1 binary building footprints, heights, and kinds)
  - cities/<city>/tree-geodata.bin.gz     (NYT2 binary street & park trees with species and heights)
  - cities/<city>/data/elevation.bin.gz   (ELV2 binary terrain heightmap from AWS Terrain Tiles)
  - cities/<city>/data/river.bin.gz       (RIV1 binary bed dig mask + water surface levels)
  - cities/<city>/data/addresses.json     (house numbers along streets)
  - cities/<city>/data/districts.json     (historic districts & landuse polygons)
  - cities/<city>/data/gas-stations.json  (fuel station canopies)
  - cities/<city>/data/rail-crossings.json(grade crossings along rail lines)
  - cities/<city>/data/roof-shapes.json   (explicit OSM roof shapes + churches)
  - cities/<city>/data/street-furniture.json (fire hydrants, park benches/tables/shelters, sports courts)
  - cities/<city>/data/wolverine.json     (Amtrak timetable from cached tools/.cache/amtrak_gtfs.zip with fallback)
  - cities/<city>/data/transit.json.gz    (Bus routes, stops, shapes, and trips in exact theride.js/actransit.js schema)

Usage:
  python3 tools/build-city-pack.py --list
  python3 tools/build-city-pack.py --city royaloak
  npm run city:install -- royaloak
"""

import argparse
import csv
import gzip
import io
import json
import math
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from heapq import heappop, heappush

try:
    import numpy as np
    from PIL import Image, ImageDraw
    from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
    from shapely.geometry.polygon import orient
    from shapely.ops import linemerge, polygonize, unary_union
    from shapely.prepared import prep
    HAS_GEO_DEPS = True
except ImportError:
    HAS_GEO_DEPS = False

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

CITY_CONFIGS = {
    'royaloak': {
        'id': 'royaloak',
        'name': 'Royal Oak, MI',
        'origin_desc': 'Main St & 11 Mile Rd (centreline)',
        'lat0': 42.4895,
        'lon0': -83.1446,
        'bbox': (42.470, -83.182, 42.535, -83.110),  # S (10 Mile/Zoo), W (Coolidge/Woodward), N (14 Mile Rd), E (Stephenson/I-75)
        'base_elev': 200.0,
        'downtown_box': (-360, -340, 380, 440),
        'in_town_box': (-600, -600, 600, 600),
        'metered_regex': re.compile(
            r'^(N Main St|S Main St|Main St|N Washington Ave|S Washington Ave|Washington Ave|'
            r'W 11 Mile Rd|E 11 Mile Rd|11 Mile Rd|W 2nd St|E 2nd St|W 3rd St|E 3rd St|'
            r'W 4th St|E 4th St|4th St|W 5th St|E 5th St|W 6th St|E 6th St|W 7th St|E 7th St|'
            r'S Center St|N Center St|Center St|S Troy St|N Troy St|Troy St|'
            r'S Lafayette Ave|N Lafayette Ave|Lafayette Ave|Williams St)$'
        ),
        'rail_default_name': 'CN Holly Subdivision',
        'rail_route_names': ['Wolverine', 'CN Holly Subdivision', 'Grand Trunk Western'],
        'amtrak_stop_id': 'ROY',
        'amtrak_station_name': 'Royal Oak Amtrak Station (ROY)',
        'amtrak_west_keywords': ('Pontiac', 'Birmingham', 'Troy'),
        'amtrak_fallback': [
            ['350', 'west', 'Pontiac', 13 * 3600 + 49 * 60, 13 * 3600 + 51 * 60, '1111111', '20250101', '20301231'],
            ['352', 'west', 'Pontiac', 21 * 3600 + 4 * 60, 21 * 3600 + 6 * 60, '1111111', '20250101', '20301231'],
            ['354', 'west', 'Pontiac', 24 * 3600 + 34 * 60, 24 * 3600 + 36 * 60, '1111111', '20250101', '20301231'],
            ['351', 'east', 'Chicago', 6 * 3600 + 2 * 60, 6 * 3600 + 4 * 60, '1111111', '20250101', '20301231'],
            ['353', 'east', 'Chicago', 9 * 3600 + 10 * 60, 9 * 3600 + 12 * 60, '1111111', '20250101', '20301231'],
            ['355', 'east', 'Chicago', 17 * 3600 + 47 * 60, 17 * 3600 + 49 * 60, '1111111', '20250101', '20301231'],
        ],
        'transit_feed_id': 'royaloak-smart-1',
        'transit_prefix': 'smart',
        'corridor_waypoints': [
            ("460", "FAST Woodward", "Pontiac / Troy", "Downtown Detroit", "#d9381e",
             [(220, 2000), (-350, 1150), (-950, 200), (-1550, -700), (-2150, -1620), (-2950, -2650)]),
            ("450", "Woodward Local - Royal Oak", "Pontiac", "Downtown Detroit via Royal Oak", "#e65100",
             [(220, 2000), (-350, 1150), (-155, 700), (-180, 115), (-950, 200), (-2150, -1620), (-2950, -2650)]),
            ("430", "Main St - Crooks", "Big Beaver & Crooks (Troy)", "Royal Oak Transit Center", "#cc292b",
             [(55, 1600), (45, 700), (25, 0), (-10, -1050), (-500, -1650), (-1100, -2400), (-1600, -3220), (-1600, -4030), (-1600, -4830)]),
            ("740", "Twelve Mile Crosstown", "Roseville / I-94", "Southfield / Twelve Oaks", "#1976d2",
             [(-2950, -1545), (-2150, -1620), (-1000, -1630), (0, -1660), (1000, -1665), (1600, -1665), (2100, -1665)]),
            ("730", "Ten Mile - Eleven Mile", "Eastland / Harper Woods", "Royal Oak Transit Center", "#00897b",
             [(-2950, 20), (-1800, 10), (-950, 5), (-200, 5), (25, -35), (850, -60), (1655, -95), (1695, 700), (1715, 1530)]),
            ("495", "John R - Campbell - Stephenson", "Oakland Mall (14 Mile)", "Royal Oak / 10 Mile", "#6a1b9a",
             [(1730, 2050), (1715, 1530), (1685, 700), (1658, -95), (1610, -960), (1590, -1665), (1560, -3220), (1550, -4830)]),
        ],
        'historic_districts': [
            {'name': 'Downtown Royal Oak Historic District', 'rings': [[-320, -280, 340, -280, 340, 420, -320, 420]]},
            {'name': 'Vinsetta Boulevard Historic District', 'rings': [[-1650, -1620, -450, -1620, -450, -700, -1650, -700]]},
            {'name': 'Shrine of the Little Flower Historic District', 'rings': [[-2350, -1850, -1850, -1850, -1850, -1250, -2350, -1250]]},
            {'name': 'Huntington Woods Historic District', 'rings': [[-2450, 50, -950, 50, -950, 1350, -2450, 1350]]},
        ],
        'neighborhood_places': [
            ('Downtown Royal Oak', 0, 80, 260),
            ('Centennial Commons', 190, 40, 140),
            ('Shrine of the Little Flower', -2154, -1624, 220),
            ('Detroit Zoo', -850, 1420, 280),
            ('Rackham Golf Course', -1050, 1750, 240),
            ('Red Run Golf Club', 850, -1950, 280),
            ('Vinsetta', -950, -1150, 240),
            ('Huntington Woods', -1850, 650, 260),
            ('Pleasant Ridge', -350, 1850, 240),
            ('Berkley', -2600, -1200, 260),
            ('Normandy Oaks Park', -2550, -4150, 260),
            ('Royal Oak High School', -1350, -3850, 240),
            ('14 Mile & Crooks (North Royal Oak)', -1600, -4830, 260),
            ('14 Mile & Rochester', 830, -4830, 240),
        ],
        'landmarks_meta': {
            'Shrine of the Little Flower': {
                'x': -2154, 'z': -1624, 'w': 124, 'd': 64, 'h': 38, 'area': 7936,
                'ring': [-2216, -1656, -2092, -1656, -2092, -1592, -2216, -1592]
            },
            'National Shrine of the Little Flower Basilica': {
                'x': -2154, 'z': -1624, 'w': 124, 'd': 64, 'h': 38, 'area': 7936,
                'ring': [-2216, -1656, -2092, -1656, -2092, -1592, -2216, -1592]
            },
            'Royal Oak Music Theatre': {
                'x': -196, 'z': 301, 'w': 35, 'd': 38, 'h': 16, 'area': 1330,
                'ring': [-213, 282, -178, 282, -178, 320, -213, 320]
            },
            'Detroit Zoo Water Tower': {
                'x': -256, 'z': 1460, 'w': 23, 'd': 23, 'h': 42, 'area': 529,
                'ring': [-268, 1448, -245, 1448, -245, 1471, -268, 1471]
            },
            'Royal Oak City Hall': {
                'x': 253, 'z': 86, 'w': 38, 'd': 55, 'h': 14, 'area': 2090,
                'ring': [234, 59, 272, 59, 272, 114, 234, 114]
            },
            'Royal Oak Farmers Market': {
                'x': 284, 'z': 8, 'w': 41, 'd': 69, 'h': 10, 'area': 2829,
                'ring': [264, -26, 305, -26, 305, 43, 264, 43]
            },
            'Royal Oak Amtrak Station': {
                'x': -240, 'z': 37, 'w': 33, 'd': 52, 'h': 8, 'area': 1716,
                'ring': [-256, 11, -223, 11, -223, 63, -256, 63]
            },
            'Emagine Royal Oak': {
                'x': 176, 'z': -109, 'w': 53, 'd': 110, 'h': 16, 'area': 5830,
                'ring': [149, -164, 202, -164, 202, -54, 149, -54]
            },
            'Henry Ford Medical Center': {
                'x': 110, 'z': 101, 'w': 36, 'd': 76, 'h': 26, 'area': 2736,
                'ring': [92, 63, 128, 63, 128, 139, 92, 139]
            },
            'Royal Oak Public Library': {
                'x': 168, 'z': 10, 'w': 55, 'd': 39, 'h': 10, 'area': 2145,
                'ring': [140, -10, 195, -10, 195, 29, 140, 29]
            },
            'Stagecrafters Baldwin Theatre': {
                'x': -231, 'z': 338, 'w': 40, 'd': 27, 'h': 14, 'area': 1080,
                'ring': [-251, 324, -211, 324, -211, 351, -251, 351]
            },
            'The Fifth': {
                'x': -194, 'z': 334, 'w': 34, 'd': 33, 'h': 64, 'area': 1122,
                'ring': [-211, 318, -177, 318, -177, 351, -211, 351]
            },
            'Washington Square Plaza': {
                'x': -216, 'z': 204, 'w': 76, 'd': 81, 'h': 26, 'area': 6156,
                'ring': [-254, 164, -178, 164, -178, 245, -254, 245]
            },
        },
        'rng_seed': 248,
    },
    'oakland': {
        'id': 'oakland',
        'name': 'Oakland, CA',
        'origin_desc': '14th St & Broadway (centreline)',
        'lat0': 37.8044,
        'lon0': -122.2712,
        'bbox': (37.785, -122.308, 37.8545, -122.230),
        'base_elev': 0.0,
        'downtown_box': (-750, -950, 650, 650),
        'in_town_box': (-900, -1200, 1200, 900),
        'metered_regex': re.compile(
            r'^(Broadway|Telegraph Ave|Grand Ave|Lakeshore Ave|Piedmont Ave|College Ave|San Pablo Ave|International Blvd|'
            r'Franklin St|Webster St|Harrison St|Jackson St|Washington St|Clay St|[789]th St|1[0-9]th St|2[0-9]th St)$'
        ),
        'rail_default_name': 'Niles Subdivision',
        'rail_route_names': ['Capitol Corridor', 'Union Pacific Niles Subdivision', 'Port of Oakland Belt Line'],
        'amtrak_stop_id': 'OKJ',
        'amtrak_station_name': 'Oakland Jack London Square (OKJ)',
        'amtrak_west_keywords': ('Sacramento', 'Auburn', 'Seattle'),
        'amtrak_fallback': [
            ['521', 'west', 'Sacramento / Auburn', 6 * 3600 + 25 * 60, 6 * 3600 + 27 * 60, '1111111', '20250101', '20301231'],
            ['522', 'east', 'San Jose Diridon', 6 * 3600 + 50 * 60, 6 * 3600 + 52 * 60, '1111111', '20250101', '20301231'],
        ],
        'transit_feed_id': 'oakland-ac-transit-1',
        'transit_prefix': 'ac',
        'corridor_waypoints': [
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
        ],
        'historic_districts': [
            {'name': 'Old Oakland Historic District', 'rings': [[-450, 120, -50, 120, -50, 420, -450, 420]]},
            {'name': 'Oakland Chinatown', 'rings': [[-10, 40, 480, 40, 480, 460, -10, 460]]},
            {'name': 'Uptown Arts & Entertainment District', 'rings': [[-220, -850, 280, -850, 280, -250, -220, -250]]},
            {'name': 'Preservation Park Historic District', 'rings': [[-620, -180, -320, -180, -320, 80, -620, 80]]},
        ],
        'neighborhood_places': [],
        'landmarks_meta': {
            'Tribune Tower': {'x': 106, 'z': 144, 'w': 28, 'd': 26, 'h': 93, 'area': 728, 'ring': [92, 131, 120, 131, 120, 157, 92, 157]},
            'Oakland City Hall': {'x': -114, 'z': -100, 'w': 56, 'd': 38, 'h': 97, 'area': 2128, 'ring': [-142, -119, -86, -119, -86, -81, -142, -81]},
            'Fox Theater': {'x': 70, 'z': -400, 'w': 48, 'd': 38, 'h': 36, 'area': 1824, 'ring': [46, -419, 94, -419, 94, -381, 46, -381]},
            'Cathedral of Christ the Light': {'x': 774, 'z': -610, 'w': 68, 'd': 68, 'h': 38, 'area': 3630, 'ring': [740, -644, 808, -644, 808, -576, 740, -576]},
            'Lake Merritt Pergola': {'x': 1794, 'z': -710, 'w': 48, 'd': 48, 'h': 10, 'area': 1800, 'ring': [1770, -734, 1818, -734, 1818, -686, 1770, -686]},
            'Port of Oakland Cranes': {'x': -2460, 'z': 580, 'w': 220, 'd': 90, 'h': 58, 'area': 19800, 'ring': [-2570, 535, -2350, 535, -2350, 625, -2570, 625]},
            'Lake Merritt Amphitheater': {'x': 1073, 'z': 688, 'w': 96, 'd': 112, 'h': 6, 'area': 8400, 'ring': [1025, 632, 1121, 632, 1121, 744, 1025, 744]},
        },
        'rng_seed': 510,
    },
    'pompanobeach': {
        'id': 'pompanobeach',
        'name': 'Pompano Beach, FL',
        'origin_desc': 'E Atlantic Blvd & N Federal Hwy / US-1 (centreline)',
        'lat0': 26.2318,
        'lon0': -80.1038,
        'bbox': (26.208, -80.135, 26.265, -80.076),
        'base_elev': 0.0,
        'downtown_box': (-2350, -350, 1750, 350),
        'in_town_box': (-2600, -1800, 2100, 1800),
        'metered_regex': re.compile(
            r'^(E Atlantic Blvd|W Atlantic Blvd|Atlantic Blvd|N Ocean Blvd|S Ocean Blvd|Ocean Blvd|'
            r'N Federal Hwy|S Federal Hwy|Federal Hwy|N Pompano Beach Blvd|S Pompano Beach Blvd|Pompano Beach Blvd|'
            r'NE 1st St|NE 2nd St|NE 3rd St|SE 1st St|SE 2nd St|Briny Ave|N Riverside Dr|S Riverside Dr)$'
        ),
        'rail_default_name': 'FEC Railway Corridor',
        'rail_route_names': ['Brightline Florida East Coast', 'FEC Freight Main Line', 'CSX / Tri-Rail Corridor'],
        'amtrak_stop_id': 'DFB',
        'amtrak_station_name': 'Pompano Beach Station (POM)',
        'amtrak_west_keywords': ('Orlando', 'Tampa', 'New York', 'Jacksonville'),
        'amtrak_fallback': [
            ['91', 'east', 'Miami Central', 10 * 3600 + 18 * 60, 10 * 3600 + 20 * 60, '1111111', '20250101', '20301231'],
            ['97', 'east', 'Miami Central', 16 * 3600 + 42 * 60, 16 * 3600 + 44 * 60, '1111111', '20250101', '20301231'],
            ['92', 'west', 'Orlando / New York', 9 * 3600 + 12 * 60, 9 * 3600 + 14 * 60, '1111111', '20250101', '20301231'],
            ['98', 'west', 'Orlando / New York', 12 * 3600 + 35 * 60, 12 * 3600 + 37 * 60, '1111111', '20250101', '20301231'],
        ],
        'transit_feed_id': 'pompanobeach-bct-1',
        'transit_prefix': 'bct',
        'corridor_waypoints': [
            ("10", "US-1 Federal Highway Breeze", "Deerfield Beach / Mizner", "Fort Lauderdale Central Terminal", "#0072ce",
             [(180, -3400), (80, -2100), (15, -900), (0, 0), (-40, 1200), (-80, 2400)]),
            ("11", "Atlantic Blvd - Pompano Beach Pier", "Pompano Beach Pier (A1A)", "Old Pompano / NW 31st Ave", "#f58220",
             [(1680, -10), (1188, -10), (0, 0), (-1100, -10), (-1867, -20), (-2900, -30)]),
            ("20", "NE 6th Ave - Dixie Highway", "Sample Rd Transit Center", "Cypress Creek Tri-Rail", "#009639",
             [(-1850, -3400), (-1950, -2100), (-2100, -900), (-2215, 0), (-2350, 1200), (-2500, 2400)]),
            ("42", "NE 14th St Causeway - Airpark", "A1A & Hillsboro Inlet", "Pompano Airpark & Dixie", "#8c1d40",
             [(2050, -2110), (1538, -2110), (90, -2110), (-900, -2110), (-2100, -2110)]),
            ("50", "Ocean Blvd A1A Coastal", "Hillsboro Inlet Lighthouse", "Lauderdale-by-the-Sea", "#00a3e0",
             [(2280, -2950), (2050, -2110), (1850, -1000), (1680, -10), (1550, 1100), (1420, 2400)]),
            ("60", "Andrews Ave - McNab Crosstown", "Pompano Civic Center", "McNab & Federal Hwy", "#662d91",
             [(-2900, -20), (-2215, 0), (-2400, 1300), (-2500, 2400), (-1000, 2400), (-80, 2400)]),
        ],
        'historic_districts': [
            {'name': 'Old Town Pompano Historic District', 'rings': [[-2550, -350, -1750, -350, -1750, 250, -2550, 250]]},
            {'name': 'Pompano Beach Barrier Island & Pier District', 'rings': [[1350, -900, 1950, -900, 1950, 500, 1350, 500]]},
            {'name': 'Hillsboro Inlet Historic Lighthouse Reserve', 'rings': [[2050, -3300, 2500, -3300, 2500, -2800, 2050, -2800]]},
            {'name': 'Harbor Village Canal District', 'rings': [[200, 100, 1300, 100, 1300, 1200, 200, 1200]]},
        ],
        'neighborhood_places': [
            ('Atlantic & Federal (Downtown East)', 0, 0, 240),
            ('Pompano Beach Fisher Family Pier', 1728, -345, 220),
            ('Hillsboro Inlet Lighthouse', 2317, -3034, 220),
            ('Intracoastal Waterway & Atlantic Drawbridge', 1188, -11, 220),
            ('Pompano Beach Airpark & Blimp Base', -719, -1689, 320),
            ('Pompano Beach Municipal Golf Course', -450, -1350, 280),
            ('Pompano Beach Civic Center & Amphitheater', -1867, -22, 240),
            ('Old Town Pompano', -2217, -78, 240),
            ('Harbor Village Finger Canals', 879, 533, 280),
            ('Santa Barbara Shores Canals', 750, 1650, 280),
            ('NE 14th St Causeway', 1538, -2112, 220),
        ],
        'landmarks_meta': {
            'Pompano Beach Fisher Family Pier': {
                'x': 1728, 'z': -345, 'w': 260, 'd': 28, 'h': 14, 'area': 7280,
                'ring': [1598, -359, 1858, -359, 1858, -331, 1598, -331]
            },
            'Hillsboro Inlet Lighthouse': {
                'x': 2317, 'z': -3034, 'w': 28, 'd': 28, 'h': 42, 'area': 784,
                'ring': [2303, -3048, 2331, -3048, 2331, -3020, 2303, -3020]
            },
            'Pompano Beach Amphitheater': {
                'x': -1867, 'z': -22, 'w': 64, 'd': 58, 'h': 18, 'area': 3712,
                'ring': [-1899, -51, -1835, -51, -1835, 7, -1899, 7]
            },
            'Pompano Airpark Goodyear Blimp Hangar': {
                'x': -719, 'z': -1689, 'w': 95, 'd': 46, 'h': 26, 'area': 4370,
                'ring': [-766, -1712, -672, -1712, -672, -1666, -766, -1666]
            },
            'Atlantic Blvd Intracoastal Control Tower': {
                'x': 1188, 'z': -11, 'w': 22, 'd': 22, 'h': 20, 'area': 484,
                'ring': [1177, -22, 1199, -22, 1199, 0, 1177, 0]
            },
            'Old Town Pompano Civic Plaza': {
                'x': -2217, 'z': -78, 'w': 48, 'd': 42, 'h': 16, 'area': 2016,
                'ring': [-2241, -99, -2193, -99, -2193, -57, -2241, -57]
            },
        },
        'rng_seed': 954,
    },
    'sanfrancisco': {
        'id': 'sanfrancisco',
        'name': 'San Francisco, CA',
        'origin_desc': 'Union Square - Post St & Powell St (centreline)',
        'lat0': 37.7879,
        'lon0': -122.4075,
        'bbox': (37.772, -122.438, 37.812, -122.384),
        'base_elev': 0.0,
        'downtown_box': (-950, -1150, 1250, 750),
        'in_town_box': (-1800, -2100, 1650, 1350),
        'metered_regex': re.compile(
            r'^(Market St|Mission St|Howard St|Folsom St|Harrison St|Bryant St|Brannan St|Townsend St|'
            r'Geary St|Geary Blvd|Post St|Sutter St|Bush St|Pine St|California St|Sacramento St|Clay St|Washington St|Jackson St|'
            r'Columbus Ave|Broadway|Grant Ave|Stockton St|Powell St|Mason St|Taylor St|Jones St|Leavenworth St|Hyde St|Larkin St|Polk St|Van Ness Ave|'
            r'Montgomery St|Sansome St|Battery St|Front St|Davis St|Drumm St|The Embarcadero|2nd St|3rd St|4th St|5th St|6th St|7th St|8th St|9th St|10th St)$'
        ),
        'rail_default_name': 'Caltrain / Muni Metro Corridor',
        'rail_route_names': ['Caltrain Peninsula Commute', 'Muni Metro T Third', 'F Market & Wharves Historic Streetcar'],
        'amtrak_stop_id': 'SFC',
        'amtrak_station_name': 'San Francisco 4th & King Station (SFC)',
        'amtrak_west_keywords': ('San Francisco', 'Oakland', 'Emeryville'),
        'amtrak_fallback': [
            ['101', 'west', 'San Francisco 4th & King', 7 * 3600 + 45 * 60, 7 * 3600 + 47 * 60, '1111111', '20250101', '20301231'],
            ['105', 'west', 'San Francisco 4th & King', 12 * 3600 + 15 * 60, 12 * 3600 + 17 * 60, '1111111', '20250101', '20301231'],
            ['102', 'east', 'San Jose Diridon / Gilroy', 8 * 3600 + 30 * 60, 8 * 3600 + 32 * 60, '1111111', '20250101', '20301231'],
            ['106', 'east', 'San Jose Diridon / Tamien', 17 * 3600 + 15 * 60, 17 * 3600 + 17 * 60, '1111111', '20250101', '20301231'],
        ],
        'transit_feed_id': 'sanfrancisco-muni-1',
        'transit_prefix': 'muni',
        'corridor_waypoints': [
            ("F", "Market & Wharves Historic Streetcar", "Fisherman's Wharf", "Castro & Market via Ferry Bldg", "#e31837",
             [(-200, -2250), (650, -1800), (1180, -850), (650, -250), (0, 200), (-750, 750), (-1500, 1300)]),
            ("38", "Geary Rapid", "Ocean Beach / Fillmore", "Salesforce Transit Center", "#cc0033",
             [(-2400, 180), (-1200, 90), (-550, 40), (0, 0), (500, -80), (920, -190)]),
            ("30", "Stockton - Marina", "Crissy Field / Chestnut", "Caltrain 4th & King", "#005a9c",
             [(-1400, -1950), (-400, -1650), (120, -800), (120, 0), (450, 450), (950, 950)]),
            ("49", "Van Ness - Mission BRT", "Fort Mason / North Point", "Mission District", "#f58220",
             [(-1250, -2050), (-1180, -1100), (-1100, 0), (-1030, 850), (-980, 1550)]),
            ("1", "California Trolley Coach", "Clay & Drumm (Embarcadero)", "Pacific Heights / Presidio", "#008566",
             [(1050, -620), (400, -520), (-200, -430), (-1100, -300), (-2350, -120)]),
            ("14R", "Mission Rapid", "Ferry Plaza", "Mission & 16th St", "#8c1d40",
             [(1150, -780), (550, -150), (-100, 320), (-850, 900), (-1450, 1450)]),
        ],
        'historic_districts': [
            {'name': 'Union Square & Downtown Retail District', 'rings': [[-320, -260, 320, -260, 320, 260, -320, 260]]},
            {'name': 'Chinatown Historic District', 'rings': [[20, -980, 360, -980, 360, -260, 20, -260]]},
            {'name': 'Jackson Square & Barbary Coast Historic District', 'rings': [[340, -1150, 780, -1150, 780, -750, 340, -750]]},
            {'name': 'Civic Center National Historic Landmark District', 'rings': [[-1350, 620, -750, 620, -750, 1180, -1350, 1180]]},
            {'name': 'Alamo Square Historic District', 'rings': [[-2500, 1050, -1950, 1050, -1950, 1500, -2500, 1500]]},
        ],
        'neighborhood_places': [
            ('Union Square', 0, 0, 220),
            ('Financial District', 620, -520, 280),
            ('Chinatown', 170, -580, 240),
            ('North Beach & Little Italy', 40, -1450, 260),
            ('Telegraph Hill & Coit Tower', 150, -1611, 200),
            ('Russian Hill & Lombard Street', -985, -1578, 260),
            ('Nob Hill', -260, -420, 240),
            ('Fisherman\'s Wharf & Pier 39', -202, -2312, 280),
            ('The Embarcadero & Ferry Building', 1214, -845, 280),
            ('South of Market (SoMa)', 380, 520, 300),
            ('Civic Center', -1038, 956, 260),
            ('China Basin & Oracle Park', 1601, 1034, 260),
            ('Alamo Square & Painted Ladies', -2226, 1289, 260),
            ('Pacific Heights', -1950, -650, 280),
            ('Japantown', -1850, 280, 240),
        ],
        'landmarks_meta': {
            'Transamerica Pyramid': {
                'x': 414, 'z': -811, 'w': 54, 'd': 54, 'h': 260, 'area': 2916,
                'ring': [387, -838, 441, -838, 441, -784, 387, -784]
            },
            'Salesforce Tower': {
                'x': 933, 'z': -200, 'w': 52, 'd': 52, 'h': 326, 'area': 2704,
                'ring': [907, -226, 959, -226, 959, -174, 907, -174]
            },
            'Ferry Building': {
                'x': 1214, 'z': -845, 'w': 48, 'd': 200, 'h': 75, 'area': 9600,
                'ring': [1190, -945, 1238, -945, 1238, -745, 1190, -745]
            },
            'Coit Tower': {
                'x': 150, 'z': -1611, 'w': 26, 'd': 26, 'h': 64, 'area': 676,
                'ring': [137, -1624, 163, -1624, 163, -1598, 137, -1598]
            },
            'San Francisco City Hall': {
                'x': -1038, 'z': 956, 'w': 118, 'd': 94, 'h': 94, 'area': 11092,
                'ring': [-1097, 909, -979, 909, -979, 1003, -1097, 1003]
            },
            'Chinatown Dragon Gate': {
                'x': 167, 'z': -311, 'w': 22, 'd': 10, 'h': 12, 'area': 220,
                'ring': [156, -316, 178, -316, 178, -306, 156, -306]
            },
            'Painted Ladies': {
                'x': -2155, 'z': 1289, 'w': 28, 'd': 62, 'h': 15, 'area': 1736,
                'ring': [-2169, 1258, -2141, 1258, -2141, 1320, -2169, 1320]
            },
        },
        'rng_seed': 415,
    },
}

r1 = lambda v: round(float(v), 1)


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
                    '-A', 'go-to-traffic-city-pack-builder/1.0',
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


def rdp(pts, eps=0.5):
    if len(pts) < 3:
        return pts
    ls = LineString(pts).simplify(eps, preserve_topology=False)
    return [(r1(x), r1(z)) for x, z in ls.coords]


def uint_var(d, v):
    while v > 127:
        d.append((v & 127) | 128)
        v >>= 7
    d.append(v)


def sint_var(d, v):
    uint_var(d, v * 2 if v >= 0 else -v * 2 - 1)


def morton(x, z):
    ix, iz = int(x / 16) + 4096, int(z / 16) + 4096
    k = 0
    for i in range(14):
        k |= ((ix >> i) & 1) << (2 * i) | ((iz >> i) & 1) << (2 * i + 1)
    return k


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


def build_city_pack(city_key):
    if city_key not in CITY_CONFIGS:
        raise ValueError(f"Unknown city '{city_key}'. Supported cities: {list(CITY_CONFIGS.keys())}")
    cfg = CITY_CONFIGS[city_key]
    city_id = cfg['id']

    out_dir = os.path.join(ROOT_DIR, 'cities', city_id)
    data_dir = os.path.join(out_dir, 'data')
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)

    LAT0 = cfg['lat0']
    LON0 = cfg['lon0']
    BBOX = cfg['bbox']
    S, W, N, E = BBOX

    A_EARTH, E2_EARTH = 6378137.0, 6.69437999014e-3
    phi = math.radians(LAT0)
    LON_M = math.pi / 180.0 * A_EARTH / math.sqrt(1.0 - E2_EARTH * math.sin(phi) ** 2) * math.cos(phi)
    LAT_M = math.pi / 180.0 * A_EARTH * (1.0 - E2_EARTH) / (1.0 - E2_EARTH * math.sin(phi) ** 2) ** 1.5

    def ll_to_xz(lat, lon):
        return round((lon - LON0) * LON_M, 1), round(-(lat - LAT0) * LAT_M, 1)

    W_X, N_Z = ll_to_xz(BBOX[2], BBOX[1])
    E_X, S_Z = ll_to_xz(BBOX[0], BBOX[3])
    CLIP_BOX = box(W_X, N_Z, E_X, S_Z)
    SIDEWALK = 4.6
    print(f"[{city_id}] {cfg['name']} world bounds: X=[{W_X}, {E_X}] ({E_X - W_X:.0f}m), Z=[{N_Z}, {S_Z}] ({S_Z - N_Z:.0f}m)")

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
  way["golf"]({S},{W},{N},{E});
  way["amenity"~"^(parking|school|university|college|hospital|place_of_worship|community_centre|library|fire_station|police|townhall|courthouse|theatre|cinema|arts_centre|marketplace|ferry_terminal|bus_station|fuel)$"]({S},{W},{N},{E});
  way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|abandoned|disused|platform)$"]({S},{W},{N},{E});
  way["man_made"~"^(pier|breakwater|groyne|bridge|water_tower)$"]({S},{W},{N},{E});
  way["historic"]({S},{W},{N},{E});
  way["tourism"~"^(zoo|attraction|museum|hotel)$"]({S},{W},{N},{E});
  relation["tourism"~"^(zoo|attraction|museum)$"]({S},{W},{N},{E});
  node["natural"="tree"]({S},{W},{N},{E});
  node["highway"~"^(street_lamp|traffic_signals|stop|give_way|crossing|motorway_junction)$"]({S},{W},{N},{E});
  node["railway"~"^(level_crossing|station|halt|tram_stop)$"]({S},{W},{N},{E});
  node["emergency"="fire_hydrant"]({S},{W},{N},{E});
  node["amenity"]({S},{W},{N},{E});
  node["shop"]({S},{W},{N},{E});
  node["tourism"]({S},{W},{N},{E});
  node["leisure"]({S},{W},{N},{E});
  node["historic"]({S},{W},{N},{E});
  node["man_made"="water_tower"]({S},{W},{N},{E});
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

    print(f"Step 1: Loading OpenStreetMap data for {cfg['name']}...")
    infra_osm = fetch_overpass(f"{city_id}_infra.json", INFRA_QUERY)
    bldg_osm = fetch_overpass(f"{city_id}_buildings.json", BUILDINGS_QUERY)
    transit_osm = fetch_overpass(f"{city_id}_transit.json", TRANSIT_QUERY)

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

    def way_coords(w):
        pts = []
        for nid in w.get('nodes', []):
            if nid in nodes:
                pts.append((nodes[nid][0], nodes[nid][1]))
        return pts

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
    # 2. Streets, Road Graph, Water, Parks, Bridges, Rail, Trails, Golf
    # ---------------------------------------------------------------------------
    print("Step 2: Processing streets, roadGraph, water, parks, bridges, golf, and railways...")

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

    def mph_tag(t):
        v = str(t.get('maxspeed', ''))
        try:
            n = float(v.split()[0])
            return round(n if 'mph' in v else n / 1.609)
        except (ValueError, IndexError):
            pass
        hw = t.get('highway', '')
        if hw == 'motorway':
            return 70 if city_id == 'royaloak' else 55
        if hw == 'trunk':
            return 45
        if hw == 'primary':
            return 35 if city_id == 'royaloak' else 30
        if hw == 'secondary':
            return 30
        return 25

    def road_spec(t):
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
        if 'width' not in t:
            w += sum(1.7 for b in (1, 2) if bike & b) + (0.6 if bike & 16 else 0)
        hw_flag = base in ('motorway', 'trunk') or (link and base in ('motorway', 'trunk'))
        return round(w, 1), lanes, d, hw_flag, bike

    in_town_x0, in_town_z0, in_town_x1, in_town_z1 = cfg['in_town_box']
    metered_re = cfg['metered_regex']

    drive = []
    trails_raw = []
    rail_tracks = []
    rail_by_name = defaultdict(list)
    water_polys = []
    green_spaces = []
    parking_polys = []
    playground_ways = []
    pier_polys = []
    coastline_lines = []
    driveway_ways = []
    golf_fairways = []
    golf_greens = []
    golf_tees = []
    golf_bunkers = []
    golf_paths = []
    golf_pins = []

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
            wd, lanes, d, hw_flag, bike = road_spec(t)
            mx, mz = pts[len(pts) // 2]
            in_town = (in_town_x0 < mx < in_town_x1 and in_town_z0 < mz < in_town_z1)
            park_lanes = 0
            if not hw_flag and in_town and metered_re.match(name) and hw in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified'):
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
                'mph': mph_tag(t),
                'park': park_lanes,
            })
        elif hw == 'service' and t.get('service') == 'driveway':
            driveway_ways.append(pts)
        elif hw in ('path', 'footway', 'cycleway', 'pedestrian', 'track', 'bridleway'):
            if t.get('golf') == 'cartpath':
                spts = rdp(pts, 0.5)
                if len(spts) >= 2:
                    golf_paths.append(flat(spts))
            elif t.get('area') != 'yes' and t.get('footway') not in ('sidewalk', 'crossing') and t.get('cycleway') != 'crossing' and t.get('tunnel') not in ('yes', 'building_passage'):
                trails_raw.append((t, pts))
        elif t.get('golf') == 'cartpath' and not is_closed:
            spts = rdp(pts, 0.5)
            if len(spts) >= 2:
                golf_paths.append(flat(spts))

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
                    rname = t.get('name', cfg['rail_default_name'])
                    rail_by_name[rname].append(seg)

        if t.get('natural') == 'coastline':
            coastline_lines.append(LineString(pts))

        if not is_closed and t.get('waterway') in ('canal', 'river') and t.get('tunnel') != 'yes':
            try:
                w_m = 24.0 if t.get('waterway') == 'canal' else 32.0
                c_poly = LineString(pts).buffer(w_m * 0.5, cap_style=2).intersection(CLIP_BOX.buffer(150))
                if not c_poly.is_empty:
                    water_polys.append(c_poly)
            except Exception:
                pass

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
                golf_tag = t.get('golf')
                name = t.get('name', '')

                if golf_tag in ('fairway', 'green', 'tee', 'bunker'):
                    g_c = poly.intersection(CLIP_BOX)
                    if not g_c.is_empty and g_c.area >= 15.0:
                        if golf_tag == 'fairway':
                            golf_fairways.extend(poly_to_rings(g_c, tol=0.6, min_area=20.0))
                        elif golf_tag == 'green':
                            rings = poly_to_rings(g_c, tol=0.4, min_area=15.0)
                            if rings:
                                golf_greens.extend(rings)
                                c = g_c.centroid
                                golf_pins.extend([r1(c.x), r1(c.y)])
                        elif golf_tag == 'tee':
                            golf_tees.extend(poly_to_rings(g_c, tol=0.4, min_area=10.0))
                        elif golf_tag == 'bunker':
                            golf_bunkers.extend(poly_to_rings(g_c, tol=0.4, min_area=8.0))

                if nat == 'water' and not t.get('layer') and t.get('intermittent') != 'yes' and t.get('water') != 'basin' and t.get('basin') != 'retention':
                    if city_id != 'oakland' or ('Lake Merritt' in name and poly.bounds[3] > -850):
                        water_polys.append(poly)
                elif leis == 'playground':
                    playground_ways.append(poly)
                elif leis == 'golf_course':
                    green_spaces.append({'name': name or 'Golf Course', 'kind': 'golf', 'geom': poly.intersection(CLIP_BOX)})
                elif leis in ('park', 'nature_reserve', 'garden', 'recreation_ground', 'common', 'dog_park') or lu in ('park', 'grass', 'meadow', 'recreation_ground', 'village_green') or t.get('tourism') == 'zoo':
                    g_c = poly.intersection(CLIP_BOX)
                    if g_c.area >= 150:
                        green_spaces.append({'name': name, 'kind': 'park', 'geom': g_c})
                elif nat in ('wood', 'scrub') or lu == 'forest':
                    g_c = poly.intersection(CLIP_BOX)
                    if g_c.area >= 150:
                        green_spaces.append({'name': name, 'kind': 'wood', 'geom': g_c})
                elif lu == 'cemetery':
                    g_c = poly.intersection(CLIP_BOX)
                    if g_c.area >= 150:
                        green_spaces.append({'name': name or 'Cemetery', 'kind': 'cemetery', 'geom': g_c})
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
        tour = t.get('tourism')
        name = t.get('name', '')
        if not (nat in ('water', 'wood', 'wetland', 'bay') or lu in ('park', 'grass', 'meadow', 'recreation_ground', 'cemetery', 'forest', 'basin', 'reservoir') or leis in ('park', 'garden', 'golf_course', 'nature_reserve') or tour == 'zoo'):
            continue
        for poly in relation_to_polygons(rel):
            if nat == 'water' and not t.get('layer') and t.get('intermittent') != 'yes':
                if city_id != 'oakland' or ('Lake Merritt' in name and poly.bounds[3] > -850):
                    water_polys.append(poly)
            elif leis == 'golf_course':
                green_spaces.append({'name': name or 'Golf Course', 'kind': 'golf', 'geom': poly.intersection(CLIP_BOX)})
            elif leis in ('park', 'garden', 'nature_reserve') or lu in ('park', 'grass', 'meadow', 'recreation_ground') or tour == 'zoo':
                g_c = poly.intersection(CLIP_BOX)
                if g_c.area >= 200:
                    green_spaces.append({'name': name, 'kind': 'park', 'geom': g_c})
            elif lu == 'cemetery':
                g_c = poly.intersection(CLIP_BOX)
                if g_c.area >= 200:
                    green_spaces.append({'name': name or 'Cemetery', 'kind': 'cemetery', 'geom': g_c})
            elif nat == 'wood' or lu == 'forest':
                g_c = poly.intersection(CLIP_BOX)
                if g_c.area >= 200:
                    green_spaces.append({'name': name, 'kind': 'wood', 'geom': g_c})

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

    # Build roadGraph
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

    river_bridges = []
    if not water.is_empty:
        w_prep = prep(water.buffer(4.0))
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

    surface = [LineString(r['pts']).buffer(r['w'] / 2, quad_segs=3) for r in drive if not r.get('is_river_bridge')]
    road_union = unary_union(surface).buffer(0) if surface else Polygon()
    water_open = water.difference(road_union.buffer(1.5)).intersection(CLIP_BOX) if not water.is_empty else Polygon()

    all_main_rail = []
    for rname, segs in rail_by_name.items():
        all_main_rail.extend(segs)
    rail_routes = []
    if all_main_rail:
        merged_r = linemerge(unary_union(all_main_rail))
        runs = [merged_r] if merged_r.geom_type == 'LineString' else list(getattr(merged_r, 'geoms', []))
        runs.sort(key=lambda l: -l.length)
        route_names = cfg['rail_route_names']
        for idx, run in enumerate(runs[:len(route_names)]):
            if run.length > 500:
                rail_routes.append([route_names[idx], flat(run.simplify(0.5).coords)])

    print(f"Railway tracks: {len(rail_tracks)}, active train routes: {[r[0] for r in rail_routes]}")

    # ---------------------------------------------------------------------------
    # 3. Landuse Zoning Grid, Buildings (NYB1), Addresses, Roof Shapes, Gas Stations
    # ---------------------------------------------------------------------------
    print(f"Step 3: Processing {cfg['name']} buildings (NYB1), addresses, roof shapes, and fuel canopies...")

    LANDUSE_MAP = {
        'residential': 1, 'retail': 5, 'commercial': 6,
        'education': 8, 'institutional': 8, 'religious': 9,
        'industrial': 10, 'port': 10, 'railway': 12, 'cemetery': 14
    }
    ZCELL = 150.0
    zoning_grid = defaultdict(list)
    landuse_out = []

    def add_landuse_poly(use_code, poly_geom):
        try:
            p_c = poly_geom.intersection(CLIP_BOX).simplify(1.5, preserve_topology=True)
            for sp in parts(p_c):
                if sp.area < 120 or len(sp.exterior.coords) < 4:
                    continue
                landuse_out.append([use_code] + flat(list(sp.exterior.coords)[:-1]))
                minx, minz, maxx, maxz = sp.bounds
                sp_prep = prep(sp)
                for ix in range(int(minx // ZCELL), int(maxx // ZCELL) + 1):
                    for iz in range(int(minz // ZCELL), int(maxz // ZCELL) + 1):
                        zoning_grid[(ix, iz)].append((use_code, minx, minz, maxx, maxz, sp_prep))
        except Exception:
            pass

    for wid, w in ways.items():
        t = w.get('tags', {})
        use = LANDUSE_MAP.get(t.get('landuse'))
        if not use:
            amen = t.get('amenity')
            if amen == 'place_of_worship' or t.get('building') in ('church', 'cathedral', 'chapel'):
                use = 9
            elif amen in ('school', 'university', 'college', 'hospital'):
                use = 8
        if use:
            pts = way_coords(w)
            if len(pts) >= 4 and pts[0] == pts[-1]:
                try:
                    p = Polygon(pts).buffer(6.0 if use == 9 else 0.0)
                    if not p.is_empty:
                        add_landuse_poly(use, p)
                except Exception:
                    pass

    for rel in relations:
        t = rel.get('tags', {})
        use = LANDUSE_MAP.get(t.get('landuse'))
        if not use and (t.get('amenity') == 'place_of_worship' or t.get('building') in ('church', 'cathedral', 'chapel')):
            use = 9
        if use:
            for p in relation_to_polygons(rel):
                add_landuse_poly(use, p.buffer(6.0 if use == 9 else 0.0))

    def zoning_at(x, z):
        pt = None
        for lu_code, minx, minz, maxx, maxz, sp_prep in zoning_grid.get((int(x // ZCELL), int(z // ZCELL)), ()):
            if minx <= x <= maxx and minz <= z <= maxz:
                if pt is None:
                    pt = Point(x, z)
                if sp_prep.contains(pt):
                    return lu_code
        return 0

    dt_x0, dt_z0, dt_x1, dt_z1 = cfg['downtown_box']
    DOWNTOWN_BOX = box(dt_x0, dt_z0, dt_x1, dt_z1)

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
        in_downtown = (dt_x0 <= cx <= dt_x1 and dt_z0 <= cz <= dt_z1)
        b_tag = tags.get('building', 'yes')
        if kind == 1:
            if b_tag in ('apartments', 'dormitory', 'terrace') or area > 260:
                return 11.0 + (h_seed % 3) * 3.0
            if area < 175 and (h_seed % 10 < 6):
                return 4.2
            return 4.2 if (h_seed % 10 < 4) else 7.6
        elif kind == 3:
            if in_downtown and area > 500:
                return 16.0 + (h_seed % 6) * 4.0
            return 11.0 + (h_seed % 4) * 3.5
        elif kind == 2:
            if in_downtown and area > 700:
                return 12.0 + (h_seed % 4) * 3.5
            return 7.0 + (h_seed % 3) * 2.5
        elif kind in (4, 5, 6):
            return 10.5 + (h_seed % 4) * 3.0
        return 7.5

    def classify_building(tags, area, cx, cz):
        b = tags.get('building', 'yes')
        amen = tags.get('amenity', '')
        off = tags.get('office', '')
        shop = tags.get('shop', '')
        leis = tags.get('leisure', '')
        tourism = tags.get('tourism', '')

        if b in ('civic', 'government', 'public', 'train_station', 'transportation') or amen in ('townhall', 'courthouse', 'library', 'police', 'fire_station', 'post_office', 'ferry_terminal', 'bus_station'):
            return 6
        if b in ('university', 'college', 'school', 'hospital', 'kindergarten') or amen in ('university', 'college', 'school', 'hospital', 'research_institute', 'clinic'):
            return 5
        if b in ('church', 'cathedral', 'chapel', 'temple', 'synagogue', 'mosque', 'stadium', 'grandstand') or amen in ('place_of_worship', 'theatre', 'arts_centre', 'community_centre', 'museum') or tourism in ('museum', 'attraction', 'zoo') or leis == 'stadium':
            return 4
        if b in ('office',) or off:
            return 3
        if b in ('commercial', 'retail', 'supermarket', 'warehouse', 'industrial', 'hotel', 'mixed_use', 'parking') or shop or tourism == 'hotel' or amen in ('restaurant', 'cafe', 'bar', 'bank', 'fast_food', 'fuel', 'cinema', 'nightclub', 'marketplace', 'parking'):
            return 2
        if b in ('house', 'detached', 'residential', 'semidetached_house', 'terrace', 'bungalow', 'hut', 'garage', 'garages', 'shed', 'carport', 'apartments', 'dormitory'):
            return 1
        z_lu = zoning_at(cx, cz)
        if z_lu == 6:
            return 3 if area > 450 else 2
        if z_lu in (5, 7, 10, 12) and area > 95:
            return 2
        if z_lu == 8 and area > 220:
            return 5
        if z_lu == 9 and area > 140:
            return 4
        if z_lu in (1, 2, 3):
            return 1
        if (dt_x0 <= cx <= dt_x1 and dt_z0 <= cz <= dt_z1) and area > 110:
            return 2 if area < 650 else 3
        if area > 350:
            return 2
        return 1

    ROOF_SHAPE_CODES = {
        'gabled': 1, 'hipped': 2, 'pyramidal': 2, 'flat': 3,
        'gambrel': 4, 'half-hipped': 5, 'skillion': 6,
        'dome': 2, 'onion': 2, 'mansard': 2,
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

        # Only assign pitched roofs in roof-shapes.json when OSM explicitly tags roof:shape (or for churches),
        # avoiding exaggerated peaked roofs on flat buildings.
        rshape = ROOF_SHAPE_CODES.get(tags.get('roof:shape', ''))
        if not rshape and (tags.get('building') in ('church', 'cathedral', 'chapel') or tags.get('amenity') == 'place_of_worship'):
            rshape = 1
        elif not rshape and tags.get('building') in ('apartments', 'commercial', 'retail', 'office', 'industrial', 'warehouse', 'civic', 'public', 'school', 'hospital'):
            rshape = 3
        if rshape:
            roof_shapes.extend([r1(cx), r1(cz), rshape])

        if tags.get('building') == 'roof' and (tags.get('amenity') == 'fuel' or area < 900):
            rect = poly.minimum_rotated_rectangle
            rc = list(rect.exterior.coords)
            if len(rc) >= 4:
                dx1, dz1 = rc[1][0] - rc[0][0], rc[1][1] - rc[0][1]
                dx2, dz2 = rc[2][0] - rc[1][0], rc[2][1] - rc[1][1]
                l1, l2 = math.hypot(dx1, dz1), math.hypot(dx2, dz2)
                ang = math.atan2(dz1, dx1) if l1 >= l2 else math.atan2(dz2, dx2)
                L, W_can = (l1, l2) if l1 >= l2 else (l2, l1)
                if tags.get('amenity') == 'fuel' or (6.0 <= L <= 45.0 and 4.0 <= W_can <= 25.0):
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
        rshape = ROOF_SHAPE_CODES.get(tags.get('roof:shape', ''))
        if not rshape and (tags.get('building') in ('church', 'cathedral', 'chapel') or tags.get('amenity') == 'place_of_worship'):
            rshape = 1
        if rshape:
            roof_shapes.extend([r1(c.x), r1(c.y), rshape])
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

    packed_bldgs = []
    for b in buildings:
        polys = quantize_bldg(b['geom'].simplify(0.25))
        if polys:
            packed_bldgs.append((morton(b['cx'], b['cz']), b['height'], b['kind'], polys))
    packed_bldgs.sort(key=lambda t: t[0])

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
    bldg_gz_path = os.path.join(out_dir, 'building-geodata.bin.gz')
    with gzip.open(bldg_gz_path, 'wb', 9) as f:
        f.write(nyb1_data)
    print(f"Wrote {bldg_gz_path} ({len(packed_bldgs)} buildings, {os.path.getsize(bldg_gz_path) // 1024} KB)")

    # ---------------------------------------------------------------------------
    # 4. City Blocks, Lawns, Parks, Trails, Streetlights, Controls, Signs, Places
    # ---------------------------------------------------------------------------
    print("Step 4: Computing blocks, lawns, trails, controls, signs, and places...")
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
            is_rect = 0
            c = q.centroid
            paved = DOWNTOWN_BOX.contains(c)
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

    # Synthesize streetlights along arterials and downtown streets where not mapped in OSM
    lamp_grid = {(round(streetlights[i] / 18), round(streetlights[i + 1] / 18)) for i in range(0, len(streetlights), 4)}
    for r in drive:
        in_dt = False
        if r['pts']:
            mx, mz = r['pts'][len(r['pts']) // 2]
            in_dt = (dt_x0 - 150 <= mx <= dt_x1 + 150 and dt_z0 - 150 <= mz <= dt_z1 + 150)
        if r['cls'] not in (1, 2, 3) and not in_dt:
            continue
        spacing = 28.0 if in_dt else 42.0
        offset = r['w'] * 0.5 + 1.2
        style = 1 if in_dt else 0
        pts = r['pts']
        for i in range(len(pts) - 1):
            x0, z0 = pts[i]
            x1, z1 = pts[i + 1]
            seg_len = math.hypot(x1 - x0, z1 - z0)
            if seg_len < 18.0:
                continue
            tx, tz = (x1 - x0) / seg_len, (z1 - z0) / seg_len
            nx, nz = -tz, tx
            steps = int(seg_len // spacing)
            for s in range(1, steps + 1):
                d = s * spacing - spacing * 0.4
                bx, bz = x0 + tx * d, z0 + tz * d
                for side in (-1, 1):
                    lx, lz = bx + nx * offset * side, bz + nz * offset * side
                    if not (W_X + 10 <= lx <= E_X - 10 and N_Z + 10 <= lz <= S_Z - 10):
                        continue
                    lk = (round(lx / 18), round(lz / 18))
                    if lk not in lamp_grid:
                        lamp_grid.add(lk)
                        heading = int(math.degrees(math.atan2(-nx * side, -nz * side))) % 360
                        streetlights += [r1(lx), r1(lz), style, heading]

    # Synthesize fire hydrants along streets if few mapped in OSM
    if len(hydrants) < 200:
        hyd_grid = {(round(hydrants[i] / 60), round(hydrants[i + 1] / 60)) for i in range(0, len(hydrants), 2)}
        for r in drive:
            if r['bridge'] or r['cls'] not in (1, 2, 3, 4):
                continue
            pts = r['pts']
            if len(pts) < 2:
                continue
            x0, z0 = pts[0]
            x1, z1 = pts[-1]
            seg_len = math.hypot(x1 - x0, z1 - z0)
            if seg_len < 65.0:
                continue
            mx, mz = pts[len(pts) // 2]
            tx, tz = (x1 - x0) / seg_len, (z1 - z0) / seg_len
            hx, hz = mx - tz * (r['w'] * 0.5 + 1.1), mz + tx * (r['w'] * 0.5 + 1.1)
            if W_X + 15 <= hx <= E_X - 15 and N_Z + 15 <= hz <= S_Z - 15:
                hk = (round(hx / 90), round(hz / 90))
                if hk not in hyd_grid:
                    hyd_grid.add(hk)
                    hydrants += [r1(hx), r1(hz)]

    # Named buildings & neighborhoods -> GEO.places
    for b in buildings:
        n = b['name']
        if not n or n[0].isdigit() or len(n) > 48:
            continue
        if n not in place_name_id:
            place_name_id[n] = len(place_names)
            place_names.append(n)
        minx, minz, maxx, maxz = b['geom'].bounds
        places_out += [r1(b['cx']), r1(b['cz']), r1(max(maxx - minx, maxz - minz) / 2), place_name_id[n]]

    for nb_name, nbx, nbz, nbr in cfg.get('neighborhood_places', []):
        if nb_name not in place_name_id:
            place_name_id[nb_name] = len(place_names)
            place_names.append(nb_name)
        places_out += [r1(nbx), r1(nbz), r1(nbr), place_name_id[nb_name]]

    # ---------------------------------------------------------------------------
    # 5. Trees (NYT2) & GEO.woods
    # ---------------------------------------------------------------------------
    print(f"Step 5: Generating {cfg['name']} street trees (NYT2) & park/wood trees...")
    rng = random.Random(cfg['rng_seed'])
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

    water_prep_trees = prep(water_open.buffer(3.0)) if not water_open.is_empty else None

    for nid, (x, z, tags) in nodes.items():
        if tags and tags.get('natural') == 'tree' and (W_X <= x <= E_X and N_Z <= z <= S_Z):
            if not hits_building(x, z):
                qx, qz = int(round(x * 2)), int(round(z * 2))
                if (qx, qz) not in tree_dict:
                    k = abs(qx * 17 + qz * 31) % 7
                    h_q = min(255, int(round((10.0 + (abs(qx * 13 + qz * 29) % 36) * 0.25) * 4)))
                    tree_dict[(qx, qz)] = (k, h_q)
                woods_flat += [r1(x), r1(z), 1]

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
                        sp = rng.choice([0, 1, 2, 3, 3, 4, 4, 5, 6])
                        h_q = int(round(rng.uniform(8.0, 17.5) * 4))
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
    tree_gz_path = os.path.join(out_dir, 'tree-geodata.bin.gz')
    with gzip.open(tree_gz_path, 'wb', 9) as f:
        f.write(nyt2_data)
    print(f"Wrote {tree_gz_path} ({len(street_trees)} street trees, {len(woods_flat)//3} park/wood trees)")

    # ---------------------------------------------------------------------------
    # 6. Elevation (ELV2) & River/Pond Bed (RIV1)
    # ---------------------------------------------------------------------------
    print("Step 6: Building data/elevation.bin.gz (ELV2) and data/river.bin.gz (RIV1)...")
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
    base_elev = float(cfg.get('base_elev', 0.0))
    if base_elev > 0.0:
        # Store elev - base_elev (shifted so minimum inside bbox stays >= 2.45 m for pond/river bed carving)
        p05 = float(np.percentile(H[inside], 0.5))
        ref_base = min(base_elev, p05 - 2.45)
        elev = np.clip(H - ref_base, 2.45, 600.0)
    else:
        BASE = max(0.0, float(np.percentile(H[inside], 0.5)))
        elev = np.clip(H - BASE + 2.45, 2.45, 600.0)
    cm_elev = np.clip(np.round(elev * 100.0), 0, 65535).astype('<u2')
    elv_header = b'ELV2' + struct.pack('<6f', ex0, ez0, STEP, cols, rows, base_elev)
    elv_path = os.path.join(data_dir, 'elevation.bin.gz')
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
    riv_path = os.path.join(data_dir, 'river.bin.gz')
    with gzip.open(riv_path, 'wb', compresslevel=9) as f:
        f.write(riv_header + dig_bytes + cm_level.tobytes())

    # ---------------------------------------------------------------------------
    # 7. Write cities/<city>/city-geodata.js and cities/<city>/data/*.json(.gz)
    # ---------------------------------------------------------------------------
    print(f"Step 7: Writing {out_dir}/city-geodata.js and {data_dir}/*.json(.gz)...")

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

    GEO = {
        'version': 1,
        'city': city_id,
        'frame': {
            'bearingDeg': 0,
            'origin': cfg['origin_desc'],
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
        'golf': {
            'fairways': golf_fairways,
            'greens': golf_greens,
            'tees': golf_tees,
            'bunkers': golf_bunkers,
            'paths': golf_paths,
            'pins': golf_pins,
        },
        'trails': trails,
        'streetlights': streetlights,
        'controls': controls,
        'signs': {'names': sign_names, 'list': signs_out},
        'places': {'names': place_names, 'list': places_out},
        'playgrounds': playgrounds,
        'lawns': lawn_polys,
        'driveways': [],
        'garageDoors': [],
        'landmarks': cfg['landmarks_meta'],
    }

    geodata_js_path = os.path.join(out_dir, 'city-geodata.js')
    with open(geodata_js_path, 'w', encoding='utf-8') as f:
        f.write(f'// cities/{city_id}/city-geodata.js - GENERATED by tools/build-city-pack.py from OpenStreetMap (ODbL).\n')
        f.write('export const GEO = ')
        json.dump(GEO, f, separators=(',', ':'))
        f.write(';\n')
    print(f"Wrote {geodata_js_path} ({os.path.getsize(geodata_js_path) // 1024} KB)")

    with open(os.path.join(data_dir, 'addresses.json'), 'w', encoding='utf-8') as f:
        json.dump(addresses[:108000], f, separators=(',', ':'))

    with open(os.path.join(data_dir, 'roof-shapes.json'), 'w', encoding='utf-8') as f:
        json.dump(roof_shapes, f, separators=(',', ':'))

    with open(os.path.join(data_dir, 'gas-stations.json'), 'w', encoding='utf-8') as f:
        json.dump({'canopies': fuel_canopies}, f, separators=(',', ':'))

    rail_crossings = []
    for nid, (x, z, tags) in nodes.items():
        if tags and tags.get('railway') == 'level_crossing' and (W_X <= x <= E_X and N_Z <= z <= S_Z):
            gates = 0 if tags.get('crossing:barrier') == 'no' else 1
            rail_crossings.extend([r1(x), r1(z), gates])
    with open(os.path.join(data_dir, 'rail-crossings.json'), 'w', encoding='utf-8') as f:
        json.dump(rail_crossings, f, separators=(',', ':'))

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

    with open(os.path.join(data_dir, 'street-furniture.json'), 'w', encoding='utf-8') as f:
        json.dump({'hydrants': hydrants, 'amenities': park_amenities, 'courts': courts_flat}, f, separators=(',', ':'))

    historic_out = list(cfg.get('historic_districts', []))
    with open(os.path.join(data_dir, 'districts.json'), 'w', encoding='utf-8') as f:
        json.dump({'historic': historic_out, 'landuse': landuse_out[:1600]}, f, separators=(',', ':'))

    # Amtrak timetable from cached tools/.cache/amtrak_gtfs.zip
    amtrak_trips = []
    amtrak_zip_path = os.path.join(CACHE_DIR, 'amtrak_gtfs.zip')
    target_stop_id = cfg['amtrak_stop_id']
    west_kw = cfg['amtrak_west_keywords']

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
                seen_trips = set()
                for r in csv.DictReader(io.TextIOWrapper(zf.open('stop_times.txt'), encoding='utf-8-sig')):
                    if r.get('stop_id') != target_stop_id:
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
                    head = (tr.get('trip_headsign') or rt.get('route_long_name') or '').strip()
                    way = 'west' if (tr.get('direction_id') == '1' or any(k in head for k in west_kw)) else 'east'
                    key = (short_num, arr_sec, days)
                    if key in seen_trips:
                        continue
                    seen_trips.add(key)
                    start_d = min(str(c.get('start_date') or '20250101'), '20250101')
                    end_d = max(str(c.get('end_date') or '20301231'), '20301231')
                    amtrak_trips.append([short_num, way, head, arr_sec, dep_sec, days, start_d, end_d])
            amtrak_trips.sort(key=lambda x: x[3])
            print(f"  Loaded {len(amtrak_trips)} official Amtrak GTFS rail trips at {target_stop_id}")
        except Exception as e:
            print(f"  Warning: Failed to parse amtrak_gtfs.zip ({e})")

    if not amtrak_trips:
        amtrak_trips = list(cfg['amtrak_fallback'])

    with open(os.path.join(data_dir, 'wolverine.json'), 'w', encoding='utf-8') as f:
        json.dump({'station': cfg['amtrak_station_name'], 'trips': amtrak_trips}, f, separators=(',', ':'))

    # Transit bus schedule in exact theride.js / actransit.js schema -> data/transit.json.gz
    adj = defaultdict(list)
    for link in glinks:
        u, v, name_idx, w, lanes, d_dir, mid_flat, cls = link[:8]
        if cls <= 3:
            ux, uz = gnodes[u]
            vx, vz = gnodes[v]
            coords = [(ux, uz)] + list(zip(mid_flat[0::2], mid_flat[1::2])) + [(vx, vz)]
            length = sum(math.hypot(coords[i + 1][0] - coords[i][0], coords[i + 1][1] - coords[i][1]) for i in range(len(coords) - 1))
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

    routes = []
    stops = []
    shapes = []
    headsigns = []
    trips = []
    t_prefix = cfg['transit_prefix']

    for r_num, r_long, head_fwd, head_rev, col_str, wps in cfg['corridor_waypoints']:
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
                dists.append(dists[-1] + math.hypot(pts_dir[i + 1][0] - pts_dir[i][0], pts_dir[i + 1][1] - pts_dir[i][1]))
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
                stops.append([f"{r_long} Stop {k + 1}", r1(px), r1(pz)])
                route_stop_indices.append((st_ix, frac))

            for blk_num, dep_t in enumerate(range(5 * 3600 + 30 * 60 + r_ix * 90, 23 * 3600 + 30 * 60, 12 * 60)):
                seq = []
                for st_ix, frac in route_stop_indices:
                    arr = int(round(dep_t + frac * dur_sec))
                    dep = arr + (15 if 0 < frac < 1 else 0)
                    seq.extend([st_ix, arr, dep])
                trips.append([r_ix, sh_ix, h_ix, 0, f"{t_prefix}_{r_ix}_{sh_ix}_{blk_num}", *seq])

    trips.sort(key=lambda r: r[6])
    transit_out = {
        'feed': [cfg['transit_feed_id'], '20250101', '20301231'],
        'routes': routes,
        'stops': stops,
        'shapes': shapes,
        'headsigns': headsigns,
        'calendar': [[0, '1111111', '20250101', '20301231']],
        'exceptions': [],
        'trips': trips,
    }
    transit_gz_path = os.path.join(data_dir, 'transit.json.gz')
    with gzip.open(transit_gz_path, 'wt', encoding='utf-8', compresslevel=9) as f:
        json.dump(transit_out, f, separators=(',', ':'))
    print(f"Wrote {transit_gz_path} ({len(routes)} routes, {len(stops)} stops, {len(trips)} trips)")

    print(
        f"Summary for {city_id}: "
        f"buildings={len(packed_bldgs)}, roads={len(roads_out)} (links={len(glinks)}), "
        f"blocks={len(blocks)}, street_trees={len(street_trees)}, park_trees={len(woods_flat)//3}, "
        f"transit_routes={len(routes)} (trips={len(trips)})"
    )


ALL_CITY_METADATA = {
    'royaloak': ('Royal Oak, MI', 'OpenStreetMap + AWS Terrain Tiles + SMART GTFS (10 Mile to 14 Mile Rd)'),
    'oakland': ('Oakland, CA', 'OpenStreetMap + AWS Terrain Tiles + AC Transit / BART'),
    'annarbor': ('Ann Arbor, MI', 'University of Michigan, Downtown, Huron River & TheRide'),
    'newyork': ('New York, NY', 'Manhattan Grid, Central Park, Hudson/East Rivers & MTA Subway'),
    'pompanobeach': ('Pompano Beach, FL', 'Atlantic Ocean Pier, Hillsboro Lighthouse, Intracoastal Canals & BCT'),
    'sanfrancisco': ('San Francisco, CA', 'Union Square, Transamerica, Coit Tower, Ferry Bldg, Lombard St & Muni'),
}


def list_city_packs():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("Go To Anywhere (GTA) - Local City Packs (cities/<id>/):\n")
    print(f"  {'ID':<12} {'DISPLAY NAME':<18} {'STATUS':<22} {'DESCRIPTION'}")
    print(f"  {'-' * 12} {'-' * 18} {'-' * 22} {'-' * 46}")
    for cid, (disp, desc) in ALL_CITY_METADATA.items():
        cdir = os.path.join(root_dir, 'cities', cid)
        geo_file = os.path.join(cdir, 'city-geodata.js')
        if os.path.isfile(geo_file):
            total_bytes = sum(
                os.path.getsize(os.path.join(dp, f))
                for dp, _, fns in os.walk(cdir)
                for f in fns
            )
            status = f"installed ({total_bytes / (1024 * 1024):.1f} MB)"
        else:
            status = "not installed"
        print(f"  {cid:<12} {disp:<18} {status:<22} {desc}")
    print("\nInstall or rebuild a city pack locally with:")
    print("  npm run city:install -- <city-id|all>")
    print("  python3 tools/build-city-pack.py --city <city-id|all>")


def ensure_geo_deps_or_reexec():
    if HAS_GEO_DEPS:
        return
    venv_py = os.path.join(ROOT_DIR, '.venv', 'bin', 'python')
    if os.path.isfile(venv_py) and os.path.realpath(sys.executable) != os.path.realpath(venv_py):
        os.execv(venv_py, [venv_py, __file__, *sys.argv[1:]])
    uv_bin = shutil.which('uv')
    if uv_bin and not os.environ.get('GTA_UV_REEXEC'):
        env = dict(os.environ, GTA_UV_REEXEC='1')
        os.execve(
            uv_bin,
            [uv_bin, 'run', '--with', 'shapely', '--with', 'numpy', '--with', 'pillow', 'python3', __file__, *sys.argv[1:]],
            env,
        )
    raise SystemExit(
        "Missing Python dependencies (shapely, numpy, Pillow).\n"
        "Install them with: pip install -r requirements.txt\n"
        "Or run with uv: uv run --with shapely --with numpy --with pillow python3 tools/build-city-pack.py --city royaloak"
    )


def install_or_build_city(city_id):
    if city_id in CITY_CONFIGS:
        ensure_geo_deps_or_reexec()
        build_city_pack(city_id)
    elif city_id in ('annarbor', 'newyork'):
        import importlib.util
        pkg_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'package-existing-cities.py')
        spec = importlib.util.spec_from_file_location('package_existing_cities', pkg_script)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        if city_id == 'annarbor':
            mod.package_annarbor()
        else:
            mod.package_newyork()
    else:
        raise ValueError(f"Unknown city pack: {city_id}")


def main():
    choices = list(ALL_CITY_METADATA.keys()) + ['all']
    parser = argparse.ArgumentParser(description="Build or install local city pack geodata for Go To Anywhere (GTA)")
    parser.add_argument('city_pos', nargs='?', choices=choices, help="Optional positional city pack ID (or 'all')")
    parser.add_argument('--city', default=None, choices=choices, help="City pack ID to build/install (or 'all')")
    parser.add_argument('--list', action='store_true', help="List available city packs and local installation status")
    args = parser.parse_args()
    if args.list:
        list_city_packs()
        return
    target = args.city or args.city_pos or 'royaloak'
    if target == 'all':
        for cid in ALL_CITY_METADATA:
            install_or_build_city(cid)
    else:
        install_or_build_city(target)


if __name__ == '__main__':
    main()
