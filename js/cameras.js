import * as THREE from 'three/webgpu';
import { CITY_PACK } from './city-packs.js';
import { groundHeight, stadiumGround } from './terrain.js';
import { hot, log } from '../lamp-game.js';

// Lamp: the camera systems made, kept through a change of this file (lamp-game.js, "Changes while it's played"), so a
// changed preset is put on the camera in use at once (the end of this file).
const live = hot(import.meta);
const systems = (live.data.systems ??= new Set());

const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Chase, action, cockpit, fixed-location and aerial cameras, with mouse/touch orbit and zoom.
const CAMERA_PRESETS = CITY_PACK.cameraPresets || [
  { id: 'chase',  name: '3rd-Person Chase',       category: 'follow', fov: 56 },
  { id: 'action', name: 'Low-Angle Action',       category: 'follow', fov: 60 },
  { id: 'pov',    name: 'First-Person / Cockpit', category: 'follow', fov: 68 },
  { id: 'drone',  name: 'Auto-Director Aerial',   category: 'scenic', fov: 50 }
];

class CameraSystem {
  static makeCamera() {
    return new THREE.PerspectiveCamera(
      56,
      window.innerWidth / window.innerHeight,
      0.35,
      60000 // at 1:1 the countryside runs out ~20-40 km to the fogged horizon (reversed float depth keeps precision)
    );
  }

  // Lamp: the game's code ran again and this system goes with that run; the camera it drove is kept (main.js).
  release() { systems.delete(this); }

  constructor(domElement, controllerManager, camera = CameraSystem.makeCamera()) {
    systems.add(this);
    this.domElement = domElement;
    this.controllerManager = controllerManager;

    this.camera = camera;

    this.activePresetId = 'chase';
    this.orbitYawOffset = 0.0;
    this.orbitPitchOffset = 0.09;
    this.zoomMultiplier = 1.0;
    this.isDragging = false;
    this.userOrbitTimer = 0;

    this.currentPos = new THREE.Vector3(0, 10, 380);
    this.currentLookAt = new THREE.Vector3(0, 8, 440);
    this.initialized = false;

    // Follow cameras (chase / action) are smoothed relative to the followed entity, see update()
    this.followEntity = null;
    this.followOffset = new THREE.Vector3();
    this.followLookOffset = new THREE.Vector3();
    this.followBaseY = 0;
    this.smoothedSpeed = 0;
    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();

    this.bindPointerControls();
  }

