import * as THREE from "three";
import { seedUnit, valueNoise1, valueNoise3 } from "./math";

export type FoliageSprite = {
  position: THREE.Vector3;
  width: number;
  height: number;
  variant: number;
  tone: number;
  tilt: number;
};

export type PineGeometry = {
  structure: THREE.BufferGeometry;
  canopy: THREE.BufferGeometry;
  needles: FoliageSprite[];
  washes: FoliageSprite[];
  nodePositions: Record<string, THREE.Vector3>;
};

// How much fish-scale bark each part carries (see createInkTrunkMaterial).
const barkAmount = { trunk: 1, root: 0.8, limb: 0.45, twig: 0.1 };
const barkPlateWidth = 0.34;
const tubeAttributes: [string, number][] = [
  ["position", 3], ["normal", 3], ["uv", 2], ["aWash", 1], ["aRoughness", 1], ["aBark", 1], ["aCellsAround", 1], ["aCellsAlong", 1], ["aFade", 1],
];

type RadiusStop = readonly [number, number];

const trunkRadius: RadiusStop[] = [
  [0, 1.12], [0.12, 1.04], [0.3, 0.86], [0.53, 0.67], [0.72, 0.48], [0.9, 0.25], [1, 0.008],
];
const branchRadius: RadiusStop[] = [[0, 1.15], [0.18, 1], [0.48, 0.72], [0.76, 0.4], [0.94, 0.16], [1, 0.035]];
const twigRadius: RadiusStop[] = [[0, 1.05], [0.24, 0.86], [0.62, 0.55], [0.9, 0.22], [1, 0.04]];
const rootRadius: RadiusStop[] = [[0, 2.25], [0.13, 1.8], [0.4, 1.22], [0.72, 0.58], [0.94, 0.18], [1, 0.025]];

const trunkAnchors = [
  new THREE.Vector3(0.06, 0, 0.02),
  new THREE.Vector3(-0.24, 0.62, 0.16),
  new THREE.Vector3(-0.72, 1.3, -0.16),
  new THREE.Vector3(-1.02, 2.02, -0.3),
  new THREE.Vector3(-0.72, 2.72, -0.12),
  new THREE.Vector3(-0.12, 3.2, 0.22),
  new THREE.Vector3(0.54, 3.76, 0.32),
  new THREE.Vector3(0.52, 4.34, 0.04),
  new THREE.Vector3(-0.18, 4.91, -0.28),
  new THREE.Vector3(-0.68, 5.55, -0.36),
  new THREE.Vector3(-0.1, 6.13, -0.08),
  new THREE.Vector3(0.6, 6.7, 0.32),
  new THREE.Vector3(0.48, 7.36, 0.22),
  new THREE.Vector3(-0.12, 8.02, -0.12),
  new THREE.Vector3(0.03, 8.34, -0.2),
  new THREE.Vector3(0.32, 8.62, -0.18),
  new THREE.Vector3(0.42, 8.96, -0.12),
];

const canopyLimbs = [
  { y: 7.96, side: -1, reach: 2.75, lift: 0.48, bow: 0.12, seed: 1 },
  { y: 7.56, side: 1, reach: 2.7, lift: 0.17, bow: -0.34, seed: 2 },
  { y: 7.02, side: -1, reach: 3.45, lift: 0.42, bow: -0.3, seed: 3 },
  { y: 6.62, side: 1, reach: 3.3, lift: 0.2, bow: -0.42, seed: 4 },
  { y: 5.98, side: -1, reach: 4.08, lift: 0.08, bow: -0.42, seed: 5 },
  { y: 5.58, side: 1, reach: 3.72, lift: 0.26, bow: -0.3, seed: 6 },
  { y: 4.96, side: -1, reach: 2.8, lift: 0.25, bow: -0.08, seed: 7 },
  { y: 5.18, side: 1, reach: 2.45, lift: 0.34, bow: -0.18, seed: 8 },
];

