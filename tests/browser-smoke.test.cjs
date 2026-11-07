const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gz': 'application/octet-stream',
  '.bin': 'application/octet-stream'
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(urlObj.pathname);
      if (pathname === '/') pathname = '/index.html';
      // Resolve ../lamp-game.js fallback if requested from root
      let filePath = path.join(rootDir, pathname);
      if (!fs.existsSync(filePath) && pathname === '/lamp-game.js') {
        filePath = path.join(rootDir, 'lamp-game.js');
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function launchChrome(userDataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CHROME_BIN, [
      '--headless=new',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank'
    ]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) resolve({ proc, wsUrl: m[1] });
    });
    proc.on('error', reject);
    setTimeout(() => reject(new Error(`Chrome launch timeout. Stderr: ${stderr}`)), 10000);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() {
    this.ws?.close();
  }
}

describe('Headless Browser Multi-City 3D Runtime Verification', () => {
  let srv, port, chrome, userDataDir, cdp, sessionId;

  before(async () => {
    ({ server: srv, port } = await startStaticServer(ROOT));
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gto-chrome-'));
    chrome = await launchChrome(userDataDir);
    cdp = new CDPClient(chrome.wsUrl);
    await cdp.connect();
    const { targetInfos } = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find((t) => t.type === 'page');
    const attached = await cdp.send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });
    sessionId = attached.sessionId;
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'window.__SKIP_SHADER_PRECOMPILE__ = true;'
    }, sessionId);
  });

  after(() => {
    cdp?.close();
    chrome?.proc?.kill('SIGKILL');
    srv?.close();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  const EXPECTED = [
    { id: 'royaloak',     title: 'Go To Anywhere (GTA) - Royal Oak, MI',     atlas: 'Royal Oak Street Atlas',     icon: 'img/icon-royaloak.svg' },
    { id: 'oakland',      title: 'Go To Anywhere (GTA) - Oakland, CA',       atlas: 'Oakland Street Atlas',       icon: 'img/app-icon.png' },
    { id: 'annarbor',     title: 'Go To Anywhere (GTA) - Ann Arbor, MI',     atlas: 'Ann Arbor Street Atlas',     icon: 'img/icon-annarbor.svg' },
    { id: 'newyork',      title: 'Go To Anywhere (GTA) - New York, NY',      atlas: 'New York Street Atlas',      icon: 'img/icon-newyork.svg' },
    { id: 'pompanobeach', title: 'Go To Anywhere (GTA) - Pompano Beach, FL', atlas: 'Pompano Beach Street Atlas', icon: 'img/icon-pompanobeach.svg' },
    { id: 'sanfrancisco', title: 'Go To Anywhere (GTA) - San Francisco, CA', atlas: 'San Francisco Street Atlas', icon: 'img/icon-sanfrancisco.svg' }
  ];

  for (const exp of EXPECTED) {
    it(`loads and renders 3D city pack ?city=${exp.id} without uncaught errors`, async () => {
      const exceptions = [];
      const onException = (params) => {
        exceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Unknown exception');
      };
      cdp.on('Runtime.exceptionThrown', onException);

      try {
        await cdp.send('Page.navigate', { url: 'about:blank' }, sessionId);
        await new Promise((r) => setTimeout(r, 150));
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/?city=${exp.id}` }, sessionId);

        const deadline = Date.now() + 45000;
        let state = null;
        while (Date.now() < deadline) {
          if (exceptions.length > 0) break;
          const evalRes = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
              const overlay = document.getElementById('loading-overlay');
              const status = document.getElementById('loading-status')?.textContent || '';
              const hidden = overlay ? overlay.classList.contains('hidden') : false;
              const citySelect = document.getElementById('city-select')?.value;
              const mapCitySelect = document.getElementById('map-city-select')?.value;
              const atlas = document.getElementById('fullmap-city-title')?.textContent;
              const loaderIcon = document.querySelector('#loading-overlay .loader-bullet')?.getAttribute('src') || '';
              const brandIcon = document.querySelector('.brand .app-logo')?.getAttribute('src') || '';
              const tpCount = document.querySelectorAll('#teleport-popover .tp-btn').length;
              const canvasCount = document.querySelectorAll('#canvas-container canvas').length;
              const locationText = document.getElementById('hud-location')?.textContent || '';
              return { hidden, status, title: document.title, citySelect, mapCitySelect, atlas, loaderIcon, brandIcon, tpCount, canvasCount, locationText };
            })()`,
            returnByValue: true
          }, sessionId);
          state = evalRes.result?.value;
          if (state && state.hidden && state.canvasCount > 0) break;
          await new Promise((r) => setTimeout(r, 300));
        }

        assert.deepEqual(exceptions, [], `Uncaught exceptions in ?city=${exp.id}: ${exceptions.join('; ')}`);
        assert.ok(state && state.hidden, `Loading overlay did not finish for ?city=${exp.id} (last status: ${state?.status})`);
        assert.equal(state.title, exp.title);
        assert.equal(state.citySelect, exp.id);
        assert.equal(state.mapCitySelect, exp.id);
        assert.equal(state.atlas, exp.atlas);
        assert.equal(state.loaderIcon, exp.icon);
        assert.equal(state.brandIcon, exp.icon);
        assert.ok(state.tpCount >= 6, `Expected >= 6 teleport buttons for ${exp.id}, got ${state.tpCount}`);
        assert.equal(state.canvasCount, 1, `Expected 3D canvas mounted in #canvas-container for ${exp.id}`);
      } finally {
        const list = cdp.listeners.get('Runtime.exceptionThrown') || [];
        const idx = list.indexOf(onException);
        if (idx >= 0) list.splice(idx, 1);
      }
    });
  }
});
