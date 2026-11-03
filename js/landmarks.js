import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ACTIVE_CITY_ID } from './city-packs.js';
import { getBlockBounds, LANDMARK_SITES, BLOCKS } from './city-config.js';
import { STADIUM, N, radiiAt, FIELD_Y, WALL_TOP, SEAT_TOP, RIM_Y, WALL_Y, AISLE_IN, CONCOURSE } from './stadium-shape.js';
import { groundUnder, stadiumGround } from './terrain.js';
import {
  createPreWarBuildingMaterial,
  createCurtainWallMaterial,
  createFacadeBoxes,
  createChryslerCrownMaterial,
  createBillboardMaterial
} from './tsl-materials.js';
import { batchStaticGroupMeshes } from './city-grid.js';

export let bryantParkLawn = null;

function pushBox(arr, w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  arr.push(g.index ? g.toNonIndexed() : g);
}

function pushCyl(arr, rt, rb, h, segs, x, y, z, ry = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, segs);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  arr.push(g.index ? g.toNonIndexed() : g);
}

function addMergedMeshes(group, arr, mat, cast = true) {
  if (!arr.length) return;
  const m = new THREE.Mesh(mergeGeometries(arr, false), mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  group.add(m);
}

// ============================================================================
// ROYAL OAK, MI LANDMARKS
// ============================================================================

function buildShrineOfTheLittleFlower() {
  const group = new THREE.Group();
  group.name = 'ShrineOfTheLittleFlower';
  const site = LANDMARK_SITES['National Shrine of the Little Flower Basilica'];
  const cx = site ? site.x : -1180;
  const cz = site ? site.z : -1820;

  const limestone = [];
  const granite = [];
  const copper = [];
  const glass = [];
  const warmGlow = [];

  // Octagonal Basilica Nave (east of the Charity Crucifixion Tower)
  pushCyl(granite, 26, 27, 4.0, 8, 22, 2.0, 0, Math.PI / 8);
  pushCyl(limestone, 24, 24.5, 14.5, 8, 22, 11.25, 0, Math.PI / 8);
  pushCyl(copper, 4.0, 25.2, 7.5, 8, 22, 22.2, 0, Math.PI / 8);
  pushCyl(limestone, 3.8, 3.8, 4.2, 8, 22, 27.2, 0, Math.PI / 8);
  pushCyl(copper, 0.3, 4.1, 4.5, 8, 22, 31.5, 0, Math.PI / 8);

  // Stained glassclerestory windows on the 8 faces of the nave
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rx = 22 + Math.cos(a) * 23.2;
    const rz = Math.sin(a) * 23.2;
    pushBox(glass, 1.2, 7.5, 6.2, rx, 11.5, rz, -a);
  }

  // Connecting colonnade cloister between Tower and Nave
  pushBox(limestone, 18, 9.5, 11, 2, 4.75, 0);
  pushBox(copper, 18.5, 1.6, 11.6, 2, 10.3, 0);

  // Iconic 1931 Art Deco Charity Crucifixion Tower (38m tall stepped limestone shaft)
  pushBox(granite, 14.5, 4.5, 14.5, -10, 2.25, 0);
  pushBox(limestone, 11.5, 14.0, 11.5, -10, 11.5, 0);
  pushBox(limestone, 9.6, 11.0, 9.6, -10, 24.0, 0);
  pushBox(limestone, 7.8, 7.5, 7.8, -10, 33.25, 0);
  pushBox(limestone, 5.8, 3.2, 5.8, -10, 38.6, 0);

  // Vertical Art Deco limestone fins and monumental Crucifixion cross relief on Woodward (-X) & 12 Mile (-Z) faces
  pushBox(limestone, 0.9, 26.0, 1.8, -15.8, 22.0, 0);
  pushBox(limestone, 0.9, 2.2, 7.6, -15.8, 28.5, 0);
  pushBox(warmGlow, 0.6, 22.0, 1.1, -16.1, 22.0, 0);
  pushBox(warmGlow, 0.6, 1.4, 6.4, -16.1, 28.5, 0);

  addMergedMeshes(group, limestone, new THREE.MeshStandardNodeMaterial({ color: 0xe3dccb, roughness: 0.7 }));
  addMergedMeshes(group, granite, new THREE.MeshStandardNodeMaterial({ color: 0xaca69b, roughness: 0.78 }));
  addMergedMeshes(group, copper, new THREE.MeshStandardNodeMaterial({ color: 0x457d68, roughness: 0.52, metalness: 0.3 }));
  addMergedMeshes(group, glass, new THREE.MeshStandardNodeMaterial({ color: 0x26415c, emissive: 0xffc870, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.5 }));
  addMergedMeshes(group, warmGlow, new THREE.MeshStandardNodeMaterial({ color: 0xfff2d6, emissive: 0xffcf78, emissiveIntensity: 0.9, roughness: 0.35 }), false);

  group.position.set(cx, groundUnder(cx, cz, 30, 30), cz);
  return {
    group,
    collider: { minX: cx - 20, maxX: cx + 48, minZ: cz - 26, maxZ: cz + 26, maxY: 42, solid: true }
  };
}

function buildDetroitZooTowerAndGate() {
  const group = new THREE.Group();
  group.name = 'DetroitZooWaterTower';
  const site = LANDMARK_SITES['Detroit Zoo Water Tower'];
  const cx = site ? site.x : -1850;
  const cz = site ? site.z : 1650;

  const steel = [];
  const stucco = [];
  const tileRoof = [];
  const bronze = [];
  const water = [];

  // 6 structural steel lattice legs supporting the elevated water tank
  const legR = 6.8;
  const ringHeights = [9, 18, 26];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lx = Math.cos(a) * legR;
    const lz = Math.sin(a) * legR;
    pushCyl(steel, 0.42, 0.55, 29, 8, lx * 0.85, 14.5, lz * 0.85);
  }
  // Central riser pipe
  pushCyl(steel, 0.95, 1.05, 29, 12, 0, 14.5, 0);
  // Horizontal strut rings
  for (const ry of ringHeights) {
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2;
      const mx = ((Math.cos(a0) + Math.cos(a1)) * 0.5) * legR * 0.85;
      const mz = ((Math.sin(a0) + Math.sin(a1)) * 0.5) * legR * 0.85;
      pushBox(steel, 0.35, 0.35, legR * 0.9, mx, ry, mz, -((a0 + a1) * 0.5));
    }
  }
  // Catwalk balcony around tank base
  pushCyl(steel, 8.6, 8.6, 0.35, 24, 0, 28.5, 0);
  pushCyl(steel, 0.18, 0.5, 3.2, 8, 0, 41.8, 0);

  // Canvas texture for iconic blue-and-white DETROIT ZOO tank
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#15589c';
  ctx.fillRect(0, 0, 1024, 150);
  ctx.fillRect(0, 362, 1024, 150);
  ctx.fillStyle = '#103e73';
  ctx.font = '900 78px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DETROIT ZOO', 256, 256);
  ctx.fillText('DETROIT ZOO', 768, 256);
  const tankTex = new THREE.CanvasTexture(cv);
  tankTex.colorSpace = THREE.SRGBColorSpace;
  tankTex.wrapS = THREE.RepeatWrapping;

  const tankGeo = new THREE.SphereGeometry(8.2, 28, 20);
  tankGeo.scale(1.0, 0.82, 1.0);
  const tankMesh = new THREE.Mesh(
    tankGeo,
    new THREE.MeshStandardNodeMaterial({ map: tankTex, roughness: 0.35, metalness: 0.2 })
  );
  tankMesh.position.set(0, 33.8, 0);
  tankMesh.castShadow = true;
  tankMesh.receiveShadow = true;
  group.add(tankMesh);

  // Historic Mediterranean-Revival Entrance Gate Pavilions & Rackham Bear Fountain Plaza
  for (const sx of [-16, 16]) {
    pushBox(stucco, 7.5, 7.2, 7.5, sx, 3.6, 18);
    pushCyl(tileRoof, 0.6, 5.8, 2.8, 4, sx, 8.6, 18, Math.PI / 4);
  }
  pushBox(stucco, 25.0, 1.8, 2.4, 0, 6.8, 18);

  // Rackham Memorial Fountain circular limestone basin & bronze bears
  pushCyl(stucco, 10.5, 11.2, 1.1, 24, 0, 0.55, -18);
  pushCyl(water, 9.6, 9.6, 0.2, 24, 0, 1.05, -18);
  pushCyl(stucco, 2.8, 3.4, 3.2, 16, 0, 1.6, -18);
  pushBox(bronze, 2.2, 2.4, 1.4, 0, 4.2, -18);

  addMergedMeshes(group, steel, new THREE.MeshStandardNodeMaterial({ color: 0xd8e0e8, roughness: 0.45, metalness: 0.6 }));
  addMergedMeshes(group, stucco, new THREE.MeshStandardNodeMaterial({ color: 0xe8dec9, roughness: 0.75 }));
  addMergedMeshes(group, tileRoof, new THREE.MeshStandardNodeMaterial({ color: 0xb54d32, roughness: 0.65 }));
  addMergedMeshes(group, bronze, new THREE.MeshStandardNodeMaterial({ color: 0x4a3b2a, roughness: 0.4, metalness: 0.7 }));
  addMergedMeshes(group, water, new THREE.MeshStandardNodeMaterial({ color: 0x24789c, roughness: 0.15, metalness: 0.6 }), false);

  group.position.set(cx, groundUnder(cx, cz, 24, 24), cz);
  return {
    group,
    collider: { minX: cx - 10, maxX: cx + 10, minZ: cz - 10, maxZ: cz + 10, maxY: 43, solid: true }
  };
}

function buildRoyalOakMusicTheatre() {
  const group = new THREE.Group();
  group.name = 'RoyalOakMusicTheatre';
  const site = LANDMARK_SITES['Royal Oak Music Theatre'];
  const cx = site ? site.x : -165;
  const cz = site ? site.z : 110;

  const brick = [];
  const stone = [];
  const marqueeFrame = [];
  const neon = [];

  // Historic 1928 brick auditorium & West 4th Street storefront block
  pushBox(brick, 28, 15.5, 42, 0, 7.75, 0);
  pushBox(stone, 28.8, 1.4, 42.8, 0, 15.6, 0);
  pushBox(brick, 26, 5.5, 16, 0, 18.2, -12); // Stage fly loft

  // Art Deco Trapezoidal Marquee Canopy over West 4th Street (+Z face)
  pushBox(marqueeFrame, 12.5, 2.4, 4.8, 0, 4.8, 23.2);
  // Vertical blade sign rising above the marquee
  pushBox(marqueeFrame, 1.8, 11.5, 2.2, 0, 11.8, 23.5);
  pushBox(neon, 2.0, 10.6, 0.35, 0, 11.8, 24.65);

  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#1c0e14';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#ffbf40';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#fff4d2';
  ctx.font = 'bold 42px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROYAL OAK', 256, 52);
  ctx.fillStyle = '#ff5252';
  ctx.font = 'bold 36px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('MUSIC THEATRE', 256, 98);
  const marqueeTex = new THREE.CanvasTexture(cv);
  marqueeTex.colorSpace = THREE.SRGBColorSpace;

  const frontSign = new THREE.Mesh(
    new THREE.PlaneGeometry(11.8, 2.1),
    new THREE.MeshBasicNodeMaterial({ map: marqueeTex })
  );
  frontSign.position.set(0, 4.8, 25.65);
  group.add(frontSign);

  addMergedMeshes(group, brick, new THREE.MeshStandardNodeMaterial({ color: 0x8f3f31, roughness: 0.82 }));
  addMergedMeshes(group, stone, new THREE.MeshStandardNodeMaterial({ color: 0xded6c6, roughness: 0.72 }));
  addMergedMeshes(group, marqueeFrame, new THREE.MeshStandardNodeMaterial({ color: 0x281820, roughness: 0.4, metalness: 0.6 }));
  addMergedMeshes(group, neon, new THREE.MeshStandardNodeMaterial({ color: 0xff3b2f, emissive: 0xff2a1a, emissiveIntensity: 1.5 }), false);

  group.position.set(cx, groundUnder(cx, cz, 16, 22), cz);
  return {
    group,
    collider: { minX: cx - 14, maxX: cx + 14, minZ: cz - 21, maxZ: cz + 21, maxY: 21, solid: true }
  };
}

