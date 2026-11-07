import * as THREE from 'three/webgpu';
import { ACTIVE_CITY_ID } from './city-packs.js';
import { nearDrop } from './cascades.js';
import { riverbedHeight, riverDepth, waterLevel, bridgeDecks } from './terrain.js';

// The Huron River and its ponds sunk into their banks (terrain.js digs the bed from data/river.bin.gz): grassy banks
// sloping down through mud to the silt of the bed, the water lying flat at the river's level over it, and the bridges
// that cross it: the streets' concrete decks with sidewalks, parapets and piers, the railways' steel girders, and
// footbridges with railings, all with open water under them to paddle through.

// Every triangle split at its longest edge until `tooBig(a, b, c)` says it's small enough; positions only
function subdivide(geometry, tooBig) {
  const src = (geometry.index ? geometry.toNonIndexed() : geometry).attributes.position.array;
  const out = [];
  const split = (a, b, c, depth) => {
    if (depth > 22 || !tooBig(a, b, c)) { out.push(...a, ...b, ...c); return; }
    const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2;
    const ab = d2(a, b), bc = d2(b, c), ca = d2(c, a), m = Math.max(ab, bc, ca);
    const mid = (p, q) => [(p[0] + q[0]) / 2, 0, (p[2] + q[2]) / 2];
    if (m === ab) { const k = mid(a, b); split(a, k, c, depth + 1); split(k, b, c, depth + 1); }
    else if (m === bc) { const k = mid(b, c); split(a, b, k, depth + 1); split(a, k, c, depth + 1); }
    else { const k = mid(c, a); split(a, b, k, depth + 1); split(k, b, c, depth + 1); }
  };
  for (let i = 0; i < src.length; i += 9) {
    split([src[i], 0, src[i + 2]], [src[i + 3], 0, src[i + 5]], [src[i + 6], 0, src[i + 8]], 0);
  }
  return out;
}

const longest = (a, b, c) => Math.max((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2, (b[0] - c[0]) ** 2 + (b[2] - c[2]) ** 2,
  (c[0] - a[0]) ** 2 + (c[2] - a[2]) ** 2);

function meshOf(pos, material, name, colors = null, cullDist = 4500) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.receiveShadow = true;
  m.userData.cullDistance = cullDist;
  return m;
}

