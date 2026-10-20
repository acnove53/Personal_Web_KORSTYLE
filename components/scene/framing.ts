import * as THREE from "three";

export type ScreenRect = { left: number; top: number; right: number; bottom: number };
export type CameraOffset = { x: number; y: number; z: number };

type FramingInput = {
  points: THREE.Vector3[];
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  fov: number;
  width: number;
  height: number;
  textRect: ScreenRect | null;
};

const textMargin = 56;
const noOffset: CameraOffset = { x: 0, y: 0, z: 0 };

// Finds the camera offset that keeps every point (the clickable dots) out from under the chapter text:
// pull the camera back by a scale k, then slide the tree right (landscape) or down (portrait).
// Assumes the base camera looks straight down -z, as it does in the canopy and roots views.
export function computeFraming({ points, cameraX, cameraY, cameraZ, fov, width, height, textRect }: FramingInput): CameraOffset {
  if (!textRect || points.length === 0 || width <= 0 || height <= 0) return noOffset;
  const landscape = width >= height;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const aspect = width / height;
  const screen = points.map((point) => {
    const distance = cameraZ - point.z;
    return {
      x: width / 2 + ((point.x - cameraX) / (distance * tanHalf * aspect)) * (width / 2),
      y: height / 2 - ((point.y - cameraY) / (distance * tanHalf)) * (height / 2),
    };
  });

  const box = landscape
    ? { x0: textRect.right + textMargin, x1: width - (width * 0.052 + 170), y0: 110, y1: height - 110 }
    : { x0: 32, x1: width - 64, y0: textRect.bottom + textMargin, y1: height - 170 };
  const main = landscape ? "x" : "y";
  const cross = landscape ? "y" : "x";
  const mainStart = landscape ? box.x0 : box.y0;
  const mainEnd = landscape ? box.x1 : box.y1;
  const crossStart = landscape ? box.y0 : box.x0;
  const crossEnd = landscape ? box.y1 : box.x1;
  if (mainEnd - mainStart < 120) return noOffset;

  const center = { x: width / 2, y: height / 2 };
  const mainValues = screen.map((point) => point[main]);
  const span = Math.max(...mainValues) - Math.min(...mainValues);
  let scale = span > 0 ? (mainEnd - mainStart) / span : 1;
  for (const point of screen) {
    const offset = point[cross] - center[cross];
    if (offset > 0 && crossEnd > center[cross]) scale = Math.min(scale, (crossEnd - center[cross]) / offset);
    if (offset < 0 && crossStart < center[cross]) scale = Math.min(scale, (center[cross] - crossStart) / -offset);
  }
  scale = THREE.MathUtils.clamp(scale, landscape ? 0.65 : 0.5, 1);

  const scaled = mainValues.map((value) => center[main] + (value - center[main]) * scale);
  const low = mainStart - Math.min(...scaled);
  const high = mainEnd - Math.max(...scaled);
  // Prefer the smallest move; if the dots cannot fit at all, clearing the text wins.
  const shift = low > high ? low : THREE.MathUtils.clamp(0, low, high);

  const baseDistance = cameraZ;
  const distance = baseDistance / scale;
  const unitsPerPixel = landscape
    ? (distance * tanHalf * aspect) / (width / 2)
    : (distance * tanHalf) / (height / 2);
  return {
    x: landscape ? -shift * unitsPerPixel : 0,
    y: landscape ? 0 : shift * unitsPerPixel,
    z: distance - baseDistance,
  };
}