function buildCentennialCommonsAndCivicCenter() {
  const group = new THREE.Group();
  group.name = 'CentennialCommons';
  const cx = 155, cz = -65;

  const lawn = [];
  const stone = [];
  const glass = [];
  const brick = [];
  const starSteel = [];
  const starGlow = [];

  // Centennial Commons raised lawn terrace & walkways
  pushBox(stone, 54, 0.45, 58, 0, 0.22, 0);
  pushBox(lawn, 44, 0.25, 48, 0, 0.5, 0);

  // "Star Dream" illuminated stainless-steel & cyan-glowing geometric arch sculpture
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 3.8;
    const z = Math.sin(a) * 3.8;
    pushBox(starSteel, 0.55, 8.2, 0.55, x * 0.6, 4.2, z * 0.6, a);
    pushBox(starGlow, 0.35, 3.6, 0.35, x * 0.35, 7.6, z * 0.35, a + 0.4);
  }
  pushCyl(starGlow, 1.8, 1.8, 0.45, 10, 0, 8.8, 0);

  // Modern Royal Oak City Hall (east of Commons)
  pushBox(brick, 34, 14.5, 24, 46, 7.25, -8);
  pushBox(glass, 28, 11.5, 24.4, 46, 7.5, -8);
  pushBox(stone, 35, 1.2, 25, 46, 14.8, -8);

  addMergedMeshes(group, lawn, new THREE.MeshStandardNodeMaterial({ color: 0x3b843c, roughness: 0.88 }), false);
  addMergedMeshes(group, stone, new THREE.MeshStandardNodeMaterial({ color: 0xd9d4c7, roughness: 0.75 }));
  addMergedMeshes(group, brick, new THREE.MeshStandardNodeMaterial({ color: 0x9c5240, roughness: 0.8 }));
  addMergedMeshes(group, glass, new THREE.MeshStandardNodeMaterial({ color: 0x1e3852, roughness: 0.18, metalness: 0.75 }));
  addMergedMeshes(group, starSteel, new THREE.MeshStandardNodeMaterial({ color: 0xe6eef6, roughness: 0.2, metalness: 0.88 }));
  addMergedMeshes(group, starGlow, new THREE.MeshStandardNodeMaterial({ color: 0x70f0ff, emissive: 0x22d8ff, emissiveIntensity: 1.35 }), false);

  group.position.set(cx, groundUnder(cx, cz, 30, 30), cz);
  return {
    group,
    collider: { minX: cx + 29, maxX: cx + 63, minZ: cz - 20, maxZ: cz + 4, maxY: 16, solid: true }
  };
}

function buildFarmersMarketAndAmtrak() {
  const group = new THREE.Group();
  group.name = 'RoyalOakFarmersMarketAndAmtrak';

  // 1. Royal Oak Farmers Market (316 E 11 Mile Rd: x=220, z=-40)
  const fmGroup = new THREE.Group();
  const fmx = 220, fmz = -40;
  const brick = [];
  const roof = [];
  const trim = [];
  const glass = [];

  pushBox(brick, 46, 7.2, 26, 0, 3.6, 0);
  pushBox(roof, 47.2, 2.2, 27.2, 0, 8.2, 0);
  // Clerestory monitor along the ridge
  pushBox(trim, 36, 2.6, 9.5, 0, 10.2, 0);
  pushBox(glass, 36.4, 1.6, 9.8, 0, 10.3, 0);
  pushBox(roof, 37.2, 0.8, 10.6, 0, 11.8, 0);

  // Market hall arched roll-up bays along N and S sides
  for (let x = -18; x <= 18; x += 6) {
    pushBox(glass, 4.2, 4.6, 26.3, x, 2.6, 0);
  }

  addMergedMeshes(fmGroup, brick, new THREE.MeshStandardNodeMaterial({ color: 0x994736, roughness: 0.82 }));
  addMergedMeshes(fmGroup, roof, new THREE.MeshStandardNodeMaterial({ color: 0x3d4852, roughness: 0.65, metalness: 0.25 }));
  addMergedMeshes(fmGroup, trim, new THREE.MeshStandardNodeMaterial({ color: 0xe6e0d2, roughness: 0.7 }));
  addMergedMeshes(fmGroup, glass, new THREE.MeshStandardNodeMaterial({ color: 0x2c4257, emissive: 0xffe0a0, emissiveIntensity: 0.25, roughness: 0.25 }));
  fmGroup.position.set(fmx, groundUnder(fmx, fmz, 24, 14), fmz);
  group.add(fmGroup);

  // 2. Royal Oak Amtrak Station Platform & Shelter (W Sherman Dr & S Lafayette: x=-190, z=95)
  const amGroup = new THREE.Group();
  const amx = -190, amz = 95;
  const plat = [];
  const canopy = [];
  const blueSign = [];

  pushBox(plat, 6.5, 0.8, 72, 0, 0.4, 0);
  pushBox(canopy, 5.2, 0.45, 28, 0, 4.2, 0);
  for (let z = -12; z <= 12; z += 6) {
    pushCyl(canopy, 0.18, 0.18, 3.6, 8, 0, 2.4, z);
  }
  pushBox(blueSign, 1.8, 1.1, 4.5, 0, 3.2, -16);

  addMergedMeshes(amGroup, plat, new THREE.MeshStandardNodeMaterial({ color: 0xc8c4bc, roughness: 0.85 }));
  addMergedMeshes(amGroup, canopy, new THREE.MeshStandardNodeMaterial({ color: 0x2b3b4e, roughness: 0.45, metalness: 0.5 }));
  addMergedMeshes(amGroup, blueSign, new THREE.MeshStandardNodeMaterial({ color: 0x00548b, emissive: 0x003b64, emissiveIntensity: 0.5 }), false);
  amGroup.position.set(amx, groundUnder(amx, amz, 6, 36), amz);
  group.add(amGroup);

  return {
    group,
    collider: { minX: fmx - 23, maxX: fmx + 23, minZ: fmz - 13, maxZ: fmz + 13, maxY: 13, solid: true }
  };
}

function buildRoyalOakLandmarks(scene) {
  const g = new THREE.Group();
  g.name = 'RoyalOakLandmarks';
  g.userData.terrain = 'set';
  const colliders = [];

  for (const builder of [
    buildShrineOfTheLittleFlower,
    buildDetroitZooTowerAndGate,
    buildRoyalOakMusicTheatre,
    buildCentennialCommonsAndCivicCenter,
    buildFarmersMarketAndAmtrak
  ]) {
    const res = builder();
    g.add(res.group);
    if (res.collider) colliders.push(res.collider);
  }

  if (scene && typeof scene.add === 'function') scene.add(g);
  return { group: g, colliders };
}

// ============================================================================
// OAKLAND, CA LANDMARKS
// ============================================================================

function buildTribuneTower() {
  const group = new THREE.Group();
  group.name = 'TribuneTower';
  const cx = 106, cz = 144;

  const brick = [];
  const trim = [];
  const copper = [];
  const glass = [];
  const neon = [];
  const clockFace = [];

  pushBox(trim, 29.0, 4.5, 27.0, 0, 2.25, 0);
  pushBox(brick, 28.0, 19.5, 26.0, 0, 14.25, 0);
  pushBox(trim, 29.2, 1.4, 27.2, 0, 24.2, 0);

  for (let floor = 1; floor < 6; floor++) {
    const wy = 4.5 + floor * 3.4;
    for (let k = -3; k <= 3; k++) {
      pushBox(glass, 28.3, 1.9, 1.6, 0, wy, k * 3.3);
      pushBox(glass, 1.6, 1.9, 26.3, k * 3.5, wy, 0);
    }
  }

  pushBox(brick, 13.5, 44.0, 13.5, 5.5, 46.0, -4.5);
  pushBox(trim, 14.6, 2.2, 14.6, 5.5, 68.5, -4.5);

  for (let floor = 0; floor < 11; floor++) {
    const wy = 27.5 + floor * 3.6;
    for (const o of [-3.2, 0, 3.2]) {
      pushBox(glass, 13.8, 2.1, 1.3, 5.5, wy, -4.5 + o);
      pushBox(glass, 1.3, 2.1, 13.8, 5.5 + o, wy, -4.5);
    }
  }

  pushBox(trim, 12.8, 9.5, 12.8, 5.5, 74.2, -4.5);
  for (const dx of [-6.0, 6.0]) {
    for (const dz of [-6.0, 6.0]) {
      pushBox(trim, 1.6, 12.5, 1.6, 5.5 + dx, 75.5, -4.5 + dz);
    }
  }
  pushCyl(clockFace, 3.1, 3.1, 0.5, 24, 5.5, 74.2, -4.5 + 6.3, 0);
  pushCyl(clockFace, 3.1, 3.1, 0.5, 24, 5.5, 74.2, -4.5 - 6.3, 0);
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(3.1, 3.1, 0.5, 24);
    g.rotateX(Math.PI / 2);
    if (s !== 0) g.rotateY(Math.PI / 2);
    g.translate(5.5 + s * 6.3, 74.2, -4.5);
    clockFace.push(g.index ? g.toNonIndexed() : g);
  }
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(3.1, 3.1, 0.5, 24);
    g.rotateX(Math.PI / 2);
    g.translate(5.5, 74.2, -4.5 + s * 6.3);
    clockFace.push(g.index ? g.toNonIndexed() : g);
  }

  pushCyl(copper, 4.5, 8.8, 9.5, 4, 5.5, 83.7, -4.5, Math.PI / 4);
  pushCyl(copper, 0.3, 2.2, 6.5, 8, 5.5, 91.0, -4.5);

  pushBox(neon, 0.9, 28.0, 2.2, 5.5 - 7.3, 50.0, -4.5);
  pushBox(neon, 2.2, 28.0, 0.9, 5.5, 50.0, -4.5 - 7.3);

  addMergedMeshes(group, brick, new THREE.MeshStandardNodeMaterial({ color: 0x9c4a38, roughness: 0.82 }));
  addMergedMeshes(group, trim, new THREE.MeshStandardNodeMaterial({ color: 0xe6dfd1, roughness: 0.72 }));
  addMergedMeshes(group, copper, new THREE.MeshStandardNodeMaterial({ color: 0x3b7a67, roughness: 0.55, metalness: 0.3 }));
  addMergedMeshes(group, glass, new THREE.MeshStandardNodeMaterial({ color: 0x223242, roughness: 0.2, metalness: 0.7 }));
  addMergedMeshes(group, clockFace, new THREE.MeshStandardNodeMaterial({ color: 0xfff6dc, emissive: 0xffe4a0, emissiveIntensity: 0.85, roughness: 0.4 }), false);
  addMergedMeshes(group, neon, new THREE.MeshStandardNodeMaterial({ color: 0xff2a1f, emissive: 0xff2211, emissiveIntensity: 1.4, roughness: 0.3 }), false);

  group.position.set(cx, groundUnder(cx, cz, 16, 16), cz);
  return group;
}

