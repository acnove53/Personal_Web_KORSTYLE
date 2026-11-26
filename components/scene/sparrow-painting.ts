// Paints the sparrow's parts in code: loose brown ink wash, a cream belly, a white cheek with a black ear patch,
// layered dry-brush feathers. Each part gets its own cell in one atlas and is drawn in the SAME bird frame (the
// assembled, perched bird), so the rig can stack the cells as they are and rotate each one about its joint.

export const sparrowCell = 384;
export const sparrowColumns = 4;
export const sparrowRows = 4;

export const sparrowParts = [
  "body", "head", "tail", "tailFan",
  "wingFolded", "wingTucked", "wingUp", "wingUpMid",
  "wingLevel", "wingDownMid", "wingDown", "legsPerch",
  "legsTrail",
] as const;
export type SparrowPart = (typeof sparrowParts)[number];

export function sparrowPartCell(part: SparrowPart) {
  const index = sparrowParts.indexOf(part);
  return { column: index % sparrowColumns, row: Math.floor(index / sparrowColumns) };
}

type Point = [number, number];

// Joints and landmarks in cell pixels (x right, y down). The bird faces right.
export const sparrowFrame = {
  neck: [236, 172] as Point,
  shoulder: [196, 196] as Point,
  tail: [106, 256] as Point,
  hip: [178, 272] as Point,
  // Where the feet stand, so a perched sprite can be hung from its feet.
  feet: [186, 352] as Point,
};

const body = { center: [186, 228] as Point, rx: 94, ry: 55, rotation: -0.4 };
const head = { center: [262, 146] as Point, radius: 38 };

