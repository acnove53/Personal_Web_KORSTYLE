// Paints the sparrow sprite sheet in code: loose brown ink wash, a pale cream belly, a white cheek with a black
// ear patch, and dry-brush wing feathers. Every sparrow in the scene reads one cell of this sheet.

export const sparrowPoses = ["perched", "perchedPeck", "wingsUp", "wingsLevel", "wingsDown", "landingFlare"] as const;
export type SparrowPose = (typeof sparrowPoses)[number];

export const sparrowAtlas = { cell: 256, columns: 3, rows: 2 };

// Where a perched sparrow's feet sit inside its cell, as fractions of the cell (x right, y down).
export const sparrowFeet = { x: 118 / 256, y: 214 / 256 };

export function sparrowPoseCell(pose: SparrowPose) {
  const index = sparrowPoses.indexOf(pose);
  return { column: index % sparrowAtlas.columns, row: Math.floor(index / sparrowAtlas.columns) };
}

type Point = [number, number];

const palette = {
  cap: "#6c3d2a",
  capDark: "#47281d",
  back: "#7b4b34",
  backLight: "#98694a",
  streak: "#2b1b15",
  cheek: "#f4eee3",
  belly: "#e9d4ae",
  bellyShade: "#cfae82",
  tail: "#58392a",
  beak: "#2b2623",
  leg: "#6e5b50",
};

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

type Brush = { context: CanvasRenderingContext2D; random: () => number };