function buildCityHall() {
  const group = new THREE.Group();
  group.name = 'OaklandCityHall';
  const cx = -114, cz = -100;

  const granite = [];
  const terracotta = [];
  const dome = [];
  const glass = [];
  const clock = [];

  pushBox(granite, 56, 16, 38, 0, 8, 0);
  pushBox(terracotta, 57.5, 1.8, 39.5, 0, 16.2, 0);
  for (let z = -12; z <= 12; z += 4) {
    pushCyl(granite, 0.75, 0.85, 11, 10, 28.4, 7.5, z);
  }

  pushBox(terracotta, 32, 42, 22, 0, 37, 0);
  pushBox(granite, 33.6, 2.2, 23.6, 0, 58.2, 0);
  for (let f = 0; f < 9; f++) {
    const wy = 20 + f * 4.2;
    for (let z = -8; z <= 8; z += 4) {
      pushBox(glass, 32.3, 2.3, 1.8, 0, wy, z);
    }
  }

  pushBox(terracotta, 17, 15, 17, 0, 66.5, 0);
  pushBox(granite, 18.4, 1.8, 18.4, 0, 74.2, 0);
  pushCyl(terracotta, 6.8, 7.2, 10, 12, 0, 79.5, 0);
  for (const s of [-1, 1]) {
    const g1 = new THREE.CylinderGeometry(2.6, 2.6, 0.5, 20);
    g1.rotateZ(Math.PI / 2);
    g1.translate(s * 8.6, 67.5, 0);
    clock.push(g1.index ? g1.toNonIndexed() : g1);
    const g2 = new THREE.CylinderGeometry(2.6, 2.6, 0.5, 20);
    g2.rotateX(Math.PI / 2);
    g2.translate(0, 67.5, s * 8.6);
    clock.push(g2.index ? g2.toNonIndexed() : g2);
  }
  pushCyl(dome, 2.0, 6.4, 7.5, 16, 0, 88.2, 0);
  pushCyl(dome, 0.25, 1.5, 5.5, 8, 0, 94.5, 0);

  addMergedMeshes(group, granite, new THREE.MeshStandardNodeMaterial({ color: 0xdedad0, roughness: 0.7 }));
  addMergedMeshes(group, terracotta, new THREE.MeshStandardNodeMaterial({ color: 0xebe6dc, roughness: 0.65 }));
  addMergedMeshes(group, dome, new THREE.MeshStandardNodeMaterial({ color: 0xc9a85c, roughness: 0.45, metalness: 0.35 }));
  addMergedMeshes(group, glass, new THREE.MeshStandardNodeMaterial({ color: 0x263849, roughness: 0.25, metalness: 0.65 }));
  addMergedMeshes(group, clock, new THREE.MeshStandardNodeMaterial({ color: 0xfff7e0, emissive: 0xffe090, emissiveIntensity: 0.75 }), false);

  group.position.set(cx, groundUnder(cx, cz, 28, 20), cz);
  return group;
}

function buildFoxTheater() {
  const group = new THREE.Group();
  group.name = 'FoxTheater';
  const cx = 70, cz = -400;

  const terracotta = [];
  const gold = [];
  const marquee = [];

  pushBox(terracotta, 48, 22, 38, 0, 11, 0);
  pushBox(gold, 49, 2.0, 39, 0, 22.2, 0);
  pushCyl(gold, 6.5, 11.5, 9.5, 16, -2, 26.8, 0);
  pushCyl(gold, 1.2, 6.5, 4.5, 16, -2, 33.8, 0);
  for (const z of [-12, 12]) {
    pushCyl(terracotta, 2.2, 2.4, 28, 12, 23, 14, z);
    pushCyl(gold, 0.6, 2.5, 5.5, 12, 23, 30.5, z);
  }
  pushBox(gold, 8.0, 1.8, 14.0, 27.5, 6.2, 0);
  pushBox(marquee, 2.4, 18.5, 1.2, 27.5, 17.5, 0);
  pushCyl(marquee, 2.8, 2.8, 1.3, 16, 27.5, 27.5, 0);

  addMergedMeshes(group, terracotta, new THREE.MeshStandardNodeMaterial({ color: 0xc89d7c, roughness: 0.78 }));
  addMergedMeshes(group, gold, new THREE.MeshStandardNodeMaterial({ color: 0xd4a445, roughness: 0.5, metalness: 0.35 }));
  addMergedMeshes(group, marquee, new THREE.MeshStandardNodeMaterial({ color: 0xffd24c, emissive: 0xffaa22, emissiveIntensity: 1.2, roughness: 0.3 }), false);

  group.position.set(cx, groundUnder(cx, cz, 24, 20), cz);
  return group;
}

function buildCathedral() {
  const group = new THREE.Group();
  group.name = 'CathedralOfChristTheLight';
  const cx = 774, cz = -610;

  const concrete = [];
  const glassVeil = [];
  const timber = [];

  pushCyl(concrete, 34, 36, 4.5, 32, 0, 2.25, 0);
  pushCyl(concrete, 21, 22, 5.5, 28, 0, 6.5, 0);

  const rings = 14;
  for (let i = 0; i < rings; i++) {
    const t0 = i / rings, t1 = (i + 1) / rings;
    const y0 = 7.0 + t0 * 31.0, y1 = 7.0 + t1 * 31.0;
    const r0 = 18.5 * (1 - t0 * 0.32), r1 = 18.5 * (1 - t1 * 0.32);
    const g = new THREE.CylinderGeometry(r1, r0, (y1 - y0) * 0.92, 28);
    g.scale(1.25, 1, 0.78);
    g.translate(0, (y0 + y1) * 0.5, 0);
    glassVeil.push(g.index ? g.toNonIndexed() : g);

    const rib = new THREE.CylinderGeometry(r1 * 0.96, r0 * 0.96, (y1 - y0) * 0.25, 28);
    rib.scale(1.25, 1, 0.78);
    rib.translate(0, y0, 0);
    timber.push(rib.index ? rib.toNonIndexed() : rib);
  }

  addMergedMeshes(group, concrete, new THREE.MeshStandardNodeMaterial({ color: 0xd4cfc7, roughness: 0.85 }));
  addMergedMeshes(group, timber, new THREE.MeshStandardNodeMaterial({ color: 0xb88456, roughness: 0.65 }));
  addMergedMeshes(group, glassVeil, new THREE.MeshStandardNodeMaterial({
    color: 0xd8ecff,
    emissive: 0xffe8b0,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    metalness: 0.25
  }));

  group.position.set(cx, groundUnder(cx, cz, 32, 32), cz);
  return group;
}

function buildPergola() {
  const group = new THREE.Group();
  group.name = 'LakeMerrittPergola';
  const cx = 1794, cz = -710;

  const stone = [];
  const wood = [];
  const lights = [];

  pushCyl(stone, 24, 26, 1.4, 28, 0, 0.7, 0);
  const arcCols = 14;
  for (let i = 0; i < arcCols; i++) {
    const a = -Math.PI * 0.65 + (i / (arcCols - 1)) * Math.PI * 1.3;
    for (const r of [15.5, 20.5]) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pushCyl(stone, 0.48, 0.56, 6.2, 12, x, 4.5, z);
      pushBox(stone, 1.35, 0.45, 1.35, x, 7.7, z, -a);
    }
    const xm = Math.cos(a) * 18.0;
    const zm = Math.sin(a) * 18.0;
    pushBox(wood, 6.8, 0.45, 0.55, xm, 8.15, zm, -a);
    pushCyl(lights, 0.28, 0.28, 0.45, 10, xm, 7.5, zm);
  }

  addMergedMeshes(group, stone, new THREE.MeshStandardNodeMaterial({ color: 0xf2eee6, roughness: 0.72 }));
  addMergedMeshes(group, wood, new THREE.MeshStandardNodeMaterial({ color: 0x8c5332, roughness: 0.8 }));
  addMergedMeshes(group, lights, new THREE.MeshStandardNodeMaterial({ color: 0xfff3cc, emissive: 0xffcf66, emissiveIntensity: 1.3 }), false);

  group.position.set(cx, groundUnder(cx, cz, 22, 22), cz);
  return group;
}

function buildPortCranes() {
  const group = new THREE.Group();
  group.name = 'PortOfOaklandCranes';
  const baseCx = -2460, baseCz = 580;

  const whiteSteel = [];
  const redWarn = [];
  const containers = [[], [], []];

  for (let c = 0; c < 3; c++) {
    const ox = (c - 1) * 95;
    const oz = c * 32;
    const legSpanX = 18;
    const legSpanZ = 22;
    const portalH = 16;
    const towerH = 58;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        pushBox(whiteSteel, 1.8, towerH, 1.8, ox + sx * legSpanX * 0.5, towerH * 0.5, oz + sz * legSpanZ * 0.5);
      }
      pushBox(whiteSteel, 1.6, 2.2, legSpanZ + 2, ox + sx * legSpanX * 0.5, portalH, oz);
      pushBox(whiteSteel, 1.6, 2.4, legSpanZ + 2, ox + sx * legSpanX * 0.5, 42, oz);
      pushBox(whiteSteel, 1.5, 1.8, legSpanZ * 0.6, ox + sx * legSpanX * 0.5, towerH, oz);
    }
    pushBox(whiteSteel, legSpanX + 2, 2.0, 1.8, ox, portalH, oz - legSpanZ * 0.5);
    pushBox(whiteSteel, legSpanX + 2, 2.0, 1.8, ox, portalH, oz + legSpanZ * 0.5);
    pushBox(whiteSteel, legSpanX + 4, 3.2, 6.0, ox, 43.5, oz - 2);
    pushBox(whiteSteel, legSpanX + 2, 2.0, 2.0, ox, towerH, oz);

    pushBox(whiteSteel, legSpanX * 0.7, 2.2, 92, ox, 42.5, oz + 18);
    pushBox(whiteSteel, 0.45, 0.45, 46, ox - 5, 50, oz + 30);
    pushBox(whiteSteel, 0.45, 0.45, 46, ox + 5, 50, oz + 30);
    pushBox(redWarn, 1.6, 1.6, 1.6, ox, towerH + 1.4, oz);
    pushBox(redWarn, 1.4, 1.4, 1.4, ox, 44.2, oz + 62);
  }

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const stack = 1 + ((row * 3 + col * 5) % 3);
      for (let s = 0; s < stack; s++) {
        const bucket = containers[(row + col + s) % 3];
        pushBox(bucket, 12.2, 2.6, 2.5, -110 + col * 14.5, 1.3 + s * 2.65, -45 - row * 6.5);
      }
    }
  }

  addMergedMeshes(group, whiteSteel, new THREE.MeshStandardNodeMaterial({ color: 0xf0f2f5, roughness: 0.5, metalness: 0.35 }));
  addMergedMeshes(group, redWarn, new THREE.MeshStandardNodeMaterial({ color: 0xff3322, emissive: 0xff2211, emissiveIntensity: 1.5 }), false);
  addMergedMeshes(group, containers[0], new THREE.MeshStandardNodeMaterial({ color: 0x1e5aa8, roughness: 0.7, metalness: 0.2 }));
  addMergedMeshes(group, containers[1], new THREE.MeshStandardNodeMaterial({ color: 0xa8382b, roughness: 0.7, metalness: 0.2 }));
  addMergedMeshes(group, containers[2], new THREE.MeshStandardNodeMaterial({ color: 0x0f6b4a, roughness: 0.7, metalness: 0.2 }));

  group.position.set(baseCx, groundUnder(baseCx, baseCz, 60, 40), baseCz);
  return group;
}

