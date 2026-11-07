// Multi-city street trees loader (NYT1 / NYT2 binary format, quantized to 0.5 m).
import { hot } from '../lamp-game.js';
import { ACTIVE_CITY_ID, cityAssetPath } from './city-packs.js';

async function fetchTreeBytes() {
  const primary = new URL(`../${cityAssetPath('tree-geodata.bin.gz')}`, import.meta.url);
  try {
    const response = await fetch(primary);
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  } catch { /* city pack not installed yet */ }
  return null;
}

const realTrees = await hot(import.meta).keep(`realTrees-${ACTIVE_CITY_ID}`, async () => {
  const body = await fetchTreeBytes();
  if (!body) return { trees: new Float32Array(0), kinds: new Uint8Array(0), heights: new Float32Array(0) };
  const data = body[0] === 0x1f && body[1] === 0x8b
    ? new Uint8Array(await new Response(new Response(body).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
    : body;
  const invalidData = () => new Error('Invalid tree data.');
  if (data.length < 12) throw invalidData();
  const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = header.getUint32(4, true), zStart = 12 + header.getUint32(8, true);
  const magic = header.getUint32(0, true), v2 = magic === 0x3254594e;
  const zEnd = v2 ? data.length - count * 2 : data.length;
  if ((magic !== 0x3154594e && !v2) || count === 0 ||
    count > zStart - 12 || count > zEnd - zStart) throw invalidData();

  function stream(start, end) {
    let cursor = start;
    return {
      delta() {
        let value = 0, shift = 0, byte;
        do {
          if (cursor >= end || shift >= 28) throw invalidData();
          byte = data[cursor++];
          value |= (byte & 127) << shift;
          shift += 7;
        } while (byte & 128);
        return (value >>> 1) ^ -(value & 1);
      },
      done: () => cursor === end
    };
  }
  const xs = stream(12, zStart), zs = stream(zStart, zEnd);
  const trees = new Float32Array(count * 2);
  let x = 0, z = 0;
  for (let i = 0; i < trees.length; i += 2) {
    x += xs.delta(); z += zs.delta();
    trees[i] = x * 0.5;
    trees[i + 1] = z * 0.5;
  }
  if (!xs.done() || !zs.done()) throw invalidData();
  const kinds = v2 ? data.slice(zEnd, zEnd + count) : new Uint8Array(count).fill(255);
  const heights = new Float32Array(count);
  if (v2) for (let i = 0; i < count; i++) heights[i] = data[zEnd + count + i] * 0.25;
  return { trees, kinds, heights };
}, { from: [cityAssetPath('tree-geodata.bin.gz')] });

export const REAL_TREES = realTrees.trees;
export const REAL_TREE_KINDS = realTrees.kinds;
export const REAL_TREE_HEIGHTS = realTrees.heights;
