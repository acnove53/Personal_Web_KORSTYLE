import * as THREE from "three";

export const noiseGlsl = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3d(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float a = mix(hash31(cell), hash31(cell + vec3(1.0, 0.0, 0.0)), local.x);
  float b = mix(hash31(cell + vec3(0.0, 1.0, 0.0)), hash31(cell + vec3(1.0, 1.0, 0.0)), local.x);
  float c = mix(hash31(cell + vec3(0.0, 0.0, 1.0)), hash31(cell + vec3(1.0, 0.0, 1.0)), local.x);
  float d = mix(hash31(cell + vec3(0.0, 1.0, 1.0)), hash31(cell + vec3(1.0, 1.0, 1.0)), local.x);
  return mix(mix(a, b, local.y), mix(c, d, local.y), local.z);
}
`;

const fbmGlsl = /* glsl */ `
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise3d(p);
    p = p * 2.03 + vec3(7.0, 13.0, 3.0);
    amplitude *= 0.5;
  }
  return value;
}
`;

// Cells over the bark surface, wrapped around the branch so there is no seam.
const barkCellsGlsl = /* glsl */ `
void barkCells(vec2 p, float around, out float f1, out float f2, out float id, out vec2 toCenter) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  f1 = 8.0;
  f2 = 8.0;
  id = 0.0;
  toCenter = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 wrapped = vec2(mod(cell.x + neighbor.x, around), cell.y + neighbor.y);
      vec2 jitter = vec2(hash31(vec3(wrapped, 3.7)), hash31(vec3(wrapped, 9.1))) * 0.8 + 0.1;
      vec2 offset = neighbor + jitter - local;
      float distance = length(offset * vec2(1.0, 1.25));
      if (distance < f1) {
        f2 = f1;
        f1 = distance;
        id = hash31(vec3(wrapped, 5.3));
        toCenter = offset;
      } else if (distance < f2) {
        f2 = distance;
      }
    }
  }
}
`;

const inkRevealGlsl = /* glsl */ `
float inkReveal(vec3 worldPosition, vec3 normal, float localY, float progress) {
  float drawNoise = fbm(worldPosition * vec3(7.6, 2.1, 7.6) + normal * 3.4);
  float drawFront = mix(-0.78, 9.42, progress) + (drawNoise - 0.5) * 0.48;
  return drawFront - localY;
}
`;

// Trunk, branches and roots painted the way a Korean ink painting builds a pine: a light wash that
// darkens on the shadow side, a brush contour that swells and breaks (flying white), fish-scale
// bark strokes (인갑준) and scattered moss dots (태점). aBark sets how much bark texture a part gets.
export function createInkTrunkMaterial({ wash, noiseStrength, windStrength }: { wash: number; noiseStrength: number; windStrength: number }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: new THREE.Color("#0b0b0a") },
      uPaper: { value: new THREE.Color("#f9f8f6") },
      uLight: { value: new THREE.Vector3(-6, 9, 8).normalize() },
      uFogDensity: { value: 0.24 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uWindStrength: { value: windStrength },
      uWash: { value: wash },
      uNoiseStrength: { value: noiseStrength },
    },
    vertexShader: /* glsl */ `
      attribute float aWash;
      attribute float aRoughness;
      attribute float aBark;
      attribute float aCellsAround;
      attribute float aCellsAlong;
      attribute float aFade;
      uniform float uNoiseStrength;
      uniform float uTime;
      uniform float uWindStrength;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying float vViewDepth;
      varying float vWash;
      varying float vLocalY;
      varying float vBark;
      varying float vRadius;
      varying vec2 vCells;
      varying float vFade;

      ${noiseGlsl}

      void main() {
        float broadNoise = noise3d(position * vec3(3.8, 1.65, 3.8) + vec3(2.3, 7.1, 4.6));
        float barkNoise = noise3d(position * vec3(17.0, 5.3, 17.0) + vec3(13.4, 2.8, 9.1));
        float displacement = ((broadNoise - 0.5) * 1.3 + (barkNoise - 0.5) * 0.4) * aRoughness * uNoiseStrength;
        vec3 gnarledPosition = position + normalize(normal) * displacement;
        float heightMask = smoothstep(2.35, 5.15, position.y);
        float radialMask = smoothstep(0.9, 3.35, length(position.xz));
        float windMask = heightMask * radialMask * uWindStrength;
        float windPhase = uTime * 1.12 + position.x * 0.48 + position.z * 0.82;
        gnarledPosition.x += (sin(windPhase) + 0.32 * cos(uTime * 0.73 + position.z * 1.19)) * 0.034 * windMask;
        gnarledPosition.z += cos(uTime * 0.91 + position.z * 0.61 - position.x * 0.34) * 0.021 * windMask;
        vec4 viewPosition = modelViewMatrix * vec4(gnarledPosition, 1.0);
        vec4 worldPosition = modelMatrix * vec4(gnarledPosition, 1.0);
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPosition = worldPosition.xyz;
        vViewPosition = -viewPosition.xyz;
        vViewDepth = -viewPosition.z;
        vWash = aWash;
        vLocalY = position.y;
        vBark = aBark;
        vRadius = aRoughness;
        vCells = vec2(aCellsAround, aCellsAlong);
        vFade = aFade;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      uniform vec3 uPaper;
      uniform vec3 uLight;
      uniform float uFogDensity;
      uniform float uProgress;
      uniform float uWash;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying float vViewDepth;
      varying float vWash;
      varying float vLocalY;
      varying float vBark;
      varying float vRadius;
      varying vec2 vCells;
      varying float vFade;

      ${noiseGlsl}
      ${fbmGlsl}
      ${barkCellsGlsl}
      ${inkRevealGlsl}

      void main() {
        vec3 viewNormal = normalize(vNormal);
        vec3 worldNormal = normalize(vWorldNormal);
        if (!gl_FrontFacing) {
          viewNormal = -viewNormal;
          worldNormal = -worldNormal;
        }
        vec2 surface = vec2(vUv.x * vCells.x, vUv.y * vCells.y);

        // Wash: pale on the lit side, deeper on the shadow side, with dry streaks running along the branch.
        float shade = smoothstep(0.45, -0.55, dot(worldNormal, uLight));
        float streaks = noise3d(vec3(surface.x * 3.0, surface.y * 0.35, 1.7));
        float fineStreaks = noise3d(vec3(surface.x * 9.0, surface.y * 0.9, 4.1));
        // The shadow side is laid in as one brushed tone with a streaky edge, not a smooth 3D gradient.
        float shadowWash = smoothstep(0.38, 0.52, shade + (streaks - 0.5) * 0.45);
        float ink = uWash + vWash * 0.3 + shadowWash * 0.34 + shade * 0.12 + (streaks - 0.5) * 0.18 + (fineStreaks - 0.5) * 0.1;

        // Fish-scale bark: each plate gets one crescent stroke under its centre, like overlapping scales,
        // rather than a full outline (which would read as cracked tiles).
        float f1;
        float f2;
        float cellId;
        vec2 toCenter;
        barkCells(surface, vCells.x, f1, f2, cellId, toCenter);
        float pressure = noise3d(vec3(surface * vec2(0.6, 0.5), 3.3));
        vec2 fromCenter = -toCenter * vec2(1.0, 1.25);
        float fromLength = max(length(fromCenter), 1e-3);
        float arcRadius = 0.3 + cellId * 0.12;
        float arcLine = 1.0 - smoothstep(0.035, 0.08 + pressure * 0.05, abs(fromLength - arcRadius));
        float below = smoothstep(-0.15, -0.65, fromCenter.y / fromLength);
        float bark = max(vBark, 0.0);
        float scales = arcLine * below * step(0.22, cellId) * bark * smoothstep(0.02, 0.09, vRadius) * mix(0.5, 1.0, shade) * (0.65 + 0.35 * pressure);
        ink = 1.0 - (1.0 - ink) * (1.0 - scales * 0.85);

        // Moss dots on a few plates, mostly on the shadow side.
        float moss = step(0.93, cellId) * (1.0 - smoothstep(0.09, 0.16, f1)) * step(0.15, bark) * mix(0.5, 1.0, shade);
        ink = 1.0 - (1.0 - ink) * (1.0 - moss * 0.9);

        // Rock (aBark = -1): horizontal axe-cut strokes and moss dots on its upper faces.
        float rock = step(vBark, -0.5);
        float axeCut = smoothstep(0.64, 0.72, noise3d(vWorldPosition * vec3(1.4, 9.0, 1.4) + 2.0)) * (0.45 + 0.55 * shade);
        float rockMoss = step(0.86, noise3d(vWorldPosition * 13.0)) * smoothstep(0.2, 0.6, worldNormal.y);
        ink = 1.0 - (1.0 - ink) * (1.0 - rock * axeCut * 0.88);
        ink = 1.0 - (1.0 - ink) * (1.0 - rock * rockMoss * 0.85);

        // Contour: a brush line that swells and thins along the branch and breaks into flying white.
        float rim = 1.0 - abs(dot(viewNormal, normalize(vViewPosition)));
        float brushPressure = noise3d(vec3(surface.y * 0.45, 3.3, vCells.x * 0.37));
        float edgeStart = mix(0.42, 0.24, brushPressure);
        float contour = smoothstep(edgeStart, edgeStart + 0.07, rim);
        // Flying white: the dry brush skips in streaks that run along the stroke.
        float flyingWhite = smoothstep(0.66, 0.82, noise3d(vec3(rim * 9.0, surface.y * 1.4, 8.0)));
        contour *= 1.0 - flyingWhite * 0.55;
        ink = max(ink, contour * 0.96);

        float reveal = inkReveal(vWorldPosition, viewNormal, vLocalY, uProgress);
        if (reveal < -0.025) discard;
        float wetEdge = 1.0 - smoothstep(0.015, 0.24, max(reveal, 0.0));
        ink = mix(ink, max(ink, 0.6), wetEdge * 0.5);
        float paperGrain = noise3d(vWorldPosition * 38.0);
        ink = clamp(ink * (0.92 + paperGrain * 0.12), 0.0, 1.0);
        float alpha = smoothstep(-0.02, 0.17, reveal);
        // Root tips break up like a dry brush as they fade into the soil.
        if (vFade < 0.999) alpha *= smoothstep(0.0, 0.6, vFade * (0.65 + 0.7 * noise3d(vec3(surface * vec2(4.0, 1.2), 6.0))));
        if (alpha < 0.01) discard;
        float fogVisibility = exp(-uFogDensity * uFogDensity * max(vViewDepth, 0.0) * max(vViewDepth, 0.0));
        if (fogVisibility < 0.008) discard;
        gl_FragColor = vec4(mix(uPaper, uInk, ink), alpha * fogVisibility);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    toneMapped: false,
  });
}

