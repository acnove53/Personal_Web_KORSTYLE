import * as THREE from "three";
import { seedUnit, smoothStep } from "./math";

export type BrushStroke = {
  position: THREE.Vector3;
  width: number;
  height: number;
  rotation: number;
};

export type PineGeometry = {
  structure: THREE.BufferGeometry;
  canopy: THREE.BufferGeometry;
  foliage: BrushStroke[];
  nodePositions: Record<string, THREE.Vector3>;
};

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
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const washes: number[] = [];
  const roughness: number[] = [];
  const indices: number[] = [];
  const ringSize = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const pathWobble = Math.sin(t * 19 + seed * 1.7) * Math.sin(t * 7.4 + seed * 0.61);
    center.x += pathWobble * baseRadius * 0.15;
    center.z += Math.cos(t * 16 + seed * 0.9) * Math.sin(t * 5.2 + seed) * baseRadius * 0.13;
    const radius = baseRadius * sampleRadius(t, stops);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;
      const roughBark = Math.sin(angle * 5 + t * 18 + seed * 0.6) * Math.sin(t * 13 + seed);
      const irregularity = 1
        + 0.09 * Math.sin(angle * 3 + seed) * Math.sin(t * 9 + seed * 0.7)
        + 0.052 * Math.sin(angle * 7 + t * 28 + seed * 1.4)
        + 0.038 * Math.sin(angle * 2 + t * 17 + seed * 0.42)
        + roughBark * 0.055;
      const radialX = Math.cos(angle) * radius * irregularity;
      const radialY = Math.sin(angle) * radius * irregularity;
      positions.push(
        center.x + normal.x * radialX + binormal.x * radialY,
        center.y + normal.y * radialX + binormal.y * radialY,
        center.z + normal.z * radialX + binormal.z * radialY,
      );
      uvs.push(u, t);
      washes.push(wash + 0.07 * Math.sin(t * 14 + seed) + 0.035 * Math.cos(angle * 4 + seed));
      roughness.push(radius);
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aWash", new THREE.Float32BufferAttribute(washes, 1));
  geometry.setAttribute("aRoughness", new THREE.Float32BufferAttribute(roughness, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergeTubeGeometries(parts: THREE.BufferGeometry[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const washes: number[] = [];
  const roughness: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const part of parts) {
    const position = part.getAttribute("position");
    const normal = part.getAttribute("normal");
    const uv = part.getAttribute("uv");
    const wash = part.getAttribute("aWash");
    const rough = part.getAttribute("aRoughness");
    const index = part.getIndex();
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
      washes.push(wash.getX(i));
      roughness.push(rough.getX(i));
    }
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
    }
    vertexOffset += position.count;
    part.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute("aWash", new THREE.Float32BufferAttribute(washes, 1));
  merged.setAttribute("aRoughness", new THREE.Float32BufferAttribute(roughness, 1));
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

export function createBrushAlphaTexture() {
  const width = 128;
  const height = 256;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const taper = Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.66);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const grain = seedUnit(x * 0.37 + 1.2, y * 0.23 + 4.8);
      const drift = 0.035 * Math.sin(v * 18) + 0.018 * Math.sin(v * 47 + grain * 4);
      const halfWidth = taper * (0.24 + 0.035 * Math.sin(v * 23 + 0.7));
      const edgeDistance = Math.abs(u - (0.5 + drift));
      let alpha = 1 - smoothStep(halfWidth - 0.015, halfWidth + 0.025, edgeDistance);
      const bristle = Math.sin(u * 104 + v * 5 + grain * 3) * 0.5 + 0.5;
      const dryGap = smoothStep(0.91, 0.99, bristle) * smoothStep(0.08, 0.24, taper);
      alpha *= (0.56 + grain * 0.44) * (1 - dryGap * 0.76);
      const index = (y * width + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(THREE.MathUtils.clamp(alpha, 0, 1) * 255);
    }
  }

  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addBrushCluster(target: BrushStroke[], center: THREE.Vector3, span: number, seed: number, density: number) {
  const lobes = [
    new THREE.Vector3(-0.31, 0.02, 0.08),
    new THREE.Vector3(0.2, 0.12, -0.13),
    new THREE.Vector3(0.03, -0.08, 0.25),
    new THREE.Vector3(0.38, -0.04, 0.15),
    new THREE.Vector3(-0.12, 0.16, -0.22),
  ];
  for (let i = 0; i < density; i++) {
    const lobeIndex = Math.floor(seedUnit(seed, i * 3 + 6) * lobes.length);
    const lobe = lobes[lobeIndex];
    const angle = seedUnit(seed, i * 5 + 2) * Math.PI * 2 + seed * 0.29;
    const ring = (seedUnit(seed, i * 7 + 4) + seedUnit(seed, i * 9 + 1) + seedUnit(seed, i * 11 + 3)) / 3;
    const heightNoise = seedUnit(seed, i * 13 + 8);
    const height = span * (0.48 + heightNoise * 0.76);
    const width = height * (0.085 + seedUnit(seed, i * 17 + 5) * 0.15);
    const spread = span * (0.19 + ring * 0.36);
    const position = center.clone()
      .addScaledVector(lobe, span * (0.45 + seedUnit(seed, i * 19 + 2) * 0.45))
      .add(new THREE.Vector3(
        Math.cos(angle) * spread * 0.52,
        Math.sin(angle) * spread * 0.19 + height * (0.06 + heightNoise * 0.16),
        Math.sin(angle) * spread * 0.46 + (seedUnit(seed, i * 23 + 4) - 0.5) * span * 0.34,
      ));
    target.push({
      position,
      width,
      height,
      rotation: angle + Math.PI * 0.5 + (seedUnit(seed, i * 29 + 7) - 0.5) * 0.95,
    });
  }
}

function makeBarkRidges() {
  const segments = 144;
  const frames = trunkSpline.computeFrenetFrames(segments, false);
  const strokes = [
    { start: 0.06, end: 0.3, angle: -0.95, seed: 1, width: 0.019 },
    { start: 0.12, end: 0.42, angle: -0.42, seed: 2, width: 0.026 },
    { start: 0.04, end: 0.25, angle: 0.28, seed: 3, width: 0.014 },
    { start: 0.21, end: 0.49, angle: -1.05, seed: 4, width: 0.022 },
    { start: 0.29, end: 0.58, angle: -0.48, seed: 5, width: 0.017 },
    { start: 0.35, end: 0.61, angle: 0.16, seed: 6, width: 0.024 },
    { start: 0.47, end: 0.72, angle: -0.88, seed: 7, width: 0.016 },
    { start: 0.53, end: 0.78, angle: -0.35, seed: 8, width: 0.025 },
    { start: 0.62, end: 0.84, angle: 0.34, seed: 9, width: 0.016 },
    { start: 0.73, end: 0.96, angle: -0.72, seed: 10, width: 0.018 },
    { start: 0.81, end: 0.99, angle: -0.2, seed: 11, width: 0.013 },
    { start: 0.08, end: 0.24, angle: 0.68, seed: 12, width: 0.03 },
    { start: 0.17, end: 0.36, angle: 1.12, seed: 13, width: 0.034 },
    { start: 0.27, end: 0.46, angle: -0.08, seed: 14, width: 0.028 },
    { start: 0.37, end: 0.56, angle: 0.52, seed: 15, width: 0.032 },
    { start: 0.48, end: 0.68, angle: 0.71, seed: 16, width: 0.035 },
    { start: 0.59, end: 0.77, angle: 0.18, seed: 17, width: 0.03 },
    { start: 0.69, end: 0.88, angle: 0.96, seed: 18, width: 0.032 },
    { start: 0.83, end: 0.98, angle: 0.42, seed: 19, width: 0.028 },
  ];
  const ridges: THREE.BufferGeometry[] = [];

  for (const stroke of strokes) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 7; i++) {
      const along = i / 7;
      const t = THREE.MathUtils.lerp(stroke.start, stroke.end, along);
      const frameIndex = Math.min(segments, Math.round(t * segments));
      const normal = frames.normals[frameIndex];
      const binormal = frames.binormals[frameIndex];
      const frontFacingAngle = Math.atan2(binormal.z, normal.z);
      const angle = frontFacingAngle + stroke.angle + Math.sin(along * 8 + stroke.seed) * 0.12;
      const radial = normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle)).normalize();
      const surfaceRadius = 0.72 * sampleRadius(t, trunkRadius);
      points.push(trunkSpline.getPointAt(t).addScaledVector(radial, surfaceRadius * 1.075 + 0.012));
    }
    const curve = curveThrough(points);
    ridges.push(makeOrganicTube(
      curve,
      stroke.width,
      [[0, 0.08], [0.18, 0.75], [0.55, 1], [0.84, 0.62], [1, 0.04]],
      6,
      30,
      stroke.seed * 1.73,
      0.28 + (stroke.seed % 3) * 0.07,
    ));
  }
  return ridges;
}

