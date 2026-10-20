import * as THREE from "three";
import { seedUnit } from "./math";

// Paintings are coverage maps: white = full ink, black = bare paper. They are used as alphaMaps on a
// single-colour material, which keeps mipmapped edges clean (no dark fringes from transparent texels).

export type PeakShape = "rolling" | "crag" | "pillar";

export type PeakSpec = {
  x: number;
  base: number;
  halfWidth: number;
  height: number;
  shape: PeakShape;
  tone: number;
  pine?: boolean;
};

export type CliffShadow = { x: number; top: number; bottom: number; width: number };

export type LandscapeLayerSpec = {
  width: number;
  height: number;
  pxPerUnit: number;
  seed: number;
  inkAlpha: number;
  peaks: PeakSpec[];
  clouds: { y: number; amount: number }[];
  dots: boolean;
  cliffShadows?: CliffShadow[];
};

type RangeRow = {
  from: number;
  to: number;
  step: number;
  base: number;
  halfWidth: [number, number];
  height: [number, number];
  tone: number;
  cragChance: number;
};

const ink = (alpha: number) => `rgba(255, 255, 255, ${THREE.MathUtils.clamp(alpha, 0, 1).toFixed(3)})`;
const erase = (alpha: number) => `rgba(0, 0, 0, ${THREE.MathUtils.clamp(alpha, 0, 1).toFixed(3)})`;

function noise1(seed: number, x: number) {
  const cell = Math.floor(x);
  const local = x - cell;
  const eased = local * local * (3 - 2 * local);
  return THREE.MathUtils.lerp(seedUnit(seed, cell), seedUnit(seed, cell + 1), eased);
}

function createRandom(seed: number) {
  let index = 0;
  return () => seedUnit(seed, index++);
}

function createCoverageCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas is unavailable");
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  return { canvas, context };
}

function toCoverageTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function dab(context: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number, rotation: number) {
  context.beginPath();
  context.ellipse(x, y, Math.max(0.3, radiusX), Math.max(0.3, radiusY), rotation, 0, Math.PI * 2);
  context.fill();
}

function addPaperGrain(context: CanvasRenderingContext2D, width: number, height: number, seed: number, strength: number) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let pixel = 0, index = 0; index < data.length; pixel++, index += 4) {
    if (data[index] === 0) continue;
    const hash = Math.imul(pixel ^ seed, 2654435761) >>> 0;
    const grain = 1 - strength + strength * (((hash >>> 16) & 255) / 255);
    const value = data[index] * grain;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  context.putImageData(image, 0, 0);
}

// Returns the ridge height (0..~1) across the peak for t in -1..1. Crags and pillars are clusters of
// rounded spires on a low mound, like granite peaks; rolling ridges are soft, irregular humps.
function createProfile(peak: PeakSpec, seed: number) {
  const skew = (seedUnit(seed, 3) - 0.5) * 0.5;
  const pillar = peak.shape === "pillar";
  const spireCount = peak.shape === "rolling" ? 0 : pillar ? 2 + Math.floor(seedUnit(seed, 5) * 2) : 3 + Math.floor(seedUnit(seed, 5) * 3);
  const spires = Array.from({ length: spireCount }, (_, index) => {
    const width = pillar ? 0.35 + seedUnit(seed, 21 + index) * 0.25 : 0.22 + seedUnit(seed, 21 + index) * 0.3;
    const reach = Math.max(0, 0.95 - width);
    return {
      center: (seedUnit(seed, 11 + index) * 2 - 1) * reach * (pillar ? 0.6 : 1),
      width,
      height: index === 0 ? 1 : 0.6 + seedUnit(seed, 31 + index) * 0.35,
    };
  });
  const mound = pillar ? 0.3 : 0.42;

  return (t: number) => {
    const skewed = THREE.MathUtils.clamp(t + skew * (1 - t * t), -1, 1);
    const a = Math.abs(skewed);
    if (a >= 1) return 0;
    if (peak.shape === "rolling") {
      const bell = 0.5 + 0.5 * Math.cos(Math.PI * a);
      const ridge = THREE.MathUtils.lerp(bell, 1 - a, 0.5)
        + ((noise1(seed, skewed * 4) - 0.5) * 0.22 + (noise1(seed + 5, skewed * 11) - 0.5) * 0.08) * (1 - a);
      return Math.max(0, ridge);
    }
    const envelope = 1 - a * a;
    let ridge = mound * Math.pow(envelope, 0.7);
    for (const spire of spires) {
      const d = (skewed - spire.center) / spire.width;
      if (Math.abs(d) < 1) ridge = Math.max(ridge, spire.height * Math.pow(1 - d * d, 0.55));
    }
    ridge += ((noise1(seed, skewed * 13) - 0.5) * 0.06 + (noise1(seed + 9, skewed * 37) - 0.5) * 0.035) * envelope;
    return Math.max(0, ridge);
  };
}

