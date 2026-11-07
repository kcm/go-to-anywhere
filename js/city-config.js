import { historicDistrictAt } from './districts.js';
import { GEO } from './city-geodata.js';
import { ACTIVE_CITY_ID, CITY_PACK } from './city-packs.js';

// Multi-city spatial configuration & street database at true 1:1 scale (1 unit = 1 m).
// Supports both OSM-polygon cities (Royal Oak, Oakland, Ann Arbor) and Manhattan's grid+shoreline (New York).

const toPts = (flat) => {
  if (!Array.isArray(flat) || !flat.length) return [];
  if (typeof flat[0] === 'object' && flat[0] !== null) return flat;
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], z: flat[i + 1] });
  return out;
};

const IS_GRID_CITY = Boolean(GEO.avenues && GEO.streets && GEO.avenues.length && GEO.streets.length);
const CUT_Z = GEO.frame?.cutZ ?? -5560;
const FAR = 1e6;

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const PRETTY = {
  'W  END AVE': 'West End Ave', '11 AVE': '11th Ave', 'AMSTERDAM AVE': 'Amsterdam Ave', '10 AVE': '10th Ave',
  'COLUMBUS AVE': 'Columbus Ave', '9 AVE': '9th Ave', 'MANHATTAN AVE': 'Manhattan Ave', 'FREDERICK DOUGLASS BLVD': 'Frederick Douglass Blvd',
  'CENTRAL PARK W': 'Central Park W', '8 AVE': '8th Ave', 'ADAM CLAYTON POWELL JR BLVD': 'Adam Clayton Powell Jr Blvd', '7 AVE': '7th Ave',
  'LENOX AVE': 'Lenox Ave', 'MALCOLM X BLVD': 'Malcolm X Blvd', 'AVE OF THE AMERICAS': '6th Ave', '5 AVE': '5th Ave',
  'MADISON AVE': 'Madison Ave', 'PARK AVE': 'Park Ave', 'PARK AVE S': 'Park Ave S', 'LEXINGTON AVE': 'Lexington Ave',
  '3 AVE': '3rd Ave', '2 AVE': '2nd Ave', '1 AVE': '1st Ave', 'YORK AVE': 'York Ave', 'SUTTON PL': 'Sutton Pl',
  'PLEASANT AVE': 'Pleasant Ave', 'AVE A': 'Ave A', 'E  END AVE': 'East End Ave', 'AVE B': 'Ave B', 'AVE C': 'Ave C',
  'AVE D': 'Ave D', 'VANDERBILT AVE': 'Vanderbilt Ave', 'UNIVERSITY PL': 'University Pl', 'IRVING PL': 'Irving Pl',
  'RIVERSIDE DR': 'Riverside Dr', 'ST NICHOLAS AVE': 'St Nicholas Ave'
};

function prettyName(n) {
  if (!n) return '';
  if (Object.hasOwn(PRETTY, n)) return PRETTY[n];
  if (!IS_GRID_CITY) return String(n);
  const m = /^(E|W)\s+(\d+)\s+ST$/.exec(n);
  if (m) return `${m[1]} ${ordinal(+m[2])} St`;
  return String(n).replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(\d+) (St|Ave)\b/g, (_, d, t) => `${ordinal(+d)} ${t}`);
}

const SHORT = {
  riverside: 'Riverside Dr', 11: '11th Ave', 10: '10th Ave', 9: '9th Ave', manhattan: 'Manhattan Ave', 8: '8th Ave',
  st_nicholas: 'St Nicholas', 7: '7th Ave', 6: '6th Ave', 5: '5th Ave', madison: 'Madison', park: 'Park Ave',
  lex: 'Lexington', 3: '3rd Ave', 2: '2nd Ave', 1: '1st Ave', york: 'York/Ave A', eastend: 'East End/Ave B',
  c: 'Ave C', d: 'Ave D', vanderbilt: 'Vanderbilt', university: 'University Pl', irving: 'Irving Pl'
};
const MINOR_AVENUES = new Set(['vanderbilt', 'university', 'irving', 'manhattan', 'st_nicholas', 'riverside', 'c', 'd']);
const CP_SPLIT = new Set(['6', '7']);

const STREET_BY_NUMBER = new Map((GEO.streets || []).map((s) => [s.n ?? s.num, s]));
function streetZ(n) {
  if (!IS_GRID_CITY) return (42 - n) * 80;
  const s = STREET_BY_NUMBER.get(n);
  if (s) return s.z;
  let lo = n - 1;
  let hi = n + 1;
  while (lo > 0 && !STREET_BY_NUMBER.has(lo)) lo--;
  while (hi < 300 && !STREET_BY_NUMBER.has(hi)) hi++;
  const a = STREET_BY_NUMBER.get(lo);
  const b = STREET_BY_NUMBER.get(hi);
  if (a && b) return a.z + ((n - lo) / (hi - lo)) * (b.z - a.z);
  return (42 - n) * 79.5;
}

