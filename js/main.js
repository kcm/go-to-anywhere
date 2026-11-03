// Lamp's game runtime first: in Lamp's preview it sets the clock and random numbers before anything reads them.
import { game, hot, save, load, log, asset, pendingRestore, rumble } from '../lamp-game.js';
import * as THREE from 'three/webgpu';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';
import { ACTIVE_CITY_ID, CITY_PACK, CITY_PACKS, cityAssetPath, switchCity, loadLocalCityPacks } from './city-packs.js';
import { CITY_PACK_INSTALLED } from './city-geodata.js';
import { getLocationLabel } from './city-config.js';
import { ThirdPersonControllerManager } from './controllers.js';
import { TouchControls } from './touch-controls.js';
import { reportMemory } from './memory-report.js';
import { releaseUploaded, useRenderer } from './gpu-only.js';
import { TIER, switchTier } from './device-tier.js';
import { CameraSystem } from './cameras.js';
import { LightingSystem } from './lighting.js';
import { updateSceneCulling, showShadowStandIns } from './scene-culling.js';
import { loadTerrain, groundHeight, streamGround, updateGroundStreaming } from './terrain.js';
import { CASCADE_START } from './cascades.js';
import { CityAudioSystem } from './audio-system.js';
import { createPrecipitation } from './weather.js';
import { buildCityWorld } from './world-builder.js';
import { createRenderPipeline } from './render-pipeline.js';
import { initCityHeaderUI, setupHudUI } from './hud-ui.js';
import { precompileShaders } from './shader-precompile.js';

// Unit conversion constants
const MS_TO_MPH = 2.23694;
const M_TO_FT = 3.28084;

// In its own window on the Mac the top strip is the title bar, which takes the clicks: the top panels sit below it
const isMac = (navigator.userAgentData?.platform === 'macOS') || /Mac|Macintosh/i.test(navigator.userAgent || navigator.platform || '');
if (window.webkit?.messageHandlers?.lampNative && isMac && (navigator.maxTouchPoints || 0) === 0) document.documentElement.classList.add('mac-window');

// Application setup, shader warm-up and frame loop.
//
// Lamp: a change that can't be swapped into the running city runs this file's code again in place (lamp-game.js,
// "Running the game's code again"). What's slow to make is kept through that with live.keep: the renderer and its
// compiled shaders, the ground's heights (terrain.js) and each part of the city, which is built again only when its own
// code, the map data it's built from or a part it's built from (its `inputs`) changed, the rest of the city kept as it is.
const live = hot(import.meta);

const PLAYER_SAVE_KEY = `player-${ACTIVE_CITY_ID}`;
const SWAPS_SAVE_KEY = `parkedSwaps-${ACTIVE_CITY_ID}`;

async function loadCityJson(relPath, fallback = null) {
  const bytes = await asset(cityAssetPath(relPath));
  if (!bytes) return fallback;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    console.warn(`[gto] Failed to parse city JSON at ${relPath}:`, err);
    return fallback;
  }
}

async function probeServerConfig() {
  try {
    const res = await fetch('/api/server-config', { cache: 'no-store' });
    if (!res.ok) return { allowCityRequests: false, locked: true };
    const data = await res.json();
    return {
      allowCityRequests: Boolean(data && data.allowCityRequests),
      locked: Boolean(!data || data.locked || !data.allowCityRequests)
    };
  } catch {
    return { allowCityRequests: false, locked: true };
  }
}

async function triggerServerCityBuild(payload, onUpdate) {
  const res = await fetch('/api/cities/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const initData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(initData.error || `Server returned ${res.status}`);
  }
  const cityId = initData.id || payload.id;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1200));
    const stRes = await fetch(`/api/cities/status?id=${encodeURIComponent(cityId)}`, { cache: 'no-store' });
    if (!stRes.ok) continue;
    const job = await stRes.json();
    if (onUpdate) onUpdate(job);
    if (job.status === 'done') return cityId;
    if (job.status === 'error') throw new Error(job.error || 'City pack build failed.');
  }
}