// Needle fans and the grey wash under each pad. Sprites stay upright and turn only around the
// vertical axis to face the camera, so the fans never spin like stars.
export function createFoliageMaterial(map: THREE.Texture, { atlas, opacity }: { atlas: boolean; opacity: number }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uAtlas: { value: atlas ? 1 : 0 },
      uOpacity: { value: opacity },
      uInk: { value: new THREE.Color("#0c0c0b") },
      uFogDensity: { value: 0.24 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aVariant;
      attribute float aTone;
      attribute float aTilt;
      uniform float uTime;
      uniform float uAtlas;
      varying vec2 vMapUv;
      varying float vTone;
      varying vec3 vWorldPosition;
      varying float vViewDepth;
      varying float vLocalY;

      void main() {
        vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        float heightMask = smoothstep(2.1, 4.7, center.y);
        float radialMask = smoothstep(0.75, 3.05, length(center.xz));
        float windMask = heightMask * radialMask;
        float windPhase = uTime * 1.72 + center.x * 0.72 + center.z * 1.13;
        center.x += (sin(windPhase) + 0.28 * cos(uTime * 1.21 + center.z)) * 0.062 * windMask;
        center.z += cos(uTime * 1.48 + center.z * 0.74 - center.x * 0.5) * 0.043 * windMask;

        // Fans grow up from their base; wheels and wash clouds are centred.
        float anchor = uAtlas > 0.5 && aVariant < 2.5 ? 0.5 : 0.0;
        vec2 corner = vec2(position.x, position.y + anchor);
        float c = cos(aTilt);
        float s = sin(aTilt);
        corner = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);

        vec3 worldCenter = (modelMatrix * vec4(center, 1.0)).xyz;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]) + vec3(1e-5, 0.0, 0.0));
        vec3 world = worldCenter + right * corner.x * size.x + vec3(0.0, 1.0, 0.0) * corner.y * size.y;
        vec4 viewPosition = viewMatrix * vec4(world, 1.0);

        vec2 tile = vec2(mod(aVariant, 2.0), floor(aVariant / 2.0));
        vMapUv = uAtlas > 0.5 ? (tile + uv) * 0.5 : uv;
        vTone = aTone;
        vWorldPosition = world;
        vViewDepth = -viewPosition.z;
        vLocalY = center.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uInk;
      uniform float uFogDensity;
      uniform float uProgress;
      varying vec2 vMapUv;
      varying float vTone;
      varying vec3 vWorldPosition;
      varying float vViewDepth;
      varying float vLocalY;

      ${noiseGlsl}

      void main() {
        float coverage = texture2D(uMap, vMapUv).g;
        float alpha = coverage * vTone * uOpacity;
        alpha *= mix(0.78, 1.0, noise3d(vWorldPosition * 26.0));
        float drawNoise = noise3d(vWorldPosition * vec3(7.0, 2.0, 7.0));
        float drawFront = mix(-0.78, 9.42, uProgress) + (drawNoise - 0.5) * 0.48;
        float inkDistance = drawFront - vLocalY;
        if (inkDistance < -0.025) discard;
        alpha *= smoothstep(-0.02, 0.17, inkDistance);
        float fogVisibility = exp(-uFogDensity * uFogDensity * max(vViewDepth, 0.0) * max(vViewDepth, 0.0));
        alpha *= fogVisibility;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(uInk, alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