const ALL_AVENUES = IS_GRID_CITY
  ? (GEO.avenues || []).map((a) => {
      const segs = a.segs || [{ z0: -7000, z1: 6000, dir: a.dir || 0, w: a.width || 24, lanes: a.lanes || 4 }];
      const main = segs.reduce((m, s) => (s.z1 - s.z0 > m.z1 - m.z0 ? s : m), segs[0]);
      return {
        id: a.id,
        x: a.x,
        name: a.label || a.name,
        short: SHORT[a.id] || a.label || a.name,
        dir: main.dir,
        width: main.w,
        sidewalk: 5.2,
        lanes: main.lanes,
        minZ: Math.min(...segs.map((s) => s.z0)),
        maxZ: Math.max(...segs.map((s) => s.z1)),
        segs,
        hasMedian: a.id === 'park',
        isSecondary: MINOR_AVENUES.has(a.id),
        splitByCentralPark: CP_SPLIT.has(a.id)
      };
    })
  : [];

if (IS_GRID_CITY) {
  ALL_AVENUES.push(
    { id: 'westside', x: -2000, name: '12th Ave / West Side Hwy (NY 9A)', short: 'West Side Hwy', dir: 0, width: 28, isHighway: true, minZ: CUT_Z, maxZ: 6200, followsShore: 'west' },
    { id: 'fdr', x: 1500, name: 'FDR Drive', short: 'FDR Dr', dir: 0, width: 26, isHighway: true, minZ: CUT_Z, maxZ: 6400, followsShore: 'east' }
  );
}

const AVENUE_BY_ID = new Map(ALL_AVENUES.map((a) => [String(a.id), a]));
const avenueX = (id) => (IS_GRID_CITY && AVENUE_BY_ID.has(String(id)) ? AVENUE_BY_ID.get(String(id)).x : FAR);

const coreAve = (id, name, extra = {}) => {
  const a = AVENUE_BY_ID.get(String(id));
  if (!a) return null;
  return { x: a.x, name, dir: a.dir, width: a.width, sidewalk: 5.2, ...extra };
};

const AVENUES = IS_GRID_CITY
  ? [
      coreAve('8', '8th Ave'),
      coreAve('7', '7th Ave / Broadway', { isTimesSquare: true }),
      coreAve('6', '6th Ave'),
      coreAve('5', '5th Ave'),
      coreAve('park', 'Park Ave', { dir: 0, hasMedian: true, width: 33 }),
      coreAve('lex', 'Lexington Ave'),
      coreAve('3', '3rd Ave')
    ].filter(Boolean)
  : [];

const coreSt = (n, name, extra = {}) => {
  const s = STREET_BY_NUMBER.get(n);
  if (!s) return null;
  const segs = s.segs || [[-1500, 1500, 0, 18]];
  const seg = segs.reduce((m, q) => (q[1] - q[0] > m[1] - m[0] ? q : m), segs[0]);
  return { z: s.z, name, dir: seg[2], width: seg[3], sidewalk: 4.6, number: n, ...extra };
};

const STREETS = IS_GRID_CITY
  ? [
      coreSt(58, '58th St'),
      coreSt(57, '57th St', { isMajor: true }),
      coreSt(56, '56th St'),
      coreSt(55, '55th St'),
      coreSt(54, '54th St'),
      coreSt(53, '53rd St'),
      coreSt(52, '52nd St'),
      coreSt(51, '51st St'),
      coreSt(50, '50th St'),
      coreSt(49, '49th St'),
      coreSt(48, '48th St'),
      coreSt(47, '47th St'),
      coreSt(46, '46th St'),
      coreSt(45, '45th St'),
      coreSt(44, '44th St'),
      coreSt(43, '43rd St'),
      coreSt(42, '42nd St', { isMajor: true }),
      coreSt(41, '41st St'),
      coreSt(40, '40th St'),
      coreSt(39, '39th St'),
      coreSt(38, '38th St'),
      coreSt(37, '37th St'),
      coreSt(36, '36th St'),
      coreSt(35, '35th St'),
      coreSt(34, '34th St', { isMajor: true }),
      coreSt(33, '33rd St')
    ].filter(Boolean)
  : [];

const BIG_PARK_BOUNDS = IS_GRID_CITY
  ? {
      minX: avenueX('8') + 15,
      maxX: avenueX('5') - 15,
      minZ: streetZ(110) + 15,
      maxZ: streetZ(59) - 15
    }
  : { minX: FAR, maxX: FAR + 1, minZ: FAR, maxZ: FAR + 1 };