function drawPine(context: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, random: () => number) {
  const lean = (random() - 0.5) * 0.6;
  const topX = x + lean * size * 0.5;
  const topY = y - size;
  context.strokeStyle = ink(alpha);
  context.lineWidth = Math.max(1.2, size * 0.08);
  context.beginPath();
  context.moveTo(x, y + size * 0.05);
  context.quadraticCurveTo(x + (random() - 0.5) * size * 0.35, y - size * 0.5, topX, topY);
  context.stroke();

  const tiers = 3 + Math.floor(random() * 2);
  for (let tier = 0; tier < tiers; tier++) {
    const along = 0.38 + 0.62 * (tier / (tiers - 1));
    const padX = x + (topX - x) * along;
    const padY = y + (topY - y) * along;
    const span = size * (0.95 - 0.5 * (tier / (tiers - 1))) * (0.8 + random() * 0.4);
    const offset = (random() - 0.5) * span * 0.5;
    context.strokeStyle = ink(alpha * 0.8);
    context.lineWidth = Math.max(1, size * 0.04);
    context.beginPath();
    context.moveTo(padX, padY);
    context.lineTo(padX + offset, padY + size * 0.03);
    context.stroke();
    for (let needle = 0; needle < 16; needle++) {
      const u = needle / 15 - 0.5;
      context.fillStyle = ink(alpha * (0.45 + random() * 0.45));
      dab(
        context,
        padX + offset + u * span + (random() - 0.5) * size * 0.05,
        padY - size * 0.02 + (random() - 0.5) * size * 0.07 + u * u * size * 0.18,
        size * (0.07 + random() * 0.05),
        size * (0.045 + random() * 0.035),
        (random() - 0.5) * 0.7,
      );
    }
  }
}

