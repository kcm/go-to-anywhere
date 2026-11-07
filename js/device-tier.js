// How much of the city a device is given. The whole city laid on its hills holds about 3 GB, which a Mac with memory to
// spare draws as it is ('full'). A phone or tablet's browser is ended by the system well before that, so there
// ('phone') only the ground and the houses around the player are built, and filled in as they move (terrain.js,
// buildings.js: `STREAM`), with the far trees, houses and street details cut, no shadows or glow, a smaller drawing and
// fewer cars and people. A Mac with 16 GB or less ('light') streams the same way over a wider area and keeps the look.
// `?tier=phone`, `?tier=light` or `?tier=full` in the page's address chooses one, to try it.
import { log } from '../lamp-game.js';

const TIERS = {
  // All-out showcase: full un-streamed city, 1536px shadow cascades, half-res SSR reflections, 11-pass HDR bloom & MSAA
  insanity: { name: 'insanity', stream: 0, shadows: true, bloom: true, reflections: true, antialias: true, scale: 1, traffic: 1, people: 1, farCut: 1, outskirts: true },
  // Whole city in memory at 1080p with 2-cascade sun shadows in a single direct swapchain pass (no offscreen bloom/SSR passes)
  full: { name: 'full', stream: 0, shadows: true, bloom: false, reflections: false, antialias: true, scale: 1, traffic: 1, people: 1, farCut: 1, outskirts: true },
  // the ground and houses within 950 m built, the rest as the player comes near; no shadow cascades, MSAA or bloom offscreen passes to save GPU & battery
  light: { name: 'light', stream: 950, shadows: false, bloom: false, reflections: false, antialias: false, scale: 0.75, traffic: 0.75, people: 0.75, farCut: 0.75, outskirts: true },
  // within about 1 km; trees, houses and street details drawn half as far; 1344x756; half the cars, a third of the people
  phone: { name: 'phone', stream: 1000, shadows: false, bloom: false, reflections: false, antialias: false, scale: 0.7, traffic: 0.5, people: 0.35, farCut: 0.5, outskirts: true }
};

const TIER_ALIASES = {
  insanity: 'insanity',
  insane: 'insanity',
  ultra: 'insanity',
  full: 'full',
  light: 'light',
  lite: 'light',
  phone: 'phone'
};

// A phone or a tablet: an iPad says it's a Mac, but has a touch screen
export const TOUCH_DEVICE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
export const FIREFOX = /Firefox\//i.test(navigator.userAgent);

// The tier in use, chosen as this module loads (before anything that imports it builds the city): read by everything
// that builds it, at the top of its module too
export const TIER = { ...TIERS.full };

export function switchTier(targetTier) {
  const raw = String(targetTier || '').trim().toLowerCase();
  const tierKey = TIER_ALIASES[raw] || 'light';
  const urlVal = tierKey === 'light' ? 'lite' : tierKey;
  try {
    localStorage.setItem('gta-tier', tierKey);
  } catch {
    // Ignore storage access errors
  }
  if (typeof globalThis.location !== 'undefined') {
    const url = new URL(globalThis.location.href);
    url.searchParams.set('tier', urlVal);
    globalThis.location.href = url.toString();
  }
}

async function chooseTier() {
  let name = TOUCH_DEVICE ? 'phone' : 'light';
  let memory = null;
  // the app on a Mac knows how much memory it has; a standalone browser defaults to 'light' (full visuals, 1.8 km streaming)
  if (!TOUCH_DEVICE && window.LampNative?.available) {
    memory = await window.LampNative.call('memory').catch(() => null);
    name = (typeof memory === 'number' && memory > 17) ? 'full' : 'light';
  }
  let saved = null;
  try {
    saved = TIER_ALIASES[String(localStorage.getItem('gta-tier') || '').trim().toLowerCase()] || null;
  } catch {
    saved = null;
  }
  const rawAsked = new URLSearchParams(location.search).get('tier');
  const asked = TIER_ALIASES[String(rawAsked || '').trim().toLowerCase()] || null;
  if (asked) {
    name = asked;
    try {
      localStorage.setItem('gta-tier', asked);
    } catch {
      // Ignore storage access errors
    }
  } else if (saved) {
    name = saved;
  }
  Object.assign(TIER, TIERS[name]);
  // Firefox's macOS WebGL2 backend stalls heavily on 4x MSAA RGBA16F offscreen blits
  if (FIREFOX) {
    TIER.antialias = false;
    if (name !== 'full' && name !== 'insanity') {
      Object.assign(TIER, { bloom: false, reflections: false, scale: Math.min(TIER.scale, 0.75), farCut: Math.min(TIER.farCut, 0.65) });
    }
  }
  log(`[tier] ${name}${memory ? ` (${Math.round(memory)} GB)` : ''}${TOUCH_DEVICE ? ', a touch device' : ''}${FIREFOX ? ', firefox' : ''}`);
  return TIER;
}
await chooseTier();
