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

// A spot on a bare stretch of limb where a sparrow can stand: the top of the wood, and the way the branch runs.
export type PerchPoint = {
  id: string;
  // "branch" perches sit on a limb; "ground" ones are a strip of the cliff top a sparrow can hop and peck along.
  kind: "branch" | "ground";
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  // A short polyline along the wood (or ground), left to right as sampled, already lifted onto the surface.
  path: THREE.Vector3[];
};

// A knothole on the camera-facing side of the trunk: where it is, which way the bark faces, and roughly how big.
export type HollowSpot = {
  position: THREE.Vector3;
  normal: THREE.Vector3;
};

export type PineGeometry = {
  structure: THREE.BufferGeometry;
  canopy: THREE.BufferGeometry;
  cliff: THREE.BufferGeometry;
  needles: FoliageSprite[];
  washes: FoliageSprite[];
  nodePositions: Record<string, THREE.Vector3>;
  perches: PerchPoint[];
  hollow: HollowSpot;
};

// How much armor-plate bark each part carries (see createInkTrunkMaterial).
const barkAmount = { trunk: 1, root: 0.85, limb: 0.75, twig: 0.1 };
const barkPlateWidth = 0.36;
const tubeAttributes: [string, number][] = [
  ["position", 3], ["normal", 3], ["uv", 2], ["aWash", 1], ["aRoughness", 1], ["aBark", 1],
  ["aCellsAround", 1], ["aCellsAlong", 1], ["aFade", 1], ["aGroove", 1], ["aTwist", 1],
];

type RadiusStop = readonly [number, number];

// The trunk flares hard at the base (nebari) and narrows to the split where the crown limbs leave.
const trunkRadius: RadiusStop[] = [
  [0, 1.45], [0.08, 1.15], [0.25, 0.95], [0.5, 0.8], [0.75, 0.66], [0.92, 0.5], [1, 0.32],
];
const branchRadius: RadiusStop[] = [[0, 1.15], [0.18, 1], [0.48, 0.72], [0.76, 0.42], [0.94, 0.18], [1, 0.04]];
const twigRadius: RadiusStop[] = [[0, 1.05], [0.24, 0.86], [0.62, 0.55], [0.9, 0.22], [1, 0.04]];
const rootRadius: RadiusStop[] = [[0, 2.1], [0.12, 1.65], [0.38, 1.12], [0.7, 0.55], [0.92, 0.16], [1, 0.02]];

// A thick S-curve that splits at about half the tree's height, like a Korean red pine on a cliff.
const trunkAnchors = [
  new THREE.Vector3(0.06, 0, 0.02),
  new THREE.Vector3(-0.15, 0.5, 0.1),
  new THREE.Vector3(-0.55, 1.2, -0.1),
  new THREE.Vector3(-0.7, 1.9, -0.2),
  new THREE.Vector3(-0.35, 2.6, 0.05),
  new THREE.Vector3(0.25, 3.2, 0.2),
  new THREE.Vector3(0.45, 3.8, 0.1),
  new THREE.Vector3(0.15, 4.5, -0.1),
  new THREE.Vector3(-0.1, 5.2, -0.15),
];

function radiusAt(stops: RadiusStop[], t: number) {
  for (let index = 1; index < stops.length; index += 1) {
    const [t1, r1] = stops[index];
    if (t <= t1) {
      const [t0, r0] = stops[index - 1];
      return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0 || 1);
    }
  }
  return stops[stops.length - 1][1];
}

// Limbs that carry perches: the long, bare stretches before the needle clusters, at these fractions of their length.
const perchLimbs = ["timeslips", "travel-health", "bytefight", "jobjoe"];
const perchStops = [0.46, 0.66];
// How far along the limb, either side of a perch, the bird can hop.
const perchHalfSpan = 0.06;