function paintPeak(context: CanvasRenderingContext2D, layer: LandscapeLayerSpec, peak: PeakSpec, seed: number) {
  const ppu = layer.pxPerUnit;
  const toX = (x: number) => (x + layer.width / 2) * ppu;
  const toY = (y: number) => (layer.height - y) * ppu;
  const profile = createProfile(peak, seed);
  const random = createRandom(seed * 7 + 3);
  const alpha = layer.inkAlpha * peak.tone;
  const rocky = peak.shape !== "rolling";
  const samples = Math.max(24, Math.ceil((peak.halfWidth * ppu) / 1.5));
  const outline: [number, number][] = [];
  let summit = 0;
  for (let i = 0; i <= samples; i++) {
    const t = -1 + (2 * i) / samples;
    const point: [number, number] = [toX(peak.x + t * peak.halfWidth), toY(peak.base + peak.height * profile(t))];
    outline.push(point);
    if (point[1] < outline[summit][1]) summit = i;
  }
  const topY = outline[summit][1];
  const bottomY = toY(peak.base);
  const tracePath = (dropPx: number) => {
    context.beginPath();
    outline.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y + dropPx);
      else context.lineTo(x, y + dropPx);
    });
  };

  context.save();
  tracePath(0);
  context.lineTo(outline[outline.length - 1][0], bottomY + 1);
  context.lineTo(outline[0][0], bottomY + 1);
  context.closePath();

  // A nearer peak hides the ridges behind it, as overlapping ranges do in ink painting.
  context.fillStyle = erase(rocky ? 0.92 : 0.85);
  context.fill();

  // Light body wash, then a dark band that follows the ridgeline and fades downward.
  const body = context.createLinearGradient(0, topY, 0, bottomY);
  body.addColorStop(0, ink(alpha * 0.32));
  body.addColorStop(rocky ? 0.75 : 0.6, ink(0));
  context.fillStyle = body;
  context.fill();
  context.clip();

  const bandDepth = (bottomY - topY) * (rocky ? 0.55 : 0.45);
  const bands = 10;
  context.lineWidth = (bandDepth / bands) * 2.6;
  for (let band = 0; band < bands; band++) {
    const fraction = band / bands;
    context.strokeStyle = ink(alpha * 0.2 * Math.pow(1 - fraction, 1.3));
    tracePath(fraction * bandDepth);
    context.stroke();
  }

  if (rocky) {
    // Broad shadow faces on the left: the light falls from the right, as on the tree.
    for (let face = 0; face < 3; face++) {
      const x = toX(peak.x + (-0.75 + random() * 0.6) * peak.halfWidth);
      context.strokeStyle = ink(alpha * (0.08 + random() * 0.07));
      context.lineWidth = ppu * peak.halfWidth * (0.2 + random() * 0.2);
      context.beginPath();
      context.moveTo(x, topY);
      context.lineTo(x + (random() - 0.5) * ppu, topY + (bottomY - topY) * 0.7);
      context.stroke();
    }
    // Texture strokes (cun): short vertical and slanted marks, densest near the summits.
    const count = Math.min(400, Math.round((peak.halfWidth * peak.height * ppu * ppu) / 190));
    for (let stroke = 0; stroke < count; stroke++) {
      const t = random() * 2 - 1;
      const ridge = peak.base + peak.height * profile(t);
      const depth = Math.pow(random(), 1.6) * peak.height * 0.7;
      const startY = ridge - depth;
      if (startY <= peak.base + peak.height * 0.12) continue;
      const length = peak.height * (0.04 + random() * 0.14);
      const slant = (random() - 0.5) * 0.4 + (t < 0 ? -0.12 : 0.12);
      const shadow = t < -0.05 ? 1.35 : 0.8;
      const x = toX(peak.x + t * peak.halfWidth);
      context.strokeStyle = ink(alpha * (0.2 + random() * 0.35) * (1 - depth / (peak.height * 0.75)) * shadow);
      context.lineWidth = ppu * (0.025 + random() * 0.06);
      context.beginPath();
      context.moveTo(x, toY(startY));
      context.quadraticCurveTo(
        x + slant * length * ppu * 0.5 + (random() - 0.5) * ppu * 0.15,
        toY(startY - length * 0.5),
        x + slant * length * ppu,
        toY(startY - length),
      );
      context.stroke();
    }
  }
  context.restore();

  // Ridge edge: overlapping brush dabs with occasional dry breaks.
  for (let i = 0; i < outline.length; i++) {
    const [x, y] = outline[i];
    if (y >= bottomY - 0.5) continue;
    const pressure = noise1(seed + 21, i * 0.06);
    if (pressure < 0.18) continue;
    const next = outline[Math.min(outline.length - 1, i + 1)];
    const angle = Math.atan2(next[1] - y, next[0] - x);
    const radius = ppu * (0.025 + pressure * 0.055);
    context.fillStyle = ink(alpha * (0.3 + pressure * 0.4) * (rocky ? 1 : 0.6));
    dab(context, x, y + radius * 0.5, radius * 1.6, radius, angle);
  }

  // Vegetation dots along the ridge, as in Korean landscape brushwork.
  if (layer.dots) {
    for (let i = 0; i < outline.length; i += 3) {
      if (random() > 0.3) continue;
      const [x, y] = outline[i];
      if (y >= bottomY - ppu * 0.3) continue;
      context.fillStyle = ink(alpha * (0.4 + random() * 0.4));
      const radius = ppu * (0.03 + random() * 0.05);
      dab(context, x + (random() - 0.5) * ppu * 0.3, y + random() * ppu * 0.45, radius, radius * 0.8, 0);
    }
  }

  if (peak.pine) {
    const [x, y] = outline[summit];
    drawPine(context, x, y + ppu * 0.08, ppu * (1.3 + random() * 0.5), Math.min(1, alpha * 1.5), random);
  }
}

