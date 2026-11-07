import { log, input, onInput, label, glyph, BUTTON, STICK, TRIGGER } from '../lamp-game.js';
import { ACTIVE_CITY_ID, CITY_PACK, CITY_PACKS, switchCity } from './city-packs.js';
import { TIER, switchTier } from './device-tier.js';
import { getLocationLabel, isTypingInField, ROADS, LANDMARKS, TELEPORT_LOCATIONS } from './city-config.js';
import { GamepadControls } from './gamepad-controls.js';
import { CAMERA_PRESETS } from './cameras.js';
import { sunTimes } from './lighting.js';
import { CityMapSystem } from './city-map.js';
import { groundHeight, nearestWater } from './terrain.js';
import { fetchWeather } from './weather.js';
import { fetchRiverFlow } from './river-gauge.js';

export async function probeServerConfig() {
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

export async function triggerServerCityBuild(payload, onUpdate) {
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

export function setupNewCityModal() {
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

export function initCityAndTierControls(probeInstalledCities) {
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
  const isFullTier = TIER.name === 'full' || TIER.name === 'insanity';
  const isInsanityTier = TIER.name === 'insanity';
  for (const btn of document.querySelectorAll('.tier-btn[data-tier]')) {
    const btnIsFull = btn.dataset.tier === 'full';
    btn.classList.toggle('active', btnIsFull === isFullTier);
    btn.setAttribute('aria-pressed', String(btnIsFull === isFullTier));
    if (!btn.dataset.tierBound) {
      btn.dataset.tierBound = '1';
      btn.addEventListener('click', () => switchTier(btn.dataset.tier));
    }
  }
  for (const cb of document.querySelectorAll('.tier-insanity-cb')) {
    cb.checked = isInsanityTier;
    cb.disabled = !isFullTier;
    cb.closest('.tier-insanity')?.classList.toggle('is-disabled', !isFullTier);
    cb.closest('.tier-insanity')?.classList.toggle('is-active', isInsanityTier);
    if (!cb.dataset.tierBound) {
      cb.dataset.tierBound = '1';
      cb.addEventListener('change', () => {
        if (!isFullTier) return;
        switchTier(cb.checked ? 'insanity' : 'full');
      });
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
}

/**
 * Populates city-specific labels, teleport popover items, and camera preset buttons.
 */
export function initCityHeaderUI() {
  const mapCityTitle = document.getElementById('fullmap-city-title');
  if (mapCityTitle) mapCityTitle.textContent = `${CITY_PACK.title} Street Atlas`;
  const mapCredit = document.getElementById('fullmap-credit');
  if (mapCredit) mapCredit.textContent = CITY_PACK.subtitle || '';
  const mapSearch = document.getElementById('fullmap-search');
  if (mapSearch && CITY_PACK.searchPlaceholder) mapSearch.placeholder = CITY_PACK.searchPlaceholder;
  const openMapBtnEl = document.getElementById('btn-open-map');
  if (openMapBtnEl) openMapBtnEl.title = `Full ${CITY_PACK.title} street map [M]`;
  const timeNowBtnEl = document.getElementById('time-now');
  if (timeNowBtnEl) timeNowBtnEl.title = `Now in ${CITY_PACK.title}`;
  const miniCardEl = document.getElementById('minimap-card');
  if (miniCardEl) {
    miniCardEl.setAttribute('aria-label', `Live ${CITY_PACK.title} Street Radar Minimap`);
    miniCardEl.title = `Open the full ${CITY_PACK.title} street map [M]`;
  }
  const fullMapModalEl = document.getElementById('fullmap-modal');
  if (fullMapModalEl) fullMapModalEl.setAttribute('aria-label', `Full ${CITY_PACK.title} Interactive Street Map`);
  const viewAllBtnEl = document.getElementById('map-view-all');
  if (viewAllBtnEl) {
    viewAllBtnEl.title = `All of ${CITY_PACK.title}`;
    viewAllBtnEl.setAttribute('aria-label', `Fit all of ${CITY_PACK.title}`);
  }

  const tpPop = document.getElementById('teleport-popover');
  if (tpPop && CITY_PACK.landmarks?.length) {
    const titleEl = document.createElement('div');
    titleEl.className = 'pop-title';
    titleEl.textContent = 'Teleport to';
    const tpItems = [titleEl];
    for (const lm of CITY_PACK.landmarks) {
      const btn = document.createElement('button');
      btn.id = `tp-${lm.id}`;
      btn.className = 'pop-item tp-btn';
      btn.dataset.teleport = lm.id;
      btn.type = 'button';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pop-name';
      nameSpan.textContent = lm.short || lm.name;
      const subSpan = document.createElement('span');
      subSpan.className = 'pop-sub';
      subSpan.textContent = lm.name;
      btn.append(nameSpan, subSpan);
      tpItems.push(btn);
    }
    tpPop.replaceChildren(...tpItems);
  }

  const camPop = document.getElementById('camera-popover');
  if (camPop && CAMERA_PRESETS.length) {
    const items = [];
    let lastCat = '';
    let scenicIdx = 0;
    for (const preset of CAMERA_PRESETS) {
      if (preset.category !== lastCat) {
        lastCat = preset.category;
        const titleEl = document.createElement('div');
        titleEl.className = 'pop-title';
        titleEl.textContent = preset.category === 'follow' ? 'Follow' : 'Scenic';
        items.push(titleEl);
      }
      const btn = document.createElement('button');
      btn.id = `cam-${preset.id}`;
      btn.className = `pop-item cam-btn${preset.id === 'chase' ? ' active' : ''}`;
      btn.dataset.camera = preset.id;
      btn.type = 'button';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pop-name';
      nameSpan.textContent = preset.name;
      btn.appendChild(nameSpan);
      let keyCode = null;
      if (preset.id === 'chase') keyCode = 'Digit6';
      else if (preset.id === 'action') keyCode = 'Digit7';
      else if (preset.id === 'pov') keyCode = 'Digit8';
      else if (preset.category === 'scenic') {
        if (scenicIdx === 0) keyCode = 'Digit9';
        else if (scenicIdx === 1) keyCode = 'Digit0';
        scenicIdx++;
      }
      if (keyCode) {
        const kbd = document.createElement('kbd');
        kbd.dataset.key = keyCode;
        kbd.textContent = keyCode.slice(-1);
        btn.appendChild(kbd);
      }
      items.push(btn);
    }
    camPop.replaceChildren(...items);
  }
}

/**
 * Wires HUD controls, popovers, mode/camera/time switchers, keyboard shortcuts,
 * gamepad controls, location street-sign badges, and the interactive street map.
 */
export function setupHudUI({
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
}) {
  const modeButtons = document.querySelectorAll('[data-mode]');
  const cameraButtons = document.querySelectorAll('[data-camera]');
  const timeButtons = document.querySelectorAll('[data-time]');
  const teleportButtons = document.querySelectorAll('[data-teleport]');
  const hudToggleBtn = document.getElementById('btn-toggle-hud');
  const modeSwitch = document.getElementById('mode-switch');
  touchControls.onAvailabilityChange = placeModeIndicator;
  touchControls.onGetInOut = () => getInOrOut();

  const elFps = document.getElementById('hud-fps');
  const elMode = document.getElementById('hud-active-mode');
  const elCamera = document.getElementById('hud-active-camera');
  const elSpeed = document.getElementById('hud-speed');
  const elSpeedMeter = document.getElementById('hud-speed-meter');
  const elAltitude = document.getElementById('hud-altitude');
  const elLocation = document.getElementById('hud-location');
  const elControlsHint = document.getElementById('hud-controls-hint');

  let mapSystem;
  const gamepadControls = new GamepadControls(controllerManager, cameraSystem, {
    onCycleMode: (step) => {
      const modes = ['person', 'car', 'cyclist', 'helicopter', 'kayak'];
      travelBy(modes[(modes.indexOf(controllerManager.activeMode) + step + modes.length) % modes.length]);
    },
    onCycleCamera: cycleCamera,
    onGetInOut: getInOrOut,
    onToggleMap: () => mapSystem.toggleFullMap(!mapSystem.isFullMapOpen),
    onCloseMap: () => mapSystem.toggleFullMap(false)
  });

  const orbit = { keys: ['Drag'], pad: [STICK.RIGHT], does: 'Orbit' };
  const controlHints = {
    person: [{ keys: ['KeyW', 'KeyS'], does: 'Walk / Run' }, { keys: ['KeyA', 'KeyD'], does: 'Turn' },
      { pad: [STICK.LEFT], does: 'Walk / Run & turn' }, { keys: ['Space'], pad: [BUTTON.A], does: 'Jump' }, orbit],
    car: [{ keys: ['KeyW', 'KeyS'], pad: [TRIGGER.RT, TRIGGER.LT], does: 'Drive / Reverse' },
      { keys: ['KeyA', 'KeyD'], pad: [STICK.LEFT], does: 'Steer' }, { keys: ['Space'], pad: [BUTTON.A], does: 'Handbrake' },
      { keys: ['KeyB'], does: 'Horn' }, { pad: [STICK.RIGHT], does: 'Orbit' }],
    cyclist: [{ keys: ['KeyW', 'KeyS'], pad: [TRIGGER.RT, TRIGGER.LT], does: 'Pedal / Brake' },
      { keys: ['KeyA', 'KeyD'], pad: [STICK.LEFT], does: 'Lean & Turn' }, orbit],
    helicopter: [{ keys: ['KeyW', 'KeyS'], does: 'Pitch' }, { keys: ['KeyA', 'KeyD'], does: 'Yaw' },
      { pad: [STICK.LEFT], does: 'Pitch & Yaw' }, { keys: ['Space', 'KeyE'], pad: [TRIGGER.RT], does: 'Ascend' },
      { keys: ['KeyQ', 'KeyC'], pad: [TRIGGER.LT], does: 'Descend' }],
    kayak: [{ keys: ['KeyW', 'KeyS'], does: 'Paddle / Back' }, { keys: ['KeyA', 'KeyD'], does: 'Turn' },
      { pad: [STICK.LEFT], does: 'Paddle & turn' }, orbit]
  };
  for (const [mode, hints] of Object.entries(controlHints)) {
    hints.push({ keys: ['KeyF'], pad: [BUTTON.X], does: mode === 'person' ? 'Get in' : 'Get out' });
  }
  const topSpeedMph = { person: 18, car: 81, cyclist: 43, helicopter: 116, kayak: 12 };

  function renderControlHints(mode, on = input()) {
    if (!elControlsHint) return;
    const pad = on.kind === 'controller';
    const items = (controlHints[mode] || []).filter((hint) => pad ? hint.pad : hint.keys).map((hint) => {
      const item = document.createElement('span');
      item.className = 'hint';
      for (const what of pad ? hint.pad : hint.keys) {
        if (pad) {
          const badge = glyph(what, on);
          if (badge) item.appendChild(badge);
          continue;
        }
        const kbd = document.createElement('kbd');
        kbd.textContent = label(what, on);
        item.appendChild(kbd);
      }
      const words = document.createElement('span');
      words.className = 'hint-label';
      words.textContent = hint.does;
      item.appendChild(words);
      return item;
    });
    elControlsHint.replaceChildren(...items);
  }

  function relabelKeys(on) {
    document.body.dataset.input = on.kind;
    for (const kbd of document.querySelectorAll('kbd[data-key], kbd[data-pad]')) {
      const badge = on.kind === 'controller' && kbd.dataset.pad ? glyph(BUTTON[kbd.dataset.pad], on) : null;
      if (badge) kbd.replaceChildren(badge);
      else if (kbd.dataset.key) kbd.textContent = label(kbd.dataset.key, on);
    }
  }

  function placeModeIndicator() {
    const active = modeSwitch ? modeSwitch.querySelector('.mode-btn.active') : null;
    if (!active) return;
    modeSwitch.style.setProperty('--ind-x', `${active.offsetLeft}px`);
    modeSwitch.style.setProperty('--ind-w', `${active.offsetWidth}px`);
  }

  function selectMode(mode) {
    controllerManager.setMode(mode);
    touchControls.setMode(controllerManager.activeMode);
    gamepadControls.reset();
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    document.body.dataset.mode = mode;
    placeModeIndicator();
    const ent = controllerManager.getActiveEntity();
    if (elMode) elMode.textContent = ent.label;
    renderControlHints(mode);

    const currentCam = cameraSystem.getActivePreset();
    if (currentCam.category !== 'follow') {
      selectCamera('chase', false);
    }
  }

  function travelBy(mode) {
    const cm = controllerManager;
    if (mode === cm.activeMode || !cm.entities[mode]) { selectMode(mode); return; }
    const here = cm.getActiveEntity().position, there = cm.entities[mode].position;
    const close = Math.hypot(there.x - here.x, there.z - here.z) < 40;
    const prevHeading = cm.getActiveEntity().heading || 0;
    selectMode(mode);
    if (!close) {
      if (mode === 'kayak') {
        const nearW = nearestWater(here.x, here.z, 180);
        if (nearW) {
          const h = cm.downstreamHeading(nearW.x, nearW.z, prevHeading);
          cm.teleportActiveTo(nearW.x, nearW.z, h);
          touchControls.reset();
          gamepadControls.reset();
          cameraSystem.resetForTeleport();
          selectCamera('chase', true);
          savePlayerState();
          return;
        }
      }
      goToStart(mode);
    }
  }

  function resetGame() {
    const cm = controllerManager;
    const p = cm.entities.person;
    p.fallen = null;
    if (p.rig) p.rig.ragdolling = false;
    p.riding = null;
    cm.setMode('person');
    if (!isOwnLook(cm.carLook)) cm.restyleCar({ kind: ownSpec.kind, hex: ownSpec.hex, style: 0 });
    roadWork.home();
    cm._colliderCells = null;
    for (const [mode, s] of Object.entries(SCENIC_STARTS)) {
      const e = cm.entities[mode];
      if (!e) continue;
      cm.setMode(mode);
      e.leftEmpty = false;
      cm.teleportActiveTo(s.x, s.z, s.heading, s.above ? groundHeight(s.x, s.z) + s.above : null);
      if (mode === 'kayak') { e.heading = s.heading; e.mesh.rotation.y = s.heading; }
      if (mode === 'car') cm.stopCar(e);
    }
    p.riding = 'car';
    selectMode('car');
    parkedCars.history.length = 0;
    selectTime('now');
    touchControls.reset();
    gamepadControls.reset();
    cameraSystem.resetForTeleport();
    selectCamera('chase', true);
    savePlayerState();
    log('[reset] game reset to its start');
    showNotice('Back to the start');
  }
  document.getElementById('reset-confirm')?.addEventListener('click', () => {
    closePopovers();
    resetGame();
  });

  function goToStart(mode) {
    const s = SCENIC_STARTS[mode];
    if (!s) return;
    controllerManager.teleportActiveTo(s.x, s.z, s.heading, s.above ? groundHeight(s.x, s.z) + s.above : null);
    touchControls.reset();
    gamepadControls.reset();
    cameraSystem.resetForTeleport();
    selectCamera('chase', true);
    savePlayerState();
  }

  let noticeEl = null, noticeTimer = 0;
  function showNotice(text) {
    if (!noticeEl) { noticeEl = document.createElement('div'); noticeEl.className = 'notice'; document.body.appendChild(noticeEl); }
    noticeEl.textContent = text;
    noticeEl.classList.add('show');
    noticeTimer = 1.6;
  }
  function tickNotice(dt) {
    if (noticeTimer > 0 && (noticeTimer -= dt) <= 0) noticeEl?.classList.remove('show');
  }

  function getInOrOut() {
    if (mapSystem.isFullMapOpen) return;
    const cm = controllerManager;
    const was = cm.activeMode;
    const choice = cm.enterOrExit(parkedCars, trafficSystem);
    if (!choice) return;
    if (choice.tooFast) { showNotice('Slow down to get out'); return; }
    const car = cm.entities.car;
    let drop = null;
    if (choice.parked || choice.moving || choice.machine) {
      drop = { ...cm.carLook, x: car.position.x, z: car.position.z, yaw: car.heading,
        y: Math.max(0, car.position.y - cm.getGroundHeight(car.position.x, car.position.z, 'car')) };
      if (car.machine) { roadWork.leave(drop.x, drop.z, drop.yaw); cm._colliderCells = null; drop = null; }
      if (choice.machine) {
        if (drop) { const done = parkedCars.take(null, drop); if (done?.collider) allColliders.push(done.collider); }
        const m = choice.machine;
        const look = roadWork.take(m.machine);
        cm._colliderCells = null;
        cm.restyleCar(look);
        cm.stopCar(car);
        car.position.set(m.x, cm.getGroundHeight(m.x, m.z, 'car'), m.z);
        car.heading = m.yaw;
        car.prevX = car.position.x;
        car.prevZ = car.position.z;
        car.mesh.position.copy(car.position);
        car.mesh.rotation.y = car.heading;
        log(`[car] climbed into ${look.kind === 'dumptruck' ? 'a dump truck' : 'an excavator'} at the road work`);
      }
    }
    if (choice.parked || choice.moving) {
      const taken = choice.moving ? trafficSystem.takeCar(cm.entities.person.position.x, cm.entities.person.position.z, 5) : null;
      if (choice.moving && !taken) { cm.entities.person.riding = null; return; }
      const done = parkedCars.take(choice.parked || null, drop);
      if (done?.collider) { allColliders.push(done.collider); cm._colliderCells = null; }
      const look = choice.moving ? taken : done.look;
      const at = choice.moving ? taken : choice.parked;
      cm.restyleCar(look);
      cm.stopCar(car);
      car.position.set(at.x, cm.getGroundHeight(at.x, at.z, 'car') + (choice.parked?.y || 0), at.z);
      car.heading = choice.moving ? taken.yaw : choice.parked.yaw;
      car.prevX = car.position.x;
      car.prevZ = car.position.z;
      if (choice.moving) car.speed = taken.speed;
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
      log(choice.moving ? `[car] took a ${look.kind} out of traffic` : `[car] took a parked ${look.kind}`);
    }
    selectMode(choice.mode);
    const at = cm.getActiveEntity().position;
    if (choice.mode === 'car' || was === 'car') audioSystem.cue('door', at, 0.9);
    savePlayerState();
  }

  function selectCamera(camId, snap = false) {
    cameraSystem.setCameraPreset(camId, snap);
    cameraButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-camera') === camId);
    });
    const preset = cameraSystem.getActivePreset();
    if (elCamera) elCamera.textContent = preset.name;
  }

  function cycleCamera(step) {
    const n = CAMERA_PRESETS.length;
    const idx = CAMERA_PRESETS.findIndex((p) => p.id === cameraSystem.activePresetId);
    selectCamera(CAMERA_PRESETS[(idx + step + n) % n].id, true);
  }

  const CROWD_BY_LOOK = { midday: 0.8, golden: 1, twilight: 0.85, midnight: 0.18 };
  function crowdBusy(timeId) {
    if (timeId !== 'now') return CROWD_BY_LOOK[timeId] ?? 0.8;
    const hour = +new Date(Date.now()).toLocaleString('en-US', { timeZone: CITY_PACK.timeZone || 'America/Detroit', hour: 'numeric', hourCycle: 'h23' });
    const byHour = [0.2, 0.14, 0.1, 0.06, 0.06, 0.08, 0.2, 0.35, 0.5, 0.55, 0.6, 0.7, 0.8, 0.8, 0.8, 0.9, 1, 1, 1, 1, 0.95, 0.85, 0.6, 0.35];
    const w = lightingSystem.weather;
    const wet = w && /rain|snow|storm|shower|sleet|drizzle/i.test(w.text || '') ? 0.6 : 1;
    const cold = w && w.tempF != null && w.tempF < 25 ? 0.75 : 1;
    return byHour[hour] * wet * cold;
  }

  function selectTime(timeId) {
    lightingSystem.applyPreset(timeId, timeId === 'now');
    trafficSystem.setCrowdBusy?.(crowdBusy(timeId));
    precipitation.set(timeId === 'now' ? lightingSystem.weather : null);
    colorGrade.applyPreset(lightingSystem.lookId);
    timeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-time') === timeId);
    });
    if (timeId === 'now') describeNow();
  }

  function describeNow() {
    const btn = document.getElementById('time-now');
    if (!btn) return;
    const { rise, set } = sunTimes(Date.now());
    const at = (t) => (t ? new Date(t).toLocaleTimeString('en-US', { timeZone: CITY_PACK.timeZone || 'America/Detroit', hour: 'numeric', minute: '2-digit' }) : '-');
    btn.title = `Now in ${CITY_PACK.title} \u00b7 sunrise ${at(rise)}, sunset ${at(set)}`;
    const labelEl = btn.querySelector('.seg-label');
    const w = lightingSystem.weather;
    const temp = w && w.tempF != null ? ` \u00b7 ${w.tempF}\u00b0` : '';
    if (labelEl) labelEl.textContent = `Now \u00b7 ${at(Date.now())}${temp}`;
    if (w && w.live) btn.title += ` \u00b7 ${w.text}${w.tempF != null ? `, ${w.tempF}\u00b0F` : ''}`;
  }

  const popovers = document.querySelectorAll('.popover[popover]');
  const supportsPopover = typeof HTMLElement.prototype.togglePopover === 'function';
  function closePopovers() {
    if (!supportsPopover) return;
    popovers.forEach((pop) => {
      if (pop.matches(':popover-open')) pop.hidePopover();
    });
  }
  popovers.forEach((pop) => {
    const invoker = document.querySelector(`[popovertarget="${pop.id}"]`);
    pop.addEventListener('beforetoggle', (e) => {
      const open = e.newState === 'open';
      if (invoker) invoker.classList.toggle('is-open', open);
      if (!open) return;
      const anchor = document.getElementById(pop.dataset.anchor) || invoker;
      const align = document.getElementById(pop.dataset.align) || invoker;
      if (!anchor || !align) return;
      const r = anchor.getBoundingClientRect();
      const spaceAbove = Math.max(0, r.top - 20);
      const spaceBelow = Math.max(0, window.innerHeight - r.bottom - 20);
      let above = pop.dataset.side === 'above';
      if ((above ? spaceAbove : spaceBelow) < 160) above = spaceAbove > spaceBelow;
      pop.style.right = `${Math.max(8, window.innerWidth - align.getBoundingClientRect().right)}px`;
      if (above) {
        pop.style.top = 'auto';
        pop.style.bottom = `${window.innerHeight - r.top + 8}px`;
        pop.style.maxHeight = `${spaceAbove}px`;
      } else {
        pop.style.bottom = 'auto';
        pop.style.top = `${r.bottom + 8}px`;
        pop.style.maxHeight = `${spaceBelow}px`;
      }
    });
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      travelBy(btn.getAttribute('data-mode'));
    });
  });

  cameraButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectCamera(btn.getAttribute('data-camera'), true);
      closePopovers();
    });
  });

  const camPrevBtn = document.getElementById('cam-prev');
  const camNextBtn = document.getElementById('cam-next');
  if (camPrevBtn) camPrevBtn.addEventListener('click', () => cycleCamera(-1));
  if (camNextBtn) camNextBtn.addEventListener('click', () => cycleCamera(1));

  timeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectTime(btn.getAttribute('data-time'));
    });
  });

  document.querySelector('.repo-link')?.addEventListener('click', (e) => {
    if (!window.LampNative?.available) return;
    e.preventDefault();
    window.LampNative.call('openRepo').catch(() => log('[github] the app could not open the link'));
  });

  document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('button') : null;
    if (btn && e.detail > 0) btn.blur();
  });

  const roadNames = new Set(ROADS.map((r) => r.name));
  const placeNames = new Set(LANDMARKS.map((l) => l.name));
  let locationText = '';
  function renderLocation(locLabel) {
    if (!elLocation || locLabel === locationText) return;
    locationText = locLabel;
    let place = '';
    let streets = locLabel;
    const split = locLabel.indexOf(' · ');
    if (split >= 0) {
      place = locLabel.slice(0, split);
      streets = locLabel.slice(split + 3);
    } else if (placeNames.has(locLabel) || (!locLabel.includes(' & ') && !roadNames.has(locLabel))) {
      place = locLabel;
      streets = '';
    }
    const nodes = [];
    if (place) {
      const el = document.createElement('div');
      el.className = 'location-place';
      el.textContent = place;
      nodes.push(el);
    }
    if (streets) {
      const row = document.createElement('div');
      row.className = 'location-signs';
      if (streets.startsWith('near ')) {
        streets = streets.slice(5);
        const near = document.createElement('span');
        near.className = 'location-near';
        near.textContent = 'near';
        row.appendChild(near);
      }
      for (const name of streets.split(' & ')) {
        const sign = document.createElement('span');
        sign.className = 'street-sign';
        sign.textContent = name;
        row.appendChild(sign);
      }
      nodes.push(row);
    }
    elLocation.replaceChildren(...nodes);
  }

  function teleportTo(x, z, heading = Math.PI) {
    const destination = controllerManager.teleportActiveTo(x, z, heading);
    touchControls.reset();
    gamepadControls.reset();
    cameraSystem.resetForTeleport();
    selectCamera('chase', true);
    mapSystem.waypoint = {
      x: destination.x,
      z: destination.z,
      name: getLocationLabel(destination.x, destination.z)
    };
    return destination;
  }

  mapSystem = new CityMapSystem({
    controllerManager,
    cameraSystem,
    trafficSystem,
    allBlocks: cityBlocks.allBlocks,
    onToggle: (open) => {
      controllerManager.resetInput();
      touchControls.setEnabled(!open);
      gamepadControls.setEnabled(!open);
      const mapHint = document.getElementById('fullmap-hover-info');
      if (open && touchControls.available && mapHint) {
        mapHint.textContent = 'Tap to teleport · Drag to pan · Use + / − to zoom';
      }
    },
    onTeleport: teleportTo
  });
  window.teleportTo = teleportTo;

  teleportButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-teleport');
      const loc = TELEPORT_LOCATIONS[key];
      if (loc) {
        teleportTo(loc.x, loc.z, loc.heading);
      }
      closePopovers();
    });
  });

  const openMapBtn = document.getElementById('btn-open-map');
  if (openMapBtn) openMapBtn.addEventListener('click', () => mapSystem.toggleFullMap(true));

  if (hudToggleBtn) {
    hudToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('hud-minimized');
      const isMin = document.body.classList.contains('hud-minimized');
      hudToggleBtn.setAttribute('aria-pressed', String(isMin));
      hudToggleBtn.setAttribute('aria-label', isMin ? 'Show HUD' : 'Hide HUD');
      hudToggleBtn.title = isMin ? 'Show the HUD [H]' : 'Clean view: hide the HUD [H]';
      if (isMin) closePopovers();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingInField(e)) return;
    switch (e.code) {
      case 'Digit1':
        travelBy('person');
        break;
      case 'Digit2':
        travelBy('car');
        break;
      case 'Digit3':
        travelBy('cyclist');
        break;
      case 'Digit4':
        travelBy('helicopter');
        break;
      case 'Digit5':
        travelBy('kayak');
        break;
      case 'Digit6':
        selectCamera('chase', true);
        break;
      case 'Digit7':
        selectCamera('action', true);
        break;
      case 'Digit8':
        selectCamera('pov', true);
        break;
      case 'Digit9': {
        const scenic = CAMERA_PRESETS.filter((p) => p.category === 'scenic');
        if (scenic[0]) selectCamera(scenic[0].id, true);
        break;
      }
      case 'Digit0': {
        const scenic = CAMERA_PRESETS.filter((p) => p.category === 'scenic');
        if (scenic[1]) selectCamera(scenic[1].id, true);
        break;
      }
      case 'KeyF':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) getInOrOut();
        break;
      case 'KeyV':
        cycleCamera(e.shiftKey ? -1 : 1);
        break;
      case 'KeyH':
        if (hudToggleBtn) hudToggleBtn.click();
        break;
      case 'KeyN':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) audioSystem.setEnabled(!audioSystem.enabled);
        break;
      case 'KeyB':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !mapSystem.isFullMapOpen) audioSystem.honk(controllerManager.getActiveEntity());
        break;
    }
  });

  window.addEventListener('resize', () => {
    placeModeIndicator();
    if (mapSystem.isFullMapOpen) {
      mapSystem.resizeFullCanvas();
      mapSystem.renderFullMap();
    }
  });

  selectMode(controllerManager.activeMode);
  onInput((on) => {
    relabelKeys(on);
    renderControlHints(controllerManager.activeMode, on);
    touchControls.updateAvailability();
    placeModeIndicator();
  });
  selectCamera('chase', true);

  let nowCheckedAt = 0;
  let weatherAskedAt = -Infinity;
  const askWeather = (elapsed) => {
    weatherAskedAt = elapsed;
    fetchWeather().then((w) => {
      lightingSystem.weather = w;
      log(`[weather] ${w.live ? `${CITY_PACK.title} now` : 'offline, so'}: ${w.text}${w.tempF != null ? `, ${w.tempF}\u00b0F` : ''}`);
      if (lightingSystem.activePresetId === 'now') selectTime('now');
    });
    fetchRiverFlow().then((r) => {
      controllerManager.riverScale = r.scale;
      log(`[river] ${r.live ? `${CITY_PACK.title} gauge now: ${Math.round(r.cfs)} cubic feet a second` : 'offline, so its usual flow'}, current x${r.scale.toFixed(2)}`);
    });
  };
  selectTime('now');
  if (document.fonts) document.fonts.ready.then(placeModeIndicator);
  markInit('ui');

  if (elFps) elFps.textContent = '60';

  function updateWeatherAndTime(elapsed) {
    if (lightingSystem.activePresetId === 'now' && elapsed - nowCheckedAt > 60) {
      nowCheckedAt = elapsed;
      selectTime('now');
    }
    if (elapsed - weatherAskedAt > 900) askWeather(elapsed);
  }

  return {
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
  };
}