// Strips of the flat cliff top, right of the trunk and in front of the roots, where a sparrow can feed on the ground.
const groundStrips: { id: string; from: [number, number]; to: [number, number] }[] = [
  { id: "ground-a", from: [3.0, 0.5], to: [3.8, 0.55] },
  { id: "ground-b", from: [1.0, 1.0], to: [2.3, 1.0] },
  { id: "ground-d", from: [1.5, 0.7], to: [2.6, 0.8] },
];

// Casts a ray at the trunk from the camera side and returns the bark it hits at the hollow's height.
const hollowHeight = 2.5;

function findHollowSpot(structure: THREE.BufferGeometry): HollowSpot {
  const centre = trunkCenterAt(hollowHeight);
  const mesh = new THREE.Mesh(structure, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(centre.x, hollowHeight, 4), new THREE.Vector3(0, 0, -1));
  const hit = raycaster.intersectObject(mesh, false)[0];
  if (!hit) return { position: new THREE.Vector3(centre.x, hollowHeight, centre.z + 0.5), normal: new THREE.Vector3(0, 0, 1) };
  const normal = (hit.face?.normal ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
  if (normal.z < 0) normal.negate();
  return { position: hit.point.clone(), normal };
}

// The height of the cliff top under (x, z), by casting a ray straight down onto the cliff geometry.
function createGroundSampler(cliff: THREE.BufferGeometry) {
  const mesh = new THREE.Mesh(cliff, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  return (x: number, z: number) => {
    origin.set(x, 3, z);
    raycaster.set(origin, down);
    const hit = raycaster.intersectObject(mesh, false)[0];
    return hit ? hit.point.y : null;
  };
}

type LimbSpec = {
  from: number;
  points: [number, number, number][];
  radius: number;
  seed: number;
  node?: string;
};

// Crown limbs: each leaves the trunk, dips, bends at an elbow and spreads into the umbrella crown.
// The two low limbs reach out and droop at their tips.
const crownLimbs: LimbSpec[] = [
  { from: 4.8, radius: 0.24, seed: 1, node: "timeslips", points: [[-0.6, 4.75, 0.15], [-1.3, 5.6, 0.3], [-2.0, 6.5, 0.2], [-3.1, 6.55, 0.1], [-4.2, 6.2, 0.05]] },
  { from: 4.9, radius: 0.24, seed: 2, node: "travel-health", points: [[0.6, 4.85, -0.1], [1.2, 5.7, -0.25], [1.9, 6.7, -0.2], [3.0, 6.65, -0.1], [4.2, 6.2, 0]] },
  { from: 5.1, radius: 0.2, seed: 3, node: "neural-vision", points: [[0.0, 5.7, -0.1], [0.35, 6.4, 0.05], [0.1, 6.85, 0.1], [0.3, 7.15, 0]] },
  { from: 3.4, radius: 0.22, seed: 4, node: "bytefight", points: [[1.1, 3.35, 0.25], [1.8, 3.85, 0.35], [2.4, 3.75, 0.3], [3.3, 3.45, 0.25], [4.1, 3.05, 0.2]] },
  { from: 3.9, radius: 0.22, seed: 5, node: "jobjoe", points: [[-0.9, 3.8, 0.3], [-1.6, 4.4, 0.35], [-2.4, 4.45, 0.3], [-3.2, 4.25, 0.2], [-4.0, 3.85, 0.15]] },
  { from: 4.4, radius: 0.16, seed: 6, points: [[-0.5, 4.6, -0.6], [-1.2, 5.3, -0.9], [-2.1, 5.7, -1.0], [-2.9, 5.6, -0.9]] },
  { from: 4.2, radius: 0.16, seed: 7, points: [[0.6, 4.35, -0.5], [1.3, 5.0, -0.8], [2.2, 5.4, -0.9], [3.0, 5.2, -0.8]] },
];

type TubeOptions = {
  // Fraction of the tube's end that fades out, for roots trailing into the soil like a dry brush.
  fadeTail?: number;
  // Fluting: sharp grooves running along the tube, wrapping round it as it goes (rope-like strands).
  flutes?: number;
  fluteDepth?: number;
  twist?: number;
};

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
  { fadeTail = 0, flutes = 0, fluteDepth = 0, twist = 0 }: TubeOptions = {},
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const length = curve.getLength();
  const positions: number[] = [];
  const uvs: number[] = [];
  const washes: number[] = [];
  const roughness: number[] = [];
  const fades: number[] = [];
  const grooves: number[] = [];
  const indices: number[] = [];
  const ringSize = radialSegments + 1;
  // Bark plates: a whole number around the branch (so the pattern wraps without a seam), slightly wider than tall.
  const circumference = Math.PI * 2 * baseRadius * sampleRadius(0.3, stops);
  const cellsAround = Math.max(3, Math.round(circumference / barkPlateWidth));
  const cellsAlong = length / ((circumference / cellsAround) * 0.8);
  // How far the flutes wrap round over the whole length, in plate cells, so plates follow the grooves.
  const twistCells = flutes > 0 ? ((-2 * twist * length) / flutes / (Math.PI * 2)) * cellsAround : 0;

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
    const flutePhase = (valueNoise1(seed + 41, along * 0.6) - 0.5) * 1.2 + twist * along;

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const burl = valueNoise3(seed, cos * 0.9, sin * 0.9, along * 0.7);
      const knot = valueNoise3(seed + 5, cos * 2.2, sin * 2.2, along * 1.9);
      let irregularity = 1 + (burl - 0.5) * 0.22 + (knot - 0.5) * 0.08;
      let groove = 0;
      if (flutes > 0) {
        // |sin| has sharp cusps, so the grooves are narrow V-cuts between broad strands.
        const strand = Math.abs(Math.sin((flutes / 2) * angle + flutePhase));
        irregularity *= 1 + fluteDepth * (strand - 0.64);
        groove = 1 - strand;
      }
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
      grooves.push(groove);
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
  const constant = (value: number) => new THREE.Float32BufferAttribute(new Array(vertexCount).fill(value), 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aWash", new THREE.Float32BufferAttribute(washes, 1));
  geometry.setAttribute("aRoughness", new THREE.Float32BufferAttribute(roughness, 1));
  geometry.setAttribute("aBark", constant(bark));
  geometry.setAttribute("aCellsAround", constant(cellsAround));
  geometry.setAttribute("aCellsAlong", constant(cellsAlong));
  geometry.setAttribute("aFade", new THREE.Float32BufferAttribute(fades, 1));
  geometry.setAttribute("aGroove", new THREE.Float32BufferAttribute(grooves, 1));
  geometry.setAttribute("aTwist", constant(twistCells));
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

// A needle cluster: fans stacked into a half-dome (wide at the bottom, smaller on top, spiky crown),
// over a grey wash cloud. Clusters behind the trunk are painted lighter, for depth.
function addNeedleCluster(needles: FoliageSprite[], washes: FoliageSprite[], center: THREE.Vector3, span: number, seed: number) {
  const random = (key: number) => seedUnit(seed, key);
  const depthTone = center.z < -0.3 ? 0.55 : 1;
  washes.push({
    position: center.clone().add(new THREE.Vector3((random(1) - 0.5) * span * 0.2, -span * 0.05, -0.05)),
    width: span * (2.5 + random(2) * 0.4),
    height: span * (1.15 + random(3) * 0.25),
    variant: 0,
    tone: (0.72 + random(4) * 0.16) * (depthTone < 1 ? 0.7 : 1),
    tilt: (random(5) - 0.5) * 0.12,
  });
  const tiers = [
    { count: 6, spread: 0.95, lift: -0.18, size: 1.1 },
    { count: 4, spread: 0.6, lift: 0.08, size: 0.95 },
    { count: 3, spread: 0.3, lift: 0.3, size: 0.78 },
  ];
  let fanIndex = 0;
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++, fanIndex++) {
      const r = (key: number) => seedUnit(seed * 3 + fanIndex * 17, key);
      const slot = tier.count === 1 ? 0 : (i / (tier.count - 1)) * 2 - 1;
      const x = (slot + (r(1) - 0.5) * 0.3) * tier.spread * span;
      const size = span * tier.size * (0.88 + r(2) * 0.28);
      const variant = r(3) < 0.08 ? 3 : Math.floor(r(4) * 3);
      needles.push({
        position: center.clone().add(new THREE.Vector3(
          x,
          tier.lift * span + (r(5) - 0.5) * span * 0.08,
          (r(6) - 0.5) * span * 0.7,
        )),
        width: variant === 3 ? size * 0.95 : size * 1.3,
        height: variant === 3 ? size * 0.95 : size * 0.9,
        variant,
        tone: (0.88 + r(7) * 0.12) * depthTone,
        // Outer fans lean outward, giving the cluster its dome.
        tilt: (-x / span) * 0.5 + (r(8) - 0.5) * 0.2,
      });
    }
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
  geometry.setAttribute("aWash", constant(0.1));
  geometry.setAttribute("aRoughness", constant(0.18));
  geometry.setAttribute("aBark", constant(-1));
  geometry.setAttribute("aCellsAround", constant(4));
  geometry.setAttribute("aCellsAlong", constant(4));
  geometry.setAttribute("aFade", constant(1));
  geometry.setAttribute("aGroove", constant(0));
  geometry.setAttribute("aTwist", constant(0));
  return geometry;
}

// The cliff top the pine stands on: a craggy block whose upper surface sits just under the roots and
// whose face drops away into mist, so the tree reads as standing on a peak above the far ranges.
function makeCliff() {
  const center = new THREE.Vector3(0.4, 0, -0.55);
  const radiusX = 5.6;
  const radiusZ = 2.6;
  const geometry = new THREE.SphereGeometry(1, 120, 72);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    // An irregular outcrop, not a rectangle: the outline wanders with the angle around the top.
    const footprint = 1 + (valueNoise3(131, Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, 0) - 0.5) * 0.4;
    let spread: number;
    let height: number;
    if (y >= 0) {
      // The top: flat under the roots, rolling off at a rounded, broken edge.
      const across = Math.sqrt(x * x + z * z);
      const roll = Math.max(0, across - 0.62) / 0.38;
      spread = across * footprint;
      height = -0.05 - roll * roll * 0.95 - valueNoise3(139, x * 4, 0, z * 4) * 0.06;
    } else {
      // The face: drops away below the edge, stepping out and in over ledges.
      const ledge = valueNoise3(137, Math.cos(angle) * 2.2, y * 5, Math.sin(angle) * 2.2) - 0.5;
      spread = footprint * (1 + -y * 0.16 + ledge * 0.12);
      height = -1.0 + y * 6.2;
    }
    position.setXYZ(i, center.x + Math.cos(angle) * spread * radiusX, height, center.z + Math.sin(angle) * spread * radiusZ);
  }
  geometry.computeVertexNormals();
  const count = position.count;
  const constant = (value: number) => new THREE.Float32BufferAttribute(new Array(count).fill(value), 1);
  // aBark of -2 marks the cliff: painted like rock, exempt from the ground cut, fading into mist below.
  geometry.setAttribute("aWash", constant(0.12));
  geometry.setAttribute("aRoughness", constant(0.16));
  geometry.setAttribute("aBark", constant(-2));
  geometry.setAttribute("aCellsAround", constant(4));
  geometry.setAttribute("aCellsAlong", constant(4));
  geometry.setAttribute("aFade", constant(1));
  geometry.setAttribute("aGroove", constant(0));
  geometry.setAttribute("aTwist", constant(0));
  return geometry;
}

export function buildPineGeometry() {
  const structureParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];
  const needles: FoliageSprite[] = [];
  const washes: FoliageSprite[] = [];
  const nodePositions: Record<string, THREE.Vector3> = {};
  const perches: PerchPoint[] = [];
  const cliff = makeCliff();
  structureParts.push(makeOrganicTube(trunkSpline, 0.7, trunkRadius, 30, 150, 0.8, 0.14, barkAmount.trunk, { flutes: 7, fluteDepth: 0.13, twist: 0.32 }));
  structureParts.push(makeRock());

  // Two broken branch stubs, a mark of an old pine.
  for (const stub of [{ y: 2.75, side: 1, depth: 0.35, seed: 41 }, { y: 4.2, side: -1, depth: -0.2, seed: 43 }]) {
    const base = trunkCenterAt(stub.y);
    const direction = new THREE.Vector3(stub.side, 0.3, stub.depth).normalize();
    const curve = curveThrough([
      base,
      base.clone().addScaledVector(direction, 0.55),
      base.clone().addScaledVector(direction, 1.05).add(new THREE.Vector3(0, 0.06, 0)),
    ]);
    structureParts.push(makeOrganicTube(curve, 0.14, [[0, 1.3], [0.35, 1], [0.85, 0.82], [1, 0.6]], 10, 14, stub.seed, 0.3, barkAmount.limb));
  }

  // Thick, twisted roots flare from the base: two grip the boulder behind, the rest splay across
  // the ground and split into ever thinner rootlets that end in points.
  const roots = [
    { angle: -3.05, reach: 3.9, seed: 1, node: "northbound" },
    { angle: 2.82, reach: 3.4, seed: 2 },
    { angle: -2.55, reach: 3.0, seed: 3 },
    { angle: 2.45, reach: 3.2, seed: 4, node: "georgia-tech" },
    { angle: -1.9, reach: 3.1, seed: 5 },
    { angle: -1.15, reach: 3.3, seed: 6 },
    { angle: -0.35, reach: 3.2, seed: 7 },
    { angle: 0.05, reach: 3.9, seed: 8, node: "katusa" },
    { angle: 0.55, reach: 3.0, seed: 9 },
  ];
  const rootStart = trunkCenterAt(0.35);
  for (const root of roots) {
    const direction = new THREE.Vector3(Math.cos(root.angle), 0, Math.sin(root.angle));
    const points = [rootStart.clone()];
    // Each root arches up out of the soil before descending into it, so the roots read as separate
    // strands from the side rather than a flat skirt. Arch heights vary per root.
    const arch = 0.75 + seedUnit(root.seed, 77) * 0.5;
    const profile = [[0.12, 0.48], [0.3, 0.4], [0.5, 0.28], [0.7, 0.15], [0.86, 0.03], [1, -0.32]];
    for (const [fraction, height] of profile) {
      const point = rootStart.clone().addScaledVector(direction, root.reach * fraction);
      const ground = height > 0 ? height * arch : height;
      point.y = Math.max(ground, rockSurfaceY(point.x, point.z) + 0.08);
      points.push(point);
    }
    const rootCurve = weatheredCurve(points, root.seed * 3.7, 0.12);
    structureParts.push(makeOrganicTube(rootCurve, 0.3, rootRadius, 18, 72, root.seed, 0.24, barkAmount.root, {
      fadeTail: 0.1, flutes: 4, fluteDepth: 0.3, twist: 1.1,
    }));
    if (root.node) {
      const jointT = 0.5;
      const tangent = rootCurve.getTangentAt(jointT).normalize();
      const surfaceNormal = new THREE.Vector3(0, 0.35, 1).addScaledVector(tangent, -tangent.z).normalize();
      nodePositions[root.node] = rootCurve.getPointAt(jointT)
        .addScaledVector(surfaceNormal, 0.3 * sampleRadius(jointT, rootRadius) + 0.055);
    }
    for (const [forkIndex, t] of [0.38, 0.6, 0.8].entries()) {
      const joint = rootCurve.getPointAt(t);
      const side = (forkIndex + root.seed) % 2 === 0 ? -1 : 1;
      const forkDirection = new THREE.Vector3(-direction.z * side, 0, direction.x * side).addScaledVector(direction, 0.9).normalize();
      const forkLength = 0.95 - t * 0.5;
      const fork = weatheredCurve([
        joint,
        joint.clone().addScaledVector(forkDirection, forkLength * 0.35).add(new THREE.Vector3(0, -0.03, 0)),
        joint.clone().addScaledVector(forkDirection, forkLength * 0.7).add(new THREE.Vector3(0, -0.08, 0)),
        joint.clone().addScaledVector(forkDirection, forkLength).add(new THREE.Vector3(0, -0.16, 0)),
      ], root.seed + t * 9, 0.06);
      structureParts.push(makeOrganicTube(fork, 0.1 - t * 0.04, twigRadius, 10, 24, root.seed + t, 0.3, barkAmount.root * 0.6, {
        fadeTail: 0.08, flutes: 3, fluteDepth: 0.22, twist: 1.4,
      }));
      // A finer rootlet off each fork.
      const rootletBase = fork.getPointAt(0.55);
      const rootletDirection = forkDirection.clone().addScaledVector(new THREE.Vector3(-forkDirection.z, 0, forkDirection.x), side * 0.8).normalize();
      const rootlet = curveThrough([
        rootletBase,
        rootletBase.clone().addScaledVector(rootletDirection, 0.2).add(new THREE.Vector3(0, -0.02, 0)),
        rootletBase.clone().addScaledVector(rootletDirection, 0.4).add(new THREE.Vector3(0, -0.08, 0)),
      ]);
      structureParts.push(makeOrganicTube(rootlet, 0.035, twigRadius, 6, 12, root.seed + t * 3, 0.32, 0, { fadeTail: 0.1 }));
    }
  }

  // Grass tufts and a broad band of ground mist under the roots.
  for (let tuft = 0; tuft < 12; tuft++) {
    const r = (key: number) => seedUnit(911 + tuft * 13, key);
    const x = -3.4 + r(1) * 7.2;
    if (Math.abs(x - 0.06) < 1.1) continue;
    const size = 0.24 + r(2) * 0.2;
    needles.push({
      position: new THREE.Vector3(x, -0.02, -0.1 + r(3) * 0.9),
      width: size * 1.3,
      height: size * 0.7,
      variant: Math.floor(r(4) * 3),
      tone: 0.45 + r(5) * 0.22,
      tilt: (r(6) - 0.5) * 0.3,
    });
  }
  washes.push(
    { position: new THREE.Vector3(0.3, 0.03, -0.2), width: 9, height: 0.95, variant: 0, tone: 0.62, tilt: 0 },
    { position: new THREE.Vector3(0.3, -0.02, 0.6), width: 7, height: 0.6, variant: 0, tone: 0.5, tilt: 0.02 },
    { position: new THREE.Vector3(1.6, 0.1, -1.4), width: 4.2, height: 0.9, variant: 0, tone: 0.36, tilt: 0.03 },
  );

  // Crown limbs, their twigs, and the needle clusters that build the umbrella crown.
  for (const limb of crownLimbs) {
    const trunkPoint = trunkCenterAt(limb.from);
    const limbCurve = weatheredCurve(
      [trunkPoint, ...limb.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))],
      limb.seed * 4.1,
      0.08,
    );
    canopyParts.push(makeOrganicTube(limbCurve, limb.radius, branchRadius, 14, 72, limb.seed, 0.24, barkAmount.limb, {
      flutes: 4, fluteDepth: 0.12, twist: 0.6,
    }));
    if (limb.node && perchLimbs.includes(limb.node)) {
      for (const [perchIndex, centre] of perchStops.entries()) {
        // Stand on top of the wood, and a little toward the viewer so the bird is drawn in front of needles.
        const liftedAt = (t: number) => {
          const point = limbCurve.getPointAt(t);
          point.y += limb.radius * radiusAt(branchRadius, t) * 0.8;
          point.z += 0.16;
          return point;
        };
        const path = [-2, -1, 0, 1, 2].map((step) => liftedAt(centre + (step / 2) * perchHalfSpan));
        perches.push({
          id: `${limb.node}-${perchIndex}`,
          kind: "branch",
          position: liftedAt(centre),
          tangent: limbCurve.getTangentAt(centre),
          path,
        });
      }
    }
    const end = limbCurve.getPointAt(1);
    const side = Math.sign(end.x - trunkPoint.x) || 1;
    const depth = end.z;

    const twigLocations = [0.42, 0.58, 0.72, 0.86];
    for (const [twigIndex, t] of twigLocations.entries()) {
      const base = limbCurve.getPointAt(t);
      const twigSide = twigIndex % 2 === 0 ? -1 : 1;
      const twigReach = 0.55 + seedUnit(limb.seed, twigIndex + 40) * 0.35;
      const twigCurve = weatheredCurve([
        base,
        base.clone().add(new THREE.Vector3(side * twigReach * 0.25, 0.18, twigSide * 0.12)),
        base.clone().add(new THREE.Vector3(side * twigReach * 0.62, 0.32, depth * 0.2 + twigSide * 0.3)),
        base.clone().add(new THREE.Vector3(side * twigReach, 0.36, depth * 0.3 + twigSide * 0.42)),
      ], limb.seed * 7 + twigIndex, 0.08);
      canopyParts.push(makeOrganicTube(twigCurve, 0.045, twigRadius, 8, 24, limb.seed + twigIndex, 0.36, barkAmount.twig));
      addNeedleCluster(needles, washes, twigCurve.getPointAt(1).add(new THREE.Vector3(0, 0.06, 0)), 0.75 + seedUnit(limb.seed, twigIndex + 60) * 0.25, limb.seed * 7 + twigIndex);

      const forkBase = twigCurve.getPointAt(0.55);
      const forkCurve = weatheredCurve([
        forkBase,
        forkBase.clone().add(new THREE.Vector3(side * 0.1, 0.14, -twigSide * 0.08)),
        forkBase.clone().add(new THREE.Vector3(side * 0.26, 0.24, -twigSide * 0.2)),
      ], limb.seed * 13 + twigIndex, 0.05);
      canopyParts.push(makeOrganicTube(forkCurve, 0.024, twigRadius, 6, 14, limb.seed + twigIndex * 2, 0.4, barkAmount.twig));
      if (twigIndex % 2 === 1) addNeedleCluster(needles, washes, forkCurve.getPointAt(1), 0.58, limb.seed * 11 + twigIndex);
    }

    // Clusters sitting on the limb itself; the terminal one carries the project dot.
    for (const [clusterIndex, t] of [0.62, 0.8, 0.97].entries()) {
      const center = limbCurve.getPointAt(t).add(new THREE.Vector3(0, 0.12, 0));
      const terminal = clusterIndex === 2;
      addNeedleCluster(needles, washes, center, terminal ? 1.05 : 0.88, limb.seed * 17 + clusterIndex);
      if (terminal && limb.node) nodePositions[limb.node] = center.clone();
    }
  }

  const structure = mergeTubeGeometries(structureParts);
  const hollow = findHollowSpot(structure);
  const groundHeight = createGroundSampler(cliff);
  for (const strip of groundStrips) {
    const path = [0, 1, 2, 3, 4].map((step) => {
      const t = step / 4;
      const x = THREE.MathUtils.lerp(strip.from[0], strip.to[0], t);
      const z = THREE.MathUtils.lerp(strip.from[1], strip.to[1], t);
      return new THREE.Vector3(x, (groundHeight(x, z) ?? -0.1) + 0.02, z + 0.1);
    });
    perches.push({
      id: strip.id,
      kind: "ground",
      position: path[2].clone(),
      tangent: path[4].clone().sub(path[0]).normalize(),
      path,
    });
  }

  return {
    structure,
    canopy: mergeTubeGeometries(canopyParts),
    cliff,
    needles,
    washes,
    nodePositions,
    perches,
    hollow,
  };
}