// Outline of the detailed town / island
const TOWN_EDGE = toPts(GEO.edge || GEO.manhattan || []);

const TOWN_BOUNDS = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of TOWN_EDGE) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  if (!Number.isFinite(minX)) {
    minX = -2500; maxX = 2500; minZ = -2500; maxZ = 2500;
  }
  return { minX, maxX, minZ, maxZ, sidewalkHeight: 0.22, waterLevel: -2.2 };
})();
const ISLAND_BOUNDS = TOWN_BOUNDS;

const SHORE = (() => {
  if (!IS_GRID_CITY || TOWN_EDGE.length < 3) return null;
  const step = 4;
  const z0 = Math.floor(TOWN_BOUNDS.minZ);
  const z1 = Math.ceil(TOWN_BOUNDS.maxZ);
  const n = Math.ceil((z1 - z0) / step) + 1;
  const west = new Float32Array(n).fill(NaN);
  const east = new Float32Array(n).fill(NaN);
  const P = TOWN_EDGE;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[j], b = P[i];
    if (a.z === b.z) continue;
    const lo = Math.min(a.z, b.z), hi = Math.max(a.z, b.z);
    const k0 = Math.max(0, Math.ceil((lo - z0) / step));
    const k1 = Math.min(n - 1, Math.floor((hi - z0) / step));
    for (let k = k0; k <= k1; k++) {
      const z = z0 + k * step + 1e-3;
      if (z < lo || z >= hi) continue;
      const x = a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z);
      if (!(west[k] <= x)) west[k] = x;
      if (!(east[k] >= x)) east[k] = x;
    }
  }
  for (let k = 1; k < n; k++) if (Number.isNaN(west[k])) { west[k] = west[k - 1]; east[k] = east[k - 1]; }
  for (let k = n - 2; k >= 0; k--) if (Number.isNaN(west[k])) { west[k] = west[k + 1]; east[k] = east[k + 1]; }
  return { z0, step, n, west, east, z1 };
})();

function getTownBoundsAtZ(z) {
  if (SHORE) {
    const f = (z - SHORE.z0) / SHORE.step;
    const k = Math.max(0, Math.min(SHORE.n - 2, Math.floor(f)));
    const t = Math.max(0, Math.min(1, f - k));
    return {
      westX: SHORE.west[k] + (SHORE.west[k + 1] - SHORE.west[k]) * t,
      eastX: SHORE.east[k] + (SHORE.east[k + 1] - SHORE.east[k]) * t
    };
  }
  return { westX: TOWN_BOUNDS.minX, eastX: TOWN_BOUNDS.maxX };
}
const getIslandBoundsAtZ = getTownBoundsAtZ;

const BROADWAY_LINE = toPts(GEO.broadway || []);
function getBroadwayX(z) {
  const L = BROADWAY_LINE;
  if (!L.length) return 0;
  if (z <= L[0].z) return L[0].x;
  if (z >= L[L.length - 1].z) return L[L.length - 1].x;
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (L[mid].z <= z) lo = mid;
    else hi = mid;
  }
  const a = L[lo], b = L[hi];
  return a.x + ((z - a.z) / Math.max(1e-6, b.z - a.z)) * (b.x - a.x);
}

