const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CITIES = [
  'sanfrancisco', 'royaloak', 'oakland', 'annarbor', 'newyork', 'pompanobeach',
  'sydney', 'venice', 'amsterdam', 'hongkong', 'paris', 'london', 'tokyo',
  'barcelona', 'rio', 'vancouver', 'capetown', 'chicago', 'boston', 'seattle'
];

describe('Codebase Review Fixes & Regression Guard Suite', () => {
  describe('Security Fixes', () => {
    it('SEC-01: js/main.js eliminates innerHTML DOM XSS sink for missing city pack', () => {
      const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
      assert.doesNotMatch(
        mainSrc,
        /box\.innerHTML\s*=/,
        'box.innerHTML must not be used to render missing city pack notifications'
      );
      assert.match(
        mainSrc,
        /strong2\.textContent\s*=\s*CITY_PACK\.displayName/,
        'CITY_PACK.displayName must be safely assigned via textContent'
      );
      assert.match(
        mainSrc,
        /box\.replaceChildren/,
        'box.replaceChildren should be used to mount safe DOM elements'
      );
    });

    it('SEC-02: normalizeCityId and registerLocalCityPack reject prototype pollution keys', async () => {
      const cityPacksMod = await import(path.join(ROOT, 'js/city-packs.js'));
      const { normalizeCityId, registerLocalCityPack, CITY_PACKS } = cityPacksMod;

      // Prototype property safety
      const dangerousKeys = ['toString', 'valueOf', 'constructor', '__proto__', 'prototype'];
      for (const key of dangerousKeys) {
        assert.equal(
          normalizeCityId(key),
          '',
          `normalizeCityId('${key}') must return empty string to prevent prototype property hijacking`
        );
      }

      // Valid city IDs and aliases must normalize accurately
      assert.equal(normalizeCityId('sanfrancisco'), 'sanfrancisco');
      assert.equal(normalizeCityId('sf'), 'sanfrancisco');
      assert.equal(normalizeCityId('tokyo'), 'tokyo');
      assert.equal(normalizeCityId('rio'), 'rio');
      assert.equal(normalizeCityId('royaloak'), 'royaloak');

      // Attempting to register prototype keys must be rejected and must not pollute Object
      for (const dangerous of ['__proto__', 'constructor', 'prototype']) {
        const result = registerLocalCityPack(dangerous, { displayName: 'Exploit' });
        assert.equal(result, null, `registerLocalCityPack should reject reserved key '${dangerous}'`);
      }
      assert.equal(Object.prototype.displayName, undefined, 'Object.prototype must not be polluted');

      // Valid local pack registration still works
      const testPack = registerLocalCityPack('customtestcity', {
        displayName: 'Custom Test City',
        lat: 37.77,
        lon: -122.41,
        aliases: ['ctc', 'testcity']
      });
      assert.ok(testPack, 'Valid local pack should register successfully');
      assert.equal(normalizeCityId('ctc'), 'customtestcity');
      assert.equal(normalizeCityId('testcity'), 'customtestcity');
      delete CITY_PACKS.customtestcity;
    });

    it('SEC-02: js/city-config.js prettyName uses Object.hasOwn against prototype properties', () => {
      const configSrc = fs.readFileSync(path.join(ROOT, 'js/city-config.js'), 'utf8');
      assert.match(
        configSrc,
        /Object\.hasOwn\(PRETTY,\s*n\)/,
        'prettyName must use Object.hasOwn(PRETTY, n) instead of unsafe PRETTY[n]'
      );
    });

    it('SEC-03: js/weather.js & js/river-gauge.js use encodeURIComponent and AbortSignal.timeout', () => {
      const weatherSrc = fs.readFileSync(path.join(ROOT, 'js/weather.js'), 'utf8');
      assert.match(
        weatherSrc,
        /encodeURIComponent\(String\(STATION\)/,
        'STATION must be sanitized via encodeURIComponent'
      );
      assert.match(
        weatherSrc,
        /signal:\s*AbortSignal\.timeout\(8000\)/,
        'fetchWeather must specify an 8-second AbortSignal timeout'
      );

      const riverSrc = fs.readFileSync(path.join(ROOT, 'js/river-gauge.js'), 'utf8');
      assert.match(
        riverSrc,
        /encodeURIComponent\(String\(SITE\)/,
        'SITE must be sanitized via encodeURIComponent'
      );
      assert.match(
        riverSrc,
        /signal:\s*AbortSignal\.timeout\(8000\)/,
        'fetchRiverFlow must specify an 8-second AbortSignal timeout'
      );
    });

    it('SEC-04: js/pedestrian-system.js regex word boundary has no leading space before Embarcadero', () => {
      const pedSrc = fs.readFileSync(path.join(ROOT, 'js/pedestrian-system.js'), 'utf8');
      assert.doesNotMatch(
        pedSrc,
        /\|\s+Embarcadero\)/,
        'STREET_CROWD regex should not contain an extraneous space before Embarcadero'
      );
      assert.match(
        pedSrc,
        /\|Embarcadero\)/,
        'STREET_CROWD regex must match |Embarcadero) cleanly with word boundary'
      );
    });
  });

  describe('Lifecycle & Memory Leak Teardown Fixes', () => {
    it('PERF-06 / DES-02: CameraSystem creates AbortController and aborts on release()', async () => {
      const camerasSrc = fs.readFileSync(path.join(ROOT, 'js/cameras.js'), 'utf8');
      assert.match(
        camerasSrc,
        /this\._abortController\s*=\s*new AbortController\(\)/,
        'CameraSystem must initialize an AbortController'
      );
      assert.match(
        camerasSrc,
        /this\._abortController\.abort\(\)/,
        'CameraSystem.release() must abort the AbortController'
      );
      assert.match(
        camerasSrc,
        /\{ passive: false, signal \}/,
        'Wheel listener must pass both passive: false and signal'
      );
    });

    it('PERF-06 / DES-02: CityMapSystem creates AbortController and aborts on release()', async () => {
      const mapSrc = fs.readFileSync(path.join(ROOT, 'js/city-map.js'), 'utf8');
      assert.match(
        mapSrc,
        /this\._abortController\s*=\s*new AbortController\(\)/,
        'CityMapSystem must initialize an AbortController'
      );
      assert.match(
        mapSrc,
        /this\._abortController\.abort\(\)/,
        'CityMapSystem.release() must abort the AbortController'
      );
      assert.match(
        mapSrc,
        /window\.addEventListener\('resize',/,
        'CityMapSystem must handle window resize to refresh cached dimensions'
      );
    });

    it('PERF-07: CityMapSystem caches minimap dimensions and reuses MapView instances', async () => {
      const mapSrc = fs.readFileSync(path.join(ROOT, 'js/city-map.js'), 'utf8');
      assert.match(
        mapSrc,
        /updateMiniDimensions\(\)/,
        'CityMapSystem must provide updateMiniDimensions() to cache canvas size'
      );
      assert.match(
        mapSrc,
        /this\._miniView\.set\(/,
        'renderMinimap must reuse this._miniView.set() instead of allocating new MapView'
      );
      assert.match(
        mapSrc,
        /this\._miniCacheView\.set\(/,
        'renderMinimap must reuse this._miniCacheView.set() instead of allocating new MapView'
      );
      assert.match(
        mapSrc,
        /set\(cx, cz, s, w, h, dpr = 1\)/,
        'MapView must implement set() method for reuse'
      );
    });
  });

  describe('Hot-Path Performance Fixes', () => {
    it('PERF-01: js/buildings.js uses spotCandidatePool and compareEffDist static comparator', () => {
      const bldSrc = fs.readFileSync(path.join(ROOT, 'js/buildings.js'), 'utf8');
      assert.match(
        bldSrc,
        /const spotCandidatePool\s*=\s*Array\.from/,
        'spotCandidatePool must be pre-allocated'
      );
      assert.match(
        bldSrc,
        /const compareEffDist\s*=\s*\(a,\s*b\)\s*=>\s*a\.effDist\s*-\s*b\.effDist/,
        'compareEffDist must be defined as a static comparator function'
      );
      assert.match(
        bldSrc,
        /spotCandidates\.sort\(compareEffDist\)/,
        'spotCandidates must be sorted using static compareEffDist'
      );
    });

    it('PERF-02: js/controllers.js iterates static ENTITY_KEYS array in update loop', () => {
      const ctrlSrc = fs.readFileSync(path.join(ROOT, 'js/controllers.js'), 'utf8');
      assert.match(
        ctrlSrc,
        /const ENTITY_KEYS\s*=\s*\['person',\s*'car',\s*'cyclist',\s*'helicopter',\s*'kayak'\]/,
        'ENTITY_KEYS must be declared statically'
      );
      assert.match(
        ctrlSrc,
        /for\s*\(\s*const key of ENTITY_KEYS\s*\)/,
        'ThirdPersonControllerManager.update must iterate ENTITY_KEYS without Object.keys allocation'
      );
    });

    it('PERF-03: js/controllers.js reuses static _reusableCollisionBody in collisionBody()', () => {
      const ctrlSrc = fs.readFileSync(path.join(ROOT, 'js/controllers.js'), 'utf8');
      assert.match(
        ctrlSrc,
        /const _reusableCollisionBody\s*=/,
        '_reusableCollisionBody must be defined at module scope'
      );
      assert.match(
        ctrlSrc,
        /const body = _reusableCollisionBody/,
        'collisionBody must reuse _reusableCollisionBody'
      );
    });

    it('PERF-04: js/controllers.js uses static compareColliderOrder in nearColliders()', () => {
      const ctrlSrc = fs.readFileSync(path.join(ROOT, 'js/controllers.js'), 'utf8');
      assert.match(
        ctrlSrc,
        /const compareColliderOrder\s*=\s*\(a,\s*b\)\s*=>\s*a\._order\s*-\s*b\._order/,
        'compareColliderOrder static comparator must be defined'
      );
      assert.match(
        ctrlSrc,
        /out\.sort\(compareColliderOrder\)/,
        'nearColliders must sort using compareColliderOrder'
      );
    });

    it('PERF-05: js/building-collision.js eliminates per-candidate closures in polygonContact()', () => {
      const bldColSrc = fs.readFileSync(path.join(ROOT, 'js/building-collision.js'), 'utf8');
      assert.match(
        bldColSrc,
        /const _satState\s*=/,
        '_satState must be defined at module scope'
      );
      assert.match(
        bldColSrc,
        /function tryDir\(ux, uz, dist\)/,
        'tryDir must be declared at module scope'
      );
      assert.match(
        bldColSrc,
        /function pushSigned\(ux, uz, s\)/,
        'pushSigned must be declared at module scope'
      );
      assert.match(
        bldColSrc,
        /function tryVec\(dx, dz\)/,
        'tryVec must be declared at module scope'
      );
    });
  });

  describe('Standards, Portability & Readability Fixes', () => {
    it('READ-01: index.html has all 20 cities in #city-select and #map-city-select', () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

      // Check #city-select
      const citySelectMatch = html.match(/<select id="city-select"[^>]*>([\s\S]*?)<\/select>/);
      assert.ok(citySelectMatch, 'index.html must contain #city-select');
      for (const cityId of CITIES) {
        assert.ok(
          citySelectMatch[1].includes(`value="${cityId}"`),
          `#city-select must include option value="${cityId}"`
        );
      }

      // Check #map-city-select
      const mapCitySelectMatch = html.match(/<select id="map-city-select"[^>]*>([\s\S]*?)<\/select>/);
      assert.ok(mapCitySelectMatch, 'index.html must contain #map-city-select');
      for (const cityId of CITIES) {
        assert.ok(
          mapCitySelectMatch[1].includes(`value="${cityId}"`),
          `#map-city-select must include option value="${cityId}"`
        );
      }

      // Check inline aliases and meta
      for (const cityId of CITIES) {
        assert.ok(html.includes(`${cityId}:`), `inline script must define meta/aliases for ${cityId}`);
      }
    });

    it('READ-02: js/audio-system.js standardizes preference to gta-sound with nyc-sound fallback', () => {
      const audioSrc = fs.readFileSync(path.join(ROOT, 'js/audio-system.js'), 'utf8');
      assert.match(
        audioSrc,
        /localStorage\.getItem\('gta-sound'\)\s*\?\?\s*localStorage\.getItem\('nyc-sound'\)/,
        'Audio system must read gta-sound with fallback to legacy nyc-sound'
      );
      assert.match(
        audioSrc,
        /localStorage\.setItem\('gta-sound'/,
        'Audio system must save preference to gta-sound'
      );
    });

    it('READ-03: js/main.js modernizes deprecated navigator.platform API', () => {
      const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
      assert.doesNotMatch(
        mainSrc,
        /window\.webkit\?\.messageHandlers\?\.lampNative\s*&&\s*\/Mac\/\.test\(navigator\.platform\)\s*&&/,
        'navigator.platform must not be used without modern navigator.userAgentData fallback'
      );
      assert.match(
        mainSrc,
        /navigator\.userAgentData\?\.platform/,
        'navigator.userAgentData?.platform must be used for platform detection'
      );
    });

    it('READ-04: named conversion constants MS_TO_MPH and M_TO_FT are declared and used', () => {
      const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
      assert.match(mainSrc, /const MS_TO_MPH\s*=\s*2\.23694;/, 'MS_TO_MPH constant must be defined in main.js');
      assert.match(mainSrc, /const M_TO_FT\s*=\s*3\.28084;/, 'M_TO_FT constant must be defined in main.js');
      assert.match(mainSrc, /Math\.round\(speed \* MS_TO_MPH\)/, 'roadWork hit logging must use MS_TO_MPH');
      assert.match(mainSrc, /\* MS_TO_MPH\)/, 'HUD speed calculation must use MS_TO_MPH');
      assert.match(mainSrc, /\* M_TO_FT\)/, 'HUD altitude calculation must use M_TO_FT');

      const ctrlSrc = fs.readFileSync(path.join(ROOT, 'js/controllers.js'), 'utf8');
      assert.match(ctrlSrc, /const MS_TO_MPH\s*=\s*2\.23694;/, 'MS_TO_MPH constant must be defined in controllers.js');
      assert.match(ctrlSrc, /Math\.round\(speed \* MS_TO_MPH\)/, 'throwMotoRider logging must use MS_TO_MPH');
    });

    it('READ-05: js/main.js logs informative warnings in catch blocks', () => {
      const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
      assert.match(
        mainSrc,
        /console\.warn\(`\[gto\] Failed to parse city JSON at \$\{relPath\}:`, err\)/,
        'loadCityJson must warn on parse errors'
      );
      assert.match(
        mainSrc,
        /console\.warn\(`\[gto\] Failed to probe city \$\{id\}:`, err\)/,
        'probeInstalledCities must warn on probe failures'
      );
    });

    it('DES-01: js/main.js delegates world building, render pipeline, HUD UI, and shader precompilation to dedicated modules', () => {
      const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
      assert.ok(mainSrc.split('\n').length < 750, 'js/main.js should be modularized under 750 lines (down from 1,641)');
      for (const mod of ['world-builder.js', 'render-pipeline.js', 'hud-ui.js', 'shader-precompile.js']) {
        assert.ok(fs.existsSync(path.join(ROOT, 'js', mod)), `js/${mod} must exist`);
        assert.match(mainSrc, new RegExp(`from '\\./${mod.replace('.', '\\.')}'`), `js/main.js must import ./${mod}`);
      }
    });

    it('DES-03: dead lamp-phaser.js is removed from repository and excluded from RUNTIME_PATHS', () => {
      assert.strictEqual(fs.existsSync(path.join(ROOT, 'lamp-phaser.js')), false, 'dead lamp-phaser.js must be deleted');
      const deploySrc = fs.readFileSync(path.join(ROOT, 'tools/deploy-gh-pages.py'), 'utf8');
      assert.doesNotMatch(
        deploySrc,
        /'lamp-phaser\.js'/,
        'tools/deploy-gh-pages.py must not bundle dead lamp-phaser.js into GitHub Pages releases'
      );
    });

    it('DES-04: index.html loads lamp.js with defer so HTML parsing is not blocked', () => {
      const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      assert.match(
        htmlSrc,
        /<script\s+src="lamp\.js"\s+defer><\/script>/,
        'index.html must load lamp.js with the defer attribute'
      );
    });

    it('DES-05: lamp-game.js guards global fetch monkey-patching behind preview/host check', () => {
      const lampGameSrc = fs.readFileSync(path.join(ROOT, 'lamp-game.js'), 'utf8');
      assert.match(
        lampGameSrc,
        /if\s*\(\(preview\s*\?\s*preview\.warm\s*:\s*host\(\)\)\s*&&\s*window\.fetch\)/,
        'lamp-game.js must only monkey-patch window.fetch when running inside Lamp preview or host'
      );
    });

    it('DES-06: orphan root geodata files are removed and unified cities/<id>/ paths are used', () => {
      for (const orphan of ['data', 'js/building-geodata.bin.gz', 'js/tree-geodata.bin.gz', 'js/city-geodata-fallback.js']) {
        assert.strictEqual(fs.existsSync(path.join(ROOT, orphan)), false, `orphan root path ${orphan} must not exist`);
      }
      const actransitSrc = fs.readFileSync(path.join(ROOT, 'js/actransit.js'), 'utf8');
      assert.doesNotMatch(actransitSrc, /\.\/data\/actransit\.json\.gz/, 'js/actransit.js must not reference legacy ./data/actransit.json.gz');
    });

    it('DES-07: tools/package-existing-cities.py removes hardcoded local agent scratch paths', () => {
      const pkgSrc = fs.readFileSync(path.join(ROOT, 'tools/package-existing-cities.py'), 'utf8');
      assert.doesNotMatch(
        pkgSrc,
        /\/Users\/kcm\/\.gemini\/antigravity\/brain/,
        'tools/package-existing-cities.py must not contain hardcoded agent brain scratch paths'
      );
      assert.match(
        pkgSrc,
        /os\.environ\.get\("GTO_SCRATCH_DIR"/,
        'tools/package-existing-cities.py should support GTO_SCRATCH_DIR environment variable'
      );
    });
  });
});