function sampleRadius(t: number, stops: readonly RadiusStop[]) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [fromT, fromRadius] = stops[i];
    const [toT, toRadius] = stops[i + 1];
    if (t <= toT) {
      const linear = THREE.MathUtils.clamp((t - fromT) / (toT - fromT), 0, 1);
      const eased = linear * linear * (3 - 2 * linear);
      return THREE.MathUtils.lerp(fromRadius, toRadius, eased);
    }
  }
  return stops[stops.length - 1][1];
}

function curveThrough(points: THREE.Vector3[]) {
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
}

function makeOrganicTube(
  curve: THREE.CatmullRomCurve3,
  baseRadius: number,
  stops: readonly RadiusStop[],
  radialSegments: number,
  tubularSegments: number,
  seed: number,
  wash: number,
  bark: number,
  // Fraction of the tube's end that fades out, for roots trailing into the soil like a dry brush.
  fadeTail = 0,
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const length = curve.getLength();
  const positions: number[] = [];
  const uvs: number[] = [];
  const washes: number[] = [];
  const roughness: number[] = [];
  const fades: number[] = [];
  const indices: number[] = [];
  const ringSize = radialSegments + 1;
  // Bark plates: a whole number around the branch (so the pattern wraps without a seam), slightly wider than tall.
  const circumference = Math.PI * 2 * baseRadius * sampleRadius(0.3, stops);
  const cellsAround = Math.max(3, Math.round(circumference / barkPlateWidth));
  const cellsAlong = length / ((circumference / cellsAround) * 0.8);

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const along = t * length;
    const center = curve.getPointAt(t);
    // Smooth noise rather than sine terms: periodic ripples read as mechanical rings once shaded.
    center.x += (valueNoise1(seed + 11, along * 0.55) - 0.5) * baseRadius * 0.3;
    center.z += (valueNoise1(seed + 23, along * 0.55) - 0.5) * baseRadius * 0.26;
    const radius = baseRadius * sampleRadius(t, stops);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const burl = valueNoise3(seed, cos * 0.9, sin * 0.9, along * 0.7);
      const knot = valueNoise3(seed + 5, cos * 2.2, sin * 2.2, along * 1.9);
      const irregularity = 1 + (burl - 0.5) * 0.22 + (knot - 0.5) * 0.08;
      const radialX = cos * radius * irregularity;
      const radialY = sin * radius * irregularity;
      positions.push(
        center.x + normal.x * radialX + binormal.x * radialY,
        center.y + normal.y * radialX + binormal.y * radialY,
        center.z + normal.z * radialX + binormal.z * radialY,
      );
      uvs.push(u, t);
      washes.push(wash + (valueNoise1(seed + 31, along * 0.8) - 0.5) * 0.1);
      roughness.push(radius);
      fades.push(fadeTail > 0 ? 1 - THREE.MathUtils.smoothstep(t, 1 - fadeTail, 1) : 1);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = ringSize * i + j;
      const b = ringSize * (i + 1) + j;
      const c = ringSize * (i + 1) + j + 1;
      const d = ringSize * i + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const vertexCount = positions.length / 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aWash", new THREE.Float32BufferAttribute(washes, 1));
  geometry.setAttribute("aRoughness", new THREE.Float32BufferAttribute(roughness, 1));
  geometry.setAttribute("aBark", new THREE.Float32BufferAttribute(new Array(vertexCount).fill(bark), 1));
  geometry.setAttribute("aCellsAround", new THREE.Float32BufferAttribute(new Array(vertexCount).fill(cellsAround), 1));
  geometry.setAttribute("aCellsAlong", new THREE.Float32BufferAttribute(new Array(vertexCount).fill(cellsAlong), 1));
  geometry.setAttribute("aFade", new THREE.Float32BufferAttribute(fades, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergeTubeGeometries(parts: THREE.BufferGeometry[]) {
  const values: Record<string, number[]> = Object.fromEntries(tubeAttributes.map(([name]) => [name, []]));
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const part of parts) {
    const count = part.getAttribute("position").count;
    for (const [name, itemSize] of tubeAttributes) {
      const attribute = part.getAttribute(name);
      const target = values[name];
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < itemSize; k++) target.push(attribute.getComponent(i, k));
      }
    }
    const index = part.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
    }
    vertexOffset += count;
    part.dispose();
  }

  const merged = new THREE.BufferGeometry();
  for (const [name, itemSize] of tubeAttributes) {
    merged.setAttribute(name, new THREE.Float32BufferAttribute(values[name], itemSize));
  }
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

