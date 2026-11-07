import * as THREE from 'three/webgpu';
import { log } from '../lamp-game.js';
import { ACTIVE_CITY_ID, CITY_PACK, cityAssetPath } from './city-packs.js';
import { buildCityGrid } from './city-grid.js';
import { buildOutskirts } from './outskirts.js';
import { buildLandmarks } from './landmarks.js';
import { buildRailways } from './railways.js';
import { buildParkedCars } from './parked-cars.js';
import { buildCityBlocks } from './buildings.js';
import { setDistricts } from './districts.js';
import { setRoofShapes } from './houses.js';
import { buildStreetDetails } from './street-details.js';
import { createTrafficSystem, createHighwayTraffic } from './traffic.js';
import { buildRoadPaint } from './road-paint.js';
import { buildTrafficControls } from './traffic-controls.js';
import { buildShopSigns } from './shop-signs.js';
import { buildRoadWork } from './road-work.js';
import { buildCascades } from './cascades.js';
import { buildRiverPeople } from './river-people.js';
import { createKnockdowns } from './knockdowns.js';
import { createHydrantSpray } from './hydrant-spray.js';
import { createSkidEffects } from './skid-effects.js';
import { setupSceneCulling, cullAlso } from './scene-culling.js';
import { setOnTerrain, groundHeight, waterLevel } from './terrain.js';
import { gpuOnly } from './gpu-only.js';

const CITY_MAP = cityAssetPath('city-geodata.js');
const BUILDING_DATA = ['js/building-geodata.js', cityAssetPath('building-geodata.bin.gz')];
const TREE_DATA = ['js/tree-geodata.js', cityAssetPath('tree-geodata.bin.gz'), 'js/tree-placements.js'];

/**
 * Builds the 3D city geography, landmarks, blocks, street details, railways,
 * parked vehicles, road work, and traffic systems for the active city pack.
 */
