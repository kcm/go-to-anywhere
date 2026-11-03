// Dynamic city geodata loader: imports ../cities/<ACTIVE_CITY_ID>/city-geodata.js
// City packs are installed locally on demand via `npm run city:install <city>`.
import { ACTIVE_CITY_ID } from './city-packs.js';

export let CITY_PACK_INSTALLED = true;

let mod;
try {
  mod = await import(`../cities/${ACTIVE_CITY_ID}/city-geodata.js`);
} catch {
  CITY_PACK_INSTALLED = false;
  mod = {
    GEO: {
      city: ACTIVE_CITY_ID,
      frame: { bearingDeg: 0, units: 'm', strip: 20, sidewalk: 4.6 },
      edge: [-200, -200, 200, -200, 200, 200, -200, 200],
      roadGraph: {
        nodes: [0, -100, 0, 100],
        links: [[0, 1, 'Main St', 12, 0, 2, [], 0, 0, 0, 0, 0, 35]]
      },
      roads: [['Main St', 12, 0, 2, 0, [0, -100, 0, 100]]],
      blocks: [],
      parks: [],
      water: [],
      parking: [],
      woods: [],
      curbCuts: [],
      rail: { tracks: [], routes: [] },
      riverBridges: [],
      golf: { fairways: [], greens: [], tees: [], bunkers: [], paths: [], pins: [] },
      trails: [],
      streetlights: [],
      controls: { signals: [], stops: [], crossings: [] },
      signs: { names: [], list: [] },
      places: { names: [], list: [] },
      playgrounds: [],
      lawns: [],
      driveways: [],
      garageDoors: [],
      landmarks: {}
    }
  };
}

export const GEO = mod.GEO;