function setupNewCityModal() {
  const modal = document.getElementById('new-city-modal');
  const closeBtn = document.getElementById('new-city-close');
  const searchInput = document.getElementById('new-city-search');
  const searchBtn = document.getElementById('new-city-search-btn');
  const resultsBox = document.getElementById('new-city-results');
  const nameInput = document.getElementById('new-city-name');
  const idInput = document.getElementById('new-city-id');
  const latInput = document.getElementById('new-city-lat');
  const lonInput = document.getElementById('new-city-lon');
  const radiusInput = document.getElementById('new-city-radius');
  const stateInput = document.getElementById('new-city-state');
  const submitBtn = document.getElementById('new-city-submit');
  const progressBox = document.getElementById('new-city-progress');
  const stepEl = document.getElementById('new-city-step');
  const logsEl = document.getElementById('new-city-logs');
  if (!modal) return () => {};

  const openModal = () => {
    modal.classList.remove('hidden');
    searchInput?.focus();
  };
  const closeModal = () => {
    modal.classList.add('hidden');
  };

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  nameInput?.addEventListener('input', () => {
    if (!idInput.dataset.manual) {
      const base = nameInput.value.split(',')[0] || '';
      idInput.value = base.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
    }
  });
  idInput?.addEventListener('input', () => {
    idInput.dataset.manual = idInput.value ? '1' : '';
  });

  async function runGeocode() {
    const q = (searchInput?.value || '').trim();
    if (q.length < 2 || !resultsBox) return;
    resultsBox.hidden = false;
    resultsBox.textContent = 'Searching OpenStreetMap Nominatim...';
    try {
      const res = await fetch(`/api/cities/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = data.results || [];
      if (!list.length) {
        resultsBox.textContent = 'No matching places found.';
        return;
      }
      resultsBox.replaceChildren(
        ...list.map((item) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'new-city-result-item';
          btn.textContent = `${item.name} (${item.lat}, ${item.lon}) - ${item.fullLabel}`;
          btn.addEventListener('click', () => {
            if (nameInput) nameInput.value = item.name;
            if (idInput) {
              idInput.value = item.id;
              idInput.dataset.manual = '1';
            }
            if (latInput) latInput.value = String(item.lat);
            if (lonInput) lonInput.value = String(item.lon);
            if (stateInput) stateInput.value = item.stateCode || '';
            resultsBox.hidden = true;
          });
          return btn;
        })
      );
    } catch (err) {
      resultsBox.textContent = `Search failed: ${err.message}`;
    }
  }

  searchBtn?.addEventListener('click', runGeocode);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runGeocode();
    }
  });

  submitBtn?.addEventListener('click', async () => {
    const id = (idInput?.value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    const name = (nameInput?.value || '').trim() || id;
    const lat = parseFloat(latInput?.value || '');
    const lon = parseFloat(lonInput?.value || '');
    const radiusKm = parseFloat(radiusInput?.value || '2.0') || 2.0;
    const stateCode = (stateInput?.value || '').trim();
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (progressBox) progressBox.hidden = false;
      if (stepEl) stepEl.textContent = 'Please search for a city or enter a valid Pack ID, Latitude, and Longitude.';
      return;
    }
    submitBtn.disabled = true;
    if (progressBox) progressBox.hidden = false;
    if (stepEl) stepEl.textContent = `Building ${name} (${id})...`;
    if (logsEl) logsEl.textContent = '';
    try {
      const builtId = await triggerServerCityBuild(
        { id, name, lat, lon, radiusKm, stateCode },
        (job) => {
          if (stepEl && job.step) stepEl.textContent = job.step;
          if (logsEl && Array.isArray(job.logs)) {
            logsEl.textContent = job.logs.slice(-18).join('\n');
            logsEl.scrollTop = logsEl.scrollHeight;
          }
        }
      );
      switchCity(builtId);
    } catch (err) {
      if (stepEl) stepEl.textContent = `Build error: ${err.message}`;
      submitBtn.disabled = false;
    }
  });

  for (const btnId of ['btn-new-city', 'map-btn-new-city']) {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', openModal);
  }
  return openModal;
}

async function probeInstalledCities() {
  await loadLocalCityPacks(null, { fetchManifest: true });
  const entries = await Promise.all(
    Object.keys(CITY_PACKS).map(async (id) => {
      if (id === ACTIVE_CITY_ID) return [id, CITY_PACK_INSTALLED];
      try {
        const res = await fetch(`cities/${id}/city-geodata.js`, { method: 'HEAD' });
        return [id, res.ok];
      } catch (err) {
        console.warn(`[gto] Failed to probe city ${id}:`, err);
        return [id, false];
      }
    })
  );
  return Object.fromEntries(entries);
}

async function initApp() {
  document.title = `Go To Anywhere (GTA) - ${CITY_PACK.displayName}`;
  const loaderSubtitle = document.getElementById('loader-subtitle');
  if (loaderSubtitle) loaderSubtitle.textContent = CITY_PACK.displayName;
  if (CITY_PACK.icon) {
    const fav = document.getElementById('app-favicon');
    if (fav) fav.href = CITY_PACK.icon;
    for (const logoEl of document.querySelectorAll('.app-logo')) {
      logoEl.src = CITY_PACK.icon;
    }
  }
  const isFullTier = TIER.name === 'full';
  for (const btn of document.querySelectorAll('.tier-btn[data-tier]')) {
    const btnIsFull = btn.dataset.tier === 'full';
    btn.classList.toggle('active', btnIsFull === isFullTier);
    btn.setAttribute('aria-pressed', String(btnIsFull === isFullTier));
    if (!btn.dataset.tierBound) {
      btn.dataset.tierBound = '1';
      btn.addEventListener('click', () => switchTier(btn.dataset.tier));
    }
  }
  const openNewCityModal = setupNewCityModal();
  for (const selId of ['city-select', 'map-city-select']) {
    const sel = document.getElementById(selId);
    if (sel) {
      sel.replaceChildren(
        ...Object.values(CITY_PACKS).map((pack) => {
          const opt = document.createElement('option');
          opt.value = pack.id;
          opt.textContent = pack.isLocal ? `${pack.displayName} (local)` : pack.displayName;
          return opt;
        })
      );
      sel.value = ACTIVE_CITY_ID;
      sel.addEventListener('change', (e) => {
        if (e.target.value === '__new_city__') {
          e.target.value = ACTIVE_CITY_ID;
          openNewCityModal();
          return;
        }
        switchCity(e.target.value);
      });
    }
  }
  Promise.all([probeInstalledCities(), probeServerConfig()]).then(([installedMap, serverCfg]) => {
    const canRequestCity = Boolean(serverCfg && serverCfg.allowCityRequests);
    for (const btnId of ['btn-new-city', 'map-btn-new-city']) {
      const btn = document.getElementById(btnId);
      if (btn) btn.hidden = !canRequestCity;
    }
    for (const selId of ['city-select', 'map-city-select']) {
      const sel = document.getElementById(selId);
      if (!sel) continue;
      const visiblePacks = Object.values(CITY_PACKS).filter(
        (pack) => canRequestCity || installedMap[pack.id] || pack.id === ACTIVE_CITY_ID
      );
      const options = visiblePacks.map((pack) => {
        const opt = document.createElement('option');
        opt.value = pack.id;
        const isInstalled = installedMap[pack.id];
        if (pack.isLocal) {
          opt.textContent = isInstalled ? `${pack.displayName} (local)` : `${pack.displayName} (local, not installed)`;
        } else {
          opt.textContent = isInstalled ? pack.displayName : `${pack.displayName} (not installed)`;
        }
        return opt;
      });
      if (canRequestCity) {
        const addOpt = document.createElement('option');
        addOpt.value = '__new_city__';
        addOpt.textContent = '+ Request / Build New City...';
        options.push(addOpt);
      }
      sel.replaceChildren(...options);
      sel.value = ACTIVE_CITY_ID;
    }
  });

  if (!CITY_PACK_INSTALLED) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingStatus = document.getElementById('loading-status');
    const loadingTrack = loadingOverlay?.querySelector('.loader-track');
    if (loadingTrack) loadingTrack.style.display = 'none';
    if (loadingStatus) {
      const [installedMap, serverCfg] = await Promise.all([probeInstalledCities(), probeServerConfig()]);
      const canRequestCity = Boolean(serverCfg && serverCfg.allowCityRequests);
      loadingStatus.textContent = canRequestCity
        ? `Local city pack "${ACTIVE_CITY_ID}" is not installed yet.`
        : `City pack "${ACTIVE_CITY_ID}" is not available on this locked public server.`;
      const box = document.createElement('div');
      box.className = 'loader-missing-pack';
      if (canRequestCity) {
        const buildCmd = CITY_PACK.isLocal
          ? `npm run city:build -- --city ${ACTIVE_CITY_ID} --name "${CITY_PACK.displayName}" --lat ${CITY_PACK.lat} --lon ${CITY_PACK.lon}`
          : `npm run city:install -- ${ACTIVE_CITY_ID}`;
        const line1 = document.createElement('div');
        const strong1 = document.createElement('strong');
        strong1.textContent = 'Local Server Unlocked: You can build & install this city right now or from the terminal.';
        line1.appendChild(strong1);

        const buildNowBtn = document.createElement('button');
        buildNowBtn.type = 'button';
        buildNowBtn.className = 'new-city-submit';
        buildNowBtn.style.marginTop = '10px';
        buildNowBtn.style.width = '100%';
        buildNowBtn.textContent = `Download & Build ${CITY_PACK.displayName} Now`;

        const liveStep = document.createElement('div');
        liveStep.style.fontSize = '12px';
        liveStep.style.color = 'var(--taxi)';
        liveStep.style.marginTop = '8px';
        liveStep.hidden = true;

        const liveLogs = document.createElement('pre');
        liveLogs.className = 'new-city-logs';
        liveLogs.style.marginTop = '6px';
        liveLogs.hidden = true;

        buildNowBtn.addEventListener('click', async () => {
          buildNowBtn.disabled = true;
          liveStep.hidden = false;
          liveLogs.hidden = false;
          liveStep.textContent = `Starting build for ${CITY_PACK.displayName}...`;
          try {
            const payload = CITY_PACK.isLocal
              ? { id: ACTIVE_CITY_ID, name: CITY_PACK.displayName, lat: CITY_PACK.lat, lon: CITY_PACK.lon }
              : { id: ACTIVE_CITY_ID };
            await triggerServerCityBuild(payload, (job) => {
              if (job.step) liveStep.textContent = job.step;
              if (Array.isArray(job.logs)) {
                liveLogs.textContent = job.logs.slice(-16).join('\n');
                liveLogs.scrollTop = liveLogs.scrollHeight;
              }
            });
            globalThis.location.reload();
          } catch (err) {
            liveStep.textContent = `Build failed: ${err.message}`;
            buildNowBtn.disabled = false;
          }
        });

        const line2 = document.createElement('div');
        line2.style.marginTop = '10px';
        line2.textContent = 'Or run in your terminal:';
        const code1 = document.createElement('code');
        code1.textContent = buildCmd;
        box.replaceChildren(line1, buildNowBtn, liveStep, liveLogs, line2, code1);
      } else {
        const line1 = document.createElement('div');
        const strong1 = document.createElement('strong');
        strong1.textContent = 'This public instance is locked to pre-built city packs.';
        line1.appendChild(strong1);
        const line2 = document.createElement('div');
        line2.style.marginTop = '6px';
        line2.textContent = 'To build and explore new cities anywhere on Earth, run the server locally (npm start).';
        box.replaceChildren(line1, line2);
      }
      const installedIds = Object.keys(installedMap).filter((id) => installedMap[id]);
      if (installedIds.length) {
        const actions = document.createElement('div');
        actions.className = 'loader-pack-actions';
        for (const id of installedIds) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tool-btn';
          btn.textContent = `Switch to ${CITY_PACKS[id].displayName}`;
          btn.addEventListener('click', () => switchCity(id));
          actions.appendChild(btn);
        }
        box.appendChild(actions);
      }
      loadingStatus.after(box);
    }
    return;
  }

  initCityHeaderUI();

  const container = document.getElementById('canvas-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  const loadingTrack = loadingOverlay ? loadingOverlay.querySelector('.loader-track') : null;
  const loadingFill = document.getElementById('loading-progress');
  const setLoadingProgress = (p) => {
    if (!loadingFill) return;
    if (loadingTrack) loadingTrack.classList.remove('is-indeterminate');
    loadingFill.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  };

  let warmStart = false;
  async function showLoadingStage(message) {
    if (loadingStatus) loadingStatus.textContent = message;
    if (loadingTrack) loadingTrack.classList.add('is-indeterminate');
    if (document.hidden || warmStart) return;
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 100);
      requestAnimationFrame(() => {
        clearTimeout(timeout);
        setTimeout(resolve, 0);
      });
    });
  }

  await showLoadingStage('Initializing graphics...');

  // 1. Initialize Three.js WebGPURenderer with 32-bit float reversedDepthBuffer
  const QUALITY = {
    tier: TIER.name,
    phone: TIER.name === 'phone',
    antialias: TIER.antialias,
    shadows: TIER.shadows,
    streetLights: false,
    reflections: false,
    bloom: TIER.bloom,
    outskirts: TIER.outskirts
  };
  const renderer = await live.keep('renderer', async () => {
    const made = new THREE.WebGPURenderer({ antialias: QUALITY.antialias, powerPreference: 'high-performance', reversedDepthBuffer: true, forceWebGL: true });
    await made.init();
    return made;
  });
  useRenderer(renderer);
  renderer.shadowMap.enabled = QUALITY.shadows;
  if (QUALITY.streetLights) renderer.lighting = new ClusteredLighting(256, 32, 28, 48);

  let initTimings = [];
  let initMark = performance.now();
  const markInit = (label) => {
    const now = performance.now();
    initTimings.push(`${label} ${Math.round(now - initMark)}ms`);
    initMark = now;
  };

  const warm = live.keep('warm', () => ({ compiled: false }), { inputs: [renderer] });
  warmStart = warm.compiled;
  if (warmStart && loadingOverlay) {
    loadingOverlay.style.transition = 'none';
    loadingOverlay.classList.add('hidden');
  }
  markInit('renderer');

  // 2. Scene, atmosphere and lighting
  await showLoadingStage('Creating sky and environment lighting...');
  const scene = live.keep('scene', () => new THREE.Scene());
  scene.clear();
  scene.matrixWorldAutoUpdate = true;
  const lighting = live.keep('lighting', () => {
    const made = new LightingSystem(scene, renderer);
    const own = [...scene.children];
    return { made, own, dispose() { made.release(); for (const object of own) object.removeFromParent(); } };
  }, { inputs: [scene, renderer] });
  scene.add(...lighting.own);
  const lightingSystem = lighting.made;
  const precipitation = createPrecipitation();
  scene.add(precipitation.mesh);
  markInit('lighting');

  await showLoadingStage('Reading the ground\'s heights...');
  const heights = await loadTerrain();
  markInit('terrain');
  {
    const saved = load(PLAYER_SAVE_KEY);
    const defaultCar = CITY_PACK.scenicStarts?.car || { x: -4.5, z: 85 };
    const at = (saved?.version === 2 && saved.entities?.[saved.activeMode]) || defaultCar;
    streamGround(TIER.stream, Number.isFinite(at.x) ? at.x : defaultCar.x, Number.isFinite(at.z) ? at.z : defaultCar.z);
  }

  // 3. Build Geography, Landmarks, Blocks, Street Details & Traffic
  let controllerManager = null;
  let audioSystem = null;
  const {
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
  } = await buildCityWorld({
    live,
    scene,
    quality: QUALITY,
    tier: TIER,
    heights,
    showLoadingStage,
    markInit,
    loadCityJson,
    getControllerManager: () => controllerManager,
    getAudioSystem: () => audioSystem
  });

  // 4. Initialize Third-Person Controllers & Multi-Camera System
  await showLoadingStage('Preparing player, vehicles and controls...');
  controllerManager = new ThirdPersonControllerManager(scene, allColliders);
  controllerManager.knockdowns = knockdowns;
  controllerManager.parkedCars = parkedCars;
  controllerManager.roadWork = roadWork;
  controllerManager.railways = railways;
  const ownSpec = CITY_PACK.ownCar || { kind: 'sports', hex: 0xd62828 };
  const isOwnLook = (look) => look && look.kind === ownSpec.kind && look.hex === ownSpec.hex;
  if (!parkedCars.history.length) {
    const added = parkedCars.replay(load(SWAPS_SAVE_KEY));
    if (added.length) { allColliders.push(...added); controllerManager._colliderCells = null; }
  }
  const SCENIC_STARTS = {
    ...(CITY_PACK.scenicStarts || {}),
    kayak: { ...(CITY_PACK.scenicStarts?.kayak || CASCADE_START) }
  };

  try {
    const saved = load(PLAYER_SAVE_KEY);
    if (saved?.version !== 2) {
      for (const [mode, s] of Object.entries(SCENIC_STARTS)) {
        if (!controllerManager.entities[mode]) continue;
        controllerManager.setMode(mode);
        controllerManager.teleportActiveTo(s.x, s.z, s.heading, s.above ? groundHeight(s.x, s.z) + s.above : null);
        if (mode === 'kayak') { const k = controllerManager.entities.kayak; k.heading = s.heading; k.mesh.rotation.y = s.heading; }
      }
      controllerManager.setMode('car');
    }
    if (saved?.version === 2) {
      for (const mode of Object.keys(controllerManager.entities)) {
        const p = saved.entities?.[mode];
        if (!p || ![p.x, p.y, p.z, p.heading].every(Number.isFinite)) continue;
        controllerManager.setMode(mode);
        controllerManager.teleportActiveTo(p.x, p.z, p.heading, p.y);
      }
      controllerManager.setMode(Object.hasOwn(controllerManager.entities, saved.activeMode) ? saved.activeMode : 'car');
      if (saved.carLook && !isOwnLook(saved.carLook)) controllerManager.restyleCar(saved.carLook);
      const sc = saved.entities?.car;
      if (controllerManager.entities.car.machine && sc && !roadWork.held) roadWork.claim(saved.carLook.kind, sc.x, sc.z);
      if (saved.activeMode !== 'person' && Object.hasOwn(controllerManager.entities, saved.activeMode)) {
        controllerManager.entities.person.riding = saved.activeMode;
        controllerManager.entities[saved.activeMode].leftEmpty = false;
      }
      for (const mode of saved.leftEmpty || []) if (controllerManager.entities[mode]) controllerManager.entities[mode].leftEmpty = true;
    }
  } catch (err) {
    console.warn('[gto] Missing or unavailable storage for player state:', err);
  }

  function savePlayerState() {
    try {
      const entities = Object.fromEntries(Object.entries(controllerManager.entities).map(([mode, entity]) => [mode, {
        x: entity.position.x, y: entity.position.y, z: entity.position.z, heading: entity.heading
      }]));
      const leftEmpty = Object.keys(controllerManager.entities).filter((mode) => controllerManager.entities[mode].leftEmpty);
      save(PLAYER_SAVE_KEY, { version: 2, activeMode: controllerManager.activeMode, entities, carLook: controllerManager.carLook, leftEmpty });
      save(SWAPS_SAVE_KEY, parkedCars.history);
    } catch (err) {
      console.warn('[gto] Failed to save player state:', err);
    }
  }

  const keptCamera = live.keep('camera', () => CameraSystem.makeCamera());
  if (![keptCamera.position.x, keptCamera.position.y, keptCamera.position.z, keptCamera.quaternion.w].every(Number.isFinite)) {
    keptCamera.position.set(0, 50, 100); keptCamera.quaternion.identity(); keptCamera.updateMatrixWorld(true);
  }
  const cameraSystem = new CameraSystem(renderer.domElement, controllerManager, keptCamera);
  cameraSystem.onResize(1920, 1080);
  const touchControls = new TouchControls(controllerManager);
  const soundButton = document.getElementById('btn-sound');
  audioSystem = new CityAudioSystem({ controllerManager, trafficSystem, highwayTraffic, streetDetails }, {
    onStateChange: updateSoundButton
  });
  roadWork.onHit = (it, speed, who) => {
    audioSystem.cue(it.kind === 'cone' ? 'thud' : 'crash', { x: it.x, y: it.g, z: it.z }, Math.min(1, (it.kind === 'cone' ? 0.25 : 0.4) + speed * 0.02));
    if (who === 'player' && speed > 8 && it.kind !== 'cone') log(`[road work] hit a ${it.kind} at ${Math.round(speed * MS_TO_MPH)} mph`);
  };
  function updateSoundButton() {
    if (!soundButton) return;
    soundButton.disabled = !audioSystem.supported;
    soundButton.setAttribute('aria-pressed', String(audioSystem.enabled));
    soundButton.setAttribute('aria-label', audioSystem.enabled ? 'Mute sound' : 'Enable sound');
    soundButton.title = audioSystem.supported ? `${audioSystem.enabled ? 'Mute' : 'Enable'} sound [N]` : 'Web Audio is unavailable';
    soundButton.querySelector('use').setAttribute('href', audioSystem.enabled ? '#i-sound' : '#i-sound-off');
  }
  soundButton?.addEventListener('click', () => audioSystem.setEnabled(!audioSystem.enabled));
  updateSoundButton();
  const _thudAt = { x: 0, y: 0, z: 0 };
  trafficSystem.setPedestrianHitListener?.((x, z, speed) => {
    _thudAt.x = x; _thudAt.z = z; _thudAt.y = groundHeight(x, z) + 0.6;
    audioSystem.cue('thud', _thudAt, Math.min(1, 0.4 + speed / 20));
    rumble(0, Math.min(1, 0.3 + speed / 25), Math.min(1, 0.2 + speed / 30), 0.25);
    log(`Knocked someone down at ${speed.toFixed(1)} m/s`);
  });
  trafficSystem.setPlayerStruckListener?.((vx, vz, speed, type) => {
    const at = controllerManager.getActiveEntity().position;
    audioSystem.cue('thud', at, Math.min(1, 0.5 + speed / 20));
    rumble(0, Math.min(1, 0.5 + speed / 20), Math.min(1, 0.4 + speed / 25), 0.35);
    if (type === 'cyclist') controllerManager.throwRider(speed, vx, vz);
    else if (type === 'motorbike') controllerManager.throwMotoRider(speed, vx * 0.6, vz * 0.6);
    else controllerManager.knockDown(vx * 1.1, 1.5 + speed * 0.2, vz * 1.1, 0, 0.6);
    log(`Hit by a car at ${speed.toFixed(1)} m/s`);
  });
  window.addEventListener('pagehide', (event) => {
    savePlayerState();
    if (!event.persisted) audioSystem.dispose();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePlayerState(); });
  markInit('controllers');

  showShadowStandIns(lightingSystem.sunLight.shadow);

  const dynamicRoots = [
    trafficSystem.group,
    highwayTraffic.group,
    railways.group.getObjectByName('Trains'),
    scene.getObjectByName('StoreClusteredLights'),
    scene.getObjectByName('StreetClusteredLights'),
    ...Object.values(controllerManager.entities).map((entity) => entity.mesh),
    controllerManager.entities.cyclist.helmet
  ];
  scene.updateMatrixWorld(true);
  scene.matrixWorldAutoUpdate = false;
  markInit('culling');

  if (!QUALITY.streetLights) {
    const smallLights = [];
    scene.traverse((object) => { if (object.isPointLight || object.isSpotLight) smallLights.push(object); });
    for (const light of smallLights) light.removeFromParent();
    console.log(`[quality] removed ${smallLights.length} small lights`);
  }
  if (!QUALITY.outskirts) {
    const group = scene.getObjectByName('Outskirts');
    if (group) group.visible = false;
  }
  console.log(`[quality] ${JSON.stringify(QUALITY)}`);
  reportMemory(scene, renderer, log, TIER.name !== 'full');

  if (renderer.backend.isWebGPUBackend) {
    scene.traverse((object) => {
      if (object.isInstancedMesh) {
        object.instanceMatrix = new THREE.StorageInstancedBufferAttribute(object.instanceMatrix.array, 16);
      }
    });
  }

  // 5. TSL RenderPipeline with Half-Res Screen Space Reflections (SSRNode), Bloom & Filmic Toning
  await showLoadingStage('Setting up visual effects, map and interface...');
  const { renderPipeline, scenePass, colorGrade, ssrPass, sceneMRT } = createRenderPipeline({
    renderer,
    scene,
    camera: cameraSystem.camera,
    quality: QUALITY
  });

  // 6. Wire UI Controls & HUD
  const {
    gamepadControls,
    mapSystem,
    hudToggleBtn,
    selectMode,
    selectCamera,
    selectTime,
    tickNotice,
    renderLocation,
    topSpeedMph,
    elFps,
    elSpeed,
    elSpeedMeter,
    elAltitude,
    updateWeatherAndTime
  } = setupHudUI({
    controllerManager,
    cameraSystem,
    lightingSystem,
    precipitation,
    colorGrade,
    touchControls,
    audioSystem,
    trafficSystem,
    parkedCars,
    roadWork,
    allColliders,
    cityBlocks,
    savePlayerState,
    SCENIC_STARTS,
    ownSpec,
    isOwnLook,
    markInit
  });

  // 7. Precompile shaders behind the loading screen
  if (!window.lampPreview && !window.__SKIP_SHADER_PRECOMPILE__ && !warmStart) {
    await precompileShaders({
      renderer,
      scene,
      camera: cameraSystem.camera,
      renderPipeline,
      scenePass,
      sceneMRT,
      showLoadingStage,
      setLoadingProgress,
      loadingStatus,
      markInit
    });
  }
  markInit('compile');
  await showLoadingStage('Preparing shadows and the first frame...');

  // 8. Frame loop (~60 Hz)
  let elapsed = 0;
  let frameCount = 0;
  let fpsTimer = 0;
  let nextPlayerSave = 0;
  let heardStrokes = 0;
  let warmedUp = false;
  let releaseFrame = 0, freedSinceReport = 0, reportedAt = 0;

  const prof = { t: 0, n: 0, parts: new Map(), draws: 0, tris: 0, next: 10 };
  let profAt = 0;
  const mark = (name) => {
    const t = performance.now();
    prof.parts.set(name, (prof.parts.get(name) || 0) + (t - profAt));
    profAt = t;
  };
  renderer.info.autoReset = false;

  const frame = (f) => {
    profAt = performance.now();
    renderer.info.reset();
    const now = f.time * 1000;
    const rawDt = f.dt;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    elapsed += dt;
    tickNotice(dt);
    knockdowns.update(dt);
    hydrantSpray.update(dt, cameraSystem.camera);
    audioSystem?.gush?.(hydrantSpray.gushes(gushList));
    skidEffects.update(dt, controllerManager.entities.car, controllerManager.activeMode === 'car', cameraSystem.camera);

    gamepadControls.supply(f.pads[0]);
    gamepadControls.update(dt);
    controllerManager.update(dt, elapsed, cameraSystem.initialized ? cameraSystem.currentPos : null);
    for (const col of parkedCars.step(dt, (p) => controllerManager.settleParked(p))) controllerManager.refreshCollider(col);
    cameraSystem.update(dt, elapsed);
    streetDetails.signalClock.value = elapsed;
    controlsPart.made.update(elapsed);
    trafficSystem.update(
      dt,
      elapsed,
      cameraSystem.currentPos,
      controllerManager.getActiveEntity(),
      controllerManager.activeMode,
      cameraSystem.camera
    );
    mark('player & traffic');
    highwayTraffic.update(dt, cameraSystem.camera, controllerManager.getActiveEntity(), controllerManager.activeMode);
    mark('highway');
    railways.update(dt, (at) => audioSystem.trainHorn(at));
    parkedCars.update(cameraSystem.camera);
    roadWork.update(dt, controllerManager.getActiveEntity(), controllerManager.activeMode, trafficSystem.cars, trafficSystem.buses);
    riverPeoplePart.made.update(dt, elapsed, cameraSystem.currentPos);
    mark('trains & parked');
    const kayak = controllerManager.entities.kayak;
    if (kayak.strokes !== heardStrokes) {
      heardStrokes = kayak.strokes;
      if (controllerManager.activeMode === 'kayak') audioSystem.cue('splash', kayak.position, 0.8);
    }
    if (!document.hidden && now >= nextPlayerSave) {
      savePlayerState();
      nextPlayerSave = now + 5000;
    }
    if (outskirts.update) outskirts.update(elapsed);
    mark('misc');
    cityBlocks.update(cameraSystem.currentPos.x, cameraSystem.currentPos.z);
    if (cityBlocks.updateLights) cityBlocks.updateLights(cameraSystem.camera);
    mark('blocks');
    if (streetDetails.update) streetDetails.update(cameraSystem.camera);
    mark('street details');
    lightingSystem.update(cameraSystem.currentPos);
    mapSystem.update();
    updateWeatherAndTime(elapsed);
    precipitation.update(cameraSystem.camera, elapsed);
    audioSystem.update(dt, elapsed, cameraSystem.camera, lightingSystem.lookId === 'midnight');
    mark('light, map, weather, sound');
    if (warmedUp) updateSceneCulling(cameraSystem.camera.position);
    if (TIER.stream) {
      const { x, z } = cameraSystem.camera.position;
      updateGroundStreaming(x, z);
      houseStream?.update(x, z);
    }
    if (warmedUp && (++releaseFrame & 31) === 0) {
      freedSinceReport += releaseUploaded(renderer);
      if (freedSinceReport > 0 && elapsed - reportedAt > 12) {
        reportedAt = elapsed; freedSinceReport = 0;
        reportMemory(scene, renderer, log, TIER.name !== 'full');
      }
    }
    for (const root of dynamicRoots) root.updateMatrixWorld();
    mark('culling');

    if (!warmedUp && !warmStart) {
      const culled = [];
      const pipelines = new Set();
      scene.traverseVisible((o) => {
        const pipeline = o.userData.sharesPipelineWith || o;
        if (pipelines.has(pipeline)) return;
        pipelines.add(pipeline);
        if (o.frustumCulled) {
          culled.push(o);
          o.frustumCulled = false;
        }
      });
      renderPipeline.render();
      for (const o of culled) o.frustumCulled = true;
      markInit('warmup');
    }
    renderPipeline.render();
    mark('render');
    prof.n++;
    prof.draws += renderer.info.render.drawCalls;
    prof.tris += renderer.info.render.triangles;
    if (elapsed >= prof.next && warmedUp) {
      prof.next = elapsed + 10;
      const parts = [...prof.parts].map(([k, v]) => `${k} ${(v / prof.n).toFixed(1)}`).join(', ');
      log(`[frame] ms a frame: ${parts}; ${Math.round(prof.draws / prof.n)} draws, ${(prof.tris / prof.n / 1e6).toFixed(2)}M triangles`);
      prof.parts.clear(); prof.n = prof.draws = prof.tris = 0;
    }
    if (!warmedUp) {
      warmedUp = true;
      markInit('firstFrame');
      const device = renderer.backend.device;
      if (loadingStatus) loadingStatus.textContent = 'Waiting for graphics to finish the first frame...';
      Promise.resolve(device && device.queue.onSubmittedWorkDone()).catch(() => {}).then(() => {
        markInit('gpu');
        log(`[init] ${initTimings.join(', ')}`);
        initTimings = null;
        if (loadingOverlay && window.lampPreview) loadingOverlay.style.transition = 'none';
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        warm.compiled = true;
        audioSystem.ready = true;
        audioSystem.unlock();
        setLoadingProgress(1);
      });
    }

    frameCount++;
    fpsTimer += Math.max(0, rawDt);
    if (fpsTimer >= 0.25) {
      const currentFps = Math.round(frameCount / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;

      const activeEnt = controllerManager.getActiveEntity();
      const mode = controllerManager.activeMode;
      const mph = Math.round((mode === 'kayak' ? activeEnt.groundSpeed || 0 : Math.abs(activeEnt.speed)) * MS_TO_MPH);
      const altFt = Math.max(0, Math.round((activeEnt.position.y - groundHeight(activeEnt.position.x, activeEnt.position.z)) * M_TO_FT));

      if (elFps) {
        elFps.textContent = String(currentFps);
        elFps.className = currentFps >= 50 ? 'fps-ok' : currentFps >= 30 ? 'fps-warn' : 'fps-bad';
      }
      if (elSpeed) elSpeed.textContent = String(mph);
      if (elSpeedMeter) elSpeedMeter.style.transform = `scaleX(${Math.min(1, mph / (topSpeedMph[mode] || 80))})`;
      if (elAltitude) elAltitude.textContent = altFt.toLocaleString('en-US');
      const where = cameraSystem.getActivePreset().category === 'follow' ? activeEnt.position : cameraSystem.currentPos;
      renderLocation(getLocationLabel(where.x, where.z));
    }
  };

  function snapshot() {
    const entities = Object.fromEntries(Object.entries(controllerManager.entities).map(([mode, entity]) => [mode, {
      x: entity.position.x, y: entity.position.y, z: entity.position.z, heading: entity.heading, speed: entity.speed || 0
    }]));
    return { version: 2, activeMode: controllerManager.activeMode, entities, camera: cameraSystem.activePresetId,
             zoom: cameraSystem.zoomMultiplier, time: lightingSystem.activePresetId,
             map: mapSystem.isFullMapOpen, hudHidden: document.body.classList.contains('hud-minimized') };
  }
  function startFrom(state) {
    if (state?.version !== 2) return;
    for (const mode of Object.keys(controllerManager.entities)) {
      const p = state.entities?.[mode];
      if (!p || ![p.x, p.y, p.z, p.heading].every(Number.isFinite)) continue;
      controllerManager.setMode(mode);
      controllerManager.teleportActiveTo(p.x, p.z, p.heading, p.y);
      if (Number.isFinite(p.speed)) controllerManager.entities[mode].speed = p.speed;
    }
    selectMode(Object.hasOwn(controllerManager.entities, state.activeMode) ? state.activeMode : controllerManager.activeMode);
    if (state.time) selectTime(state.time);
    if (state.camera) selectCamera(state.camera, true);
    if (Number.isFinite(state.zoom)) cameraSystem.zoomMultiplier = state.zoom;
    if (typeof state.hudHidden === 'boolean' && hudToggleBtn && state.hudHidden !== document.body.classList.contains('hud-minimized')) hudToggleBtn.click();
    if (state.map === true) mapSystem.toggleFullMap(true);
  }

  game({ renderer, init() {
    if (TIER.scale < 1) renderer.setSize(Math.round(1920 * TIER.scale), Math.round(1080 * TIER.scale), false);
    const was = pendingRestore(); if (was) startFrom(was);
  }, frame, touch: false, keyboard: false, snapshot, sharp: false,
    dispose() { cameraSystem.release(); mapSystem.release(); renderPipeline.dispose(); colorGrade.dispose(); ssrPass?.dispose(); scenePass.dispose(); } });
  container.appendChild(renderer.domElement);
}

initApp();