export async function buildCityWorld({
  live,
  scene,
  quality,
  tier,
  heights,
  showLoadingStage,
  markInit,
  loadCityJson,
  getControllerManager,
  getAudioSystem
}) {
  function finishPart(group, made, cull, still) {
    const culled = cull ? cull(group, [group], quality.shadows) : [];
    if (still) gpuOnly(group);
    return {
      group,
      made,
      culled,
      dispose() {
        group.removeFromParent();
        group.traverse((o) => {
          o.geometry?.dispose();
          for (const m of [o.material].flat()) m?.dispose?.();
        });
      }
    };
  }

  function cityPart(build, { cull = null, still = false } = {}) {
    const group = new THREE.Group();
    const made = build(group);
    if (made instanceof Promise) return made.then((m) => finishPart(group, m, cull, still));
    return finishPart(group, made, cull, still);
  }

  await showLoadingStage(CITY_PACK.loadingStages?.streets || 'Building streets, parks and waterways...');
  const grid = await live.keep(`grid-${ACTIVE_CITY_ID}`, () => cityPart(async (g) => {
    const made = buildCityGrid(g);
    await setOnTerrain(g.getObjectByName('CityGrid'));
    return made;
  }, { cull: setupSceneCulling, still: true }), { inputs: [heights], from: [CITY_MAP, 'js/cascades.js', 'js/river.js', 'js/tsl-materials.js'] });
  const cityGrid = grid.made;
  markInit('cityGrid');

  const cascadesPart = live.keep(`cascades-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildCascades(g, waterLevel)), { inputs: [heights, grid] });
  const riverPeoplePart = live.keep(`riverPeople-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildRiverPeople(g)), { inputs: [heights, grid] });

  await showLoadingStage(CITY_PACK.loadingStages?.outskirts || 'Laying out the surrounding hills and shoreline...');
  const outskirtsPart = live.keep(`outskirts-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildOutskirts(g), { cull: setupSceneCulling, still: true }),
    { inputs: [heights, grid], from: ['js/outskirts.js'] });
  const outskirts = outskirtsPart.made;
  markInit('outskirts');

  await showLoadingStage(CITY_PACK.loadingStages?.landmarks || 'Building city landmarks...');
  const landmarks = live.keep(`landmarks-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildLandmarks(g), { cull: setupSceneCulling, still: true }), { inputs: [heights], from: [CITY_MAP, 'js/landmarks.js'] });
  const landmarkColliders = landmarks.made.colliders;
  markInit('landmarks');

  await showLoadingStage('Generating building footprints and facades...');
  const districts = await loadCityJson('data/districts.json', null);
  setDistricts(districts);
  const addresses = await loadCityJson('data/addresses.json', null);
  const gasStations = await loadCityJson('data/gas-stations.json', null);
  const roofShapes = await loadCityJson('data/roof-shapes.json', null);
  setRoofShapes(roofShapes);
  const blocks = live.keep(`blocks-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildCityBlocks(g, landmarks.made.colliders, addresses, gasStations), { cull: setupSceneCulling, still: true }),
    { inputs: [heights, landmarks], from: [CITY_MAP, ...BUILDING_DATA, cityAssetPath('data/addresses.json'), cityAssetPath('data/districts.json'), cityAssetPath('data/gas-stations.json'), cityAssetPath('data/roof-shapes.json')] });
  const cityBlocks = blocks.made;
  markInit('blocks');
  const allColliders = [...landmarkColliders, ...cityBlocks.colliders, ...outskirts.colliders, ...(cityGrid.colliders || [])];

  await showLoadingStage('Placing trees, streetlights and street furniture...');
  const streetFurniture = await loadCityJson('data/street-furniture.json', null);
  const details = await live.keep(`streetDetails-${ACTIVE_CITY_ID}`, () => cityPart(async (g) => {
    const made = buildStreetDetails(g, allColliders, streetFurniture);
    await setOnTerrain(g.getObjectByName('StreetDetails'));
    return made;
  }, { cull: setupSceneCulling, still: true }), { inputs: [heights, grid, outskirtsPart, landmarks, blocks], from: [...TREE_DATA, cityAssetPath('data/street-furniture.json'), 'js/street-details.js'] });
  const streetDetails = details.made;
  markInit('streetDetails');

  await showLoadingStage('Creating traffic and pedestrian routes...');
  const traffic = live.keep(`traffic-${ACTIVE_CITY_ID}`, () => cityPart((g) => createTrafficSystem(g, grid.made.sidewalks, [
    ...grid.made.footprints,
    ...details.made.footprints,
    ...allColliders.filter((c) => !c.obb
      && (c.minY ?? 0) - groundHeight((c.minX + c.maxX) * 0.5, (c.minZ + c.maxZ) * 0.5) < 3.5)
  ], details.made.signalIntersections)), { inputs: [heights, grid, outskirtsPart, landmarks, blocks, details], from: [CITY_MAP] });
  const trafficSystem = traffic.made;
  markInit('traffic');

  const highway = live.keep(`highwayTraffic-${ACTIVE_CITY_ID}`, () => cityPart((g) => createHighwayTraffic(g, grid.made.highwayLanes)), { inputs: [grid], from: [CITY_MAP] });
  const highwayTraffic = highway.made;

  await showLoadingStage('Adding road markings...');
  const roadPaint = live.keep(`roadPaint-${ACTIVE_CITY_ID}`, () => cityPart((g) => {
    const made = buildRoadPaint(g, traffic.made.network);
    setOnTerrain(made, 0);
    made.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingSphere();
      o.geometry.boundingSphere.radius += 16;
    });
    return made;
  }, { cull: setupSceneCulling, still: true }), { inputs: [heights, traffic], from: [CITY_MAP, 'js/road-network.js'] });
  markInit('roadPaint');

  const controlsPart = live.keep(`trafficControls-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildTrafficControls(g, traffic.made.network), { cull: setupSceneCulling, still: true }), { inputs: [heights, traffic, details] });
  const signsPart = live.keep(`shopSigns-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildShopSigns(g), { cull: setupSceneCulling, still: true }), { inputs: [heights], from: ['js/shop-signs.js'] });

  await showLoadingStage('Laying the railroads...');
  const railCrossings = await loadCityJson('data/rail-crossings.json', []);
  const wolverine = await loadCityJson('data/wolverine.json', null);
  const railPart = live.keep(`railways-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildRailways(g, railCrossings, wolverine), { cull: setupSceneCulling, still: true }), { inputs: [heights], from: [cityAssetPath('data/rail-crossings.json'), cityAssetPath('data/wolverine.json')] });
  const railways = railPart.made;

  const parkedPart = live.keep(`parkedCars-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildParkedCars(g, railways.nearTrack)), { inputs: [heights], from: ['js/parked-cars.js', 'js/railways.js'] });
  const parkedCars = parkedPart.made;
  for (const c of parkedCars.colliders) allColliders.push(c);
  parkedCars.onColliders = (added, removed) => {
    if (removed.size) {
      let n = 0;
      for (const c of allColliders) if (!removed.has(c)) allColliders[n++] = c;
      allColliders.length = n;
    }
    for (const c of added) allColliders.push(c);
    const cm = getControllerManager();
    if (cm) cm._colliderCells = null;
  };

  const roadWorkPart = live.keep(`roadWork-${ACTIVE_CITY_ID}`, () => cityPart((g) => buildRoadWork(g, traffic.made.closures)), { inputs: [heights, traffic], from: ['js/road-work.js'] });
  const roadWork = roadWorkPart.made;
  allColliders.push(...roadWork.colliders);

  const obstacleBox = (o) => {
    const g = groundHeight(o.x, o.z);
    const knock = o.kind && (o.pose || o.parts?.length) ? { ...o, g, down: false } : null;
    return { minX: o.x - o.r, maxX: o.x + o.r, minZ: o.z - o.r, maxZ: o.z + o.r, minY: g - 1, maxY: g + 6, thin: true, knock };
  };
  for (const o of [...(details.made.obstacles || []), ...(controlsPart.made.obstacles || [])]) allColliders.push(obstacleBox(o));

  const treeField = details.made.treeField;
  if (tier.stream && treeField?.obstacles) {
    const boxOf = new Map();
    const add = (list) => { for (const o of list) { const b = obstacleBox(o); boxOf.set(o, b); allColliders.push(b); } };
    add(treeField.obstacles());
    treeField.onObstacles = (added, removed) => {
      if (removed.length) {
        const gone = new Set();
        for (const o of removed) { gone.add(boxOf.get(o)); boxOf.delete(o); }
        let n = 0;
        for (const c of allColliders) if (!gone.has(c)) allColliders[n++] = c;
        allColliders.length = n;
      }
      add(added);
      const cm = getControllerManager();
      if (cm) cm._colliderCells = null;
    };
  }

  const hydrantSpray = createHydrantSpray(scene);
  const skidEffects = createSkidEffects(scene);
  const gushList = [];
  const knockdowns = createKnockdowns({
    onFall: (it, speed) => {
      log(`[knock] a ${it.kind} went over at ${Math.round(speed * 3.6)} km/h`);
      if (it.kind === 'hydrant') hydrantSpray.start(it.x, it.z);
    },
    onLand: (it, spin) => getAudioSystem()?.cue(it.kind === 'tree' ? 'thud' : 'crash',
      { x: it.x + it.dx * it.height * 0.6, y: it.g, z: it.z + it.dz * it.height * 0.6 }, Math.min(1, 0.4 + spin * 0.2))
  });

  const parts = [grid, cascadesPart, riverPeoplePart, outskirtsPart, landmarks, blocks, details, traffic, highway, roadPaint, controlsPart, signsPart, railPart, parkedPart, roadWorkPart];
  for (const part of parts) {
    scene.add(part.group);
    cullAlso(part.culled);
  }
  const houseStream = blocks.group.getObjectByName('Houses')?.userData.stream;
  const partHooks = parts.map((part) => part.group).filter((g) => g.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender);
  scene.onBeforeRender = (...args) => { for (const g of partHooks) g.onBeforeRender(...args); };
  markInit('ground');

  return {
    outskirts,
    cityBlocks,
    streetDetails,
    trafficSystem,
    highwayTraffic,
    controlsPart,
    riverPeoplePart,
    railways,
    parkedCars,
    roadWork,
    allColliders,
    hydrantSpray,
    skidEffects,
    gushList,
    knockdowns,
    houseStream
  };
}