function paintCliffShadows(context: CanvasRenderingContext2D, layer: LandscapeLayerSpec) {
  const ppu = layer.pxPerUnit;
  const toX = (x: number) => (x + layer.width / 2) * ppu;
  const toY = (y: number) => (layer.height - y) * ppu;
  const random = createRandom(layer.seed * 3 + 5);
  // A feathered dark wash behind a waterfall, built from overlapping soft vertical strokes.
  for (const shadow of layer.cliffShadows ?? []) {
    const top = toY(shadow.top);
    const bottom = toY(shadow.bottom);
    for (let stroke = 0; stroke < 24; stroke++) {
      const offset = (random() * 2 - 1) * shadow.width * 0.5;
      const weight = 1 - Math.abs(offset) / (shadow.width * 0.5);
      const x = toX(shadow.x + offset);
      const strokeTop = top + random() * ppu * 0.8;
      const gradient = context.createLinearGradient(0, strokeTop, 0, bottom);
      gradient.addColorStop(0, ink(layer.inkAlpha * 0.4 * weight));
      gradient.addColorStop(0.6, ink(layer.inkAlpha * 0.24 * weight));
      gradient.addColorStop(1, ink(0));
      context.strokeStyle = gradient;
      context.lineWidth = ppu * shadow.width * (0.12 + random() * 0.18);
      context.beginPath();
      context.moveTo(x, strokeTop);
      context.quadraticCurveTo(x + (random() - 0.5) * ppu * 0.4, (strokeTop + bottom) / 2, x + (random() - 0.5) * ppu * 0.3, bottom);
      context.stroke();
    }
  }
}

function eraseClouds(context: CanvasRenderingContext2D, layer: LandscapeLayerSpec) {
  const ppu = layer.pxPerUnit;
  const toX = (x: number) => (x + layer.width / 2) * ppu;
  const toY = (y: number) => (layer.height - y) * ppu;
  layer.clouds.forEach((cloud, cloudIndex) => {
    const random = createRandom(layer.seed * 13 + cloudIndex * 101);
    const count = Math.round(layer.width / 1.4);
    for (let billow = 0; billow < count; billow++) {
      const x = -layer.width / 2 + random() * layer.width;
      const y = cloud.y + (noise1(layer.seed + cloudIndex * 7, x * 0.08) - 0.5) * layer.height * 0.12 + (random() - 0.5) * 0.8;
      const radius = layer.height * (0.05 + random() * 0.08) * ppu;
      const centerX = toX(x);
      const centerY = toY(y);
      const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, erase(cloud.amount * 0.6));
      gradient.addColorStop(0.6, erase(cloud.amount * 0.3));
      gradient.addColorStop(1, erase(0));
      context.fillStyle = gradient;
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    }
  });
}

function fadeHorizontalEdges(context: CanvasRenderingContext2D, width: number, height: number) {
  const edge = width * 0.07;
  const left = context.createLinearGradient(0, 0, edge, 0);
  left.addColorStop(0, erase(1));
  left.addColorStop(1, erase(0));
  context.fillStyle = left;
  context.fillRect(0, 0, edge, height);
  const right = context.createLinearGradient(width - edge, 0, width, 0);
  right.addColorStop(0, erase(0));
  right.addColorStop(1, erase(1));
  context.fillStyle = right;
  context.fillRect(width - edge, 0, edge, height);
}

export function rangeRow(seed: number, row: RangeRow): PeakSpec[] {
  const peaks: PeakSpec[] = [];
  for (let x = row.from, index = 0; x <= row.to; x += row.step, index++) {
    const random = (key: number) => seedUnit(seed, index * 7 + key);
    peaks.push({
      x: x + (random(2) - 0.5) * row.step * 0.6,
      base: row.base + (random(3) - 0.5) * 0.6,
      halfWidth: THREE.MathUtils.lerp(row.halfWidth[0], row.halfWidth[1], random(4)),
      height: THREE.MathUtils.lerp(row.height[0], row.height[1], random(5)),
      shape: random(1) < row.cragChance ? "crag" : "rolling",
      tone: row.tone * (0.85 + random(6) * 0.3),
    });
  }
  return peaks;
}

export function paintLandscapeLayer(layer: LandscapeLayerSpec) {
  const width = Math.round(layer.width * layer.pxPerUnit);
  const height = Math.round(layer.height * layer.pxPerUnit);
  const { canvas, context } = createCoverageCanvas(width, height);
  layer.peaks.forEach((peak, index) => paintPeak(context, layer, peak, layer.seed * 31 + index));
  paintCliffShadows(context, layer);
  eraseClouds(context, layer);
  fadeHorizontalEdges(context, width, height);
  addPaperGrain(context, width, height, layer.seed, 0.16);
  return toCoverageTexture(canvas);
}