  bindPointerControls() {
    const canvas = this.domElement;
    const pointers = new Map();
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointers.size >= 2) return;
      // Only two touch pointers may share a gesture; mouse and pen drags stay independent.
      if (pointers.size && (e.pointerType !== 'touch' || pointers.values().next().value.type !== 'touch')) return;
      e.preventDefault();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      canvas.setPointerCapture(e.pointerId);
      this.isDragging = true;
      this.userOrbitTimer = 4.0;
    });

    canvas.addEventListener('pointermove', (e) => {
      const pointer = pointers.get(e.pointerId);
      if (!pointer) return;
      e.preventDefault();
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      const pair = pointers.size === 2 ? [...pointers.values()] : null;
      const previousDistance = pair ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
      pointer.x = e.clientX;
      pointer.y = e.clientY;

      if (pair) {
        const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        if (previousDistance > 1 && distance > 1) {
          this.zoomMultiplier = Math.max(0.45, Math.min(2.4, this.zoomMultiplier * previousDistance / distance));
        }
      } else {
        this.orbitYawOffset -= dx * 0.0065;
        this.orbitPitchOffset = Math.max(-0.32, Math.min(0.68, this.orbitPitchOffset + dy * 0.005));
      }
      this.userOrbitTimer = 4.0;
    });

    const releasePointer = (id) => {
      if (!pointers.delete(id)) return;
      this.isDragging = pointers.size > 0;
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, (e) => releasePointer(e.pointerId));
    }
    const clearPointers = () => {
      for (const id of pointers.keys()) releasePointer(id);
    };
    this._clearPointers = clearPointers;
    window.addEventListener('blur', clearPointers);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearPointers();
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomMultiplier = Math.max(0.45, Math.min(2.4, this.zoomMultiplier + e.deltaY * 0.001));
    }, { passive: false });
  }

  setCameraPreset(presetId, snapImmediately = false) {
    const preset = CAMERA_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    this.activePresetId = preset.id;
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    if (snapImmediately) {
      this.initialized = false;
    }
  }

  applyGamepadInput(lookX, lookY, zoom, dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    if (this.activePresetId !== 'chase' && this.activePresetId !== 'pov') return;
    // POV uses the orbit angles, but only chase renders a zoomed camera distance.
    if (this.activePresetId !== 'chase') zoom = 0;
    if (!lookX && !lookY && !zoom) return;
    this.orbitYawOffset -= lookX * 2.0 * dt;
    this.orbitPitchOffset = Math.max(-0.32, Math.min(0.68, this.orbitPitchOffset + lookY * 1.25 * dt));
    this.zoomMultiplier = Math.max(0.45, Math.min(2.4, this.zoomMultiplier + zoom * 0.9 * dt));
    this.userOrbitTimer = 4.0;
  }

  resetOrbit() {
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0.09;
    this.zoomMultiplier = 1;
    this.userOrbitTimer = 0;
  }

  resetForTeleport() {
    // Arrive with a fresh chase view, without carrying a previous drive or gesture into the destination.
    this._clearPointers();
    this.isDragging = false;
    this.resetOrbit();
    this.smoothedSpeed = 0;
    this.followEntity = null;
    this.followOffset.set(0, 0, 0);
    this.followLookOffset.set(0, 0, 0);
    this.followBaseY = 0;
    this.setCameraPreset('chase', true);
  }

  // A real jump in the car cuts to a camera set down low beside where it will come down, which turns to follow it
  // through the air and holds a moment after it lands, then the chase or action view glides back.
  updateJumpCam(entity, dt) {
    const followView = this.activePresetId === 'chase' || this.activePresetId === 'action';
    let jc = this.jumpCam;
    if (jc && (entity !== jc.entity || !followView)) return this.endJumpCam(), false;
    if (!jc) {
      if (entity.type !== 'car' || !entity.airborne) { this._jumpLooked = false; return false; }
      if (!followView || this._jumpLooked || (entity.flightTime || 0) < 0.3) return false;
      this._jumpLooked = true;
      const surface = (x, z) => this.controllerManager.getGroundHeight?.(x, z, 'car') ?? groundHeight(x, z);
      const p = entity.position, vy = entity.vy || 0;
      const h = Math.max(0, p.y - surface(p.x, p.z));
      const tLeft = (vy + Math.sqrt(vy * vy + 19.6 * h)) / 9.8;
      const sn = Math.sin(entity.heading), cs = Math.cos(entity.heading);
      const vx = sn * entity.speed + (entity.vx || 0), vz = cs * entity.speed + (entity.vz || 0);
      if (tLeft < 1.1 || Math.hypot(vx, vz) < 8) return false;
      const ax = p.x + vx * tLeft * 0.62, az = p.z + vz * tLeft * 0.62;
      const hv = Math.hypot(vx, vz), sx = vz / hv, sz = -vx / hv;
      const side = Math.min(16, 8 + hv * 0.25);
      const blocked = (x, z) => {
        let n = 0;
        for (const k of this.controllerManager.nearColliders(x, z, side)) {
          if (!k.thin) {
            if (x > k.minX && x < k.maxX && z > k.minZ && z < k.maxZ) n += 10;
            continue;
          }
          const kx = (k.minX + k.maxX) / 2, kz = (k.minZ + k.maxZ) / 2;
          const t = clamp01(((kx - x) * (ax - x) + (kz - z) * (az - z)) / (side * side));
          if (Math.hypot(x + (ax - x) * t - kx, z + (az - z) * t - kz) < 1.6) n++;
        }
        return n;
      };
      let best = null;
      for (const s of [1, -1]) {
        for (const back of [0, 0.35, -0.3]) {
          const x = ax + sx * side * s - (vx / hv) * side * back, z = az + sz * side * s - (vz / hv) * side * back;
          const n = blocked(x, z) + Math.abs(back) * 0.5;
          if (!best || n < best.n) best = { x, z, n };
        }
      }
      const cx = best.x, cz = best.z;
      const landY = surface(p.x + vx * tLeft, p.z + vz * tLeft);
      const camY = Math.max(surface(cx, cz) + (best.n >= 1 ? 3.2 : 1.1), Math.min(p.y, landY) + 1.4);
      jc = this.jumpCam = { entity, after: 0, pos: new THREE.Vector3(cx, camY, cz) };
      this.currentPos.copy(jc.pos);
      this.currentLookAt.set(p.x, p.y + 0.6, p.z);
      this.camera.fov = 40;
      this.camera.updateProjectionMatrix();
      log(`[jump cam] cut to the side for about ${tLeft.toFixed(1)} s in the air`);
    }
    if (!entity.airborne) jc.after += dt;
    if (jc.after > 0.8) return this.endJumpCam(), false;
    const p = entity.position;
    this.currentPos.copy(jc.pos);
    this._desiredLook.set(p.x, p.y + 0.6, p.z);
    this.currentLookAt.lerp(this._desiredLook, 1 - Math.exp(-dt * 9));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
    return true;
  }

  endJumpCam() {
    this.jumpCam = null;
    this.followEntity = null;
    this.setCameraPreset(this.activePresetId);
  }

  getActivePreset() {
    return CAMERA_PRESETS.find((p) => p.id === this.activePresetId) || CAMERA_PRESETS[0];
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, elapsed) {
    const entity = this.controllerManager.getActiveEntity();
    const desiredPos = this._desiredPos;
    const desiredLook = this._desiredLook;

    if (this.userOrbitTimer > 0 && !this.isDragging) {
      this.userOrbitTimer = Math.max(0, this.userOrbitTimer - dt);
    }

    if (!this.isDragging && this.userOrbitTimer <= 0 && Math.abs(entity.speed) > 0.5) {
      this.orbitYawOffset -= Math.round(this.orbitYawOffset / (Math.PI * 2)) * (Math.PI * 2);
      this.orbitYawOffset += (0.0 - this.orbitYawOffset) * (1 - Math.exp(-dt * 2.2));
    }

    this.smoothedSpeed += (Math.abs(entity.speed) - this.smoothedSpeed) * (1 - Math.exp(-dt * 3.0));
    const speedLag = this.smoothedSpeed * 0.1;

    const totalYaw = entity.heading + this.orbitYawOffset;

    if (this.updateJumpCam(entity, dt)) return;

    switch (this.activePresetId) {
      case 'chase': {
        const dist = entity.chaseDistance * this.zoomMultiplier * (1 + Math.min(0.25, this.smoothedSpeed * 0.01));
        const height = entity.chaseHeight * this.zoomMultiplier + Math.sin(this.orbitPitchOffset) * dist * 0.85;
        const horizDist = Math.cos(this.orbitPitchOffset) * dist + speedLag;

        desiredPos.set(
          entity.position.x - Math.sin(totalYaw) * horizDist,
          Math.max(groundHeight(entity.position.x - Math.sin(totalYaw) * horizDist, entity.position.z - Math.cos(totalYaw) * horizDist) + 0.65, entity.position.y + height),
          entity.position.z - Math.cos(totalYaw) * horizDist
        );

        const lookUpBias = entity.type === 'helicopter' ? 0.2 : (entity.type === 'car' ? 0.52 : 1.55);
        desiredLook.set(
          entity.position.x + Math.sin(entity.heading) * 5.2,
          entity.position.y + entity.cameraTargetOffset.y + lookUpBias,
          entity.position.z + Math.cos(entity.heading) * 5.2
        );
        break;
      }

      case 'action': {
        const sideOffset = entity.type === 'car' ? 2.65 : (entity.type === 'helicopter' ? 4.2 : 0.95);
        const backDist = (entity.type === 'car' ? 3.6 : (entity.type === 'helicopter' ? 8.5 : 2.8)) + speedLag;
        const lowY = entity.type === 'helicopter' ? entity.position.y + 1.2 : entity.position.y + 0.92;

        desiredPos.set(
          entity.position.x - Math.sin(entity.heading) * backDist + Math.cos(entity.heading) * sideOffset,
          Math.max(groundHeight(entity.position.x, entity.position.z) + 0.55, lowY),
          entity.position.z - Math.cos(entity.heading) * backDist - Math.sin(entity.heading) * sideOffset
        );
        desiredLook.set(
          entity.position.x + Math.sin(entity.heading) * 3.2,
          entity.position.y + 1.05,
          entity.position.z + Math.cos(entity.heading) * 3.2
        );
        break;
      }

      case 'pov': {
        let fwdOffset = 0.35;
        let eyeY = 1.68;
        if (entity.type === 'car') {
          fwdOffset = 0.55;
          eyeY = 1.52;
        } else if (entity.type === 'cyclist') {
          fwdOffset = 0.35;
          eyeY = 1.55;
        } else if (entity.type === 'helicopter') {
          fwdOffset = 1.65;
          eyeY = 1.65;
        } else if (entity.type === 'kayak') {
          fwdOffset = -0.05;
          eyeY = 0.98;
        }

        desiredPos.set(
          entity.position.x + Math.sin(entity.heading) * fwdOffset,
          entity.position.y + eyeY,
          entity.position.z + Math.cos(entity.heading) * fwdOffset
        );
        desiredLook.set(
          entity.position.x + Math.sin(totalYaw) * 40.0,
          entity.position.y + eyeY + Math.sin(-this.orbitPitchOffset) * 18.0 + 1.5,
          entity.position.z + Math.cos(totalYaw) * 40.0
        );
        break;
      }

      case 'drone': {
        const angle = elapsed * 0.07 + 0.65;
        const radius = 720.0 + Math.sin(elapsed * 0.23) * 140.0;
        const alt = 280.0 + Math.cos(elapsed * 0.19) * 60.0;
        const cx = CITY_PACK.defaultSpawn?.x || 0;
        const cz = CITY_PACK.defaultSpawn?.z || 0;
        const g = groundHeight(cx, cz);
        desiredPos.set(
          Math.cos(angle) * radius + cx,
          g + alt,
          Math.sin(angle) * radius + cz
        );
        desiredLook.set(cx, g + 35.0, cz);
        break;
      }

      default: {
        const sc = CITY_PACK.scenicCameras?.[this.activePresetId];
        if (sc) {
          const freq = sc.freq || 0.14;
          const s = Math.sin(elapsed * freq);
          const c = Math.cos(elapsed * freq * 0.85);
          const ap = sc.ampPos || [0, 0, 0];
          const al = sc.ampLook || [0, 0, 0];
          desiredPos.set(sc.pos[0] + s * ap[0], sc.pos[1] + c * ap[1], sc.pos[2] + c * ap[2]);
          desiredLook.set(sc.look[0] + s * al[0], sc.look[1] + c * al[1], sc.look[2] + c * al[2]);
          if (!sc.absoluteY) {
            const g = this.activePresetId === 'bigHouse' ? stadiumGround() : groundHeight(desiredPos.x, desiredPos.z);
            desiredPos.y += g;
            desiredLook.y += g;
          }
        }
        break;
      }
    }

    if (!this.initialized || this.activePresetId === 'pov') {
      this.currentPos.copy(desiredPos);
      this.currentLookAt.copy(desiredLook);
      this.initialized = true;
      this.followEntity = null;
    } else if (this.activePresetId === 'chase' || this.activePresetId === 'action') {
      if (this.followEntity !== entity) {
        this.followEntity = entity;
        this.followBaseY = entity.position.y;
        this.followOffset.subVectors(this.currentPos, entity.position);
        this.followLookOffset.subVectors(this.currentLookAt, entity.position);
      }
      const k = 1 - Math.exp(-dt * 8.5);
      this.followBaseY += (entity.position.y - this.followBaseY) * k;
      this.followOffset.lerp(desiredPos.sub(entity.position), k);
      this.followLookOffset.lerp(desiredLook.sub(entity.position), k);
      this.currentPos.set(entity.position.x, this.followBaseY, entity.position.z).add(this.followOffset);
      this.currentLookAt.set(entity.position.x, this.followBaseY, entity.position.z).add(this.followLookOffset);
      this.currentPos.y = Math.max(groundHeight(this.currentPos.x, this.currentPos.z) + 0.55, this.currentPos.y);
    } else {
      this.followEntity = null;
      const k = 1 - Math.exp(-dt * 8.5);
      this.currentPos.lerp(desiredPos, k);
      this.currentLookAt.lerp(desiredLook, k);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }
}

live.accept((next, { changed }) => {
  if (changed.includes('CameraSystem.makeCamera')) return false;
  if (changed.some((name) => /\.bindPointerControls$/.test(name))) return false;
  for (const system of systems) system.setCameraPreset(system.activePresetId);
});

export { CAMERA_PRESETS, CameraSystem };