const trunkSpline = curveThrough(trunkAnchors);

function trunkCenterAt(y: number) {
  let previous = trunkSpline.getPointAt(0);
  const samples = 112;
  for (let i = 1; i <= samples; i++) {
    const next = trunkSpline.getPointAt(i / samples);
    if (next.y >= y) {
      const blend = THREE.MathUtils.clamp((y - previous.y) / Math.max(0.0001, next.y - previous.y), 0, 1);
      return previous.clone().lerp(next, blend);
    }
    previous = next;
  }
  return trunkSpline.getPointAt(1);
}

function weatheredCurve(points: THREE.Vector3[], seed: number, amplitude: number) {
  const last = points.length - 1;
  const weathered = points.map((point, index) => {
    if (index === 0 || index === last) return point.clone();
    const amount = amplitude * (0.55 + seedUnit(seed, index * 7 + 2) * 0.9);
    return point.clone().add(new THREE.Vector3(
      (seedUnit(seed, index * 11 + 1) * 2 - 1) * amount,
      (seedUnit(seed, index * 13 + 3) * 2 - 1) * amount * 0.72,
      (seedUnit(seed, index * 17 + 5) * 2 - 1) * amount,
    ));
  });
  return curveThrough(weathered);
}

// Needles are painted as fans in a flat horizontal layer, over a soft grey wash, the way Korean
// ink paintings build a pine pad.
function addNeedlePad(needles: FoliageSprite[], washes: FoliageSprite[], center: THREE.Vector3, span: number, seed: number, density: number) {
  const random = (key: number) => seedUnit(seed, key);
  washes.push({
    position: center.clone().add(new THREE.Vector3((random(1) - 0.5) * span * 0.2, -span * 0.06, -0.04)),
    width: span * (2.1 + random(2) * 0.5),
    height: span * (0.8 + random(3) * 0.25),
    variant: 0,
    tone: 0.5 + random(4) * 0.2,
    tilt: (random(5) - 0.5) * 0.14,
  });
  const fans = Math.max(5, Math.round(density / 2.6));
  for (let fan = 0; fan < fans; fan++) {
    const r = (key: number) => seedUnit(seed * 3 + fan * 17, key);
    const angle = r(1) * Math.PI * 2;
    const radius = Math.sqrt(r(2));
    const upperTier = fan % 3 === 2;
    const size = span * (0.85 + r(3) * 0.4) * (upperTier ? 0.8 : 1);
    const variant = r(4) < 0.16 ? 3 : Math.floor(r(5) * 3);
    needles.push({
      position: center.clone().add(new THREE.Vector3(
        Math.cos(angle) * radius * span * 0.95,
        (upperTier ? span * 0.2 : 0) - span * 0.14 + (r(6) - 0.5) * span * 0.1,
        Math.sin(angle) * radius * span * 0.6,
      )),
      width: variant === 3 ? size * 0.95 : size * 1.3,
      height: variant === 3 ? size * 0.95 : size * 0.68,
      variant,
      tone: 0.72 + r(7) * 0.28,
      tilt: (r(8) - 0.5) * 0.35,
    });
  }
}

// The boulder the pine grows against: a lumpy ellipsoid with a flattened, buried base.
const rockCenter = new THREE.Vector3(0.55, -0.3, -1.05);
const rockScale = new THREE.Vector3(1.7, 1.05, 1.15);