function buildAmphitheater() {
  const group = new THREE.Group();
  group.name = 'LakeMerrittAmphitheater';

  const segs = 64;
  const rows = STADIUM.rows || 9;
  const fieldY = STADIUM.fieldY ?? -3.2;
  const wallY = STADIUM.wallY ?? 2.2;
  const stonePos = [];
  const grassPos = [];

  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const [rIn0, rOut0] = radiiAt(a0);
    const [rIn1, rOut1] = radiiAt(a1);

    grassPos.push(
      0, fieldY, 0,
      c1 * rIn1, fieldY, s1 * rIn1,
      c0 * rIn0, fieldY, s0 * rIn0
    );

    for (let r = 0; r < rows; r++) {
      const t0 = r / rows, t1 = (r + 1) / rows;
      const d00 = rIn0 + (rOut0 - rIn0) * t0, d01 = rIn0 + (rOut0 - rIn0) * t1;
      const d10 = rIn1 + (rOut1 - rIn1) * t0, d11 = rIn1 + (rOut1 - rIn1) * t1;
      const y0 = fieldY + (t0 * 0.8 + t0 * t0 * 0.2) * (wallY - fieldY);
      const y1 = fieldY + (t1 * 0.8 + t1 * t1 * 0.2) * (wallY - fieldY);
      const target = (r % 2 === 0) ? stonePos : grassPos;
      stonePos.push(
        c0 * d00, y0, s0 * d00, c1 * d10, y0, s1 * d10, c1 * d10, y1, s1 * d10,
        c0 * d00, y0, s0 * d00, c1 * d10, y1, s1 * d10, c0 * d00, y1, s0 * d00
      );
      target.push(
        c0 * d00, y1, s0 * d00, c1 * d10, y1, s1 * d10, c1 * d11, y1, s1 * d11,
        c0 * d00, y1, s0 * d00, c1 * d11, y1, s1 * d11, c0 * d01, y1, s0 * d01
      );
    }
  }

  const makeMesh = (pos, colorHex, rough = 0.88) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardNodeMaterial({ color: colorHex, roughness: rough, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  };

  group.add(makeMesh(grassPos, 0x3b7a38, 0.92));
  group.add(makeMesh(stonePos, 0xd8d2c5, 0.82));
  group.rotation.y = STADIUM.rot || 0.45;
  group.position.set(STADIUM.cx, stadiumGround(), STADIUM.cz);
  return group;
}

function buildOaklandLandmarks(scene) {
  const g = new THREE.Group();
  g.name = 'OaklandLandmarks';
  g.userData.terrain = 'set';
  g.add(buildTribuneTower());
  g.add(buildCityHall());
  g.add(buildFoxTheater());
  g.add(buildCathedral());
  g.add(buildPergola());
  g.add(buildPortCranes());
  g.add(buildAmphitheater());
  if (scene && typeof scene.add === 'function') scene.add(g);

  const colliders = [
    { minX: 91, maxX: 121, minZ: 130, maxZ: 158, maxY: 98, solid: true },
    { minX: -143, maxX: -85, minZ: -120, maxZ: -80, maxY: 102, solid: true },
    { minX: 46, maxX: 94, minZ: -419, maxZ: -381, maxY: 44, solid: true },
    { minX: 745, maxX: 803, minZ: -639, maxZ: -581, maxY: 45, solid: true },
    { minX: 1775, maxX: 1813, minZ: -725, maxZ: -695, maxY: 14, solid: false },
    { minX: -2600, maxX: -2300, minZ: 540, maxZ: 620, maxY: 68, solid: false },
    { minX: 1018, maxX: 1128, minZ: 630, maxZ: 746, maxY: 16, stadium: true }
  ];
  return { group: g, colliders };
}

// ============================================================================
// ANN ARBOR, MI LANDMARKS (Michigan Stadium - "The Big House")
// ============================================================================

function buildBigHouse(group, colliders) {
  const { cx, cz } = STADIUM;
  const G = stadiumGround();
  const ROWS = 72, AISLE_EVERY = 6;
  const pos = [], col = [];
  const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const bench = C(0xb9bdc2), riser = C(0x6d727a), aisle = C(0xd2cdc2), concrete = C(0xa6a39b), blue = C(0x00274c),
    maize = C(0xffcb05), brick = C(0x8a4d37), stone = C(0xcfc6b4), turfDark = C(0x2f6b2c);
  const quad = (a, b, c, d, color) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) col.push(color.r, color.g, color.b);
  };
  const at = (k, r, y) => {
    const a = (k / N) * Math.PI * 2;
    return [cx + Math.cos(a) * r, G + y, cz + Math.sin(a) * r];
  };
  for (let k = 0; k < N; k++) {
    const k1 = k + 1;
    const [i0, o0] = radiiAt((k / N) * Math.PI * 2), [i1, o1] = radiiAt((k1 / N) * Math.PI * 2);
    const isAisle = k % AISLE_EVERY === 0;
    quad(at(k, i0, FIELD_Y), at(k1, i1, FIELD_Y), at(k1, i1, WALL_TOP - 0.25), at(k, i0, WALL_TOP - 0.25), blue);
    quad(at(k, i0, WALL_TOP - 0.25), at(k1, i1, WALL_TOP - 0.25), at(k1, i1, WALL_TOP), at(k, i0, WALL_TOP), maize);
    quad(at(k, i0, WALL_TOP), at(k1, i1, WALL_TOP), at(k1, i1 + AISLE_IN, WALL_TOP), at(k, i0 + AISLE_IN, WALL_TOP), concrete);
    const s0 = i0 + AISLE_IN, s1 = i1 + AISLE_IN, e0 = o0 - CONCOURSE, e1 = o1 - CONCOURSE;
    for (let row = 0; row < ROWS; row++) {
      const t0 = row / ROWS, t1 = (row + 1) / ROWS;
      const ya = WALL_TOP + (SEAT_TOP - WALL_TOP) * t0, yb = WALL_TOP + (SEAT_TOP - WALL_TOP) * t1;
      const ra0 = s0 + (e0 - s0) * t0, ra1 = s1 + (e1 - s1) * t0, rb0 = s0 + (e0 - s0) * t1, rb1 = s1 + (e1 - s1) * t1;
      quad(at(k, ra0, ya), at(k1, ra1, ya), at(k1, ra1, yb), at(k, ra0, yb), isAisle ? aisle : riser);
      quad(at(k, ra0, yb), at(k1, ra1, yb), at(k1, rb1, yb), at(k, rb0, yb), isAisle ? aisle : (row % 2 ? bench : C(0xaeb3b8)));
    }
    quad(at(k, e0, SEAT_TOP), at(k1, e1, SEAT_TOP), at(k1, e1, RIM_Y - 0.15), at(k, e0, RIM_Y - 0.15), blue);
    quad(at(k, e0, RIM_Y - 0.15), at(k1, e1, RIM_Y - 0.15), at(k1, e1, RIM_Y), at(k, e0, RIM_Y), maize);
    quad(at(k, e0, RIM_Y), at(k1, e1, RIM_Y), at(k1, o1 - 0.6, RIM_Y), at(k, o0 - 0.6, RIM_Y), concrete);
    quad(at(k, o0 - 0.6, RIM_Y), at(k1, o1 - 0.6, RIM_Y), at(k1, o1 - 0.6, WALL_Y), at(k, o0 - 0.6, WALL_Y), brick);
    quad(at(k, o0 - 0.6, WALL_Y), at(k1, o1 - 0.6, WALL_Y), at(k1, o1, WALL_Y), at(k, o0, WALL_Y), stone);
    quad(at(k, o0, WALL_Y), at(k1, o1, WALL_Y), at(k1, o1, WALL_Y - 0.7), at(k, o0, WALL_Y - 0.7), stone);
    quad(at(k, o0, WALL_Y - 0.7), at(k1, o1, WALL_Y - 0.7), at(k1, o1, -3), at(k, o0, -3), brick);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const stands = new THREE.Mesh(geo, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }));
  stands.name = 'BigHouseStands';
  stands.castShadow = stands.receiveShadow = true;
  group.add(stands);

  const floorShape = new THREE.Shape();
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2, r = radiiAt(a)[0];
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    k ? floorShape.lineTo(x, -z) : floorShape.moveTo(x, -z);
  }
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape).rotateX(-Math.PI / 2),
    new THREE.MeshStandardNodeMaterial({ color: turfDark, roughness: 0.92 }));
  floor.position.set(cx, G + FIELD_Y, cz);
  floor.receiveShadow = true;
  group.add(floor);
  const P = STADIUM.pitch;
  const field = new THREE.Group();
  field.position.set(P.cx, G + FIELD_Y + 0.03, P.cz);
  field.rotation.y = Math.PI / 2 - P.angle;
  const flat = (w, d, color, y = 0, x = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardNodeMaterial({ color, roughness: 0.9 }));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    field.add(m);
    return m;
  };
  const W = 48.8, L = 91.4, EZ = 9.1;
  for (let i = 0; i < 20; i++) flat(W + 6, L / 20, i % 2 ? 0x3b8a35 : 0x347f30, 0.0, 0, -L / 2 + (i + 0.5) * (L / 20));
  flat(W + 6, EZ + 3, 0x00274c, 0.01, 0, -(L / 2 + (EZ + 3) / 2));
  flat(W + 6, EZ + 3, 0x00274c, 0.01, 0, L / 2 + (EZ + 3) / 2);
  for (let yd = 0; yd <= 100; yd += 5) flat(W, yd % 10 ? 0.12 : 0.22, 0xf2f2ee, 0.03, 0, -L / 2 + (yd / 100) * L);
  for (const sx of [-1, 1]) flat(0.2, L + EZ * 2, 0xf2f2ee, 0.03, sx * W / 2, 0);
  for (const sz of [-1, 1]) flat(W, 0.2, 0xf2f2ee, 0.03, 0, sz * (L / 2 + EZ));
  for (let yd = 1; yd < 100; yd++) for (const hx of [-3.08, 3.08]) flat(0.6, 0.1, 0xf2f2ee, 0.03, hx, -L / 2 + (yd / 100) * L);
  {
    const cv = document.createElement('canvas');
    cv.width = 2048; cv.height = 300;
    const g = cv.getContext('2d');
    g.font = 'bold 270px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = '#ffffff';
    g.strokeText('MICHIGAN', 1024, 160, 1960);
    g.fillStyle = '#ffcb05';
    g.fillText('MICHIGAN', 1024, 160, 1960);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardNodeMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.85,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo2 = new THREE.PlaneGeometry(W - 4, (W - 4) * 300 / 2048).rotateX(-Math.PI / 2);
    for (const s of [-1, 1]) {
      const word = new THREE.Mesh(geo2, mat);
      word.position.set(0, 0.035, s * (L / 2 + EZ / 2));
      word.rotation.y = s > 0 ? Math.PI : 0;
      word.renderOrder = 1;
      field.add(word);
    }
  }
  const numberTex = new Map();
  const numberMat = (n) => {
    if (!numberTex.has(n)) {
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 220;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff';
      g.font = 'bold 230px "Arial Black", "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(n), 160, 118, 300);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      numberTex.set(n, new THREE.MeshStandardNodeMaterial({ color: 0xf2f2ee, map: tex, transparent: true, depthWrite: false,
        roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    }
    return numberTex.get(n);
  };
  const numberGeo = new THREE.PlaneGeometry(2.66, 1.83).rotateX(-Math.PI / 2);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.45); arrowShape.lineTo(-0.23, -0.45); arrowShape.lineTo(0.23, -0.45);
  const arrowGeo = new THREE.ShapeGeometry(arrowShape).rotateX(-Math.PI / 2);
  const lineMat = new THREE.MeshStandardNodeMaterial({ color: 0xf2f2ee, roughness: 0.9 });
  const NX = W / 2 - 7.4 - 0.915;
  for (let yd = 10; yd <= 90; yd += 10) {
    const z = -L / 2 + (yd / 100) * L, n = yd <= 50 ? yd : 100 - yd;
    for (const side of [-1, 1]) {
      const num = new THREE.Mesh(numberGeo, numberMat(n));
      num.position.set(side * NX, 0.035, z);
      num.rotation.y = -side * Math.PI / 2;
      num.renderOrder = 1;
      field.add(num);
      if (n === 50) continue;
      const toward = yd < 50 ? -1 : 1;
      const arrow = new THREE.Mesh(arrowGeo, lineMat);
      arrow.position.set(side * (NX + 0.55), 0.035, z + toward * 1.75);
      arrow.rotation.y = toward < 0 ? 0 : Math.PI;
      field.add(arrow);
    }
  }
  const BLOCK_M = [[-5, -3.7], [-1.9, -3.7], [-1.9, -2.7], [-2.6, -2.7], [-2.6, 0.9], [0, -2.9], [2.6, 0.9], [2.6, -2.7],
    [1.9, -2.7], [1.9, -3.7], [5, -3.7], [5, -2.7], [4.3, -2.7], [4.3, 2.7], [5, 2.7], [5, 3.7], [2.4, 3.7], [0, 0.4],
    [-2.4, 3.7], [-5, 3.7], [-5, 2.7], [-4.3, 2.7], [-4.3, -2.7], [-5, -2.7]];
  const blockM = (grow) => {
    const shape = new THREE.Shape();
    BLOCK_M.forEach(([x, y], i) => {
      const [px, py] = BLOCK_M[(i + BLOCK_M.length - 1) % BLOCK_M.length], [nx, ny] = BLOCK_M[(i + 1) % BLOCK_M.length];
      let ax = y - py, ay = px - x, bx = ny - y, by = x - nx;
      const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
      ax /= la; ay /= la; bx /= lb; by /= lb;
      const mx = ax + bx, my = ay + by, d = (mx * ax + my * ay) || 1;
      const ox = x + (mx / d) * grow, oy = y + (my / d) * grow;
      i ? shape.lineTo(ox, oy) : shape.moveTo(ox, oy);
    });
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  };
  for (const [grow, hex, y] of [[0.35, 0x00274c, 0.045], [0, 0xffcb05, 0.05]]) {
    const mMesh = new THREE.Mesh(blockM(grow), new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 0.8 }));
    mMesh.position.y = y;
    mMesh.scale.setScalar(1.4);
    mMesh.rotation.y = -Math.PI / 2;
    field.add(mMesh);
  }
  const postMat = new THREE.MeshStandardNodeMaterial({ color: 0xffcb05, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const z = s * (L / 2 + EZ + 0.6);
    const add = (g2, x, y, zz) => { const m = new THREE.Mesh(g2, postMat); m.position.set(x, y, zz); m.castShadow = true; field.add(m); };
    add(new THREE.CylinderGeometry(0.12, 0.12, 3.05, 8), 0, 1.52, z + s * 1.5);
    add(new THREE.BoxGeometry(0.15, 0.15, 1.6), 0, 3.05, z + s * 0.75);
    add(new THREE.BoxGeometry(5.64, 0.12, 0.12), 0, 3.05, z);
    for (const x of [-2.82, 2.82]) add(new THREE.CylinderGeometry(0.06, 0.06, 6.1, 6), x, 3.05 + 3.05, z);
  }
  group.add(field);

  const brickMat = new THREE.MeshStandardNodeMaterial({ color: 0x7e4733, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardNodeMaterial({ color: 0x1d2c3c, roughness: 0.12, metalness: 0.6 });
  const bandMat = new THREE.MeshStandardNodeMaterial({ color: 0xd9d4c8, roughness: 0.7 });
  const maizeMat = new THREE.MeshStandardNodeMaterial({ color: 0xffcb05, roughness: 0.6 });
  const towers = [{ side: -1, top: 36, half: 66, depth: 22 }, { side: 1, top: 27, half: 60, depth: 18 }];
  for (const t of towers) {
    const rOut = radiiAt(t.side < 0 ? Math.PI : 0)[1];
    const outerX = cx + t.side * rOut, innerX = outerX - t.side * t.depth, midX = (outerX + innerX) / 2;
    const y0 = RIM_Y + 1.5, h = t.top - y0;
    colliders.push({ minX: Math.min(innerX, outerX), maxX: Math.max(innerX, outerX), minZ: cz - t.half, maxZ: cz + t.half,
      minY: G + y0, maxY: G + t.top, solid: true });
    const box = new THREE.Mesh(new THREE.BoxGeometry(t.depth, h, t.half * 2), brickMat);
    box.position.set(midX, G + y0 + h / 2, cz);
    box.castShadow = box.receiveShadow = true;
    group.add(box);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, y0 + 3, t.half * 2), brickMat);
    base.position.set(outerX - t.side * 1.5, G + (y0 - 3) / 2, cz);
    colliders.push({ minX: Math.min(outerX, outerX - t.side * 3), maxX: Math.max(outerX, outerX - t.side * 3),
      minZ: cz - t.half, maxZ: cz + t.half, minY: G - 3, maxY: G + y0, solid: true });
    group.add(base);
    for (let b = 0; b < 3; b++) {
      const gy = y0 + 3 + b * (h - 6) / 3, gh = (h - 6) / 3 - 1.4;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.3, gh, t.half * 2 - 4), glassMat);
      glass.position.set(innerX - t.side * 0.12, G + gy + gh / 2, cz);
      group.add(glass);
      const outerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.3, gh * 0.6, t.half * 2 - 20), glassMat);
      outerGlass.position.set(outerX + t.side * 0.12, G + gy + gh / 2, cz);
      group.add(outerGlass);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(t.depth + 0.4, 1.2, t.half * 2 + 0.4), maizeMat);
    stripe.position.set(midX, G + t.top - 1.4, cz);
    group.add(stripe);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(t.depth + 0.6, 0.5, t.half * 2 + 0.6), bandMat);
    cap.position.set(midX, G + t.top + 0.25, cz);
    group.add(cap);
  }

  const boxMat = new THREE.MeshStandardNodeMaterial({ color: 0x3f474f, roughness: 0.5, metalness: 0.3 });
  const cv = document.createElement('canvas');
  cv.width = 1240; cv.height = 400;
  const cx2 = cv.getContext('2d');
  const sky = cx2.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#0b3a6b'); sky.addColorStop(1, '#00274c');
  cx2.fillStyle = sky; cx2.fillRect(0, 0, 1240, 400);
  cx2.strokeStyle = '#ffcb05'; cx2.lineWidth = 14; cx2.strokeRect(22, 22, 1196, 356);
  cx2.fillStyle = '#ffcb05';
  cx2.font = '900 250px "Helvetica Neue", Helvetica, Arial, sans-serif';
  cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
  cx2.fillText('GO BLUE', 620, 212, 1100);
  const screenTex = new THREE.CanvasTexture(cv);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 8;
  const screenMat = new THREE.MeshBasicNodeMaterial({ map: screenTex });
  for (const s of [-1, 1]) {
    const a = s < 0 ? -Math.PI / 2 : Math.PI / 2, rOut = radiiAt(a)[1];
    const bz = cz + s * (rOut - 2);
    const board = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 2), new THREE.MeshStandardNodeMaterial({ color: 0x00274c, roughness: 0.5 }));
    board.position.set(cx, G + 23, bz);
    board.castShadow = true;
    group.add(board);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(31, 10), screenMat);
    screen.position.set(cx, G + 23.5, bz - s * 1.05);
    if (s > 0) screen.rotation.y = Math.PI;
    group.add(screen);
    const band = new THREE.Mesh(new THREE.BoxGeometry(34.2, 1.2, 2.2), new THREE.MeshStandardNodeMaterial({ color: 0xffcb05, roughness: 0.6 }));
    band.position.set(cx, G + 16.6, bz);
    group.add(band);
    for (const lx of [-12, 12]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, 1.6), boxMat);
      leg.position.set(cx + lx, G + 8, bz);
      group.add(leg);
    }
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2, r = radiiAt(a)[1];
    minX = Math.min(minX, cx + Math.cos(a) * r); maxX = Math.max(maxX, cx + Math.cos(a) * r);
    minZ = Math.min(minZ, cz + Math.sin(a) * r); maxZ = Math.max(maxZ, cz + Math.sin(a) * r);
  }
  colliders.push({ minX, maxX, minZ, maxZ, maxY: G + 45, stadium: true });
  group.userData.terrain = 'set';
}

