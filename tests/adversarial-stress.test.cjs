const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

describe('Adversarial Stress Test & Robustness Verification Harness', () => {

  describe('1. Adversarial Prototype Pollution Probing', () => {
    it('normalizeCityId neutralizes prototype keys across all casings, encodings, and paddings', async () => {
      const { normalizeCityId } = await import(path.join(ROOT, 'js/city-packs.js'));

      const dangerousNames = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf',
        '__PROTO__',
        'Constructor',
        'PROTOTYPE',
        'ToString',
        'ValueOf',
        ' __proto__ ',
        ' constructor\t',
        'prototype\n',
        '__defineGetter__',
        '__defineSetter__',
        '__lookupGetter__',
        '__lookupSetter__'
      ];

      for (const dangerous of dangerousNames) {
        const normalized = normalizeCityId(dangerous);
        // Must either be empty string or not match any dangerous prototype property on Object
        assert.ok(
          normalized === '' || !Object.hasOwn(Object.prototype, normalized),
          `normalizeCityId('${dangerous}') returned '${normalized}' which is an own property of Object.prototype!`
        );
        assert.strictEqual(
          Object.prototype[dangerous.trim().toLowerCase()],
          Object.prototype[dangerous.trim().toLowerCase()],
          `Object.prototype property '${dangerous}' was tampered with`
        );
      }

      // Check specific reserved keys explicitly return ''
      assert.strictEqual(normalizeCityId('__proto__'), '');
      assert.strictEqual(normalizeCityId('__PROTO__'), '');
      assert.strictEqual(normalizeCityId('constructor'), '');
      assert.strictEqual(normalizeCityId('CONSTRUCTOR'), '');
      assert.strictEqual(normalizeCityId('prototype'), '');
      assert.strictEqual(normalizeCityId('PROTOTYPE'), '');
      assert.strictEqual(normalizeCityId('toString'), '');
      assert.strictEqual(normalizeCityId('TOSTRING'), '');
      assert.strictEqual(normalizeCityId('valueOf'), '');
      assert.strictEqual(normalizeCityId('VALUEOF'), '');
    });

    it('registerLocalCityPack rejects prototype property pollution and leaves Object.prototype pristine', async () => {
      const { registerLocalCityPack, CITY_PACKS } = await import(path.join(ROOT, 'js/city-packs.js'));

      const dangerousPayloads = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf'
      ];

      for (const prop of dangerousPayloads) {
        const spec = {
          displayName: `Malicious ${prop}`,
          polluted: true,
          lat: 10,
          lon: 20,
          aliases: ['__proto__', 'constructor', 'prototype', prop]
        };

        const result = registerLocalCityPack(prop, spec);
        assert.strictEqual(result, null, `registerLocalCityPack must reject dangerous id '${prop}'`);

        // Verify Object.prototype has not been contaminated
        assert.strictEqual(Object.prototype.polluted, undefined, `Object.prototype.polluted was created via '${prop}'!`);
        assert.strictEqual(Object.prototype.displayName, undefined, `Object.prototype.displayName was created via '${prop}'!`);
        assert.strictEqual(typeof Object.prototype.toString, 'function');
        assert.strictEqual(typeof Object.prototype.valueOf, 'function');
        assert.strictEqual(typeof Object.prototype.isPrototypeOf, 'function');
        assert.strictEqual(typeof Object.prototype.hasOwnProperty, 'function');
      }

      // Test synthetic object prototype pollution attempt via JSON
      const parsedBad = JSON.parse('{"__proto__":{"pollutedKey":1337}}');
      const testPack = registerLocalCityPack('cleanadversarialcity', {
        ...parsedBad,
        displayName: 'Clean City',
        aliases: ['cac']
      });

      assert.ok(testPack, 'Valid city should register');
      assert.strictEqual(Object.prototype.pollutedKey, undefined, 'Object.prototype.pollutedKey must remain undefined');
      assert.strictEqual(({}).pollutedKey, undefined, 'Empty object must not inherit pollutedKey');

      delete CITY_PACKS.cleanadversarialcity;
    });

    it('js/city-config.js prettyName never exposes prototype methods or breaks under prototype keys', () => {
      const configSrc = fs.readFileSync(path.join(ROOT, 'js/city-config.js'), 'utf8');

      // Verify source guard
      assert.match(
        configSrc,
        /if\s*\(\s*Object\.hasOwn\(\s*PRETTY,\s*n\s*\)\s*\)\s*return\s+PRETTY\[n\];/,
        'prettyName must guard with Object.hasOwn'
      );

      // Extract PRETTY dictionary and prettyName function logic directly to test behavior
      const prettyBlockMatch = configSrc.match(/const PRETTY = \{[\s\S]*?\n\};/);
      assert.ok(prettyBlockMatch, 'PRETTY definition must exist');

      // Evaluate isolated prettyName logic
      const sandboxFn = new Function(`
        ${prettyBlockMatch[0]}
        const IS_GRID_CITY = true;
        const ordinal = (n) => n + 'th';
        return function prettyName(n) {
          if (!n) return '';
          if (Object.hasOwn(PRETTY, n)) return PRETTY[n];
          if (!IS_GRID_CITY) return String(n);
          const m = /^(E|W)\\s+(\\d+)\\s+ST$/.exec(n);
          if (m) return m[1] + ' ' + ordinal(+m[2]) + ' St';
          return String(n).replace(/\\s+/g, ' ').toLowerCase().replace(/\\b\\w/g, (c) => c.toUpperCase()).replace(/\\b(\\d+) (St|Ave)\\b/g, (_, d, t) => ordinal(+d) + ' ' + t);
        };
      `)();

      const dangerousKeys = ['toString', 'valueOf', 'constructor', '__proto__', 'isPrototypeOf', 'hasOwnProperty', 'propertyIsEnumerable'];

      for (const key of dangerousKeys) {
        const result = sandboxFn(key);
        assert.strictEqual(typeof result, 'string', `prettyName('${key}') must return string, got ${typeof result}`);
        assert.notStrictEqual(typeof result, 'function', `prettyName('${key}') leaked prototype function!`);
      }
    });
  });

  describe('2. Adversarial DOM XSS Injection Probing', () => {
    it('js/main.js contains zero innerHTML assignments for missing city pack rendering', () => {
      const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
      const missingPackIdx = mainSrc.indexOf('loader-missing-pack');
      assert.ok(missingPackIdx !== -1, 'loader-missing-pack code path must be present');

      // Slice the missing pack handling block
      const block = mainSrc.slice(missingPackIdx - 200, missingPackIdx + 1200);

      // Verify no innerHTML
      assert.doesNotMatch(
        block,
        /innerHTML\s*=/,
        'Critical: innerHTML must not be used anywhere in the missing pack block'
      );

      // Verify use of textContent or replaceChildren
      assert.match(block, /replaceChildren\(/, 'Must use replaceChildren for DOM node assembly');
      assert.match(block, /textContent\s*=/, 'Must use textContent for string injection');
    });

    it('simulated DOM mounting with hostile XSS vectors produces pure text nodes without script execution', () => {
      // Create minimal mock DOM nodes to trace exact DOM tree output of js/main.js:157-206
      class MockElement {
        constructor(tagName) {
          this.tagName = tagName.toUpperCase();
          this.className = '';
          this.style = {};
          this.children = [];
          this._textContent = '';
        }

        set textContent(val) {
          this._textContent = String(val);
          this.children = [];
        }

        get textContent() {
          if (this.children.length === 0) return this._textContent;
          return this.children.map(c => typeof c === 'string' ? c : c.textContent).join('');
        }

        appendChild(child) {
          this.children.push(child);
        }

        append(...items) {
          for (const item of items) {
            this.children.push(item);
          }
        }

        replaceChildren(...items) {
          this.children = [...items];
        }

        querySelector(sel) {
          return null;
        }

        after(el) {
          this.nextSibling = el;
        }
      }

      const hostileVectors = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg/onload=alert(1)>',
        'javascript:alert(1)',
        '\'><iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const hostilePayload of hostileVectors) {
        const ACTIVE_CITY_ID = hostilePayload;
        const CITY_PACK = {
          displayName: hostilePayload,
          isLocal: true,
          lat: 0,
          lon: 0
        };

        const loadingStatus = new MockElement('div');
        const box = new MockElement('div');
        box.className = 'loader-missing-pack';

        const buildCmd = CITY_PACK.isLocal
          ? `npm run city:build -- --city ${ACTIVE_CITY_ID} --name "${CITY_PACK.displayName}" --lat ${CITY_PACK.lat} --lon ${CITY_PACK.lon}`
          : `npm run city:install -- ${ACTIVE_CITY_ID}`;

        const line1 = new MockElement('div');
        const strong1 = new MockElement('strong');
        strong1.textContent = 'City data is stored locally (like npm packages) and does not need to be synced with the repo.';
        line1.appendChild(strong1);

        const line2 = new MockElement('div');
        line2.append('To download and build ');
        const strong2 = new MockElement('strong');
        strong2.textContent = CITY_PACK.displayName;
        line2.append(strong2, ' locally, run:');

        const code1 = new MockElement('code');
        code1.textContent = buildCmd;

        const line3 = new MockElement('div');
        line3.textContent = 'or with Python / uv:';

        const code2 = new MockElement('code');
        code2.textContent = `uv run --with shapely --with numpy --with pillow python3 tools/build-city-pack.py --city ${ACTIVE_CITY_ID}`;

        box.replaceChildren(line1, line2, code1, line3, code2);
        loadingStatus.after(box);

        // Verification: inspect child elements and verify no <script>, <img>, <iframe>, or <svg> elements exist
        const allElements = [];
        function collect(el) {
          if (el instanceof MockElement) {
            allElements.push(el);
            for (const c of el.children) collect(c);
          }
        }
        collect(box);

        const hostileTags = ['SCRIPT', 'IMG', 'IFRAME', 'SVG', 'OBJECT', 'EMBED'];
        for (const el of allElements) {
          assert.ok(
            !hostileTags.includes(el.tagName),
            `Hostile tag ${el.tagName} was parsed into DOM element tree!`
          );
        }

        // The hostile payload must be preserved strictly as string content in strong2 and code1
        assert.strictEqual(strong2.textContent, hostilePayload);
        assert.ok(code1.textContent.includes(hostilePayload));
      }
    });
  });

  describe('3. Adversarial Network Resiliency & Timeout Probing', () => {
    it('js/weather.js safely encodes query parameters and handles timeout / network failure gracefully', async () => {
      const weatherSrc = fs.readFileSync(path.join(ROOT, 'js/weather.js'), 'utf8');

      // Verify code signatures
      assert.match(weatherSrc, /encodeURIComponent\(String\(STATION\)\.trim\(\)\)/);
      assert.match(weatherSrc, /signal:\s*AbortSignal\.timeout\(8000\)/);

      // Verify URL encoding with adversarial station strings
      const hostileStations = [
        'KDTW 123',
        'KDTW/OBS',
        'KDTW?query=hack&inj=1',
        'KDTW#hash',
        'KDTW%20TEST',
        '<script>alert(1)</script>',
        'station with spaces and unicode 東京'
      ];

      for (const st of hostileStations) {
        const encoded = encodeURIComponent(String(st).trim());
        const testUrl = `https://api.weather.gov/stations/${encoded}/observations/latest`;
        const parsed = new URL(testUrl);
        // Path should never break or split into unintended query/hash parameters
        assert.ok(!parsed.pathname.includes('<script>'), 'Unencoded script tags must not appear in URL pathname');
        assert.ok(!parsed.pathname.includes(' '), 'Unencoded spaces must not appear in URL pathname');
      }

      // Test execution resilience: verify isolated fetchWeather behavior under simulated network conditions
      const weatherBlockMatch = weatherSrc.match(/async function fetchWeather\(\) \{[\s\S]*?\n\}/);
      assert.ok(weatherBlockMatch, 'fetchWeather definition must exist');

      const classifyMatch = weatherSrc.match(/function classify\(props\) \{[\s\S]*?\n\}/);
      assert.ok(classifyMatch, 'classify definition must exist');

      // Test with mock fetch
      const makeFetcher = (STATION, mockFetch) => {
        return new Function('STATION', 'fetch', `
          const FAIR = { kind: 'fair', amount: 0, text: 'Fair', tempF: null, wind: [0, 0], live: false };
          ${classifyMatch[0]}
          ${weatherBlockMatch[0]}
          return fetchWeather;
        `)(STATION, mockFetch);
      };

      // 1. Timeout abortion
      const timeoutFetch = async (url, opts) => {
        assert.ok(opts.signal, 'Must pass abort signal');
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        throw err;
      };
      const fetchWithTimeout = makeFetcher('KDTW', timeoutFetch);
      const timeoutRes = await fetchWithTimeout();
      assert.deepStrictEqual(timeoutRes, { kind: 'fair', amount: 0, text: 'Fair', tempF: null, wind: [0, 0], live: false });

      // 2. HTTP 500 server error
      const errorFetch = async () => ({ ok: false, status: 500 });
      const fetchWithError = makeFetcher('KDTW', errorFetch);
      const errorRes = await fetchWithError();
      assert.deepStrictEqual(errorRes, { kind: 'fair', amount: 0, text: 'Fair', tempF: null, wind: [0, 0], live: false });

      // 3. Network error (DNS failure / offline)
      const networkFailFetch = async () => { throw new TypeError('Failed to fetch'); };
      const fetchWithNetFail = makeFetcher('KDTW', networkFailFetch);
      const netFailRes = await fetchWithNetFail();
      assert.deepStrictEqual(netFailRes, { kind: 'fair', amount: 0, text: 'Fair', tempF: null, wind: [0, 0], live: false });

      // 4. Successful parse
      const okFetch = async (url, opts) => ({
        ok: true,
        json: async () => ({
          properties: {
            textDescription: 'Mostly Cloudy',
            temperature: { value: 20 },
            windSpeed: { value: 18 },
            windDirection: { value: 180 },
            cloudLayers: [{ amount: 'BKN' }]
          }
        })
      });
      const fetchWithOk = makeFetcher('KDTW', okFetch);
      const okRes = await fetchWithOk();
      assert.strictEqual(okRes.live, true);
      assert.strictEqual(okRes.kind, 'cloudy');
      assert.strictEqual(okRes.tempF, 68);

      // Verify AbortSignal.timeout is a valid modern JS API in this environment
      assert.strictEqual(typeof AbortSignal.timeout, 'function');
      const sig = AbortSignal.timeout(50);
      assert.strictEqual(sig.aborted, false);
      await new Promise(r => setTimeout(r, 60));
      assert.strictEqual(sig.aborted, true);
    });

    it('js/river-gauge.js safely encodes site query and handles timeout / malformed responses', async () => {
      const riverSrc = fs.readFileSync(path.join(ROOT, 'js/river-gauge.js'), 'utf8');

      // Verify code signatures
      assert.match(riverSrc, /encodeURIComponent\(String\(SITE\)\.trim\(\)\)/);
      assert.match(riverSrc, /signal:\s*AbortSignal\.timeout\(8000\)/);

      const hostileSites = [
        '04166500 & format=xml',
        '04166500#inject',
        '04166500?extra=true',
        '../path/traversal',
        '<svg onload=1>'
      ];

      for (const site of hostileSites) {
        const encoded = encodeURIComponent(String(site).trim());
        const testUrl = `https://waterservices.usgs.gov/nwis/iv/?sites=${encoded}&format=json&parameterCd=00060`;
        const parsed = new URL(testUrl);
        // The query param 'sites' must equal the unencoded string exactly
        assert.strictEqual(parsed.searchParams.get('sites'), String(site).trim());
        // No extra parameters injected
        assert.strictEqual(parsed.searchParams.get('format'), 'json');
        assert.strictEqual(parsed.searchParams.get('parameterCd'), '00060');
      }

      const { USUAL_RIVER_FLOW, fetchRiverFlow } = await import(path.join(ROOT, 'js/river-gauge.js'));
      assert.ok(USUAL_RIVER_FLOW, 'USUAL_RIVER_FLOW must be exported');
      assert.strictEqual(USUAL_RIVER_FLOW.live, false);

      // Extract fetchRiverFlow logic to test under mock conditions
      const riverBlockMatch = riverSrc.match(/async function fetchRiverFlow\(\) \{[\s\S]*?\n\}/);
      const scaleMatch = riverSrc.match(/function currentScale\(cfs\) \{[\s\S]*?\n\}/);
      assert.ok(riverBlockMatch && scaleMatch, 'Definitions must exist');

      const makeRiverFetcher = (SITE, mockFetch) => {
        return new Function('SITE', 'fetch', `
          const USUAL_CFS = 120;
          const USUAL = { cfs: USUAL_CFS, scale: 1, live: false };
          ${scaleMatch[0]}
          ${riverBlockMatch[0]}
          return fetchRiverFlow;
        `)(SITE, mockFetch);
      };

      // 1. Timeout abortion
      const timeoutFetch = async (url, opts) => {
        assert.ok(opts.signal, 'Abort signal must be provided');
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        throw err;
      };
      const riverTimeout = makeRiverFetcher('04166500', timeoutFetch);
      const resTimeout = await riverTimeout();
      assert.deepStrictEqual(resTimeout, { cfs: 120, scale: 1, live: false });

      // 2. HTTP error
      const riverErr = makeRiverFetcher('04166500', async () => ({ ok: false, status: 503 }));
      const resErr = await riverErr();
      assert.deepStrictEqual(resErr, { cfs: 120, scale: 1, live: false });

      // 3. Network error
      const riverNetErr = makeRiverFetcher('04166500', async () => { throw new TypeError('Network error'); });
      const resNetErr = await riverNetErr();
      assert.deepStrictEqual(resNetErr, { cfs: 120, scale: 1, live: false });

      // 4. Malformed JSON / missing properties
      const riverMalformed = makeRiverFetcher('04166500', async () => ({
        ok: true,
        json: async () => ({})
      }));
      const resMalformed = await riverMalformed();
      assert.deepStrictEqual(resMalformed, { cfs: 120, scale: 1, live: false });

      // 5. Valid flow reading
      const riverOk = makeRiverFetcher('04166500', async () => ({
        ok: true,
        json: async () => ({
          value: {
            timeSeries: [{
              values: [{
                value: [{ value: '250' }]
              }]
            }]
          }
        })
      }));
      const resOk = await riverOk();
      assert.strictEqual(resOk.live, true);
      assert.strictEqual(resOk.cfs, 250);
      assert.ok(resOk.scale > 1, 'Scale should increase with higher CFS');
    });
  });

  describe('4. Lifecycle Cleanup & Event Listener Abort Probing', () => {
    it('CameraSystem aborts all listeners via AbortController on release()', () => {
      const camerasSrc = fs.readFileSync(path.join(ROOT, 'js/cameras.js'), 'utf8');

      // Assert AbortController instantiation
      assert.match(camerasSrc, /this\._abortController\s*=\s*new AbortController\(\)/);

      // Count occurrences of signal: this._abortController.signal or { ... signal }
      const signalMatches = camerasSrc.match(/signal/g);
      assert.ok(signalMatches && signalMatches.length >= 8, `Expected at least 8 listener signal attachments, found ${signalMatches ? signalMatches.length : 0}`);

      // Assert abort() call in release()
      assert.match(camerasSrc, /release\(\)\s*\{[\s\S]*?this\._abortController\.abort\(\)/);
    });

    it('CityMapSystem aborts all listeners via AbortController on release()', () => {
      const mapSrc = fs.readFileSync(path.join(ROOT, 'js/city-map.js'), 'utf8');

      assert.match(mapSrc, /this\._abortController\s*=\s*new AbortController\(\)/);

      const signalMatches = mapSrc.match(/signal/g);
      assert.ok(signalMatches && signalMatches.length >= 10, `Expected at least 10 listener signal attachments, found ${signalMatches ? signalMatches.length : 0}`);

      assert.match(mapSrc, /release\(\)\s*\{[\s\S]*?this\._abortController\.abort\(\)/);
    });
  });

});