// Waterfront piers & bridges (populated for New York; empty for inland/non-pier cities)
const PIER_KINDS = [
  ['Pier 99', 'Pier 99', 'sanitation'],
  ['Pier 92', 'Pier 92 \u00b7 Cruise Terminal', 'cruise'],
  ['Pier 90', 'Pier 90 \u00b7 Cruise Terminal', 'cruise', { cruiseShip: true }],
  ['Pier 88', 'Pier 88 \u00b7 Cruise Terminal', 'cruise'],
  ['Pier 86', 'Pier 86 \u00b7 Intrepid Museum', 'intrepid', { isLandmarkPier: true }],
  ['Pier 84', 'Pier 84 \u00b7 Hudson River Pk', 'park'],
  ['Pier 83', 'Pier 83 \u00b7 Circle Line', 'ferryPier', { circleLine: true }],
  ['Pier 81', 'Pier 81 \u00b7 World Yacht', 'ferryPier', { ferries: 2, ferryLen: 24 }],
  ['Pier 76', 'Pier 76 \u00b7 Hudson Yards', 'shed', { roofParking: true }],
  ['Pier 66', 'Pier 66 \u00b7 26th St', 'park', { lightship: true }],
  ['Pier 64', 'Pier 64 \u00b7 Hudson River Pk', 'park'],
  ['Pier 62', 'Pier 62 \u00b7 Chelsea Piers', 'park'],
  ['Pier 61', 'Pier 61 \u00b7 Chelsea Piers', 'chelsea'],
  ['Pier 60', 'Pier 60 \u00b7 Chelsea Piers', 'chelsea', { sign: true }],
  ['Pier 59', 'Pier 59 \u00b7 Chelsea Piers', 'chelsea', { golf: true }],
  ['Pier 57', 'Pier 57 \u00b7 Rooftop Park', 'pier57'],
  ['Little Island', 'Little Island @ Pier 55', 'littleIsland'],
  ['Pier 45 at Hudson River Park', 'Pier 45 \u00b7 Christopher St', 'park'],
  ['Pier 46', 'Pier 46 \u00b7 Charles St', 'park'],
  ['Pier 40', 'Pier 40 \u00b7 Houston St', 'pier40'],
  ['Pier 34', 'Pier 34 \u00b7 Canal St', 'vent'],
  ['Pier 26', 'Pier 26 \u00b7 Tribeca', 'park'],
  ['Pier 25', 'Pier 25 \u00b7 Tribeca', 'fields'],
  ['Pier 15', 'Pier 15 \u00b7 Seaport Esplanade', 'pier15'],
  ['Pier 11', 'Pier 11 \u00b7 Wall St Ferry', 'ferryPier', { ferries: 2 }]
];
const WATERFRONT_PIERS = [];
if (IS_GRID_CITY && Array.isArray(GEO.piers)) {
  for (const [osm, name, kind, extra] of PIER_KINDS) {
    const cands = GEO.piers.filter((p) => p.name === osm);
    if (!cands.length) continue;
    const p = cands.reduce((a, b) => (b.len * b.wid > a.len * a.wid ? b : a));
    const side = p.cx < getTownBoundsAtZ(p.cz).westX + 200 ? 'west' : 'east';
    WATERFRONT_PIERS.push({ side, name, kind, cx: p.cx, cz: p.cz, z: p.cz, length: p.len, width: p.wid, angle: p.ang, ring: toPts(p.ring), ...(extra || {}) });
  }
}

const islandPts = (k) => (GEO.islands && GEO.islands[k] ? toPts(GEO.islands[k]) : []);
const ROOSEVELT_ISLAND_POLYGON = islandPts('roosevelt');
const GOVERNORS_ISLAND_POLYGON = islandPts('governors');
const RANDALLS_ISLAND_POLYGON = islandPts('randalls');
const LIBERTY_ISLAND_POLYGON = islandPts('liberty');
const ELLIS_ISLAND_POLYGON = islandPts('ellis');
const MILL_ROCK_POLYGON = islandPts('millRock');
const biggestRing = (rings) => (Array.isArray(rings) && rings.length ? rings.reduce((a, r) => (r.length > a.length ? r : a), rings[0]) : []);
const NJ_SHORELINE_POLYGON = GEO.boroughs?.newJersey?.[0] ? toPts(GEO.boroughs.newJersey[0]) : [];
const BROOKLYN_POLYGONS = (GEO.boroughs?.brooklyn || []).map(toPts);
const QUEENS_POLYGONS = (GEO.boroughs?.queens || []).map(toPts);
const BRONX_POLYGONS = (GEO.boroughs?.brooklyn ? (GEO.boroughs.bronx || []).map(toPts) : []);
const STATEN_ISLAND_POLYGON = GEO.boroughs?.statenIsland ? toPts(biggestRing(GEO.boroughs.statenIsland)) : [];
const LONG_ISLAND_POLYGONS = GEO.boroughs?.brooklyn && GEO.boroughs?.queens
  ? [toPts(biggestRing(GEO.boroughs.brooklyn)), toPts(biggestRing(GEO.boroughs.queens))]
  : [];
const UPPER_MANHATTAN_POLYGON = toPts(GEO.upperManhattan || []);
const WESTCHESTER_POLYGON = [];
const NASSAU_POLYGON = [];