const palette = {
  cap: "#6a3a28",
  capDark: "#43261b",
  back: "#7a4b34",
  backMid: "#8c5a3e",
  backLight: "#a8764f",
  streak: "#2a1a13",
  cheek: "#f5efe4",
  belly: "#ecd9b4",
  bellyShade: "#d2b389",
  breast: "#c9b49a",
  tail: "#5a3a2b",
  beak: "#2b2623",
  beakLow: "#8a6a4f",
  leg: "#76604f",
  edge: "#3a2418",
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

function withAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// A tapered brush stroke along a quadratic curve: overlapping ink dabs whose width and pressure vary.
function stroke(brush: Brush, from: Point, control: Point, to: Point, startWidth: number, endWidth: number, color: string, alpha: number) {
  const { context, random } = brush;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(6, Math.ceil(length / 1.4));
  context.fillStyle = color;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * control[0] + t * t * to[0];
    const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * control[1] + t * t * to[1];
    const dx = 2 * (1 - t) * (control[0] - from[0]) + 2 * t * (to[0] - control[0]);
    const dy = 2 * (1 - t) * (control[1] - from[1]) + 2 * t * (to[1] - control[1]);
    const width = lerp(startWidth, endWidth, t) * (0.85 + random() * 0.3);
    context.globalAlpha = alpha * (0.55 + random() * 0.45);
    context.beginPath();
    context.ellipse(x + (random() - 0.5) * 0.6, y + (random() - 0.5) * 0.6, Math.max(0.4, width * 0.9), Math.max(0.3, width * 0.5), Math.atan2(dy, dx), 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

// A soft pool of colour, like a loaded brush pressed flat.
function wash(brush: Brush, x: number, y: number, radiusX: number, radiusY: number, rotation: number, color: string, alpha: number, core = 0.6) {
  const { context } = brush;
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(radiusX, radiusY);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, color);
  gradient.addColorStop(core, color);
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

type FeatherOptions = {
  color: string;
  tipColor?: string;
  edgeColor?: string;
  alpha?: number;
  width?: number;
  bend?: number;
};

// One feather: a leaf shape from its base to its tip, darker toward the tip, with a pale dry-brush edge and a quill.
function feather(brush: Brush, base: Point, angle: number, length: number, options: FeatherOptions) {
  const { context, random } = brush;
  const width = (options.width ?? length * 0.16) * (0.9 + random() * 0.2);
  const bend = (options.bend ?? 0) + (random() - 0.5) * 0.08 * length;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const tip: Point = [base[0] + dx * length + nx * bend, base[1] + dy * length + ny * bend];
  const mid: Point = [base[0] + dx * length * 0.5 + nx * bend * 0.5, base[1] + dy * length * 0.5 + ny * bend * 0.5];
  const left: Point = [mid[0] + nx * width, mid[1] + ny * width];
  const right: Point = [mid[0] - nx * width * 0.8, mid[1] - ny * width * 0.8];
  const alpha = options.alpha ?? 0.94;

  context.save();
  const gradient = context.createLinearGradient(base[0], base[1], tip[0], tip[1]);
  gradient.addColorStop(0, options.color);
  gradient.addColorStop(0.65, options.color);
  gradient.addColorStop(1, options.tipColor ?? options.color);
  context.globalAlpha = alpha * (0.85 + random() * 0.15);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(base[0], base[1]);
  context.quadraticCurveTo(left[0], left[1], tip[0], tip[1]);
  context.quadraticCurveTo(right[0], right[1], base[0], base[1]);
  context.fill();
  // The quill, and a pale fringe along the leading edge.
  context.globalAlpha = alpha * 0.55;
  context.strokeStyle = options.tipColor ?? palette.capDark;
  context.lineWidth = Math.max(0.8, width * 0.12);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(base[0], base[1]);
  context.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]);
  context.stroke();
  if (options.edgeColor) {
    context.globalAlpha = alpha * 0.6;
    context.strokeStyle = options.edgeColor;
    context.lineWidth = Math.max(0.8, width * 0.2);
    context.beginPath();
    context.moveTo(base[0] + nx * width * 0.55, base[1] + ny * width * 0.55);
    context.quadraticCurveTo(left[0] * 0.98 + mid[0] * 0.02, left[1] * 0.98 + mid[1] * 0.02, tip[0], tip[1]);
    context.stroke();
  }
  context.restore();
}

function paintBody(brush: Brush) {
  const { random } = brush;
  const [cx, cy] = body.center;
  const direction: Point = [Math.cos(body.rotation), Math.sin(body.rotation)];
  const perpendicular: Point = [-direction[1], direction[0]]; // points down the body's underside
  const at = (along: number, across: number): Point => [
    cx + direction[0] * along + perpendicular[0] * across,
    cy + direction[1] * along + perpendicular[1] * across,
  ];

  // A brown egg, then the cream belly and a greyer breast laid over its underside.
  wash(brush, cx, cy, body.rx * 1.04, body.ry * 1.02, body.rotation, palette.back, 0.97, 0.74);
  wash(brush, ...at(8, 30), body.rx * 0.82, body.ry * 0.58, body.rotation, palette.belly, 0.97, 0.66);
  wash(brush, ...at(58, 16), 40, 38, 0, palette.breast, 0.7, 0.4);
  wash(brush, ...at(-6, 44), body.rx * 0.6, body.ry * 0.22, body.rotation, palette.bellyShade, 0.45, 0.3);

  // Fine feather ticks on the belly and breast, so it reads as plumage and not a flat wash.
  for (let index = 0; index < 54; index += 1) {
    const along = lerp(-60, 76, random());
    const across = lerp(10, 50, random());
    const [x, y] = at(along, across);
    const angle = body.rotation + Math.PI * 0.5 + (random() - 0.5) * 0.7;
    stroke(brush, [x, y], [x + Math.cos(angle) * 5, y + Math.sin(angle) * 5], [x + Math.cos(angle) * 11, y + Math.sin(angle) * 11], 1.5, 0.5, index % 3 === 0 ? palette.bellyShade : palette.belly, 0.5);
  }

  // The nape and breast run up into the neck; the head hangs from here.
  wash(brush, 232, 182, 40, 34, 0, palette.cheek, 0.9, 0.5);
  wash(brush, 226, 166, 34, 24, -0.4, palette.back, 0.95, 0.6);

  // Dark streaks down the back and a darker rump.
  for (let index = 0; index < 22; index += 1) {
    const along = lerp(-78, 62, random());
    const across = lerp(-52, -14, random());
    const [x, y] = at(along, across);
    const angle = body.rotation + (random() - 0.5) * 0.35;
    const length = 10 + random() * 16;
    stroke(brush, [x, y], [x + Math.cos(angle) * length * 0.5, y + Math.sin(angle) * length * 0.5], [x + Math.cos(angle) * length, y + Math.sin(angle) * length], 2.6, 0.8, palette.streak, 0.62);
  }
  stroke(brush, at(-96, -26), at(-20, -66), at(78, -42), 5, 2.6, palette.edge, 0.5);
  wash(brush, ...at(-82, -10), 26, 22, body.rotation, palette.backLight, 0.5, 0.3);
}

function paintHead(brush: Brush) {
  const [hx, hy] = head.center;
  const r = head.radius;

  // Neck stub (so the head can swing without a gap), the brown nape, and the white cheek in front of it.
  wash(brush, 244, 168, 30, 30, 0, palette.cheek, 0.92, 0.5);
  wash(brush, hx - r * 0.5, hy + r * 0.12, r * 0.86, r * 0.92, 0, palette.back, 0.97, 0.7);
  wash(brush, hx + r * 0.12, hy + r * 0.2, r * 0.84, r * 0.78, 0, palette.cheek, 0.98, 0.7);
  // Chestnut crown, darker down its middle.
  wash(brush, hx - r * 0.1, hy - r * 0.46, r * 1.06, r * 0.62, -0.1, palette.cap, 0.99, 0.7);
  stroke(brush, [hx - r * 0.9, hy - r * 0.34], [hx - r * 0.2, hy - r * 0.82], [hx + r * 0.62, hy - r * 0.42], 7, 4, palette.capDark, 0.7);
  for (let index = 0; index < 8; index += 1) {
    const x = hx - r * 0.7 + index * r * 0.2;
    stroke(brush, [x, hy - r * 0.6], [x + 2, hy - r * 0.4], [x + 3, hy - r * 0.2], 2.2, 0.7, palette.capDark, 0.45);
  }
  // The black ear patch behind the eye and the black bib under the beak.
  dot(brush, hx - r * 0.06, hy + r * 0.2, r * 0.15, r * 0.21, 0.3, palette.streak, 0.9);
  wash(brush, hx + r * 0.32, hy + r * 0.84, r * 0.4, r * 0.3, 0, palette.streak, 0.85, 0.6);
  // The eye, with a pinprick highlight.
  dot(brush, hx + r * 0.3, hy - r * 0.04, r * 0.13, r * 0.13, 0, palette.streak, 1);
  dot(brush, hx + r * 0.34, hy - r * 0.09, r * 0.04, r * 0.04, 0, "#f7f1e6", 0.9);
  // A short, thick seed-eater's beak: dark above, paler below.
  const bx = hx + r * 0.86;
  const by = hy + r * 0.14;
  brush.context.globalAlpha = 0.98;
  brush.context.fillStyle = palette.beakLow;
  brush.context.beginPath();
  brush.context.moveTo(bx - 4, by + 1);
  brush.context.quadraticCurveTo(bx + r * 0.42, by + 3, bx + r * 0.62, by + r * 0.2);
  brush.context.quadraticCurveTo(bx + r * 0.3, by + r * 0.26, bx - 4, by + r * 0.16);
  brush.context.fill();
  brush.context.fillStyle = palette.beak;
  brush.context.beginPath();
  brush.context.moveTo(bx - 6, by - r * 0.16);
  brush.context.quadraticCurveTo(bx + r * 0.46, by - r * 0.1, bx + r * 0.7, by + r * 0.16);
  brush.context.quadraticCurveTo(bx + r * 0.36, by + r * 0.06, bx - 6, by + r * 0.06);
  brush.context.fill();
  brush.context.globalAlpha = 1;
}

function paintTail(brush: Brush, fan: number) {
  const { random } = brush;
  const [tx, ty] = sparrowFrame.tail;
  const count = 7;
  const centre = radians(148);
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1) - 0.5;
    const angle = centre + t * fan + (random() - 0.5) * 0.03;
    const length = 104 * (0.94 + random() * 0.08) * (1 - Math.abs(t) * 0.1);
    feather(brush, [tx + (random() - 0.5) * 5, ty + (random() - 0.5) * 5], angle, length, {
      color: index % 2 === 0 ? palette.tail : palette.cap,
      tipColor: palette.capDark,
      edgeColor: palette.backLight,
      width: 11,
      alpha: 0.95,
    });
  }
  wash(brush, tx + 4, ty + 2, 16, 13, 0, palette.back, 0.85, 0.5);
}