// The banks and bed, and the water over them. `geos` are the water's polygons, flat at y = 0
function buildRiver(group, geos, waterMat, roadMat = null) {
  const river = new THREE.Group();
  river.name = 'HuronRiver';
  river.userData.terrain = 'set';
  // The banks: cut fine (3 m) where the ground slopes down to the bed, coarse (40 m) over the bed itself
  const bankPos = [], bankCol = [];
  // the lawn's own green on the top, a deeper, shaggier green down the bank, a narrow strip of mud at the water
  const lawn = new THREE.Color(0x4f8a2e).convertSRGBToLinear(), grass = new THREE.Color(0x3f6b27).convertSRGBToLinear();
  const mud = new THREE.Color(0x5a4c35).convertSRGBToLinear();
  const silt = new THREE.Color(0x4a4632).convertSRGBToLinear(), c = new THREE.Color();
  const sloped = (p) => { const d = riverDepth(p[0], p[2]); return d > 0.001 && d < 0.999; };
  const isAnnArbor = ACTIVE_CITY_ID === 'annarbor';
  const isOakland = ACTIVE_CITY_ID === 'oakland';
  // around the Argo Cascades or Lake Merritt Channel (cascades.js), where the channel's levels step down
  const byCascades = (a, b, k) => {
    if (isAnnArbor) {
      return Math.max(a[0], b[0], k[0]) > 140 && Math.min(a[0], b[0], k[0]) < 660
        && Math.max(a[2], b[2], k[2]) > -1300 && Math.min(a[2], b[2], k[2]) < -1030;
    }
    if (isOakland) {
      return Math.max(a[0], b[0], k[0]) > 970 && Math.min(a[0], b[0], k[0]) < 1180
        && Math.max(a[2], b[2], k[2]) > 530 && Math.min(a[2], b[2], k[2]) < 1010;
    }
    return false;
  };
  const dry = (x, z) => { const lv = waterLevel(x, z); return lv === null || riverbedHeight(x, z) > lv + 0.1; };
  const waterPos = [];
  const inChannelZone = (a, b, k) => isAnnArbor || !isOakland || (Math.max(a[0], b[0], k[0]) > 350 && Math.min(a[2], b[2], k[2]) < 1520);
  for (const geo of geos) {
    const bank = subdivide(geo, (a, b, k) => {
      const l = longest(a, b, k);
      if (l > (inChannelZone(a, b, k) ? 1600 : 14400)) return true;
      if (l > 9 && byCascades(a, b, k)) return true; // following the ground there, every 3 m
      if (l <= (inChannelZone(a, b, k) ? 144 : 900)) return false;
      const m = [(a[0] + b[0] + k[0]) / 3, 0, (a[2] + b[2] + k[2]) / 3];
      return sloped(a) || sloped(b) || sloped(k) || sloped(m);
    });
    for (let i = 0; i < bank.length; i += 3) {
      const x = bank[i], z = bank[i + 2], y = riverbedHeight(x, z), lv = waterLevel(x, z) ?? y;
      // none on the land beside the cascades, which the ground there draws itself
      if (i % 9 === 0) {
        const a = [x, 0, z], b = [bank[i + 3], 0, bank[i + 5]], k = [bank[i + 6], 0, bank[i + 8]], high = (p) => {
          const g = riverbedHeight(p[0], p[2]), l = waterLevel(p[0], p[2]); return l === null || g > l + 0.6;
        };
        if (byCascades(a, b, k) && high(a) && high(b) && high(k)) { i += 6; continue; }
      }
      bankPos.push(x, y, z);
      const above = y - lv;
      if (above > 1.0) c.copy(grass).lerp(lawn, Math.min(1, (above - 1.0) / 0.4));
      else if (above > 0.25) c.copy(grass);
      else if (above > -0.3) c.copy(mud).lerp(grass, (above + 0.3) / 0.55);
      else c.copy(silt).lerp(mud, Math.max(0, (above + 1.2) / 0.9));
      bankCol.push(c.r, c.g, c.b);
    }
    // The water: flat at the river's level, cut every 20 m in Lake Merritt & the channel (120 m on the open Estuary)
    // and every 60 cm over the channel drops, so each step shows (cascades.js)
    const water = subdivide(geo, (a, b, k) => {
      const l = longest(a, b, k);
      if (l > (inChannelZone(a, b, k) ? 900 : 14400)) return true;
      if (l <= 0.36) return false;
      const reach = Math.sqrt(l);
      // and every 3 m down the rest of the channel, so its pools lie at their own levels
      // (any piece reaching over it, not only those with a corner in it, so none lies across a step)
      if (l > 9 && byCascades(a, b, k)) return true;
      return [a, b, k, [(a[0] + b[0] + k[0]) / 3, 0, (a[2] + b[2] + k[2]) / 3]].some((p) => nearDrop(p[0], p[2], reach));
    });
    for (let i = 0; i < water.length; i += 9) {
      const a = [water[i], 0, water[i + 2]], b = [water[i + 3], 0, water[i + 5]], k = [water[i + 6], 0, water[i + 8]];
      // none over the land beside the cascades, where the water would show through the ground
      if (byCascades(a, b, k) && dry(a[0], a[2]) && dry(b[0], b[2]) && dry(k[0], k[2])) continue;
      for (const [x, , z] of [a, b, k]) waterPos.push(x, waterLevel(x, z) ?? riverbedHeight(x, z) + 0.05, z);
    }
  }
  if (bankPos.length) {
    // in tiles, so only what's in view is drawn
    const bankMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.97 });
    const TILE = 700, tiles = new Map();
    for (let i = 0; i < bankPos.length; i += 9) {
      const key = Math.floor((bankPos[i] + bankPos[i + 3] + bankPos[i + 6]) / 3 / TILE) * 1000
        + Math.floor((bankPos[i + 2] + bankPos[i + 5] + bankPos[i + 8]) / 3 / TILE);
      if (!tiles.has(key)) tiles.set(key, [[], []]);
      const [tp, tc] = tiles.get(key);
      for (let k = 0; k < 9; k++) { tp.push(bankPos[i + k]); tc.push(bankCol[i + k]); }
    }
    for (const [tp, tc] of tiles.values()) river.add(meshOf(tp, bankMat, 'RiverBanks', tc));
  }
  if (waterPos.length) {
    // in tiles, so only what's in view is drawn
    const TILE = 700, tiles = new Map();
    for (let i = 0; i < waterPos.length; i += 9) {
      const key = Math.floor((waterPos[i] + waterPos[i + 3] + waterPos[i + 6]) / 3 / TILE) * 1000
        + Math.floor((waterPos[i + 2] + waterPos[i + 5] + waterPos[i + 8]) / 3 / TILE);
      if (!tiles.has(key)) tiles.set(key, []);
      const t = tiles.get(key);
      for (let k = 0; k < 9; k++) t.push(waterPos[i + k]);
    }
    for (const t of tiles.values()) {
      const m = meshOf(t, waterMat, 'RiverWater');
      const n = m.geometry.attributes.normal;
      // flat, but for the cascades' drops, which keep their slope (the water's shading tilts with it)
      const ps = m.geometry.attributes.position;
      for (let i = 0; i < n.count; i++) if (!nearDrop(ps.getX(i), ps.getZ(i), 0)) n.setXYZ(i, 0, 1, 0);
      river.add(m);
    }
  }
  group.add(river);
  buildBridges(river, roadMat);
}

