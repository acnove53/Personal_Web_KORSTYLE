import * as THREE from "three";

export function seedUnit(seed: number, index: number) {
  const value = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function hash3(seed: number, x: number, y: number, z: number) {
  return seedUnit(seed + x * 0.317 + y * 1.913, z * 7.129 + x * 3.71 + y * 0.53);
}

// Smooth value noise in 0..1, used for organic, non-repeating variation in generated geometry.
export function valueNoise3(seed: number, x: number, y: number, z: number) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const cz = Math.floor(z);
  const fx = x - cx;
  const fy = y - cy;
  const fz = z - cz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const lerp = THREE.MathUtils.lerp;
  const layer = (z0: number) => lerp(
    lerp(hash3(seed, cx, cy, z0), hash3(seed, cx + 1, cy, z0), ux),
    lerp(hash3(seed, cx, cy + 1, z0), hash3(seed, cx + 1, cy + 1, z0), ux),
    uy,
  );
  return lerp(layer(cz), layer(cz + 1), uz);
}

export function valueNoise1(seed: number, x: number) {
  return valueNoise3(seed, x, 0.5, 0.5);
}

export function smoothStep(edge0: number, edge1: number, value: number) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}