// Open flight wings fan out from the shoulder; the angle and length change with the beat, as a side view foreshortens them.
function paintOpenWing(brush: Brush, angle: number, lengthScale: number, spread: number) {
  const { random } = brush;
  const [sx, sy] = sparrowFrame.shoulder;
  const length = 158 * lengthScale;
  const primaries = 7;
  const secondaries = 6;
  const total = primaries + secondaries;
  // Secondaries first (nearest the body), so the long primaries lie over them.
  for (let index = 0; index < total; index += 1) {
    const t = index / (total - 1);
    const feathers = index < secondaries ? "secondary" : "primary";
    const featherAngle = angle + (t - 0.5) * spread;
    const reach = length * (feathers === "primary" ? 0.88 + 0.12 * Math.sin(Math.PI * (0.35 + (t - 0.46) * 1.1)) : 0.66 + 0.1 * t) * (0.96 + random() * 0.06);
    feather(brush, [sx + (random() - 0.5) * 4, sy + (random() - 0.5) * 4], featherAngle, reach, {
      color: index % 2 === 0 ? palette.back : palette.backMid,
      tipColor: palette.capDark,
      edgeColor: palette.backLight,
      width: length * 0.095,
      bend: (t - 0.5) * 6,
      alpha: 0.95,
    });
  }
  // Coverts: rows of short rounded feathers over the root of the wing, with dark spots and two pale bars.
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  wash(brush, sx + dx * length * 0.2, sy + dy * length * 0.2, length * 0.26, length * 0.15, angle, palette.back, 0.96, 0.7);
  for (let row = 0; row < 3; row += 1) {
    for (let index = 0; index < 5; index += 1) {
      const t = (index / 4 - 0.5) * spread * 0.9;
      feather(brush, [sx + dx * length * (0.08 + row * 0.09), sy + dy * length * (0.08 + row * 0.09)], angle + t, length * (0.3 - row * 0.03), {
        color: row === 1 ? palette.backLight : palette.backMid,
        tipColor: palette.cap,
        width: length * 0.06,
        alpha: 0.8,
      });
    }
  }
  for (let index = 0; index < 8; index += 1) {
    const along = 0.1 + random() * 0.26;
    const across = (random() - 0.5) * length * 0.2;
    dot(brush, sx + dx * length * along - dy * across, sy + dy * length * along + dx * across, 2.4 + random() * 2, 1.6 + random() * 1.3, angle, palette.streak, 0.7);
  }
  for (const along of [0.3, 0.42]) {
    const centre: Point = [sx + dx * length * along, sy + dy * length * along];
    stroke(brush, [centre[0] - dy * length * 0.12, centre[1] + dx * length * 0.12], centre, [centre[0] + dy * length * 0.12, centre[1] - dx * length * 0.12], 3.6, 2.4, palette.cheek, 0.36);
  }
}