function rockSurfaceY(x: number, z: number) {
  const dx = (x - rockCenter.x) / rockScale.x;
  const dz = (z - rockCenter.z) / rockScale.z;
  const reach = dx * dx + dz * dz;
  return reach < 1 ? rockCenter.y + rockScale.y * Math.sqrt(1 - reach) : -Infinity;
}

function makeRock() {
  const geometry = new THREE.SphereGeometry(1, 48, 28);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump = 1 + (valueNoise3(71, x * 1.3, y * 1.3, z * 1.3) - 0.5) * 0.45 + (valueNoise3(73, x * 3.1, y * 3.1, z * 3.1) - 0.5) * 0.12;
    let py = y * lump;
    if (py < -0.35) py = -0.35 + (py + 0.35) * 0.25;
    position.setXYZ(
      i,
      rockCenter.x + x * lump * rockScale.x,
      rockCenter.y + py * rockScale.y,
      rockCenter.z + z * lump * rockScale.z,
    );
  }
  geometry.computeVertexNormals();
  const count = position.count;
  // aBark of -1 tells the ink material to paint rock texture (axe-cut strokes) instead of pine bark.
  const constant = (value: number) => new THREE.Float32BufferAttribute(new Array(count).fill(value), 1);
  geometry.setAttribute("aWash", constant(0.08));
  geometry.setAttribute("aRoughness", constant(0.18));
  geometry.setAttribute("aBark", constant(-1));
  geometry.setAttribute("aCellsAround", constant(4));
  geometry.setAttribute("aCellsAlong", constant(4));
  geometry.setAttribute("aFade", constant(1));
  return geometry;
}