export function buildPineGeometry() {
  const structureParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];
  const foliageStrokes: BrushStroke[] = [];
  const nodePositions: Record<string, THREE.Vector3> = {};
  const rootNodeBySeed: Record<number, string> = { 1: "northbound", 5: "katusa", 8: "georgia-tech" };
  const canopyNodeBySeed: Record<number, string> = {
    1: "timeslips",
    2: "travel-health",
    3: "neural-vision",
    4: "bytefight",
    5: "jobjoe",
  };
  structureParts.push(makeOrganicTube(trunkSpline, 0.72, trunkRadius, 26, 176, 0.8, 0.12));
  structureParts.push(...makeBarkRidges());

  // Nebari roots flare from the trunk and travel visibly across the ground plane.
  const rootArms = [
    { angle: -3.1, reach: 3.8, lift: -0.31, seed: 1 },
    { angle: -2.4, reach: 2.65, lift: -0.19, seed: 2 },
    { angle: -1.25, reach: 3.25, lift: -0.36, seed: 3 },
    { angle: -0.15, reach: 2.52, lift: -0.2, seed: 4 },
    { angle: 0.35, reach: 3.55, lift: -0.3, seed: 5 },
    { angle: 0.95, reach: 2.28, lift: -0.16, seed: 6 },
    { angle: 1.75, reach: 3.12, lift: -0.34, seed: 7 },
    { angle: 2.75, reach: 2.72, lift: -0.23, seed: 8 },
  ];
  for (const root of rootArms) {
    const direction = new THREE.Vector3(Math.cos(root.angle), 0, Math.sin(root.angle)).normalize();
    const start = trunkCenterAt(0.16);
    const rootCurve = weatheredCurve([
      start.clone(),
      start.clone().addScaledVector(direction, root.reach * 0.18).add(new THREE.Vector3(0, 0.1, 0)),
      start.clone().addScaledVector(direction, root.reach * 0.46).add(new THREE.Vector3(-direction.z * 0.12, 0.025, direction.x * 0.12)),
      start.clone().addScaledVector(direction, root.reach * 0.74).add(new THREE.Vector3(direction.z * 0.13, root.lift * 0.42, -direction.x * 0.13)),
      start.clone().addScaledVector(direction, root.reach).add(new THREE.Vector3(0, root.lift, 0)),
    ], root.seed * 3.7, 0.13);
    structureParts.push(makeOrganicTube(rootCurve, 0.29, rootRadius, 16, 68, root.seed, 0.25));
    const rootNodeId = rootNodeBySeed[root.seed];
    if (rootNodeId) {
      const jointT = 0.68;
      const tangent = rootCurve.getTangentAt(jointT).normalize();
      const surfaceNormal = new THREE.Vector3(0, 0, 1)
        .addScaledVector(tangent, -tangent.z)
        .normalize();
      const surfaceRadius = 0.29 * sampleRadius(jointT, rootRadius);
      nodePositions[rootNodeId] = rootCurve.getPointAt(jointT)
        .addScaledVector(surfaceNormal, surfaceRadius + 0.055);
    }

    for (const t of [0.42, 0.68, 0.86]) {
      const joint = rootCurve.getPointAt(t);
      const forkSide = t > 0.6 ? -1 : 1;
      const forkDirection = new THREE.Vector3(-direction.z * forkSide, 0, direction.x * forkSide);
      const fork = weatheredCurve([
        joint,
        joint.clone().addScaledVector(forkDirection, 0.2).add(new THREE.Vector3(0, -0.035, 0)),
        joint.clone().addScaledVector(forkDirection, 0.46).add(new THREE.Vector3(0, -0.1, 0)),
        joint.clone().addScaledVector(forkDirection, 0.66).add(new THREE.Vector3(0, -0.17, 0)),
      ], root.seed + t * 9, 0.075);
      structureParts.push(makeOrganicTube(fork, 0.075, twigRadius, 9, 26, root.seed + t, 0.34));
    }
  }

  // Each hand-shaped bough reaches sideways and lifts into a distinct pine pad.
  canopyLimbs.forEach((limb) => {
    const direction = new THREE.Vector3(limb.side, 0, 0);
    const trunkPoint = trunkCenterAt(limb.y);
    const depth = (seedUnit(limb.seed, 1) - 0.5) * 2.4;
    const sway = (seedUnit(limb.seed, 2) - 0.5) * 0.36;
    const primaryCurve = weatheredCurve([
      trunkPoint,
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.2).add(new THREE.Vector3(sway, 0.38 + limb.lift * 0.2, depth * 0.38)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.48).add(new THREE.Vector3(-sway * 0.4, limb.lift + limb.bow, depth * 0.82)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.76).add(new THREE.Vector3(sway * 0.7, limb.lift + limb.bow * 0.55, depth)),
      trunkPoint.clone().addScaledVector(direction, limb.reach).add(new THREE.Vector3(-sway, limb.lift, depth * 0.7)),
    ], limb.seed * 4.1, 0.16);
    const tier = Math.max(0, (8.1 - limb.y) * 0.012);
    const upperBranch = limb.y >= 7.02;
    canopyParts.push(makeOrganicTube(primaryCurve, (upperBranch ? 0.13 : 0.16) - tier, branchRadius, 12, 56, limb.seed, 0.22 + tier));

    const twigLocations = limb.seed % 2 === 0 ? [0.29, 0.53, 0.83] : [0.38, 0.56, 0.72, 0.91];
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
      canopyParts.push(makeOrganicTube(twigCurve, upperBranch ? 0.034 : 0.046, twigRadius, 8, 24, limb.seed + twigIndex, 0.34));
      addBrushCluster(foliageStrokes, twigCurve.getPointAt(1), 0.42 + (twigIndex % 2) * 0.08, limb.seed * 7 + twigIndex, 22);

      const forkBase = twigCurve.getPointAt(0.58);
      const forkCurve = weatheredCurve([
        forkBase,
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.08, 0.16, twigSide * 0.03)),
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.22, 0.29, twigSide * 0.11)),
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.31, 0.34, twigSide * 0.16)),
      ], limb.seed * 13 + twigIndex, 0.07);
      canopyParts.push(makeOrganicTube(forkCurve, upperBranch ? 0.018 : 0.024, twigRadius, 7, 16, limb.seed + twigIndex * 2, 0.4));
      if (twigIndex % 2 === 0) addBrushCluster(foliageStrokes, forkCurve.getPointAt(1), 0.29, limb.seed * 11 + twigIndex, 14);
    }

    for (const [padIndex, t] of [0.4, 0.68, 0.96].entries()) {
      const upperTerminalPad = upperBranch && padIndex === 2;
      const padSize = padIndex === 2 ? (upperTerminalPad ? 0.42 : 0.64) : 0.43;
      const padCenter = primaryCurve.getPointAt(t);
      const padDensity = upperTerminalPad ? 28 : padIndex === 2 ? 44 : 28;
      addBrushCluster(foliageStrokes, padCenter, padSize, limb.seed * 17 + padIndex, padDensity);
      const projectNodeId = canopyNodeBySeed[limb.seed];
      if (padIndex === 2 && projectNodeId) nodePositions[projectNodeId] = padCenter.clone();
    }
  });

  return {
    structure: mergeTubeGeometries(structureParts),
    canopy: mergeTubeGeometries(canopyParts),
    foliage: foliageStrokes,
    nodePositions,
  };
}