function shoreCrossing(ax, az, ux, uz, fromT, toT, inside) {
  for (let t = fromT; t <= toT; t += 2) {
    const x = ax + ux * t;
    const z = az + uz * t;
    const b = getTownBoundsAtZ(z);
    const on = x > b.westX && x < b.eastX;
    if (on !== inside) return t;
  }
  return toT;
}
function makeBridge(id, name, short, type, spec) {
  const g = GEO.bridges?.[id];
  if (!g) return null;
  const [ax, az] = g.a;
  const [ux, uz] = g.dir;
  const L = spec.length;
  const b = { x: ax + ux * L, z: az + uz * L };
  const tShore = shoreCrossing(ax, az, ux, uz, 0, L, true);
  const towers = spec.towers(tShore).map((t) => Math.round((t / L) * 10000) / 10000);
  return { id, name, short, type, a: { x: ax, z: az }, b, towers, ...spec.extra };
}
const EAST_RIVER_BRIDGES = IS_GRID_CITY && GEO.bridges
  ? [
      makeBridge('queensboro', 'Queensboro (59th St) Bridge', 'Queensboro Br', 'cantilever', {
        length: 1720,
        towers: (s) => [s - 60, s + 300, s + 480, s + 780],
        extra: { deckY: 41, towerH: 107, width: 27 }
      }),
      makeBridge('williamsburg', 'Williamsburg Bridge', 'Williamsburg Br', 'suspension', {
        length: 2040,
        towers: (s) => [s + 30, s + 30 + 488],
        extra: { deckY: 41, towerH: 102, width: 36, sideSpan: 182, anchorage: [34, 10] }
      }),
      makeBridge('manhattan', 'Manhattan Bridge', 'Manhattan Br', 'suspension', {
        length: 1700,
        towers: (s) => [s + 25, s + 25 + 448],
        extra: { deckY: 41, towerH: 98, width: 37, sideSpan: 220, anchorage: [34, 10] }
      }),
      makeBridge('brooklyn', 'Brooklyn Bridge', 'Brooklyn Br', 'brooklyn', {
        length: 1480,
        towers: (s) => [s + 20, s + 20 + 486],
        extra: { deckY: 38, towerH: 84, width: 26, sideSpan: 284, anchorage: [40, 14] }
      })
    ].filter(Boolean)
  : [];
const SUSPENSION_BRIDGES = EAST_RIVER_BRIDGES;
const OUTER_BRIDGES = [];

// Water, parking lots, and named parks/forests
const WATER_POLYGONS = (GEO.water || []).map((rings) => rings.map(toPts));
const PARKING_LOTS = (GEO.parking || []).map((rings) => rings.map(toPts));
const PARKS = (GEO.parks || []).map((entry) => {
  const [name, acres, cx, cz, rawRings, cat] = Array.isArray(entry)
    ? entry
    : [entry.name || '', entry.acres || 0, entry.cx || 0, entry.cz || 0, entry.rings || [], entry.cat || 'park'];
  const rings = (rawRings || []).map(toPts);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of rings) {
    for (const p of r) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  return { name, acres, cx, cz, rings, cat: cat || 'park', minX, maxX, minZ, maxZ };
});

// Named roads & spatial index
const ROADS = (GEO.roads || []).map((entry) => {
  if (Array.isArray(entry)) {
    const [name, w, dir, lanes, hw, flat] = entry;
    const numDir = dir === 'FT' ? 1 : dir === 'TF' ? -1 : dir === 'TW' ? 0 : Number(dir) || 0;
    return { name: prettyName(name), raw: name, w, dir: numDir, lanes: lanes || 2, highway: !!hw, pts: toPts(flat) };
  }
  return {
    name: prettyName(entry.name),
    raw: entry.raw || entry.name || '',
    w: entry.w || 10,
    dir: entry.dir || entry.oneway || 0,
    lanes: entry.lanes || 2,
    highway: !!entry.highway,
    pts: toPts(entry.pts || [])
  };
});

const MAJOR_STREETS = new Set([125, 116, 110, 96, 86, 79, 72, 66, 59, 57, 42, 34, 23, 14]);
const CP_TRANSVERSES = new Set([97, 86, 79, 65]);
const STREET_SUFFIX = {
  125: ' (MLK Jr Blvd \u00b7 Harlem)', 110: ' (Cathedral Pkwy \u00b7 Central Park N)', 59: ' (Central Park South)', 42: ' (Times Sq \u00b7 Grand Central)',
  34: ' (Herald Sq \u00b7 Empire State)', 23: ' (Madison Sq \u00b7 Flatiron)', 14: ' (Union Square)', 8: ' (St Marks Pl)', 4: ' (West 4th \u00b7 Washington Sq)'
};
const ALL_STREETS = [];
if (IS_GRID_CITY) {
  for (const s of GEO.streets || []) {
    const num = s.n ?? s.num;
    if (num > 130) continue;
    const runs = (s.segs || []).filter((g) => g[1] - g[0] > 30);
    if (!runs.length) continue;
    const westX = Math.min(...runs.map((g) => g[0]));
    const eastX = Math.max(...runs.map((g) => g[1]));
    const main = runs.reduce((m, g) => (g[1] - g[0] > m[1] - m[0] ? g : m), runs[0]);
    ALL_STREETS.push({
      number: num,
      name: `${ordinal(num)} St${STREET_SUFFIX[num] || ''}`,
      short: `${ordinal(num)} St`,
      z: s.z,
      isMajor: MAJOR_STREETS.has(num),
      isTransverse: CP_TRANSVERSES.has(num),
      dir: MAJOR_STREETS.has(num) ? 0 : main[2],
      width: main[3],
      westX,
      eastX,
      runs,
      splitByCentralPark: s.z > BIG_PARK_BOUNDS.minZ && s.z < BIG_PARK_BOUNDS.maxZ
    });
  }
  ALL_STREETS.sort((a, b) => a.z - b.z);
}