export function buildPineGeometry() {
  const structureParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];
  const needles: FoliageSprite[] = [];
  const washes: FoliageSprite[] = [];
  const nodePositions: Record<string, THREE.Vector3> = {};
  const canopyNodeBySeed: Record<number, string> = {
    1: "timeslips",
    2: "travel-health",
    3: "neural-vision",
    4: "bytefight",
    5: "jobjoe",
  };
  structureParts.push(makeOrganicTube(trunkSpline, 0.62, trunkRadius, 26, 176, 0.8, 0.12, barkAmount.trunk));
  structureParts.push(makeRock());

  // Two broken branch stubs, a mark of an old pine.
  for (const stub of [{ y: 3.05, side: 1, depth: 0.35, seed: 41 }, { y: 4.55, side: -1, depth: -0.2, seed: 43 }]) {
    const base = trunkCenterAt(stub.y);
    const direction = new THREE.Vector3(stub.side, 0.3, stub.depth).normalize();
    const curve = curveThrough([
      base,
      base.clone().addScaledVector(direction, 0.5),
      base.clone().addScaledVector(direction, 0.95).add(new THREE.Vector3(0, 0.06, 0)),
    ]);
    structureParts.push(makeOrganicTube(curve, 0.13, [[0, 1.3], [0.35, 1], [0.85, 0.82], [1, 0.62]], 10, 14, stub.seed, 0.3, barkAmount.limb));
  }

  // Thick roots grip the rock, then dive into the soil and fade out like a dry brush.
  const roots = [
    { angle: -2.95, reach: 3.6, seed: 1, node: "northbound" },
    { angle: -1.9, reach: 3.0, seed: 2 },
    { angle: -1.05, reach: 3.3, seed: 3 },
    { angle: 0.25, reach: 3.4, seed: 4, node: "katusa" },
    { angle: 2.55, reach: 2.9, seed: 5, node: "georgia-tech" },
  ];
  const rootStart = trunkCenterAt(0.3);
  for (const root of roots) {
    const direction = new THREE.Vector3(Math.cos(root.angle), 0, Math.sin(root.angle));
    const points = [rootStart.clone()];
    for (const fraction of [0.14, 0.32, 0.52, 0.72, 0.88, 1]) {
      const point = rootStart.clone().addScaledVector(direction, root.reach * fraction);
      const ground = fraction < 0.88 ? 0.06 - fraction * 0.12 : -0.35 - (fraction - 0.88) * 2;
      point.y = Math.max(ground, rockSurfaceY(point.x, point.z) + 0.08);
      points.push(point);
    }
    const rootCurve = weatheredCurve(points, root.seed * 3.7, 0.1);
    structureParts.push(makeOrganicTube(rootCurve, 0.22, rootRadius, 16, 72, root.seed, 0.22, barkAmount.root, 0.32));
    if (root.node) {
      const jointT = 0.5;
      const tangent = rootCurve.getTangentAt(jointT).normalize();
      const surfaceNormal = new THREE.Vector3(0, 0.35, 1).addScaledVector(tangent, -tangent.z).normalize();
      nodePositions[root.node] = rootCurve.getPointAt(jointT)
        .addScaledVector(surfaceNormal, 0.22 * sampleRadius(jointT, rootRadius) + 0.055);
    }
    for (const t of [0.45, 0.7]) {
      const joint = rootCurve.getPointAt(t);
      const side = t > 0.6 ? -1 : 1;
      const forkDirection = new THREE.Vector3(-direction.z * side, 0, direction.x * side).addScaledVector(direction, 0.6).normalize();
      const fork = weatheredCurve([
        joint,
        joint.clone().addScaledVector(forkDirection, 0.3).add(new THREE.Vector3(0, -0.04, 0)),
        joint.clone().addScaledVector(forkDirection, 0.62).add(new THREE.Vector3(0, -0.14, 0)),
        joint.clone().addScaledVector(forkDirection, 0.85).add(new THREE.Vector3(0, -0.32, 0)),
      ], root.seed + t * 9, 0.06);
      structureParts.push(makeOrganicTube(fork, 0.085, twigRadius, 9, 26, root.seed + t, 0.3, barkAmount.twig, 0.4));
    }
  }

  // Grass tufts and a band of ground wash around the base.
  for (let tuft = 0; tuft < 12; tuft++) {
    const r = (key: number) => seedUnit(911 + tuft * 13, key);
    const x = -2.8 + r(1) * 6.2;
    if (Math.abs(x - 0.06) < 0.8) continue;
    const size = 0.24 + r(2) * 0.2;
    needles.push({
      position: new THREE.Vector3(x, -0.02, -0.1 + r(3) * 0.9),
      width: size * 1.3,
      height: size * 0.7,
      variant: Math.floor(r(4) * 3),
      tone: 0.42 + r(5) * 0.22,
      tilt: (r(6) - 0.5) * 0.3,
    });
  }
  washes.push(
    { position: new THREE.Vector3(0.4, 0.04, -0.3), width: 6.8, height: 0.7, variant: 0, tone: 0.42, tilt: 0 },
    { position: new THREE.Vector3(1.6, 0.1, -1.4), width: 4.2, height: 0.9, variant: 0, tone: 0.32, tilt: 0.03 },
  );

  // Each bough leaves the trunk with a dip, bends at an elbow and climbs to its pad: the dragon-like
  // gesture of an old pine (용틀임), rather than a smooth arc.
  canopyLimbs.forEach((limb) => {
    const direction = new THREE.Vector3(limb.side, 0, 0);
    const trunkPoint = trunkCenterAt(limb.y);
    const depth = (seedUnit(limb.seed, 1) - 0.5) * 2.4;
    const sway = (seedUnit(limb.seed, 2) - 0.5) * 0.36;
    const droop = 0.25 + seedUnit(limb.seed, 9) * 0.25;
    const primaryCurve = weatheredCurve([
      trunkPoint,
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.16).add(new THREE.Vector3(sway * 0.5, -0.12 - droop * 0.15, depth * 0.3)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.4).add(new THREE.Vector3(-sway * 0.3, -droop, depth * 0.7)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.62).add(new THREE.Vector3(sway * 0.5, limb.lift * 0.5 + 0.05, depth * 0.9)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.82).add(new THREE.Vector3(-sway * 0.4, limb.lift * 0.95 + 0.1, depth * 0.85)),
      trunkPoint.clone().addScaledVector(direction, limb.reach).add(new THREE.Vector3(-sway, limb.lift + 0.08, depth * 0.7)),
    ], limb.seed * 4.1, 0.12);
    const tier = Math.max(0, (8.1 - limb.y) * 0.012);
    const upperBranch = limb.y >= 7.02;
    canopyParts.push(makeOrganicTube(primaryCurve, (upperBranch ? 0.13 : 0.16) - tier, branchRadius, 12, 64, limb.seed, 0.22 + tier, barkAmount.limb));

    const twigLocations = limb.seed % 2 === 0 ? [0.3, 0.55, 0.8] : [0.36, 0.58, 0.74, 0.9];
    for (const [twigIndex, t] of twigLocations.entries()) {
      const base = primaryCurve.getPointAt(t);
      const twigSide = twigIndex % 2 === 0 ? -limb.side : limb.side;
      const twigReach = limb.reach * (0.15 - t * 0.035);
      const twigCurve = weatheredCurve([
        base,
        base.clone().add(new THREE.Vector3(limb.side * twigReach * 0.24, 0.2, twigSide * 0.1)),
        base.clone().add(new THREE.Vector3(limb.side * twigReach * 0.63, 0.38 + limb.lift * 0.16, depth * 0.45 + twigSide * 0.16)),
        base.clone().add(new THREE.Vector3(limb.side * twigReach, 0.32 + limb.lift * 0.2, depth * 0.62 + twigSide * 0.2)),
      ], limb.seed * 7 + twigIndex, 0.085);
      canopyParts.push(makeOrganicTube(twigCurve, upperBranch ? 0.034 : 0.046, twigRadius, 8, 24, limb.seed + twigIndex, 0.34, barkAmount.twig));
      addNeedlePad(needles, washes, twigCurve.getPointAt(1), 0.42 + (twigIndex % 2) * 0.08, limb.seed * 7 + twigIndex, 22);

      const forkBase = twigCurve.getPointAt(0.58);
      const forkCurve = weatheredCurve([
        forkBase,
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.08, 0.16, twigSide * 0.03)),
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.22, 0.29, twigSide * 0.11)),
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.31, 0.34, twigSide * 0.16)),
      ], limb.seed * 13 + twigIndex, 0.07);
      canopyParts.push(makeOrganicTube(forkCurve, upperBranch ? 0.018 : 0.024, twigRadius, 7, 16, limb.seed + twigIndex * 2, 0.4, barkAmount.twig));
      if (twigIndex % 2 === 0) addNeedlePad(needles, washes, forkCurve.getPointAt(1), 0.29, limb.seed * 11 + twigIndex, 14);
    }

    for (const [padIndex, t] of [0.4, 0.68, 0.96].entries()) {
      const upperTerminalPad = upperBranch && padIndex === 2;
      const padSize = padIndex === 2 ? (upperTerminalPad ? 0.42 : 0.64) : 0.43;
      const padCenter = primaryCurve.getPointAt(t);
      const padDensity = upperTerminalPad ? 28 : padIndex === 2 ? 44 : 28;
      addNeedlePad(needles, washes, padCenter, padSize, limb.seed * 17 + padIndex, padDensity);
      const projectNodeId = canopyNodeBySeed[limb.seed];
      if (padIndex === 2 && projectNodeId) nodePositions[projectNodeId] = padCenter.clone();
    }
  });

  return {
    structure: mergeTubeGeometries(structureParts),
    canopy: mergeTubeGeometries(canopyParts),
    needles,
    washes,
    nodePositions,
  };
}
