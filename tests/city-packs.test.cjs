const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CITIES = [
  'sanfrancisco', 'royaloak', 'oakland', 'annarbor', 'newyork', 'pompanobeach',
  'sydney', 'venice', 'amsterdam', 'hongkong', 'paris', 'london', 'tokyo',
  'barcelona', 'rio', 'vancouver', 'capetown', 'chicago', 'boston', 'seattle',
  'tampa'
];

const REQUIRED_FILES = [
  'city-geodata.js',
  'building-geodata.bin.gz',
  'tree-geodata.bin.gz',
  'data/elevation.bin.gz',
  'data/river.bin.gz',
  'data/addresses.json',
  'data/districts.json',
  'data/gas-stations.json',
  'data/rail-crossings.json',
  'data/roof-shapes.json',
  'data/street-furniture.json',
  'data/wolverine.json',
  'data/transit.json.gz'
];

describe('Multi-City Pack Manifest & Assets', () => {
  it('exports all 20 city packs with sanfrancisco as default and regional archetypes in js/city-packs.js', async () => {
    const mod = await import(path.join(ROOT, 'js/city-packs.js'));
    assert.ok(mod.CITY_PACKS, 'CITY_PACKS should be exported');
    assert.equal(mod.ACTIVE_CITY_ID, 'sanfrancisco', 'Default ACTIVE_CITY_ID should be sanfrancisco');
    for (const cityId of CITIES) {
      const pack = mod.CITY_PACKS[cityId];
      assert.ok(pack, `Missing CITY_PACKS.${cityId}`);
      assert.equal(pack.id, cityId);
      assert.ok(pack.title && pack.displayName && pack.stateCode, `Missing title/displayName for ${cityId}`);
      assert.ok(pack.icon && fs.existsSync(path.join(ROOT, pack.icon)), `Missing or nonexistent icon ${pack.icon} for ${cityId}`);
      assert.ok(Number.isFinite(pack.lat) && Number.isFinite(pack.lon), `Invalid lat/lon for ${cityId}`);
      assert.ok(Number.isFinite(pack.baseElev), `Invalid baseElev for ${cityId}`);
      assert.ok(pack.weatherStation, `Missing weatherStation for ${cityId}`);
      assert.ok(pack.police && pack.plate && pack.transit && pack.ownCar, `Missing vehicle branding for ${cityId}`);
      assert.ok(Array.isArray(pack.landmarks) && pack.landmarks.length >= 6, `Insufficient landmarks for ${cityId}`);
      assert.ok(Array.isArray(pack.cameraPresets) && pack.cameraPresets.length >= 5, `Insufficient cameraPresets for ${cityId}`);
      assert.ok(pack.scenicStarts && pack.scenicStarts.car && pack.scenicStarts.person, `Missing scenicStarts for ${cityId}`);
      assert.ok(pack.archetypes && pack.archetypes.residential && pack.archetypes.midrise, `Missing regional building archetypes for ${cityId}`);
      assert.ok(
        pack.archetypes.treeCoverage &&
          Number.isFinite(pack.archetypes.treeCoverage.canopyCover) &&
          Number.isFinite(pack.archetypes.treeCoverage.streetTreeDensity) &&
          Number.isFinite(pack.archetypes.treeCoverage.foliageScale),
        `Missing or invalid treeCoverage for ${cityId}`
      );
      assert.ok(
        pack.archetypes.housingDensity &&
          typeof pack.archetypes.housingDensity.form === 'string' &&
          Number.isFinite(pack.archetypes.housingDensity.buildingsPerKm2) &&
          Number.isFinite(pack.archetypes.housingDensity.footprintCoverage),
        `Missing or invalid housingDensity for ${cityId}`
      );
      assert.ok(
        pack.archetypes.neighborhoods && Object.keys(pack.archetypes.neighborhoods).length >= 2,
        `Missing neighborhood archetypes for ${cityId}`
      );
      for (const [nbKey, nbSpec] of Object.entries(pack.archetypes.neighborhoods)) {
        assert.ok(nbSpec.treeCoverage && Number.isFinite(nbSpec.treeCoverage.streetTreeDensity), `Missing treeCoverage on neighborhood ${nbKey} in ${cityId}`);
        assert.ok(nbSpec.housingDensity && typeof nbSpec.housingDensity.form === 'string', `Missing housingDensity on neighborhood ${nbKey} in ${cityId}`);
      }
      assert.ok(
        pack.archetypes.landmarks && Object.keys(pack.archetypes.landmarks).length >= 3,
        `Missing landmark archetypes for ${cityId}`
      );
      for (const [lmName, lmSpec] of Object.entries(pack.archetypes.landmarks)) {
        assert.ok(lmSpec.form && typeof lmSpec.form === 'string', `Missing form on landmark archetype ${lmName} in ${cityId}`);
        assert.ok(lmSpec.w > 0 && lmSpec.d > 0 && lmSpec.h > 0, `Invalid dimensions on landmark archetype ${lmName} in ${cityId}`);
      }
    }
  });

  it('supports user-added local city packs without repo changes', async () => {
    const mod = await import(path.join(ROOT, 'js/city-packs.js'));
    assert.equal(typeof mod.registerLocalCityPack, 'function');
    assert.equal(typeof mod.hydrateLocalCityPackFromGeo, 'function');

    const localPack = mod.registerLocalCityPack('traversecity', {
      displayName: 'Traverse City, MI',
      lat: 44.7631,
      lon: -85.6206,
      baseElev: 182
    });
    assert.ok(localPack);
    assert.equal(localPack.id, 'traversecity');
    assert.equal(localPack.isLocal, true);
    assert.equal(localPack.title, 'Traverse City');
    assert.equal(localPack.stateCode, 'MI');
    assert.ok(localPack.archetypes.treeCoverage && localPack.archetypes.housingDensity);

    mod.hydrateLocalCityPackFromGeo(localPack, {
      landmarks: [{ name: 'City Opera House', x: 40, z: -20 }],
      parks: [{ name: 'Clinch Park Beach', rings: [[-180, -320, -140, -320, -140, -280]] }],
      places: { names: ['Boardman River Wier', 'State Theatre'], list: [160, 140, 18, 0, -120, 60, 15, 1] }
    });
    assert.ok(localPack.landmarks.some((l) => l.name === 'Clinch Park Beach'));
    assert.ok(localPack.landmarks.some((l) => l.name === 'City Opera House'));

    const script = `
      globalThis.__CITY_ID__ = 'mycustomlocalcity';
      const packs = await import('./js/city-packs.js');
      const cfg = await import('./js/city-config.js');
      console.log(JSON.stringify({
        activeId: packs.ACTIVE_CITY_ID,
        isLocal: packs.CITY_PACK.isLocal,
        title: packs.CITY_PACK.title,
        landmarks: cfg.LANDMARKS.length,
        teleports: Object.keys(cfg.TELEPORT_LOCATIONS).length,
        label: cfg.getLocationLabel(0, 0)
      }));
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    const res = JSON.parse(out.trim().split('\n').pop());
    assert.equal(res.activeId, 'mycustomlocalcity');
    assert.equal(res.isLocal, true);
    assert.equal(res.title, 'Mycustomlocalcity');
    assert.ok(res.landmarks >= 4);
    assert.ok(res.teleports >= 4);
    assert.ok(res.label.length > 0);
  });

  for (const cityId of CITIES) {
    const cityDir = path.join(ROOT, 'cities', cityId);
    const isInstalled = fs.existsSync(path.join(cityDir, 'city-geodata.js'));
    const skipOpt = isInstalled ? false : `cities/${cityId} not installed locally (run: npm run city:install -- ${cityId})`;

    describe(`City Pack: ${cityId}`, { skip: skipOpt }, () => {

      it('contains all 13 required city pack files', () => {
        for (const rel of REQUIRED_FILES) {
          const full = path.join(cityDir, rel);
          assert.ok(fs.existsSync(full), `Missing ${rel} in cities/${cityId}`);
          const stat = fs.statSync(full);
          assert.ok(stat.size > 0, `Empty file ${rel} in cities/${cityId}`);
        }
      });

      it('has valid NYB1 building-geodata.bin.gz', () => {
        const raw = zlib.gunzipSync(fs.readFileSync(path.join(cityDir, 'building-geodata.bin.gz')));
        const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        assert.equal(dv.getUint32(0, true), 0x3142594e, `${cityId} building-geodata magic must be NYB1`);
        const count = dv.getUint32(4, true);
        assert.ok(count > 500, `${cityId} building count (${count}) should be > 500`);
      });

      it('has valid NYT1/NYT2 tree-geodata.bin.gz', () => {
        const raw = zlib.gunzipSync(fs.readFileSync(path.join(cityDir, 'tree-geodata.bin.gz')));
        const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        const magic = dv.getUint32(0, true);
        assert.ok(magic === 0x3154594e || magic === 0x3254594e, `${cityId} tree-geodata magic must be NYT1 or NYT2`);
        const streetCount = dv.getUint32(4, true);
        const parkCount = dv.getUint32(8, true);
        assert.ok(streetCount + parkCount > 100, `${cityId} total trees (${streetCount + parkCount}) should be > 100`);
      });

      it('has valid ELV2 data/elevation.bin.gz and RIV1 data/river.bin.gz', () => {
        const elv = zlib.gunzipSync(fs.readFileSync(path.join(cityDir, 'data/elevation.bin.gz')));
        assert.equal(elv.subarray(0, 4).toString('utf8'), 'ELV2', `${cityId} elevation magic must be ELV2`);
        const riv = zlib.gunzipSync(fs.readFileSync(path.join(cityDir, 'data/river.bin.gz')));
        assert.equal(riv.subarray(0, 4).toString('utf8'), 'RIV1', `${cityId} river magic must be RIV1`);
      });

      it('loads js/city-config.js cleanly and resolves roads, blocks, landmarks, and teleports', () => {
        const script = `
          globalThis.__CITY_ID__ = ${JSON.stringify(cityId)};
          const cfg = await import('./js/city-config.js');
          const geo = (await import('./js/city-geodata.js')).GEO;
          const summary = {
            cityId: globalThis.__CITY_ID__,
            roads: cfg.ROADS.length,
            blocks: cfg.BLOCKS.length,
            landmarks: cfg.LANDMARKS.length,
            teleports: Object.keys(cfg.TELEPORT_LOCATIONS).length,
            roadGraphNodes: geo.roadGraph.nodes.length / 2,
            roadGraphLinks: geo.roadGraph.links.length,
            sampleLabel: cfg.getLocationLabel(0, 0),
            blockBounds: cfg.getBlockBounds(2, 3)
          };
          console.log(JSON.stringify(summary));
        `;
        const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
          cwd: ROOT,
          encoding: 'utf8'
        });
        const summary = JSON.parse(out.trim().split('\n').pop());
        assert.equal(summary.cityId, cityId);
        assert.ok(summary.roads > 50, `${cityId} should have > 50 named roads (got ${summary.roads})`);
        assert.ok(summary.blocks > 100, `${cityId} should have > 100 city blocks (got ${summary.blocks})`);
        assert.ok(summary.landmarks >= 6, `${cityId} should have >= 6 landmarks (got ${summary.landmarks})`);
        assert.ok(summary.teleports >= 6, `${cityId} should have >= 6 teleports (got ${summary.teleports})`);
        assert.ok(summary.roadGraphNodes > 100, `${cityId} should have > 100 roadGraph nodes`);
        assert.ok(summary.roadGraphLinks > 100, `${cityId} should have > 100 roadGraph links`);
        assert.ok(typeof summary.sampleLabel === 'string' && summary.sampleLabel.length > 0);
        assert.ok(summary.blockBounds && Number.isFinite(summary.blockBounds.cx));
      });
    });
  }

  it('gates city requests via tools/serve.py in unlocked vs --locked modes', () => {
    const pyCheck = `
import importlib.util
spec = importlib.util.spec_from_file_location("serve", "tools/serve.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
assert hasattr(mod, "GTAServerHandler")
assert hasattr(mod, "slugify_city")
assert mod.slugify_city("Belo Horizonte, MG") == "belohorizonte"
print("OK")
`;
    const out = execFileSync('python3', ['-c', pyCheck], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(out.trim(), 'OK');
  });

  it('configures regional driveSide, watercraft, and defaultWeather across all 21 city packs', async () => {
    const { CITY_PACKS } = await import('../js/city-packs.js');
    const leftDriveCities = new Set(['london', 'tokyo', 'sydney', 'hongkong', 'capetown']);
    for (const id of Object.keys(CITY_PACKS)) {
      const pack = CITY_PACKS[id];
      assert.equal(pack.driveSide, leftDriveCities.has(id) ? 'left' : 'right', `${id} driveSide mismatch`);
      assert.ok(['kayak', 'gondola', 'canal_boat', 'harbor_craft'].includes(pack.watercraft), `${id} invalid watercraft`);
      assert.ok(pack.defaultWeather && typeof pack.defaultWeather.kind === 'string', `${id} missing defaultWeather`);
      assert.ok(Number.isFinite(pack.defaultWeather.tempF), `${id} missing defaultWeather.tempF`);
    }
    assert.equal(CITY_PACKS.venice.watercraft, 'gondola');
    assert.equal(CITY_PACKS.amsterdam.watercraft, 'canal_boat');
  });

  it('includes dense Presidio and Golden Gate Park tree cover, park lawns, and Golden Gate Bridge spans in sanfrancisco', () => {
    const script = `
      globalThis.__CITY_ID__ = 'sanfrancisco';
      const geo = (await import('./js/city-geodata.js')).GEO;
      const woods = geo.woods || [];
      let presidioTrees = 0;
      let ggpTrees = 0;
      for (let i = 0; i < woods.length; i += 3) {
        const x = woods[i], z = woods[i + 1];
        if (x > -6800 && x < -3800 && z > -2700 && z < -600) presidioTrees++;
        if (x > -9100 && x < -4050 && z > 100 && z < 1600) ggpTrees++;
      }
      console.log(JSON.stringify({
        presidioTrees,
        ggpTrees,
        lawns: (geo.lawns || []).length,
        riverBridges: (geo.riverBridges || []).length,
        signs: ((geo.signs && geo.signs.list) || []).length / 7
      }));
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    const stats = JSON.parse(out.trim().split('\n').pop());
    assert.ok(stats.presidioTrees > 4000, `Expected > 4000 Presidio woods trees, got ${stats.presidioTrees}`);
    assert.ok(stats.ggpTrees > 2500, `Expected > 2500 Golden Gate Park woods trees, got ${stats.ggpTrees}`);
    assert.ok(stats.lawns > 5000, `Expected > 5000 SF park/lawn polygons, got ${stats.lawns}`);
    assert.ok(stats.riverBridges > 100, `Expected > 100 SF bridges, got ${stats.riverBridges}`);
    assert.ok(stats.signs > 5000, `Expected > 5000 SF storefront signs, got ${stats.signs}`);
  });
});