const ROAD_CELL = 64;
const ROAD_GRID = new Map();
for (const r of ROADS) {
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const a = r.pts[i];
    const b = r.pts[i + 1];
    const seg = { r, ax: a.x, az: a.z, bx: b.x, bz: b.z };
    const ix0 = Math.floor(Math.min(a.x, b.x) / ROAD_CELL), ix1 = Math.floor(Math.max(a.x, b.x) / ROAD_CELL);
    const iz0 = Math.floor(Math.min(a.z, b.z) / ROAD_CELL), iz1 = Math.floor(Math.max(a.z, b.z) / ROAD_CELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const k = ix * 100000 + iz;
      if (!ROAD_GRID.has(k)) ROAD_GRID.set(k, []);
      ROAD_GRID.get(k).push(seg);
    }
  }
}

/** Nearest roads to (x, z) within `radius`: [{ road, dist, horizontal }] sorted by distance */
function nearestRoads(x, z, radius = 60) {
  const best = new Map();
  const ix0 = Math.floor((x - radius) / ROAD_CELL), ix1 = Math.floor((x + radius) / ROAD_CELL);
  const iz0 = Math.floor((z - radius) / ROAD_CELL), iz1 = Math.floor((z + radius) / ROAD_CELL);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = ROAD_GRID.get(ix * 100000 + iz);
    if (!list) continue;
    for (const s of list) {
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
      const d = Math.hypot(s.ax + t * dx - x, s.az + t * dz - z);
      if (d > radius) continue;
      const prev = best.get(s.r.name);
      if (!prev || d < prev.dist) best.set(s.r.name, { road: s.r, dist: d, horizontal: Math.abs(dx) > Math.abs(dz) });
    }
  }
  return [...best.values()].sort((a, b) => a.dist - b.dist);
}

// ---------------------------------------------------------------------------------------------------------------------
// Blocks: every real curb island (raised sidewalk slab) with its lot rectangles inside the property line
// ---------------------------------------------------------------------------------------------------------------------
const BLOCKS = (GEO.blocks || []).map((entry, id) => {
  const [flat, rects, park, parkName, isRect, frames, lawn] = Array.isArray(entry)
    ? entry
    : [entry.pts || [], entry.rects || [], entry.park || 0, entry.parkName || '', entry.rect ? 1 : 0, entry.frames || null, entry.lawn ? 1 : 0];
  const poly = toPts(flat);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, a = 0, cx = 0, cz = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[i], q = poly[j];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    const c = q.x * p.z - p.x * q.z;
    a += c; cx += (q.x + p.x) * c; cz += (q.z + p.z) * c;
  }
  a *= 0.5;
  const area = Math.abs(a);
  return {
    id, poly, rects: rects || [], frames: frames || null, park: park || 0, parkName: parkName || '',
    rect: !!isRect, area, lawn: !!lawn,
    minX, maxX, minZ, maxZ,
    cx: a ? cx / (6 * a) : (minX + maxX) / 2,
    cz: a ? cz / (6 * a) : (minZ + maxZ) / 2,
    median: /Malls?|Plaza$/.test(parkName || '') || Math.min(maxX - minX, maxZ - minZ) < 9
  };
});