// ---------------------------------------------------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------------------------------------------------

function buildBridges(group, roadMat = null) {
  const decks = bridgeDecks();
  if (!decks.length) return;
  const asphalt = [], concrete = [], steel = [], wood = [], rail = [];
  const upVec = new THREE.Vector3(0, 1, 0);
  const dirVec = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const strut = (out, a, b, w) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return;
    const g = new THREE.BoxGeometry(w, len, w).toNonIndexed();
    dirVec.set(dx / len, dy / len, dz / len);
    quat.setFromUnitVectors(upVec, dirVec);
    g.applyQuaternion(quat);
    g.translate((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5);
    out.push(...g.attributes.position.array);
  };

  for (const d of decks) {
    if (d.coincidentWith) continue;
    const P = d.points;
    // each point's way along the bridge and across it (to the left)
    const T = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
      return [tx / l, tz / l];
    });
    const at = (i, o, y) => [P[i][0] - T[i][1] * o, P[i][3] + y, P[i][1] + T[i][0] * o];
    // a strip along the bridge between offset o0 at height y0 and offset o1 at y1 (both sides with `both`)
    const along = (out, o0, y0, o1, y1, both = true) => {
      for (const s of both ? [1, -1] : [1]) {
        for (let i = 0; i + 1 < P.length; i++) {
          const a = at(i, o0 * s, y0), b = at(i, o1 * s, y1), c2 = at(i + 1, o1 * s, y1), d2 = at(i + 1, o0 * s, y0);
          out.push(...a, ...b, ...c2, ...a, ...c2, ...d2);
        }
      }
    };
    // a box standing across the bridge at point i: `across` wide, `thick` along it, from y0 up to y1 (world heights)
    const pier = (out, i, across, thick, y0, y1) => {
      const g = new THREE.BoxGeometry(across, y1 - y0, thick).toNonIndexed();
      g.rotateY(Math.atan2(T[i][0], T[i][1]));
      g.translate(P[i][0], (y0 + y1) / 2, P[i][1]);
      out.push(...g.attributes.position.array);
    };
    const hw = d.half;
    const under = d.kind === 2 ? -0.45 : -1.1; // the deck's underside, under its top
    if (d.kind === 0) {
      const curb = d.w / 2;
      if (roadMat) along(asphalt, -curb, 0.0, curb, 0.0, false); // the asphalt roadway surface
      along(concrete, curb, 0.0, curb, 0.2);              // the curbs
      along(concrete, curb, 0.2, hw - 0.3, 0.2);          // the sidewalks
      along(concrete, hw - 0.3, 0.2, hw - 0.3, 1.05);     // the parapets
      along(concrete, hw - 0.3, 1.05, hw, 1.05);
      along(concrete, hw, 1.05, hw, under);               // and the deck's face below them
      along(concrete, -hw, under, hw, under, false);      // its underside
      along(concrete, -curb, -0.06, curb, -0.06, false);  // the deck under the road
      // a steel railing on the parapets
      along(steel, hw - 0.2, 1.05, hw - 0.2, 1.12);
    } else if (d.kind === 1) {
      along(concrete, -hw, -0.15, hw, -0.15, false);      // the deck under the ballast
      along(steel, hw, -0.15, hw, under);
      along(concrete, -hw, under, hw, under, false);
      // plate girders along both sides, standing above the deck
      along(steel, hw - 0.1, -0.15, hw - 0.1, 1.5);
      along(steel, hw - 0.1, 1.5, hw + 0.25, 1.5);
      along(steel, hw + 0.25, 1.5, hw + 0.25, under);
    } else {
      along(wood, -hw, 0.0, hw, 0.0, false);              // the deck
      along(wood, hw, 0.0, hw, under);
      along(concrete, -hw, under, hw, under, false);
      // railings: a top rail and a mid rail, with posts every couple of metres
      along(rail, hw, 1.05, hw - 0.08, 1.1);
      along(rail, hw, 1.1, hw, 0.98);
      along(rail, hw, 0.55, hw, 0.5);
      for (let i = 0; i < P.length; i++) {
        for (const s of [1, -1]) {
          const [x, y, z] = at(i, (hw - 0.04) * s, 0);
          const g = new THREE.BoxGeometry(0.07, 1.1, 0.07).toNonIndexed().translate(x, y + 0.55, z);
          rail.push(...g.attributes.position.array);
        }
      }
    }
    // Authored Golden Gate Bridge in landmarks.js supplies its own International Orange towers, cables & piers
    if (ACTIVE_CITY_ID === 'sanfrancisco' && P[0][0] < -5000) continue;

    // Piers in the water (spaced wider on long suspension/harbour crossings), and an abutment where each end meets the bank
    const wet = P.map((p) => p[4] || riverDepth(p[0], p[1]) > 0.05);
    const first = wet.indexOf(true), last = wet.lastIndexOf(true);
    if (first < 0) continue;
    const span = P[last][2] - P[first][2];
    const sFirst = P[first][2], sLast = P[last][2];
    const ang = (i) => Math.atan2(T[i][0], T[i][1]);
    const idxAtS = (targetS) => {
      let i = first;
      while (i < last && P[i][2] < targetS) i++;
      return i;
    };

    // San Francisco-Oakland Bay Bridge West Span: tandem suspension bridges with 4 X-braced towers & Center Anchorage (W4)
    if (ACTIVE_CITY_ID === 'sanfrancisco' && d.kind === 0 && span > 1800) {
      const towerH = 78;
      const trussDepth = 5.2;
      // Double-deck stiffening truss chords & side diagonals beneath the roadway
      along(steel, hw - 0.25, -trussDepth, hw - 0.25, -trussDepth + 0.55);
      along(steel, -hw + 0.25, -trussDepth, hw - 0.25, -trussDepth, false);
      for (let i = first; i + 4 <= last; i += 4) {
        for (const s of [-1, 1]) {
          const pTop0 = at(i, (hw - 0.25) * s, -0.3);
          const pBot0 = at(i, (hw - 0.25) * s, -trussDepth);
          const pTop1 = at(i + 4, (hw - 0.25) * s, -0.3);
          const pBot1 = at(i + 4, (hw - 0.25) * s, -trussDepth);
          strut(steel, pBot0, pTop0, 0.32);
          strut(steel, pBot0, pTop1, 0.28);
          strut(steel, pTop0, pBot1, 0.28);
        }
      }
      // 4 West Span suspension towers: W6, W5 (East Bay side) and W3, W2 (SF side)
      const tFracs = [0.115, 0.365, 0.635, 0.885];
      const tIndices = tFracs.map((f) => idxAtS(sFirst + span * f));
      for (const ti of tIndices) {
        const deckY = P[ti][3], bed = riverbedHeight(P[ti][0], P[ti][1]) - 0.6;
        pier(concrete, ti, hw * 2 + 5.0, 9.5, bed, deckY - trussDepth);
        for (const s of [-1, 1]) {
          const [lx, , lz] = at(ti, (hw - 0.35) * s, 0);
          const leg = new THREE.BoxGeometry(2.6, towerH + trussDepth, 3.4).toNonIndexed();
          leg.rotateY(ang(ti));
          leg.translate(lx, deckY - trussDepth * 0.5 + towerH * 0.5, lz);
          steel.push(...leg.attributes.position.array);
        }
        // Horizontal portal struts & signature diagonal X-bracing
        for (const yOff of [19, 46, towerH - 2.5]) {
          const beam = new THREE.BoxGeometry(hw * 2 + 0.6, 2.0, 2.2).toNonIndexed();
          beam.rotateY(ang(ti));
          beam.translate(P[ti][0], deckY + yOff, P[ti][1]);
          steel.push(...beam.attributes.position.array);
        }
        for (const [y0, y1] of [[2, 18], [20, 45], [47, towerH - 3.5]]) {
          strut(steel, at(ti, -(hw - 0.35), y0), at(ti, hw - 0.35, y1), 0.75);
          strut(steel, at(ti, hw - 0.35, y0), at(ti, -(hw - 0.35), y1), 0.75);
        }
      }
      // Concrete Center Anchorage (W4) at mid-span between W5 and W3
      const mi = idxAtS(sFirst + span * 0.50);
      const mDeckY = P[mi][3], mBed = riverbedHeight(P[mi][0], P[mi][1]) - 0.6;
      pier(concrete, mi, hw * 2 + 4.5, 28.0, mBed, mDeckY - 0.2);
      for (const s of [-1, 1]) {
        const [ax, , az] = at(mi, (hw - 0.1) * s, 0);
        const pylon = new THREE.BoxGeometry(3.2, 16.0, 24.0).toNonIndexed();
        pylon.rotateY(ang(mi));
        pylon.translate(ax, mDeckY + 8.0, az);
        concrete.push(...pylon.attributes.position.array);
      }
      const mBeam = new THREE.BoxGeometry(hw * 2 + 2.0, 2.4, 8.0).toNonIndexed();
      mBeam.rotateY(ang(mi));
      mBeam.translate(P[mi][0], mDeckY + 14.8, P[mi][1]);
      concrete.push(...mBeam.attributes.position.array);

      // Approach piers near YBI and SF shorelines
      for (const f of [0.04, 0.96]) {
        const pi = idxAtS(sFirst + span * f);
        const top = P[pi][3] - trussDepth, bed = riverbedHeight(P[pi][0], P[pi][1]) - 0.5;
        if (top - bed > 1) pier(concrete, pi, hw * 2, 3.8, bed, top);
      }

      // Piecewise parabolic main suspension cables & vertical suspender ropes across both tandem spans
      const sW6 = P[tIndices[0]][2], sW5 = P[tIndices[1]][2], sW4 = P[mi][2];
      const sW3 = P[tIndices[2]][2], sW2 = P[tIndices[3]][2];
      const cableH = (sPos) => {
        if (sPos <= sW6) {
          const u = (sPos - sFirst) / Math.max(1, sW6 - sFirst);
          return 2.5 + (towerH - 3.0) * (u * u);
        }
        if (sPos <= sW5) {
          const mid = 0.5 * (sW6 + sW5), half = Math.max(1, 0.5 * (sW5 - sW6));
          const u = (sPos - mid) / half;
          return 5.2 + (towerH - 5.7) * (u * u);
        }
        if (sPos <= sW4) {
          const u = (sW4 - sPos) / Math.max(1, sW4 - sW5);
          return 14.2 + (towerH - 14.7) * (u * u);
        }
        if (sPos <= sW3) {
          const u = (sPos - sW4) / Math.max(1, sW3 - sW4);
          return 14.2 + (towerH - 14.7) * (u * u);
        }
        if (sPos <= sW2) {
          const mid = 0.5 * (sW3 + sW2), half = Math.max(1, 0.5 * (sW2 - sW3));
          const u = (sPos - mid) / half;
          return 5.2 + (towerH - 5.7) * (u * u);
        }
        const u = (sLast - sPos) / Math.max(1, sLast - sW2);
        return 2.5 + (towerH - 3.0) * (u * u);
      };
      const step = 3;
      for (let i = first; i < last; i += step) {
        const j = Math.min(last, i + step);
        const h0 = cableH(P[i][2]), h1 = cableH(P[j][2]);
        for (const s of [-1, 1]) {
          const p0 = at(i, (hw - 0.35) * s, h0);
          const p1 = at(j, (hw - 0.35) * s, h1);
          strut(steel, p0, p1, 0.62);
          const base = at(i, (hw - 0.35) * s, 0.2);
          strut(rail, base, p0, 0.16);
        }
      }
      continue;
    }

    // San Francisco-Oakland Bay Bridge East Span: single-tower Self-Anchored Suspension (SAS) + twin skyway viaduct piers
    if (ACTIVE_CITY_ID === 'sanfrancisco' && d.kind === 0 && P[0][0] > 3500 && span > 800) {
      const nPiers = Math.max(2, Math.floor(span / 135));
      for (let k = 1; k <= nPiers; k++) {
        const pi = idxAtS(sFirst + (span * k) / (nPiers + 1));
        const top = P[pi][3] + under, bed = riverbedHeight(P[pi][0], P[pi][1]) - 0.5;
        if (top - bed > 1) pier(concrete, pi, hw * 2 - 1.2, 3.4, bed, top);
      }
      if (!d.twinOf) {
        const ti = idxAtS(sFirst + Math.min(340, span * 0.18));
        const deckY = P[ti][3], bed = riverbedHeight(P[ti][0], P[ti][1]) - 0.6;
        const towerH = 92;
        const midOff = d.hasTwinDeck ? -(hw + 5.5) : 0;
        const [tx, , tz] = at(ti, midOff, 0);
        const basePier = new THREE.BoxGeometry(16, deckY - bed, 12).toNonIndexed();
        basePier.rotateY(ang(ti));
        basePier.translate(tx, (deckY + bed) * 0.5, tz);
        concrete.push(...basePier.attributes.position.array);
        const mast = new THREE.BoxGeometry(5.2, towerH + 12, 6.2).toNonIndexed();
        mast.rotateY(ang(ti));
        mast.translate(tx, deckY + towerH * 0.5 - 4, tz);
        concrete.push(...mast.attributes.position.array);
        const topPt = [tx, deckY + towerH, tz];
        const iStart = idxAtS(Math.max(sFirst, P[ti][2] - 180));
        const iEnd = idxAtS(Math.min(sLast, P[ti][2] + 380));
        const sT = P[ti][2];
        for (let i = iStart; i < iEnd; i += 3) {
          const j = Math.min(iEnd, i + 3);
          const hOf = (idx) => {
            const sPos = P[idx][2];
            const u = sPos <= sT
              ? (sPos - P[iStart][2]) / Math.max(1, sT - P[iStart][2])
              : (P[iEnd][2] - sPos) / Math.max(1, P[iEnd][2] - sT);
            return 2.0 + (towerH - 2.5) * (u * u);
          };
          const h0 = hOf(i), h1 = hOf(j);
          for (const s of [-1, 1]) {
            const c0 = at(i, (midOff * (1 - (h0 / towerH)) + (hw - 0.35) * s * (1 - h0 / towerH)), h0);
            const c1 = at(j, (midOff * (1 - (h1 / towerH)) + (hw - 0.35) * s * (1 - h1 / towerH)), h1);
            strut(steel, c0, c1, 0.52);
            strut(rail, at(i, (hw - 0.35) * s, 0.2), c0, 0.15);
          }
        }
        // Keep topPt referenced for clean linting
        void topPt;
      }
      continue;
    }

    const pierStep = span > 450 ? Math.max(140, span * 0.28) : span > 160 ? 55 : 25;
    const piers = span > 34 ? Math.max(1, Math.floor(span / pierStep)) : 0;
    const towerIndices = [];
    for (let k = 1; k <= piers; k++) {
      const s = sFirst + (span * k) / (piers + 1);
      const i = idxAtS(s);
      const top = P[i][3] + under, bed = riverbedHeight(P[i][0], P[i][1]) - 0.4;
      if (top - bed > 1) pier(concrete, i, hw * 2 - (d.kind === 2 ? 0.4 : 1.0), d.kind === 2 ? 0.5 : (span > 200 ? 3.2 : 1.3), bed, top);
      if (d.kind === 0 && span > 140 && ACTIVE_CITY_ID !== 'venice' && (k === 1 || k === piers)) towerIndices.push(i);
    }
    // Overhead steel portal towers, continuous parabolic main cables & vertical suspender cables on major road bridges (> 140 m)
    if (d.kind === 0 && span > 140 && towerIndices.length > 0) {
      const towerH = Math.min(68, Math.max(18, span * 0.11));
      for (const ti of towerIndices) {
        const deckY = P[ti][3];
        for (const s of [-1, 1]) {
          const [lx, , lz] = at(ti, (hw - 0.35) * s, 0);
          const leg = new THREE.BoxGeometry(1.6, towerH, 2.2).toNonIndexed();
          leg.rotateY(ang(ti));
          leg.translate(lx, deckY + towerH * 0.5, lz);
          steel.push(...leg.attributes.position.array);
        }
        // Portal cross-struts above the roadway clearance
        for (const frac of [0.58, 0.92]) {
          const beam = new THREE.BoxGeometry(hw * 2, 1.5, 1.6).toNonIndexed();
          beam.rotateY(ang(ti));
          beam.translate(P[ti][0], deckY + towerH * frac, P[ti][1]);
          steel.push(...beam.attributes.position.array);
        }
      }
      const t0 = towerIndices[0];
      const t1 = towerIndices[towerIndices.length - 1];
      const sTower0 = P[t0][2];
      const sTower1 = P[t1][2];
      const midS = (sTower0 + sTower1) * 0.5;
      const halfMain = Math.max(20, (sTower1 - sTower0) * 0.5);
      const cableH = (sPos) => {
        if (sPos <= sTower0) {
          const u = (sPos - sFirst) / Math.max(1, sTower0 - sFirst);
          return 2.0 + (towerH - 2.6) * (u * u);
        }
        if (t0 !== t1 && sPos <= sTower1) {
          const u = (sPos - midS) / halfMain;
          return 3.0 + (towerH - 3.6) * (u * u);
        }
        const u = (sLast - sPos) / Math.max(1, sLast - sTower1);
        return 2.0 + (towerH - 2.6) * (u * u);
      };
      const step = 3;
      for (let i = first; i < last; i += step) {
        const j = Math.min(last, i + step);
        const h0 = cableH(P[i][2]), h1 = cableH(P[j][2]);
        for (const s of [-1, 1]) {
          const p0 = at(i, (hw - 0.35) * s, h0);
          const p1 = at(j, (hw - 0.35) * s, h1);
          strut(steel, p0, p1, 0.42);
          strut(rail, at(i, (hw - 0.35) * s, 0.2), p0, 0.14);
        }
      }
    }
    for (const i of [Math.max(0, first - 1), Math.min(P.length - 1, last + 1)]) {
      const top = P[i][3] + under, bed = riverbedHeight(P[i][0], P[i][1]) - 0.5;
      if (top - bed > 0.3) pier(concrete, i, hw * 2 + 0.2, 1.6, bed, top + 0.05);
    }
  }

  const mat = (color, rough, metal = 0) => new THREE.MeshStandardNodeMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide });
  if (asphalt.length && roadMat) {
    const mesh = meshOf(asphalt, roadMat, 'BridgeAsphalt', null, 6000);
    group.add(mesh);
  }
  for (const [pos, m, name] of [[concrete, mat(0xb3ada3, 0.9), 'BridgeConcrete'], [steel, mat(0x6d777d, 0.55, 0.35), 'BridgeSteel'],
    [wood, mat(0x8a7356, 0.9), 'BridgeDecks'], [rail, mat(0x3a4044, 0.5, 0.4), 'BridgeRailings']]) {
    if (!pos.length) continue;
    const mesh = meshOf(pos, m, name, null, 6000);
    mesh.castShadow = true;
    group.add(mesh);
  }
}

export { buildRiver };