// A tapered brush stroke along a quadratic curve: overlapping ink dabs whose width and pressure vary.
function stroke(brush: Brush, from: Point, control: Point, to: Point, startWidth: number, endWidth: number, color: string, alpha: number) {
  const { context, random } = brush;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(6, Math.ceil(length / 1.6));
  context.fillStyle = color;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * control[0] + t * t * to[0];
    const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * control[1] + t * t * to[1];
    const dx = 2 * (1 - t) * (control[0] - from[0]) + 2 * t * (to[0] - control[0]);
    const dy = 2 * (1 - t) * (control[1] - from[1]) + 2 * t * (to[1] - control[1]);
    const width = lerp(startWidth, endWidth, t) * (0.82 + random() * 0.36);
    context.globalAlpha = alpha * (0.5 + random() * 0.5);
    context.beginPath();
    context.ellipse(x + (random() - 0.5) * 0.8, y + (random() - 0.5) * 0.8, Math.max(0.4, width * 0.9), Math.max(0.3, width * 0.5), Math.atan2(dy, dx), 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function withAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// A soft pool of colour, like a loaded brush pressed flat.
function wash(brush: Brush, x: number, y: number, radiusX: number, radiusY: number, rotation: number, color: string, alpha: number) {
  const { context } = brush;
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(radiusX, radiusY);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.62, color);
  gradient.addColorStop(1, withAlpha(color, 0));
  context.globalAlpha = alpha;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 1, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.globalAlpha = 1;
}

function dot(brush: Brush, x: number, y: number, radiusX: number, radiusY: number, rotation: number, color: string, alpha = 1) {
  const { context } = brush;
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

type Spec = {
  body: { x: number; y: number; rx: number; ry: number; rotation: number };
  head: { x: number; y: number; r: number; beakAngle: number };
  tail: { from: Point; to: Point; fan: number };
  // folded wings sit on the body; open wings fan out from the shoulder
  wing: { shoulder: Point; from: number; to: number; length: number; count: number; far?: boolean };
  legs?: { hip: Point; footY: number; spread: number };
};

function paintBird(brush: Brush, spec: Spec) {
  const { context, random } = brush;
  const { body, head, tail, wing, legs } = spec;
  const bodyDirection: Point = [Math.cos(body.rotation), Math.sin(body.rotation)];
  const bodyPerpendicular: Point = [-bodyDirection[1], bodyDirection[0]];
  const rear: Point = [body.x - bodyDirection[0] * body.rx, body.y - bodyDirection[1] * body.rx];
  const front: Point = [body.x + bodyDirection[0] * body.rx, body.y + bodyDirection[1] * body.rx];

  // Legs first, so the body overlaps their tops.
  if (legs) {
    for (const side of [-1, 1]) {
      const footX = legs.hip[0] + side * legs.spread;
      stroke(brush, [legs.hip[0] + side * 5, legs.hip[1]], [legs.hip[0] + side * 7, (legs.hip[1] + legs.footY) / 2], [footX, legs.footY], 3, 2, palette.leg, 0.9);
      for (const toe of [-1, 0.2, 1.3]) {
        stroke(brush, [footX, legs.footY], [footX + toe * 6, legs.footY + 1], [footX + toe * 11, legs.footY + (toe === 0.2 ? 3 : 1)], 2, 1, palette.leg, 0.85);
      }
    }
  }

  // Tail: a few long dark strokes that fan out from the rump.
  for (let index = 0; index < 4; index += 1) {
    const spread = (index / 3 - 0.5) * tail.fan;
    const dx = tail.to[0] - tail.from[0];
    const dy = tail.to[1] - tail.from[1];
    const angle = Math.atan2(dy, dx) + spread;
    const length = Math.hypot(dx, dy) * (0.9 + random() * 0.15);
    const end: Point = [tail.from[0] + Math.cos(angle) * length, tail.from[1] + Math.sin(angle) * length];
    const middle: Point = [lerp(tail.from[0], end[0], 0.5) + (random() - 0.5) * 4, lerp(tail.from[1], end[1], 0.5) + (random() - 0.5) * 4];
    stroke(brush, tail.from, middle, end, 7, 3, index % 2 === 0 ? palette.tail : palette.capDark, 0.9);
  }

  // A brown egg for the body, the cream belly over its lower front, and a darker contour along the back.
  wash(brush, body.x, body.y, body.rx * 1.02, body.ry * 1.0, body.rotation, palette.back, 0.95);
  wash(brush, body.x + bodyPerpendicular[0] * body.ry * 0.42 + bodyDirection[0] * body.rx * 0.1, body.y + bodyPerpendicular[1] * body.ry * 0.42 + bodyDirection[1] * body.rx * 0.1, body.rx * 0.8, body.ry * 0.62, body.rotation, palette.belly, 0.97);
  wash(brush, body.x + bodyPerpendicular[0] * body.ry * 0.8, body.y + bodyPerpendicular[1] * body.ry * 0.8, body.rx * 0.5, body.ry * 0.28, body.rotation, palette.bellyShade, 0.3);
  stroke(
    brush,
    [rear[0] - bodyPerpendicular[0] * body.ry * 0.5, rear[1] - bodyPerpendicular[1] * body.ry * 0.5],
    [body.x - bodyPerpendicular[0] * body.ry * 0.95, body.y - bodyPerpendicular[1] * body.ry * 0.95],
    [front[0] - bodyPerpendicular[0] * body.ry * 0.55, front[1] - bodyPerpendicular[1] * body.ry * 0.55],
    5,
    3,
    palette.capDark,
    0.55,
  );

  // Head: chestnut cap, white cheek, black ear patch and bib, a dark eye and the beak.
  const headDirection: Point = [Math.cos(head.beakAngle), Math.sin(head.beakAngle)];
  // The nape and back of the head are brown; the white cheek sits in front of it.
  wash(brush, head.x - head.r * 0.45, head.y + head.r * 0.05, head.r * 0.85, head.r * 0.9, 0, palette.back, 0.95);
  wash(brush, head.x + head.r * 0.12, head.y + head.r * 0.12, head.r * 0.82, head.r * 0.78, 0, palette.cheek, 0.97);
  stroke(brush, [head.x - head.r * 0.1, head.y + head.r * 0.95], [head.x + head.r * 0.5, head.y + head.r * 1.0], [head.x + head.r * 0.85, head.y + head.r * 0.5], 2.6, 1.2, palette.bellyShade, 0.55);
  wash(brush, head.x - head.r * 0.1, head.y - head.r * 0.42, head.r * 1.08, head.r * 0.66, -0.12, palette.cap, 0.98);
  stroke(brush, [head.x - head.r * 0.9, head.y - head.r * 0.2], [head.x - head.r * 0.2, head.y - head.r * 0.75], [head.x + head.r * 0.7, head.y - head.r * 0.35], head.r * 0.34, head.r * 0.2, palette.capDark, 0.75);
  dot(brush, head.x - head.r * 0.12, head.y + head.r * 0.12, head.r * 0.24, head.r * 0.2, 0.2, palette.streak, 0.95);
  dot(brush, head.x + head.r * 0.1, head.y + head.r * 0.72, head.r * 0.34, head.r * 0.24, 0, palette.streak, 0.9);
  dot(brush, head.x + head.r * 0.34, head.y - head.r * 0.08, head.r * 0.14, head.r * 0.14, 0, palette.streak, 1);
  const beakBase: Point = [head.x + headDirection[0] * head.r * 0.82, head.y + headDirection[1] * head.r * 0.82 + head.r * 0.05];
  const beakTip: Point = [beakBase[0] + headDirection[0] * head.r * 0.72, beakBase[1] + headDirection[1] * head.r * 0.72];
  stroke(brush, beakBase, [(beakBase[0] + beakTip[0]) / 2, (beakBase[1] + beakTip[1]) / 2], beakTip, head.r * 0.34, head.r * 0.06, palette.beak, 1);

  // Wing: a shoulder patch of covert feathers with dark spots, then fanned flight feathers.
  const { shoulder, length, count } = wing;
  const feathers = Math.max(2, count);
  for (let index = 0; index < feathers; index += 1) {
    const t = feathers === 1 ? 0 : index / (feathers - 1);
    const angle = radians(lerp(wing.from, wing.to, t)) + (random() - 0.5) * 0.06;
    const reach = length * (0.8 + 0.28 * Math.sin(Math.PI * (0.15 + t * 0.7))) * (0.94 + random() * 0.1);
    const start: Point = [shoulder[0] + Math.cos(angle) * 8, shoulder[1] + Math.sin(angle) * 8];
    const end: Point = [shoulder[0] + Math.cos(angle) * reach, shoulder[1] + Math.sin(angle) * reach];
    const bend = (random() - 0.5) * 10;
    const middle: Point = [lerp(start[0], end[0], 0.5) - Math.sin(angle) * bend, lerp(start[1], end[1], 0.5) + Math.cos(angle) * bend];
    const alpha = wing.far ? 0.55 : 0.92;
    stroke(brush, start, middle, end, 15, 4.5, index % 2 === 0 ? palette.back : palette.cap, alpha);
    // A pale, dry-brush edge along each feather.
    stroke(brush, start, middle, end, 3, 1.4, palette.backLight, alpha * 0.4);
  }
  const patchAngle = radians((wing.from + wing.to) / 2);
  wash(brush, shoulder[0] + Math.cos(patchAngle) * length * 0.2, shoulder[1] + Math.sin(patchAngle) * length * 0.2, length * 0.42, length * 0.26, patchAngle, palette.back, wing.far ? 0.55 : 0.95);
  context.globalAlpha = 1;
  if (!wing.far) {
    for (let index = 0; index < 7; index += 1) {
      const along = 0.1 + random() * 0.38;
      const off = (random() - 0.5) * length * 0.18;
      dot(
        brush,
        shoulder[0] + Math.cos(patchAngle) * length * along - Math.sin(patchAngle) * off,
        shoulder[1] + Math.sin(patchAngle) * length * along + Math.cos(patchAngle) * off,
        2.2 + random() * 2.2,
        1.4 + random() * 1.2,
        patchAngle,
        palette.streak,
        0.7,
      );
    }
    // Two pale wing bars, the sparrow's signature.
    for (const along of [0.34, 0.5]) {
      stroke(
        brush,
        [shoulder[0] + Math.cos(patchAngle - 0.25) * length * along, shoulder[1] + Math.sin(patchAngle - 0.25) * length * along],
        [shoulder[0] + Math.cos(patchAngle) * length * (along + 0.02), shoulder[1] + Math.sin(patchAngle) * length * (along + 0.02)],
        [shoulder[0] + Math.cos(patchAngle + 0.25) * length * along, shoulder[1] + Math.sin(patchAngle + 0.25) * length * along],
        2.4,
        1.6,
        palette.backLight,
        0.55,
      );
    }
  }

  // Dry brush: flecks of bare paper dragged through the body and wing along the stroke direction.
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.lineCap = "round";
  for (let index = 0; index < 34; index += 1) {
    const x = body.x + (random() - 0.5) * (body.rx * 2.4) + (wing.far ? 0 : Math.cos(patchAngle) * length * 0.4);
    const y = body.y + (random() - 0.5) * (body.ry * 2.6) + (wing.far ? 0 : Math.sin(patchAngle) * length * 0.4);
    const angle = patchAngle + (random() - 0.5) * 0.5;
    const size = 4 + random() * 11;
    context.globalAlpha = 0.2 + random() * 0.35;
    context.lineWidth = 0.6 + random() * 0.9;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    context.stroke();
  }
  context.restore();
  context.globalAlpha = 1;
}

// Feet land here in the cell (see sparrowFeet), so the sprite can be anchored on the branch.
const perchedLegs = { hip: [118, 178] as Point, footY: 214, spread: 11 };

function specFor(pose: SparrowPose): Spec[] {
  switch (pose) {
    case "perched":
      return [{
        body: { x: 118, y: 148, rx: 58, ry: 40, rotation: -0.5 },
        head: { x: 172, y: 98, r: 31, beakAngle: 0.08 },
        tail: { from: [74, 172], to: [28, 214], fan: 0.34 },
        wing: { shoulder: [132, 124], from: 152, to: 176, length: 80, count: 6 },
        legs: perchedLegs,
      }];
    case "perchedPeck":
      return [{
        body: { x: 112, y: 156, rx: 58, ry: 40, rotation: -0.24 },
        head: { x: 190, y: 128, r: 31, beakAngle: 1.0 },
        tail: { from: [62, 168], to: [24, 200], fan: 0.34 },
        wing: { shoulder: [126, 134], from: 158, to: 182, length: 82, count: 6 },
        legs: perchedLegs,
      }];
    case "wingsUp":
      return [
        {
          body: { x: 126, y: 146, rx: 46, ry: 29, rotation: -0.3 },
          head: { x: 172, y: 122, r: 25, beakAngle: 0.1 },
          tail: { from: [86, 158], to: [34, 176], fan: 0.3 },
          wing: { shoulder: [140, 126], from: -128, to: -62, length: 108, count: 7, far: true },
        },
        {
          body: { x: 126, y: 146, rx: 46, ry: 29, rotation: -0.3 },
          head: { x: 172, y: 122, r: 25, beakAngle: 0.1 },
          tail: { from: [86, 158], to: [34, 176], fan: 0.3 },
          wing: { shoulder: [122, 128], from: -132, to: -58, length: 112, count: 8 },
        },
      ];
    case "wingsLevel":
      return [
        {
          body: { x: 126, y: 144, rx: 46, ry: 29, rotation: -0.1 },
          head: { x: 172, y: 132, r: 25, beakAngle: 0.08 },
          tail: { from: [86, 150], to: [32, 158], fan: 0.3 },
          wing: { shoulder: [140, 128], from: -178, to: -138, length: 92, count: 6, far: true },
        },
        {
          body: { x: 126, y: 144, rx: 46, ry: 29, rotation: -0.1 },
          head: { x: 172, y: 132, r: 25, beakAngle: 0.08 },
          tail: { from: [86, 150], to: [32, 158], fan: 0.3 },
          wing: { shoulder: [122, 130], from: -184, to: -132, length: 96, count: 7 },
        },
      ];
    case "wingsDown":
      return [
        {
          body: { x: 126, y: 130, rx: 46, ry: 29, rotation: 0.05 },
          head: { x: 172, y: 124, r: 25, beakAngle: 0.15 },
          tail: { from: [86, 134], to: [34, 140], fan: 0.3 },
          wing: { shoulder: [140, 138], from: 52, to: 104, length: 100, count: 7, far: true },
        },
        {
          body: { x: 126, y: 130, rx: 46, ry: 29, rotation: 0.05 },
          head: { x: 172, y: 124, r: 25, beakAngle: 0.15 },
          tail: { from: [86, 134], to: [34, 140], fan: 0.3 },
          wing: { shoulder: [122, 140], from: 48, to: 112, length: 106, count: 8 },
        },
      ];
    case "landingFlare":
      return [
        {
          body: { x: 120, y: 142, rx: 48, ry: 32, rotation: -0.85 },
          head: { x: 160, y: 94, r: 27, beakAngle: 0.1 },
          tail: { from: [98, 170], to: [64, 232], fan: 0.62 },
          wing: { shoulder: [136, 126], from: -150, to: -36, length: 104, count: 8, far: true },
          legs: { hip: [118, 172], footY: 216, spread: 14 },
        },
        {
          body: { x: 120, y: 142, rx: 48, ry: 32, rotation: -0.85 },
          head: { x: 160, y: 94, r: 27, beakAngle: 0.1 },
          tail: { from: [98, 170], to: [64, 232], fan: 0.62 },
          wing: { shoulder: [118, 130], from: -156, to: -30, length: 110, count: 9 },
        },
      ];
  }
}

// A fresh canvas holding every pose; cells are `sparrowAtlas.cell` square, laid out row by row.
export function paintSparrowAtlas() {
  const { cell, columns, rows } = sparrowAtlas;
  const canvas = document.createElement("canvas");
  canvas.width = cell * columns;
  canvas.height = cell * rows;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  for (const [index, pose] of sparrowPoses.entries()) {
    const { column, row } = sparrowPoseCell(pose);
    context.save();
    context.beginPath();
    context.rect(column * cell, row * cell, cell, cell);
    context.clip();
    context.translate(column * cell, row * cell);
    const brush: Brush = { context, random: createRandom(9100 + index * 53) };
    // Far wing first, then the body with the near wing, so the near wing sits on top.
    for (const spec of specFor(pose)) paintBird(brush, spec);
    context.restore();
  }
  return canvas;
}