// The wing folded along the flank: scalloped coverts, pale wing bars, and the dark primaries ending at the rump.
function paintFoldedWing(brush: Brush, scale: number, laid: number) {
  const { random } = brush;
  const [sx, sy] = sparrowFrame.shoulder;
  const angle = radians(155 + laid);
  const length = 132 * scale;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;

  // Long flight feathers lie in layers along the flank, the longest (primaries) lowest and darkest.
  for (let index = 0; index < 7; index += 1) {
    const t = index / 6;
    feather(brush, [sx + nx * (t - 0.4) * 30, sy + ny * (t - 0.4) * 30 + 6], angle + (t - 0.5) * 0.14, length * (0.78 + 0.22 * (1 - t)), {
      color: t < 0.4 ? palette.capDark : palette.cap,
      tipColor: palette.streak,
      edgeColor: palette.backLight,
      width: 11,
      alpha: 0.96,
    });
  }
  wash(brush, sx + dx * length * 0.3, sy + dy * length * 0.3, length * 0.4, 25, angle, palette.back, 0.96, 0.72);
  // Scalloped coverts, front to back.
  for (let row = 0; row < 4; row += 1) {
    for (let index = 0; index < 5; index += 1) {
      const along = 0.03 + row * 0.1 + (index % 2) * 0.03;
      const across = (index / 4 - 0.5) * 38;
      const px = sx + dx * length * along + nx * across;
      const py = sy + dy * length * along + ny * across;
      feather(brush, [px, py], angle + (random() - 0.5) * 0.2, 26 + random() * 8, {
        color: row % 2 === 0 ? palette.backMid : palette.backLight,
        tipColor: palette.cap,
        width: 8,
        alpha: 0.88,
      });
    }
  }
  for (let index = 0; index < 9; index += 1) {
    const along = 0.06 + random() * 0.5;
    const across = (random() - 0.5) * 34;
    dot(brush, sx + dx * length * along + nx * across, sy + dy * length * along + ny * across, 2.4 + random() * 2.2, 1.5 + random() * 1.2, angle, palette.streak, 0.75);
  }
  for (const along of [0.26, 0.4]) {
    const centre: Point = [sx + dx * length * along, sy + dy * length * along];
    stroke(brush, [centre[0] - nx * 22, centre[1] - ny * 22], centre, [centre[0] + nx * 22, centre[1] + ny * 22], 3.6, 2.4, palette.cheek, 0.38);
  }
  // The rufous edge along the top of the wing.
  stroke(brush, [sx - 6, sy - 10], [sx + dx * length * 0.5 - 4, sy + dy * length * 0.5 - 24], [sx + dx * length * 0.96, sy + dy * length * 0.96 - 6], 4, 2, palette.backLight, 0.55);
}

