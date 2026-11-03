import { CITY_PACK } from './city-packs.js';

// Live USGS stream gauge flow for the active city (waterservices.usgs.gov),
// asked for when the city opens and every 15 minutes.

const SITE = CITY_PACK.riverGaugeSite || '04166500';
const USUAL_CFS = CITY_PACK.usualCfs || 120; // typical flow scale in cubic feet a second
const USUAL = { cfs: USUAL_CFS, scale: 1, live: false };

// How much faster than usual the water moves for a flow: velocity grows about as the 0.4 power of discharge
function currentScale(cfs) {
  return Math.min(2.4, Math.max(0.45, (cfs / USUAL_CFS) ** 0.4));
}

async function fetchRiverFlow() {
  try {
    const safeSite = encodeURIComponent(String(SITE).trim());
    const res = await fetch(`https://waterservices.usgs.gov/nwis/iv/?sites=${safeSite}&format=json&parameterCd=00060`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return USUAL;
    const series = (await res.json())?.value?.timeSeries?.[0];
    const values = series?.values?.[0]?.value || [];
    const cfs = Number(values[values.length - 1]?.value);
    if (!Number.isFinite(cfs) || cfs < 0) return USUAL;
    return { cfs, scale: currentScale(cfs), live: true };
  } catch {
    return USUAL;
  }
}

export { fetchRiverFlow, USUAL as USUAL_RIVER_FLOW };