function buildAnnArborLandmarks(scene) {
  const group = new THREE.Group();
  group.name = 'AnnArborLandmarks';
  const colliders = [];
  buildBigHouse(group, colliders);
  if (scene && typeof scene.add === 'function') scene.add(group);
  return { group, colliders };
}

// ============================================================================
// NEW YORK, NY LANDMARKS (Midtown & Lower Manhattan)
// ============================================================================

function buildNewYorkLandmarks(scene) {
  const group = new THREE.Group();
  group.name = 'ManhattanLandmarks';
  const colliders = [];

  const limestoneTrimMat = new THREE.MeshStandardNodeMaterial({
    color: 0xdad0bc,
    roughness: 0.68,
    metalness: 0.12
  });
  const stainlessSteelMat = new THREE.MeshStandardNodeMaterial({
    color: 0xe2ebf4,
    metalness: 0.88,
    roughness: 0.12
  });
  const chryslerCrownMat = createChryslerCrownMaterial();
  const darkBronzeFrameMat = new THREE.MeshStandardNodeMaterial({
    color: 0x26221e,
    roughness: 0.36,
    metalness: 0.72
  });
  const copperRoofMat = new THREE.MeshStandardNodeMaterial({
    color: 0x4b8770,
    roughness: 0.52,
    metalness: 0.28
  });
  const beaconMat = new THREE.MeshBasicNodeMaterial({
    color: 0xff2b2b
  });
  const warmFloodMat = new THREE.MeshStandardNodeMaterial({
    color: 0xffe8be,
    emissive: 0xffc870,
    emissiveIntensity: 1.35,
    roughness: 0.28
  });

  const metlifeSignCanvas = document.createElement('canvas');
  metlifeSignCanvas.width = 512;
  metlifeSignCanvas.height = 128;
  const mlCtx = metlifeSignCanvas.getContext('2d');
  mlCtx.fillStyle = '#24221f';
  mlCtx.fillRect(0, 0, 512, 128);
  mlCtx.strokeStyle = '#6e665c';
  mlCtx.lineWidth = 6;
  mlCtx.strokeRect(4, 4, 504, 120);
  mlCtx.fillStyle = '#fff5dc';
  mlCtx.font = '900 76px Inter, Arial, sans-serif';
  mlCtx.textAlign = 'center';
  mlCtx.textBaseline = 'middle';
  mlCtx.fillText('METLIFE', 256, 68);
  const metlifeSignTex = new THREE.CanvasTexture(metlifeSignCanvas);
  metlifeSignTex.colorSpace = THREE.SRGBColorSpace;
  const metlifeSignMat = new THREE.MeshBasicNodeMaterial({ map: metlifeSignTex });

  const LIMESTONE_CROWN = {
    stoneColor: 0xdad0bc,
    trimColor: 0xa89e8a,
    windowGlassColor: 0x1a2836,
    windowWidth: 2.5,
    floorHeight: 3.6,
    litProbability: 0.58,
    warmth: 0.82,
    crownGlowHeight: 185.0,
    crownGlowColor: 0xffd584,
    seed: 19.31
  };
  const MARBLE_STONE = {
    stoneColor: 0xe6e0d4,
    trimColor: 0xa09888,
    windowGlassColor: 0x1a2634,
    windowWidth: 2.4,
    floorHeight: 3.6,
    litProbability: 0.60,
    warmth: 0.82,
    crownGlowHeight: 152.0,
    seed: 30.19
  };
  const SILVER_CURTAIN = {
    glassTint: 0x1e3e5a,
    frameTint: 0xc8d2dc,
    windowWidth: 2.8,
    floorHeight: 4.0,
    litProbability: 0.62,
    warmth: 0.52,
    reflectivity: 0.94,
    seed: 77.4
  };
  const BRONZE_CURTAIN = {
    glassTint: 0x242a32,
    frameTint: 0x48423c,
    windowWidth: 2.5,
    floorHeight: 3.7,
    litProbability: 0.66,
    warmth: 0.72,
    reflectivity: 0.88,
    seed: 58.2
  };
  const landmarkLimestoneCrownMat = createPreWarBuildingMaterial(LIMESTONE_CROWN);
  const landmarkMarbleStoneMat = createPreWarBuildingMaterial(MARBLE_STONE);
  const landmarkSilverCurtainMat = createCurtainWallMaterial(SILVER_CURTAIN);
  const landmarkBronzeCurtainMat = createCurtainWallMaterial(BRONZE_CURTAIN);
  const boxLocalTwins = new Map([
    [landmarkLimestoneCrownMat, createPreWarBuildingMaterial({ ...LIMESTONE_CROWN, boxLocal: true })],
    [landmarkMarbleStoneMat, createPreWarBuildingMaterial({ ...MARBLE_STONE, boxLocal: true })],
    [landmarkSilverCurtainMat, createCurtainWallMaterial({ ...SILVER_CURTAIN, boxLocal: true })],
    [landmarkBronzeCurtainMat, createCurtainWallMaterial({ ...BRONZE_CURTAIN, boxLocal: true })]
  ]);

  function fitToSite(objs, siteObj, c0, { height, horizontal, stretch = false, offset = [0, 0] } = {}) {
    if (!siteObj) return;
    const box = new THREE.Box3();
    for (const o of objs) {
      o.updateMatrixWorld(true);
      box.expandByObject(o);
    }
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const sy = height ? height / size.y : 1;
    let sx;
    let sz;
    if (stretch) {
      sx = siteObj.w / size.x;
      sz = siteObj.d / size.z;
    } else {
      const fit = Math.min(siteObj.w / size.x, siteObj.d / size.z) * 1.06;
      sx = sz = horizontal ?? Math.min(sy, fit);
    }
    const tx = siteObj.x + offset[0];
    const tz = siteObj.z + offset[1];
    for (const o of objs) {
      o.position.set(tx + (o.position.x - c.x) * sx, o.position.y * sy, tz + (o.position.z - c.z) * sz);
      o.scale.multiply(new THREE.Vector3(sx, sy, sz));
    }
    for (let i = c0; i < colliders.length; i++) {
      const k = colliders[i];
      const x0 = tx + (k.minX - c.x) * sx;
      const x1 = tx + (k.maxX - c.x) * sx;
      const z0 = tz + (k.minZ - c.z) * sz;
      const z1 = tz + (k.maxZ - c.z) * sz;
      k.minX = Math.min(x0, x1);
      k.maxX = Math.max(x0, x1);
      k.minZ = Math.min(z0, z1);
      k.maxZ = Math.max(z0, z1);
      k.maxY *= sy;
    }
  }
  const site = (name) => LANDMARK_SITES[name];
  const unionSite = (...names) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const n of names) {
      const t = LANDMARK_SITES[n];
      if (!t) continue;
      x0 = Math.min(x0, t.x - t.w / 2); x1 = Math.max(x1, t.x + t.w / 2);
      z0 = Math.min(z0, t.z - t.d / 2); z1 = Math.max(z1, t.z + t.d / 2);
    }
    return isFinite(x0) ? { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 } : null;
  };
  const blockSite = (parkName) => {
    const b = BLOCKS.filter((q) => q.parkName === parkName && !q.median).sort((p, q) => q.area - p.area)[0];
    return b && { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, w: b.maxX - b.minX - 9.2, d: b.maxZ - b.minZ - 9.2 };
  };

  // 1. EMPIRE STATE BUILDING
  {
    const c0 = colliders.length;
    const b = getBlockBounds(2, 5);
    const esb = new THREE.Group();
    esb.position.set(b.cx, 0, b.cz);
    const esbMat = landmarkLimestoneCrownMat;

    const podium = new THREE.Mesh(new THREE.BoxGeometry(68, 22, 50), esbMat);
    podium.position.y = 11;
    podium.castShadow = podium.receiveShadow = true;
    esb.add(podium);

    const portal = new THREE.Mesh(new THREE.BoxGeometry(3.2, 14, 12), limestoneTrimMat);
    portal.position.set(34.2, 7, 0);
    esb.add(portal);

    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(54, 34, 38), esbMat);
    tier1.position.y = 22 + 17;
    tier1.castShadow = tier1.receiveShadow = true;
    esb.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(44, 28, 32), esbMat);
    tier2.position.y = 56 + 14;
    tier2.castShadow = tier2.receiveShadow = true;
    esb.add(tier2);

    const mainShaft = new THREE.Mesh(new THREE.BoxGeometry(35, 112, 26), esbMat);
    mainShaft.position.y = 84 + 56;
    mainShaft.castShadow = mainShaft.receiveShadow = true;
    esb.add(mainShaft);

    for (const sx of [-18.5, 18.5]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4.5, 96, 16), esbMat);
      wing.position.set(sx, 84 + 48, 0);
      wing.castShadow = wing.receiveShadow = true;
      esb.add(wing);
    }

    const tier3 = new THREE.Mesh(new THREE.BoxGeometry(29, 24, 21), esbMat);
    tier3.position.y = 196 + 12;
    tier3.castShadow = true;
    esb.add(tier3);

    const tier4 = new THREE.Mesh(new THREE.BoxGeometry(23, 18, 17), esbMat);
    tier4.position.y = 220 + 9;
    tier4.castShadow = true;
    esb.add(tier4);

    const obsTerrace = new THREE.Mesh(new THREE.BoxGeometry(23.8, 1.1, 17.8), limestoneTrimMat);
    obsTerrace.position.y = 238.4;
    esb.add(obsTerrace);

    for (const pz of [-8.6, 8.6]) {
      const railZ = new THREE.Mesh(new THREE.BoxGeometry(23.6, 1.25, 0.32), stainlessSteelMat);
      railZ.position.set(0, 239.5, pz);
      esb.add(railZ);
    }
    for (const px of [-11.6, 11.6]) {
      const railX = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.25, 17.6), stainlessSteelMat);
      railX.position.set(px, 239.5, 0);
      esb.add(railX);
    }

    const obsDeck = new THREE.Mesh(new THREE.BoxGeometry(18.6, 6.4, 13.6), warmFloodMat);
    obsDeck.position.y = 238.8 + 3.2;
    esb.add(obsDeck);

    for (let mx = -7.5; mx <= 7.5; mx += 3.0) {
      const mullionZ = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.4, 13.95), darkBronzeFrameMat);
      mullionZ.position.set(mx, 242.0, 0);
      esb.add(mullionZ);
    }
    for (let mz = -5.0; mz <= 5.0; mz += 2.5) {
      const mullionX = new THREE.Mesh(new THREE.BoxGeometry(18.95, 6.4, 0.45), darkBronzeFrameMat);
      mullionX.position.set(0, 242.0, mz);
      esb.add(mullionX);
    }
    const obsCap = new THREE.Mesh(new THREE.BoxGeometry(19.8, 0.9, 14.8), limestoneTrimMat);
    obsCap.position.y = 245.2;
    esb.add(obsCap);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6.2, 30, 16), stainlessSteelMat);
    mast.position.y = 245 + 15;
    esb.add(mast);

    const ring102 = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 3.2, 16), warmFloodMat);
    ring102.position.y = 271;
    esb.add(ring102);

    const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 4.6, 8, 16), stainlessSteelMat);
    dome.position.y = 276.5;
    esb.add(dome);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.4, 44, 12), stainlessSteelMat);
    spire.position.y = 280.5 + 22;
    esb.add(spire);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 8), beaconMat);
    beacon.position.y = 325.2;
    esb.add(beacon);

    group.add(esb);
    colliders.push({ minX: b.cx - 34, maxX: b.cx + 34, minZ: b.cz - 25, maxZ: b.cz + 25, maxY: 245 });
    fitToSite([esb], site('Empire State Building'), c0, { height: 443 });
  }

  // 2. CHRYSLER BUILDING
  {
    const c0 = colliders.length;
    const b = getBlockBounds(5, 3);
    const chrysler = new THREE.Group();
    chrysler.position.set(b.cx - 8, 0, b.cz + 6);
    const chryslerShaftMat = landmarkMarbleStoneMat;
    const crownMat = chryslerCrownMat;

    const base = new THREE.Mesh(new THREE.BoxGeometry(50, 24, 44), chryslerShaftMat);
    base.position.y = 12;
    base.castShadow = base.receiveShadow = true;
    chrysler.add(base);

    const step1 = new THREE.Mesh(new THREE.BoxGeometry(40, 24, 34), chryslerShaftMat);
    step1.position.y = 24 + 12;
    step1.castShadow = step1.receiveShadow = true;
    chrysler.add(step1);

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(31, 22, 28), chryslerShaftMat);
    step2.position.y = 48 + 11;
    step2.castShadow = step2.receiveShadow = true;
    chrysler.add(step2);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(24, 102, 24), chryslerShaftMat);
    shaft.position.y = 70 + 51;
    shaft.castShadow = shaft.receiveShadow = true;
    chrysler.add(shaft);

    for (const gx of [-12.2, 12.2]) {
      for (const gz of [-12.2, 12.2]) {
        const gargoyle = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.8, 6), stainlessSteelMat);
        gargoyle.position.set(gx * 1.06, 169, gz * 1.06);
        gargoyle.rotation.x = gz > 0 ? Math.PI * 0.38 : -Math.PI * 0.38;
        gargoyle.rotation.z = gx > 0 ? -Math.PI * 0.38 : Math.PI * 0.38;
        chrysler.add(gargoyle);
      }
    }

    const numTiers = 7;
    let curY = 172;
    for (let t = 0; t < numTiers; t++) {
      const u = t / numTiers;
      const w = 22.8 * (1.0 - u * 0.72);
      const h = 6.8 * (1.0 - u * 0.16);
      const tierCore = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.82), crownMat);
      tierCore.position.y = curY + h * 0.5;
      chrysler.add(tierCore);
      const tierCross = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h, w), crownMat);
      tierCross.position.y = curY + h * 0.5;
      chrysler.add(tierCross);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.55, w + 0.7), stainlessSteelMat);
      rib.position.y = curY + h;
      chrysler.add(rib);
      curY += h;
    }

    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.35, 38, 12), stainlessSteelMat);
    needle.position.y = curY + 18;
    chrysler.add(needle);

    const cBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), beaconMat);
    cBeacon.position.y = curY + 37.5;
    chrysler.add(cBeacon);

    group.add(chrysler);
    colliders.push({ minX: b.cx - 33, maxX: b.cx + 17, minZ: b.cz - 16, maxZ: b.cz + 28, maxY: 225 });
    fitToSite([chrysler], site('Chrysler Building'), c0, { height: 319 });
  }

  // 3. ONE VANDERBILT
  {
    const c0 = colliders.length;
    const b = getBlockBounds(3, 3);
    const vanderbilt = new THREE.Group();
    vanderbilt.position.set(b.cx + 12, 0, b.cz + 5);
    const ovMat = landmarkSilverCurtainMat;
    const segments = [
      { w: 40, d: 38, h: 68, y: 0, ox: 0, oz: 0 },
      { w: 35, d: 33, h: 72, y: 66, ox: 1.0, oz: -1.0 },
      { w: 29, d: 28, h: 62, y: 136, ox: -1.0, oz: 1.0 },
      { w: 23, d: 22, h: 42, y: 196, ox: 0.5, oz: 0.5 },
      { w: 15, d: 15, h: 24, y: 236, ox: 0, oz: 0 }
    ];
    for (const seg of segments) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(seg.w, seg.h, seg.d), ovMat);
      m.position.set(seg.ox, seg.y + seg.h * 0.5, seg.oz);
      m.castShadow = m.receiveShadow = true;
      vanderbilt.add(m);
    }
    const summitCore = new THREE.Mesh(new THREE.BoxGeometry(24.6, 8.2, 23.2), warmFloodMat);
    summitCore.position.set(0.5, 206, 0.5);
    vanderbilt.add(summitCore);
    for (let fx = -11; fx <= 11; fx += 2.75) {
      const finZ = new THREE.Mesh(new THREE.BoxGeometry(0.42, 8.6, 23.8), stainlessSteelMat);
      finZ.position.set(0.5 + fx, 206, 0.5);
      vanderbilt.add(finZ);
    }
    for (let fz = -10; fz <= 10; fz += 2.5) {
      const finX = new THREE.Mesh(new THREE.BoxGeometry(25.2, 8.6, 0.42), stainlessSteelMat);
      finX.position.set(0.5, 206, 0.5 + fz);
      vanderbilt.add(finX);
    }
    const ovSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.95, 30, 8), warmFloodMat);
    ovSpire.position.y = 260 + 15;
    vanderbilt.add(ovSpire);

    group.add(vanderbilt);
    colliders.push({ minX: b.cx - 10, maxX: b.cx + 33, minZ: b.cz - 15, maxZ: b.cz + 25, maxY: 260 });
    fitToSite([vanderbilt], site('One Vanderbilt'), c0, { height: 427 });
  }

  // 4. GRAND CENTRAL TERMINAL & METLIFE BUILDING
  {
    const c0 = colliders.length;
    const b = getBlockBounds(4, 3);
    const gctGroup = new THREE.Group();
    gctGroup.position.set(b.cx, 0, b.cz);

    const gctBody = new THREE.Mesh(new THREE.BoxGeometry(62, 24, 28), landmarkMarbleStoneMat);
    gctBody.position.set(0, 12, 14);
    gctBody.castShadow = gctBody.receiveShadow = true;
    gctGroup.add(gctBody);

    const gctRoof = new THREE.Mesh(new THREE.BoxGeometry(58, 3.5, 24), copperRoofMat);
    gctRoof.position.set(0, 25.5, 14);
    gctGroup.add(gctRoof);

    for (const wx of [-17, 0, 17]) {
      const archWin = new THREE.Mesh(new THREE.BoxGeometry(9.2, 14.2, 0.8), warmFloodMat);
      archWin.position.set(wx, 11.8, 28.05);
      gctGroup.add(archWin);
      const archTop = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.8, 16), warmFloodMat);
      archTop.rotation.x = Math.PI * 0.5;
      archTop.position.set(wx, 18.9, 28.05);
      gctGroup.add(archTop);
      for (const mx of [-2.3, 0, 2.3]) {
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 16.5, 0.95), darkBronzeFrameMat);
        vBar.position.set(wx + mx, 13.0, 28.1);
        gctGroup.add(vBar);
      }
      for (const my of [8.5, 13.0, 17.5]) {
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.32, 0.95), darkBronzeFrameMat);
        hBar.position.set(wx, my, 28.1);
        gctGroup.add(hBar);
      }
    }
    for (const cx of [-25.5, -23.0, -9.8, -7.2, 7.2, 9.8, 23.0, 25.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.70, 18.2, 12), limestoneTrimMat);
      col.position.set(cx, 12.2, 28.45);
      col.castShadow = true;
      gctGroup.add(col);
    }

    const gctEntablature = new THREE.Mesh(new THREE.BoxGeometry(58, 1.8, 2.2), limestoneTrimMat);
    gctEntablature.position.set(0, 22.4, 28.2);
    gctGroup.add(gctEntablature);
    const pediment = new THREE.Mesh(new THREE.BoxGeometry(16, 4.8, 2.2), limestoneTrimMat);
    pediment.position.set(0, 25.4, 27.6);
    gctGroup.add(pediment);
    const pedimentPeak = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.4, 2.2), limestoneTrimMat);
    pedimentPeak.position.set(0, 28.6, 27.6);
    gctGroup.add(pedimentPeak);

    const clockBezel = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.75, 20), darkBronzeFrameMat);
    clockBezel.rotation.x = Math.PI * 0.5;
    clockBezel.position.set(0, 25.8, 28.55);
    gctGroup.add(clockBezel);
    const clockGlow = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.85, 20), warmFloodMat);
    clockGlow.rotation.x = Math.PI * 0.5;
    clockGlow.position.set(0, 25.8, 28.6);
    gctGroup.add(clockGlow);

    const viaductDeck = new THREE.Mesh(new THREE.BoxGeometry(11, 1.8, 76), limestoneTrimMat);
    viaductDeck.position.set(-55, 9.5, 38);
    viaductDeck.castShadow = viaductDeck.receiveShadow = true;
    gctGroup.add(viaductDeck);
    for (const vz of [8, 28, 52, 70]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(9.5, 9.0, 3.5), limestoneTrimMat);
      pier.position.set(-55, 4.5, vz);
      pier.castShadow = pier.receiveShadow = true;
      gctGroup.add(pier);
    }

    const metlifeMat = landmarkBronzeCurtainMat;
    const mlCenter = new THREE.Mesh(new THREE.BoxGeometry(44, 198, 24), metlifeMat);
    mlCenter.position.set(0, 99, -12);
    mlCenter.castShadow = mlCenter.receiveShadow = true;
    gctGroup.add(mlCenter);

    const mlWingW = new THREE.Mesh(new THREE.BoxGeometry(16, 198, 16), metlifeMat);
    mlWingW.position.set(-24, 99, -12);
    mlWingW.rotation.y = Math.PI * 0.25;
    mlWingW.castShadow = true;
    gctGroup.add(mlWingW);

    const mlWingE = new THREE.Mesh(new THREE.BoxGeometry(16, 198, 16), metlifeMat);
    mlWingE.position.set(24, 99, -12);
    mlWingE.rotation.y = Math.PI * 0.25;
    mlWingE.castShadow = true;
    gctGroup.add(mlWingE);

    const signBand = new THREE.Mesh(new THREE.BoxGeometry(28.5, 6.8, 25.4), metlifeSignMat);
    signBand.position.set(0, 191, -12);
    gctGroup.add(signBand);

    group.add(gctGroup);
    colliders.push({ minX: b.cx - 34, maxX: b.cx + 34, minZ: b.cz - 28, maxZ: b.cz + 28, maxY: 198 });
    fitToSite([gctGroup], unionSite('Grand Central Terminal', 'MetLife Building'), c0, { height: 246 });
  }

  // 5. BRYANT PARK & NEW YORK PUBLIC LIBRARY
  {
    const c0 = colliders.length;
    const b = getBlockBounds(2, 4);
    const bpGroup = new THREE.Group();
    bpGroup.position.set(b.cx, 0, b.cz);

    const nypl = new THREE.Mesh(new THREE.BoxGeometry(26, 21, 56), landmarkMarbleStoneMat);
    nypl.position.set(20, 10.5, 0);
    nypl.castShadow = nypl.receiveShadow = true;
    bpGroup.add(nypl);

    const nyplRoof = new THREE.Mesh(new THREE.BoxGeometry(22, 3.2, 50), copperRoofMat);
    nyplRoof.position.set(20, 22.5, 0);
    bpGroup.add(nyplRoof);

    const porticoBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 18.5, 22), landmarkMarbleStoneMat);
    porticoBack.position.set(32.2, 9.25, 0);
    porticoBack.castShadow = porticoBack.receiveShadow = true;
    bpGroup.add(porticoBack);

    for (const pz of [-6.4, 0, 6.4]) {
      const archFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 11.8, 4.2), darkBronzeFrameMat);
      archFrame.position.set(33.3, 8.2, pz);
      bpGroup.add(archFrame);
      const archGlass = new THREE.Mesh(new THREE.BoxGeometry(1.25, 10.6, 3.2), warmFloodMat);
      archGlass.position.set(33.35, 8.0, pz);
      bpGroup.add(archGlass);
    }
    for (const cz of [-9.6, -5.8, -2.2, 2.2, 5.8, 9.6]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.66, 14.2, 12), limestoneTrimMat);
      column.position.set(34.8, 9.5, cz);
      column.castShadow = column.receiveShadow = true;
      bpGroup.add(column);
    }
    const porticoEntablature = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 22.4), limestoneTrimMat);
    porticoEntablature.position.set(33.6, 17.6, 0);
    porticoEntablature.castShadow = true;
    bpGroup.add(porticoEntablature);
    const porticoAttic = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 16.0), limestoneTrimMat);
    porticoAttic.position.set(33.4, 19.6, 0);
    bpGroup.add(porticoAttic);
    const stairs = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.4, 18), limestoneTrimMat);
    stairs.position.set(35.5, 1.2, 0);
    stairs.receiveShadow = true;
    bpGroup.add(stairs);

    for (const lz of [-10.5, 10.5]) {
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.2), limestoneTrimMat);
      pedestal.position.set(35.8, 1.1, lz);
      bpGroup.add(pedestal);
      const lion = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.2), limestoneTrimMat);
      lion.position.set(36.0, 2.8, lz);
      bpGroup.add(lion);
    }

    const lawnWall = new THREE.Mesh(new THREE.BoxGeometry(46, 0.85, 60), limestoneTrimMat);
    lawnWall.position.set(-14, 0.42, 0);
    lawnWall.receiveShadow = true;
    bpGroup.add(lawnWall);

    const lawnGrassMat = new THREE.MeshStandardNodeMaterial({ color: 0x388c42, emissive: 0x081e0b, roughness: 0.80 });
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(38, 0.28, 48), lawnGrassMat);
    lawn.position.set(-13, 0.92, 0);
    lawn.receiveShadow = true;
    bpGroup.add(lawn);

    const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.2, 1.1, 20), limestoneTrimMat);
    fountainBasin.position.set(-29, 0.9, 0);
    bpGroup.add(fountainBasin);
    const fountainWater = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 0.16, 20),
      new THREE.MeshStandardNodeMaterial({ color: 0x24789c, emissive: 0x0a2e40, roughness: 0.12, metalness: 0.65 })
    );
    fountainWater.position.set(-29, 1.42, 0);
    bpGroup.add(fountainWater);

    const carouselBase = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.0, 2.8, 14), limestoneTrimMat);
    carouselBase.position.set(-12, 2.2, 21);
    bpGroup.add(carouselBase);
    const carouselRoof = new THREE.Mesh(
      new THREE.ConeGeometry(4.4, 2.2, 14),
      new THREE.MeshStandardNodeMaterial({ color: 0xb83228, roughness: 0.45 })
    );
    carouselRoof.position.set(-12, 4.6, 21);
    bpGroup.add(carouselRoof);

    group.add(bpGroup);
    colliders.push({ minX: b.cx + 6, maxX: b.cx + 35, minZ: b.cz - 28, maxZ: b.cz + 28, maxY: 24 });
    fitToSite([bpGroup], blockSite('Bryant Park'), c0, { height: 30, stretch: true });
    bpGroup.updateMatrixWorld(true);
    const lb = new THREE.Box3().setFromObject(lawn);
    bryantParkLawn = { minX: lb.min.x, maxX: lb.max.x, minZ: lb.min.z, maxZ: lb.max.z, top: lb.max.y };
  }

  // 6. ONE TIMES SQUARE
  {
    const c0 = colliders.length;
    const b = getBlockBounds(1, 3);
    const tsGroup = new THREE.Group();
    tsGroup.position.set(b.cx, 0, b.cz);
    const darkFacadeMat = landmarkBronzeCurtainMat;
    const otsW = 18, otsD = 26, otsH = 118, otsX = -16;
    const otsTower = new THREE.Mesh(new THREE.BoxGeometry(otsW, otsH, otsD), darkFacadeMat);
    otsTower.position.set(otsX, otsH * 0.5, 14);
    otsTower.castShadow = otsTower.receiveShadow = true;
    tsGroup.add(otsTower);

    for (let s = 0; s < 5; s++) {
      const panelH = 17.5;
      const panelY = 14 + s * 19.5;
      const screenW = new THREE.Mesh(new THREE.PlaneGeometry(otsD - 2, panelH), createBillboardMaterial(s));
      screenW.rotation.y = -Math.PI * 0.5;
      screenW.position.set(otsX - otsW * 0.5 - 0.25, panelY, 14);
      tsGroup.add(screenW);

      const screenS = new THREE.Mesh(new THREE.PlaneGeometry(otsW - 2, panelH), createBillboardMaterial(s + 1));
      screenS.position.set(otsX, panelY, 14 + otsD * 0.5 + 0.25);
      tsGroup.add(screenS);

      const screenN = new THREE.Mesh(new THREE.PlaneGeometry(otsW - 2, panelH), createBillboardMaterial(s + 3));
      screenN.rotation.y = Math.PI;
      screenN.position.set(otsX, panelY, 14 - otsD * 0.5 - 0.25);
      tsGroup.add(screenN);
    }

    const ballMast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 8), stainlessSteelMat);
    ballMast.position.set(otsX, otsH + 13, 14);
    tsGroup.add(ballMast);
    const nyeBall = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 14, 14),
      new THREE.MeshBasicNodeMaterial({ color: 0x88f5ff })
    );
    nyeBall.position.set(otsX, otsH + 22, 14);
    tsGroup.add(nyeBall);

    group.add(tsGroup);
    colliders.push({ minX: b.cx + otsX - 9, maxX: b.cx + otsX + 9, minZ: b.cz + 1, maxZ: b.cz + 27, maxY: otsH });
    fitToSite([tsGroup], site('One Times Square'), c0, { height: 120 });
  }

  // 7. 30 ROCKEFELLER PLAZA
  {
    const c0 = colliders.length;
    const b = getBlockBounds(2, 2);
    const rockGroup = new THREE.Group();
    rockGroup.position.set(b.cx, 0, b.cz);
    const rockMat = landmarkLimestoneCrownMat;

    const slabMain = new THREE.Mesh(new THREE.BoxGeometry(24, 212, 56), rockMat);
    slabMain.position.set(-14, 106, 0);
    slabMain.castShadow = slabMain.receiveShadow = true;
    rockGroup.add(slabMain);

    const slabStep1 = new THREE.Mesh(new THREE.BoxGeometry(34, 135, 44), rockMat);
    slabStep1.position.set(-14, 67.5, 0);
    slabStep1.castShadow = slabStep1.receiveShadow = true;
    rockGroup.add(slabStep1);

    for (const cz of [-18, 18]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(28, 28, 18), rockMat);
      wing.position.set(18, 14, cz);
      wing.castShadow = wing.receiveShadow = true;
      rockGroup.add(wing);
    }

    const prometheus = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.45, 10, 20),
      new THREE.MeshStandardNodeMaterial({ color: 0xffc845, metalness: 0.65, roughness: 0.22 })
    );
    prometheus.position.set(1, 3.8, 0);
    prometheus.rotation.y = Math.PI * 0.5;
    rockGroup.add(prometheus);

    group.add(rockGroup);
    colliders.push({ minX: b.cx - 32, maxX: b.cx + 4, minZ: b.cz - 28, maxZ: b.cz + 28, maxY: 212 });
    fitToSite([rockGroup], site('30 Rockefeller Plaza'), c0, { height: 259 });
  }

  // 8. CITIGROUP CENTER
  {
    const c0 = colliders.length;
    const b = getBlockBounds(5, 1);
    const citiGroup = new THREE.Group();
    citiGroup.position.set(b.cx, 0, b.cz);
    const citiMat = landmarkSilverCurtainMat;

    for (const [sx, sz] of [[-18, 0], [18, 0], [0, -18], [0, 18]]) {
      const stilt = new THREE.Mesh(new THREE.BoxGeometry(7.5, 30, 7.5), stainlessSteelMat);
      stilt.position.set(sx, 15, sz);
      stilt.castShadow = stilt.receiveShadow = true;
      citiGroup.add(stilt);
    }
    const core = new THREE.Mesh(new THREE.BoxGeometry(16, 30, 16), stainlessSteelMat);
    core.position.set(0, 15, 0);
    core.castShadow = core.receiveShadow = true;
    citiGroup.add(core);

    const citiShaft = new THREE.Mesh(new THREE.BoxGeometry(42, 145, 42), citiMat);
    citiShaft.position.set(0, 30 + 72.5, 0);
    citiShaft.castShadow = citiShaft.receiveShadow = true;
    citiGroup.add(citiShaft);

    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(-21, 0);
    wedgeShape.lineTo(21, 0);
    wedgeShape.lineTo(-21, 34);
    wedgeShape.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 42, bevelEnabled: false });
    wedgeGeo.translate(0, 0, -21);
    const citiCrown = new THREE.Mesh(wedgeGeo, stainlessSteelMat);
    citiCrown.position.set(0, 175, 0);
    citiGroup.add(citiCrown);

    group.add(citiGroup);
    colliders.push({ minX: b.cx - 21, maxX: b.cx + 21, minZ: b.cz - 21, maxZ: b.cz + 21, maxY: 209 });
    fitToSite([citiGroup], site('Citigroup Center'), c0, { height: 279 });
  }

  // 9. FLATIRON BUILDING
  {
    const c0 = colliders.length;
    const b = getBlockBounds(2, 7);
    const flatironGroup = new THREE.Group();
    flatironGroup.position.set(b.cx + 28, 0, b.cz - 4);
    const flatironMat = landmarkMarbleStoneMat;

    const triShape = new THREE.Shape();
    triShape.moveTo(0, -26);
    triShape.quadraticCurveTo(2.0, -26, 11, 24);
    triShape.lineTo(-13, 24);
    triShape.quadraticCurveTo(-2.5, -26, 0, -26);

    const flatGeo = new THREE.ExtrudeGeometry(triShape, {
      depth: 88, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2
    });
    flatGeo.rotateX(Math.PI * 0.5);
    flatGeo.translate(0, 88, 0);
    const flatironMesh = new THREE.Mesh(flatGeo, flatironMat);
    flatironMesh.castShadow = flatironMesh.receiveShadow = true;
    flatironGroup.add(flatironMesh);

    const corniceGeo = new THREE.ExtrudeGeometry(triShape, {
      depth: 2.8, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 1.2, bevelSegments: 2
    });
    corniceGeo.rotateX(Math.PI * 0.5);
    corniceGeo.translate(0, 89.2, 0);
    const corniceMesh = new THREE.Mesh(corniceGeo, limestoneTrimMat);
    flatironGroup.add(corniceMesh);

    group.add(flatironGroup);
    colliders.push({ minX: b.cx + 15, maxX: b.cx + 39, minZ: b.cz - 30, maxZ: b.cz + 20, maxY: 90 });
    fitToSite([flatironGroup], site('Flatiron Building'), c0, { height: 87 });
  }

  // 10. SEAGRAM BUILDING
  {
    const c0 = colliders.length;
    const b = getBlockBounds(4, 1);
    const seagramGroup = new THREE.Group();
    seagramGroup.position.set(b.cx, 0, b.cz);
    const seagramMat = landmarkBronzeCurtainMat;

    const tower = new THREE.Mesh(new THREE.BoxGeometry(42, 162, 36), seagramMat);
    tower.position.set(8, 81, 0);
    tower.castShadow = tower.receiveShadow = true;
    seagramGroup.add(tower);

    const bustle = new THREE.Mesh(new THREE.BoxGeometry(24, 92, 26), seagramMat);
    bustle.position.set(22, 46, 0);
    bustle.castShadow = bustle.receiveShadow = true;
    seagramGroup.add(bustle);

    const poolMat = new THREE.MeshStandardNodeMaterial({ color: 0x1e5266, roughness: 0.1, metalness: 0.7 });
    for (const pz of [-14, 14]) {
      const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 0.55, 12), poolMat);
      pool.position.set(-22, 0.32, pz);
      seagramGroup.add(pool);
    }

    group.add(seagramGroup);
    colliders.push({ minX: b.cx - 13, maxX: b.cx + 34, minZ: b.cz - 18, maxZ: b.cz + 18, maxY: 162 });
    fitToSite([seagramGroup], site('Seagram Building'), c0, { height: 157, offset: [-14, 0] });
  }

  // 11. ONE WORLD TRADE CENTER
  {
    const c0 = colliders.length;
    const owtcGroup = new THREE.Group();
    owtcGroup.position.set(-260, 0, 1234);
    const owtcMat = landmarkSilverCurtainMat;
    const podiumFinMat = new THREE.MeshStandardNodeMaterial({ color: 0xc8d4e0, roughness: 0.22, metalness: 0.85 });

    const basePodium = new THREE.Mesh(new THREE.BoxGeometry(48, 52, 48), owtcMat);
    basePodium.position.y = 26;
    basePodium.castShadow = basePodium.receiveShadow = true;
    owtcGroup.add(basePodium);

    for (let f = -20; f <= 20; f += 5) {
      const finNS = new THREE.Mesh(new THREE.BoxGeometry(0.45, 44, 49.2), podiumFinMat);
      finNS.position.set(f, 28, 0);
      owtcGroup.add(finNS);
      const finEW = new THREE.Mesh(new THREE.BoxGeometry(49.2, 44, 0.45), podiumFinMat);
      finEW.position.set(0, 28, f);
      owtcGroup.add(finEW);
    }

    const lobbyNS = new THREE.Mesh(new THREE.BoxGeometry(24, 9.5, 48.6), warmFloodMat);
    lobbyNS.position.set(0, 4.8, 0);
    owtcGroup.add(lobbyNS);
    const lobbyEW = new THREE.Mesh(new THREE.BoxGeometry(48.6, 9.5, 24), warmFloodMat);
    lobbyEW.position.set(0, 4.8, 0);
    owtcGroup.add(lobbyEW);

    const podiumCollar = new THREE.Mesh(new THREE.BoxGeometry(49.6, 1.8, 49.6), podiumFinMat);
    podiumCollar.position.y = 52.0;
    owtcGroup.add(podiumCollar);

    const shaft1Geo = new THREE.CylinderGeometry(23.5, 33.9, 235, 4).toNonIndexed();
    shaft1Geo.computeVertexNormals();
    const shaft1 = new THREE.Mesh(shaft1Geo, owtcMat);
    shaft1.rotation.y = Math.PI * 0.25;
    shaft1.position.y = 52 + 117.5;
    shaft1.castShadow = shaft1.receiveShadow = true;
    owtcGroup.add(shaft1);

    const shaft2Geo = new THREE.CylinderGeometry(33.9, 23.5, 235, 4).toNonIndexed();
    shaft2Geo.computeVertexNormals();
    const shaft2 = new THREE.Mesh(shaft2Geo, owtcMat);
    shaft2.position.y = 52 + 117.5;
    shaft2.castShadow = shaft2.receiveShadow = true;
    owtcGroup.add(shaft2);

    const parapetRing = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 8, 16), warmFloodMat);
    parapetRing.position.y = 291;
    owtcGroup.add(parapetRing);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 2.2, 68, 12), podiumFinMat);
    spire.position.y = 295 + 34;
    owtcGroup.add(spire);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), warmFloodMat);
    beacon.position.y = 364;
    owtcGroup.add(beacon);

    group.add(owtcGroup);
    colliders.push({ minX: -285, maxX: -235, minZ: 1209, maxZ: 1259, maxY: 364 });
    fitToSite([owtcGroup], site('One World Trade Center'), c0, { height: 541, horizontal: 1.27 });
  }

  group.updateMatrixWorld(true);
  const facadeBoxes = new Map();
  const boxParts = [];
  group.traverse((obj) => {
    if (obj.isMesh && boxLocalTwins.has(obj.material) && obj.geometry.type === 'BoxGeometry') boxParts.push(obj);
  });
  const partPos = new THREE.Vector3();
  const partRot = new THREE.Quaternion();
  const partScale = new THREE.Vector3();
  for (const m of boxParts) {
    m.matrixWorld.decompose(partPos, partRot, partScale);
    if (Math.abs(partRot.w) < 0.99999) continue;
    const { width, height, depth } = m.geometry.parameters;
    const twin = boxLocalTwins.get(m.material);
    if (!facadeBoxes.has(twin)) facadeBoxes.set(twin, []);
    facadeBoxes.get(twin).push({ x: partPos.x, y: partPos.y, z: partPos.z, w: width * partScale.x, h: height * partScale.y, d: depth * partScale.z });
    m.removeFromParent();
  }
  for (const [mat, boxes] of facadeBoxes) {
    const inst = createFacadeBoxes(mat, boxes);
    inst.castShadow = inst.receiveShadow = true;
    group.add(inst);
  }

  batchStaticGroupMeshes(group, new Set([stainlessSteelMat]));
  if (scene && typeof scene.add === 'function') scene.add(group);
  return { group, colliders };
}

export function buildLandmarks(scene) {
  if (ACTIVE_CITY_ID === 'annarbor') return buildAnnArborLandmarks(scene);
  if (ACTIVE_CITY_ID === 'newyork') return buildNewYorkLandmarks(scene);
  if (ACTIVE_CITY_ID === 'oakland') return buildOaklandLandmarks(scene);
  return buildRoyalOakLandmarks(scene);
}