function paintLegs(brush: Brush, trailing: boolean) {
  const [hx, hy] = sparrowFrame.hip;
  const [fx, fy] = sparrowFrame.feet;
  for (const [index, side] of [-1, 1].entries()) {
    const footX = trailing ? fx + 14 + side * 14 : fx + side * 12;
    const footY = trailing ? fy - 16 : fy - 4;
    const kneeX = trailing ? hx + 6 + side * 6 : hx + side * 4 - 4;
    const kneeY = trailing ? hy + 26 : hy + 24;
    const colour = index === 0 ? palette.leg : withAlpha(palette.leg, 0.88);
    // Thigh feathers, then the thin scaled shank.
    stroke(brush, [hx + side * 6, hy - 6], [hx + side * 10, hy + 8], [kneeX, kneeY], 8, 4.4, palette.belly, 0.95);
    stroke(brush, [kneeX, kneeY], [(kneeX + footX) / 2 - 3, (kneeY + footY) / 2], [footX, footY], 3.8, 2.4, colour, 0.98);
    for (let scale = 1; scale < 6; scale += 1) {
      const t = scale / 6;
      const x = lerp(kneeX, footX, t) - 1.5;
      const y = lerp(kneeY, footY, t);
      stroke(brush, [x, y], [x + 1.5, y + 0.5], [x + 3, y + 1], 1, 1, palette.edge, 0.25);
    }
    // Toes: three reaching forward and one back, gripping or spread.
    const toes = trailing ? [-0.9, -0.4, 0.05, 0.55] : [-0.35, 0.05, 0.38, 2.9];
    for (const toe of toes) {
      const length = toe > 2 ? 11 : 17;
      const tx = footX + Math.cos(toe + (trailing ? 0.6 : 0)) * length;
      const ty = footY + Math.sin(toe + (trailing ? 0.6 : 0)) * length * 0.5 + (trailing ? 0 : 3);
      stroke(brush, [footX, footY], [(footX + tx) / 2, (footY + ty) / 2 - 1.5], [tx, ty], 2.6, 1.2, colour, 0.98);
    }
  }
}