// Pine needles as painted in Korean ink work: fans of fine tapering strokes from one point (송엽).
// A 2×2 atlas: three fans (symmetric, leaning left, leaning right) and one full wheel (차륜형).
// Fans have their base at the bottom of the tile; the wheel is centred.
export function paintNeedleAtlas() {
  const size = 1024;
  const tile = size / 2;
  const { canvas, context } = createCoverageCanvas(size, size);
  const variants = [
    { from: -95, to: 95, wheel: false },
    { from: -115, to: 60, wheel: false },
    { from: -60, to: 115, wheel: false },
    { from: -180, to: 180, wheel: true },
  ];

  variants.forEach((variant, index) => {
    const random = createRandom(401 + index * 37);
    // CanvasTexture flips Y, so atlas row 0 is the bottom half of the canvas.
    const originX = (index % 2) * tile;
    const originY = (1 - Math.floor(index / 2)) * tile;
    const baseX = originX + tile / 2;
    const baseY = originY + (variant.wheel ? tile / 2 : tile * 0.9);
    // Few, bold strokes: at screen size a fan is only ~50px across, so fine needles would vanish.
    const count = variant.wheel ? 30 : 26 + Math.floor(random() * 7);
    for (let needle = 0; needle < count; needle++) {
      const along = count === 1 ? 0.5 : needle / (count - 1);
      const degrees = THREE.MathUtils.lerp(variant.from, variant.to, along) + (random() - 0.5) * 8;
      const angle = THREE.MathUtils.degToRad(degrees);
      // Longer needles in the centre and shorter at the sides give each burst its half-dome.
      const sideFalloff = variant.wheel ? 1 : 0.58 + 0.42 * Math.cos(angle);
      const length = tile * (variant.wheel ? 0.34 + random() * 0.08 : 0.32 + random() * 0.12) * sideFalloff;
      const directionX = Math.sin(angle);
      const directionY = -Math.cos(angle);
      const startRadius = tile * 0.018;
      const startX = baseX + directionX * startRadius;
      const startY = baseY + directionY * startRadius;
      const tipX = baseX + directionX * length;
      const tipY = baseY + directionY * length;
      const bend = (random() - 0.5) * length * 0.12;
      const controlX = (startX + tipX) / 2 - directionY * bend;
      const controlY = (startY + tipY) / 2 + directionX * bend;
      const halfWidth = tile * (0.011 + random() * 0.005);
      context.fillStyle = ink(0.82 + random() * 0.18);
      context.beginPath();
      context.moveTo(startX - directionY * halfWidth, startY + directionX * halfWidth);
      context.quadraticCurveTo(controlX, controlY, tipX, tipY);
      context.quadraticCurveTo(controlX, controlY, startX + directionY * halfWidth, startY - directionX * halfWidth);
      context.closePath();
      context.fill();
    }
    context.fillStyle = ink(1);
    dab(context, baseX, baseY, tile * 0.04, tile * 0.028, 0);
  });

  return toCoverageTexture(canvas);
}

// The soft grey cloud of diluted ink (담묵) laid under each needle pad.
export function paintWashCloud() {
  const size = 256;
  const { canvas, context } = createCoverageCanvas(size, size);
  const random = createRandom(733);
  for (let lobe = 0; lobe < 9; lobe++) {
    const x = size * (0.28 + random() * 0.44);
    const y = size * (0.4 + random() * 0.22);
    const radius = size * (0.16 + random() * 0.14);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, ink(0.55));
    gradient.addColorStop(0.6, ink(0.3));
    gradient.addColorStop(1, ink(0));
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  addPaperGrain(context, size, size, 733, 0.25);
  return toCoverageTexture(canvas);
}

export function paintMistBand(seed: number) {
  const width = 1024;
  const height = 256;
  const { canvas, context } = createCoverageCanvas(width, height);
  const band = context.createLinearGradient(0, 0, 0, height);
  band.addColorStop(0, ink(0));
  band.addColorStop(0.45, ink(0));
  band.addColorStop(0.65, ink(0.72));
  band.addColorStop(1, ink(0.9));
  context.fillStyle = band;
  context.fillRect(0, 0, width, height);

  const random = createRandom(seed);
  for (let billow = 0; billow < 90; billow++) {
    const x = random() * width;
    const y = height * (0.38 + random() * 0.3);
    const radius = height * (0.12 + random() * 0.2);
    for (const wrapX of [x - width, x, x + width]) {
      const gradient = context.createRadialGradient(wrapX, y, 0, wrapX, y, radius);
      gradient.addColorStop(0, ink(0.5));
      gradient.addColorStop(1, ink(0));
      context.fillStyle = gradient;
      context.fillRect(wrapX - radius, y - radius, radius * 2, radius * 2);
    }
  }

  const texture = toCoverageTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