const BLOCK_CELL = 64;
const BLOCK_GRID = new Map();
for (const b of BLOCKS) {
  for (let ix = Math.floor(b.minX / BLOCK_CELL); ix <= Math.floor(b.maxX / BLOCK_CELL); ix++) {
    for (let iz = Math.floor(b.minZ / BLOCK_CELL); iz <= Math.floor(b.maxZ / BLOCK_CELL); iz++) {
      const k = ix * 100000 + iz;
      if (!BLOCK_GRID.has(k)) BLOCK_GRID.set(k, []);
      BLOCK_GRID.get(k).push(b);
    }
  }
}
function pointInPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function blockAt(x, z) {
  const list = BLOCK_GRID.get(Math.floor(x / BLOCK_CELL) * 100000 + Math.floor(z / BLOCK_CELL));
  if (!list) return null;
  for (const b of list) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    if (b.rect || pointInPoly(b.poly, x, z)) return b;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Neighbourhoods / districts
// ---------------------------------------------------------------------------------------------------------------------
const AREAS = CITY_PACK.areas || [];
function districtAt(x, z) {
  if (ACTIVE_CITY_ID === 'oakland') {
    if (x >= -40 && x <= 520 && z >= 120 && z <= 580) return 'chinatown';
    if (x >= -620 && x <= -40 && z >= 120 && z <= 520) return 'old_oakland';
    if (x >= -650 && x <= 420 && z >= -250 && z <= 480) return 'downtown';
    if (x >= -550 && x <= 520 && z >= -1100 && z <= -250) return 'uptown';
  }
  if (IS_GRID_CITY) {
    const cp = BIG_PARK_BOUNDS;
    if (x > cp.minX && x < cp.maxX && z > cp.minZ && z < cp.maxZ) return 'central_park';
    if (z < streetZ(110)) return 'harlem';
    if (z < streetZ(59)) return x < cp.minX ? 'uws' : 'ues';
    if (z < streetZ(34)) return 'midtown';
    if (z < streetZ(14)) return 'flatiron';
    if (z < 3376) return 'village';
    if (z < 4859) return 'soho';
    return 'fidi';
  }
  let bestId = 'downtown', bestD = Infinity;
  for (const [ax, az, name] of AREAS) {
    const d = Math.hypot(x - ax, z - az);
    if (d < bestD) {
      bestD = d;
      bestId = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
  }
  return bestId;
}

function districtLabel(idOrX, z) {
  if (typeof idOrX === 'number' && typeof z === 'number') {
    let bestName = CITY_PACK.title, bestD = Infinity;
    for (const [ax, az, name] of AREAS) {
      const d = Math.hypot(idOrX - ax, z - az);
      if (d < bestD) { bestD = d; bestName = name; }
    }
    return bestName;
  }
  for (const [, , name] of AREAS) {
    if (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') === idOrX) return name;
  }
  return CITY_PACK.title;
}
for (const b of BLOCKS) b.district = districtAt(b.cx, b.cz);

// ---------------------------------------------------------------------------------------------------------------------
// Landmarks & street-level arrivals
// ---------------------------------------------------------------------------------------------------------------------
const LANDMARK_SITES = { ...(GEO.landmarks || {}) };
const LANDMARKS = (CITY_PACK.landmarks || []).map((l) => {
  const site = LANDMARK_SITES[l.name];
  const x = site && Number.isFinite(site.x) ? site.x : l.x;
  const z = site && Number.isFinite(site.z) ? site.z : l.z;
  return { ...l, x, z, district: districtLabel(x, z) };
});

function arrival(x, z, fallback = { x: 0, z: 0, heading: 0 }) {
  const near = nearestRoads(x, z, 260).filter((r) => !r.road.highway);
  if (!near.length) return { x: fallback.x ?? x, z: fallback.z ?? z, heading: fallback.heading ?? 0 };
  const { road } = near[0];
  let best = null;
  for (let i = 0; i + 1 < road.pts.length; i++) {
    const a = road.pts[i], b = road.pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const px = a.x + t * dx, pz = a.z + t * dz, d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d) best = { d, px, pz, dx, dz };
  }
  if (!best) return { x: fallback.x ?? x, z: fallback.z ?? z, heading: fallback.heading ?? 0 };
  const L = Math.hypot(best.dx, best.dz) || 1;
  const side = Math.sign((x - best.px) * (-best.dz / L) + (z - best.pz) * (best.dx / L)) || 1;
  const px = best.px + (-best.dz / L) * side * Math.min(3.5, road.w * 0.25);
  const pz = best.pz + (best.dx / L) * side * Math.min(3.5, road.w * 0.25);
  return { x: px, z: pz, heading: Math.atan2(x - px, z - pz) };
}

const TELEPORT_LOCATIONS = {};
for (const l of LANDMARKS) {
  TELEPORT_LOCATIONS[l.id] = arrival(l.x, l.z, l);
}
if (ACTIVE_CITY_ID === 'oakland') {
  TELEPORT_LOCATIONS.broadway = { x: 0, z: 48, heading: Math.PI };
} else if (ACTIVE_CITY_ID === 'royaloak') {
  TELEPORT_LOCATIONS.main4th = { x: -4.5, z: 45, heading: Math.PI };
}

// Named buildings lookup (GEO.places)
const PLACE_CELL = 100;
const placeCells = new Map();
{
  const { names = [], list = [] } = GEO.places || {};
  for (let i = 0; i < list.length; i += 4) {
    const key = Math.floor(list[i] / PLACE_CELL) + ',' + Math.floor(list[i + 1] / PLACE_CELL);
    if (!placeCells.has(key)) placeCells.set(key, []);
    placeCells.get(key).push({ x: list[i], z: list[i + 1], r: list[i + 2], name: names[list[i + 3]] });
  }
}
function buildingNameAt(x, z) {
  const cx = Math.floor(x / PLACE_CELL), cz = Math.floor(z / PLACE_CELL);
  let best = null, bestD = Infinity;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (const p of placeCells.get(cx + i + ',' + (cz + j)) || []) {
        const d = Math.hypot(x - p.x, z - p.z) - p.r;
        if (d < 14 && d < bestD) { best = p; bestD = d; }
      }
    }
  }
  return best ? best.name : null;
}