type PartPainter = (brush: Brush) => void;

const wingFrames: { part: SparrowPart; angle: number; length: number; spread: number }[] = [
  { part: "wingUp", angle: radians(-108), length: 1, spread: radians(74) },
  { part: "wingUpMid", angle: radians(-142), length: 0.9, spread: radians(62) },
  { part: "wingLevel", angle: radians(-176), length: 0.72, spread: radians(48) },
  { part: "wingDownMid", angle: radians(148), length: 0.92, spread: radians(60) },
  { part: "wingDown", angle: radians(110), length: 1, spread: radians(72) },
];

const painters: Record<SparrowPart, PartPainter> = {
  body: paintBody,
  head: paintHead,
  tail: (brush) => paintTail(brush, 0.16),
  tailFan: (brush) => paintTail(brush, 0.95),
  wingFolded: (brush) => paintFoldedWing(brush, 1, 0),
  wingTucked: (brush) => paintFoldedWing(brush, 0.84, 6),
  wingUp: (brush) => paintOpenWing(brush, wingFrames[0].angle, wingFrames[0].length, wingFrames[0].spread),
  wingUpMid: (brush) => paintOpenWing(brush, wingFrames[1].angle, wingFrames[1].length, wingFrames[1].spread),
  wingLevel: (brush) => paintOpenWing(brush, wingFrames[2].angle, wingFrames[2].length, wingFrames[2].spread),
  wingDownMid: (brush) => paintOpenWing(brush, wingFrames[3].angle, wingFrames[3].length, wingFrames[3].spread),
  wingDown: (brush) => paintOpenWing(brush, wingFrames[4].angle, wingFrames[4].length, wingFrames[4].spread),
  legsPerch: (brush) => paintLegs(brush, false),
  legsTrail: (brush) => paintLegs(brush, true),
};

// Bare-paper flecks dragged along the strokes, so the ink looks dry-brushed.
function dryBrush(context: CanvasRenderingContext2D, random: () => number, count: number) {
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.lineCap = "round";
  for (let index = 0; index < count; index += 1) {
    const x = 40 + random() * 300;
    const y = 40 + random() * 300;
    const angle = radians(150) + (random() - 0.5) * 1.3;
    const size = 3 + random() * 9;
    context.globalAlpha = 0.14 + random() * 0.3;
    context.lineWidth = 0.6 + random() * 0.9;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    context.stroke();
  }
  context.restore();
}

// A fresh canvas holding every part. Each part is painted on its own layer, then pressed into the sheet over a soft
// halo of its own colour: ink bleeding into the paper.
export function paintSparrowAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = sparrowCell * sparrowColumns;
  canvas.height = sparrowCell * sparrowRows;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const layer = document.createElement("canvas");
  layer.width = sparrowCell;
  layer.height = sparrowCell;
  const layerContext = layer.getContext("2d");
  if (!layerContext) return canvas;

  for (const [index, part] of sparrowParts.entries()) {
    const random = createRandom(7100 + index * 61);
    layerContext.clearRect(0, 0, sparrowCell, sparrowCell);
    painters[part]({ context: layerContext, random });
    dryBrush(layerContext, random, part.startsWith("wing") || part.startsWith("tail") ? 70 : 46);

    const { column, row } = sparrowPartCell(part);
    context.save();
    context.shadowColor = "rgba(98, 62, 42, 0.5)";
    context.shadowBlur = 7;
    context.drawImage(layer, column * sparrowCell, row * sparrowCell);
    context.restore();
    context.drawImage(layer, column * sparrowCell, row * sparrowCell);
  }
  return canvas;
}