function getLocationLabel(x, z) {
  for (const l of LANDMARKS) {
    if (Math.hypot(x - l.x, z - l.z) < 90) {
      const near = nearestRoads(x, z, 120);
      return `${l.name}${near.length ? ` \u00b7 ${near[0].road.name}` : ''}`;
    }
  }
  const building = buildingNameAt(x, z);
  if (building) {
    const near = nearestRoads(x, z, 120);
    return `${building}${near.length ? ` \u00b7 ${near[0].road.name}` : ''}`;
  }
  const b = blockAt(x, z);
  if (b && b.park > 0.6 && b.parkName) return b.parkName;
  const near = nearestRoads(x, z, 160);
  const historic = historicDistrictAt(x, z);
  const lead = historic ? `${historic} \u00b7 ` : '';
  if (near.length >= 2) return `${lead}${near[0].road.name} & ${near[1].road.name}`;
  if (near.length) return `${lead}${near[0].road.name}`;
  if (historic) return historic;
  if (x < TOWN_BOUNDS.minX || x > TOWN_BOUNDS.maxX || z < TOWN_BOUNDS.minZ || z > TOWN_BOUNDS.maxZ) {
    return CITY_PACK.countyLabel || CITY_PACK.title;
  }
  const dLabel = districtLabel(x, z);
  return dLabel === CITY_PACK.title ? CITY_PACK.title : `${dLabel}, ${CITY_PACK.title}`;
}

const fromOldFrame = (x, z) => ({ x, z });
function getBlockBounds(col = 0, row = 0) {
  const cx = (col - 2.5) * 160;
  const cz = (row - 3.5) * 80;
  return { cx, cz, minX: cx - 50, maxX: cx + 50, minZ: cz - 30, maxZ: cz + 30, w: 100, d: 60 };
}

function isTypingInField(e) {
  return Boolean(e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA'));
}

const SIGNAL_TIMING = { cycle: 60, avenueAmber: 26, avenueRed: 30, streetAmber: 56, walk: 7 };

function signalPhase(time, isAvenue) {
  const { cycle, avenueAmber, avenueRed, streetAmber } = SIGNAL_TIMING;
  const t = ((time % cycle) + cycle) % cycle;
  if (isAvenue) return t < avenueAmber ? 'green' : t < avenueRed ? 'amber' : 'red';
  return t < avenueRed ? 'red' : t < streetAmber ? 'green' : 'amber';
}

function walkSignal(time, isAvenue) {
  const { cycle, avenueRed, walk } = SIGNAL_TIMING;
  const t = (((time - (isAvenue ? 0 : avenueRed)) % cycle) + cycle) % cycle;
  return t < walk;
}

export {
  WATER_POLYGONS,
  IS_GRID_CITY,
  PARKING_LOTS,
  PARKS,
  districtLabel,
  AVENUES,
  ALL_AVENUES,
  BIG_PARK_BOUNDS,
  getTownBoundsAtZ,
  getIslandBoundsAtZ,
  TOWN_EDGE,
  getBroadwayX,
  BROADWAY_LINE,
  WATERFRONT_PIERS,
  NJ_SHORELINE_POLYGON,
  BROOKLYN_POLYGONS,
  QUEENS_POLYGONS,
  BRONX_POLYGONS,
  STATEN_ISLAND_POLYGON,
  LONG_ISLAND_POLYGONS,
  UPPER_MANHATTAN_POLYGON,
  WESTCHESTER_POLYGON,
  NASSAU_POLYGON,
  ROOSEVELT_ISLAND_POLYGON,
  GOVERNORS_ISLAND_POLYGON,
  RANDALLS_ISLAND_POLYGON,
  LIBERTY_ISLAND_POLYGON,
  ELLIS_ISLAND_POLYGON,
  MILL_ROCK_POLYGON,
  SUSPENSION_BRIDGES,
  EAST_RIVER_BRIDGES,
  OUTER_BRIDGES,
  STREETS,
  ALL_STREETS,
  ROADS,
  LANDMARKS,
  LANDMARK_SITES,
  TELEPORT_LOCATIONS,
  TOWN_BOUNDS,
  ISLAND_BOUNDS,
  BLOCKS,
  CUT_Z,
  SIGNAL_TIMING,
  streetZ,
  avenueX,
  districtAt,
  blockAt,
  nearestRoads,
  getBlockBounds,
  getLocationLabel,
  fromOldFrame,
  isTypingInField,
  signalPhase,
  walkSignal
};
