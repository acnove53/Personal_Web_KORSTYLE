import * as THREE from "three";

const noiseGlsl = /* glsl */ `
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

export function createSumiToonMaterial(wash: number, noiseStrength: number, windStrength: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInkDeep: { value: new THREE.Color("#080807") },
      uInkMid: { value: new THREE.Color("#11110f") },
      uInkLight: { value: new THREE.Color("#1a1a1a") },
      uPaper: { value: new THREE.Color("#f9f8f6") },
      uFogDensity: { value: 0.24 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uWindStrength: { value: windStrength },
      uWash: { value: wash },
      uNoiseStrength: { value: noiseStrength },
    },
    vertexShader: `
      attribute float aWash;
      attribute float aRoughness;
      uniform float uNoiseStrength;
      uniform float uTime;
      uniform float uWindStrength;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying float vViewDepth;
      varying float vWash;
      varying float vLocalY;

      ${noiseGlsl}

      void main() {
        float broadNoise = noise3d(position * vec3(3.8, 1.65, 3.8) + vec3(2.3, 7.1, 4.6));
        float barkNoise = noise3d(position * vec3(17.0, 5.3, 17.0) + vec3(13.4, 2.8, 9.1));
        float ridgeNoise = 1.0 - abs(noise3d(position * vec3(7.0, 2.3, 7.0) + vec3(4.2, 8.7, 1.6)) * 2.0 - 1.0);
        float displacement = ((broadNoise - 0.5) * 1.45 + (barkNoise - 0.5) * 0.55 + (ridgeNoise - 0.48) * 0.48) * aRoughness * uNoiseStrength;
        vec3 gnarledPosition = position + normalize(normal) * displacement;
        float heightMask = smoothstep(2.35, 5.15, position.y);
        float radialMask = smoothstep(0.9, 3.35, length(position.xz));
        float windMask = heightMask * radialMask * uWindStrength;
        float windPhase = uTime * 1.12 + position.x * 0.48 + position.z * 0.82;
        float windX = sin(windPhase) + 0.32 * cos(uTime * 0.73 + position.z * 1.19);
        float windZ = cos(uTime * 0.91 + position.z * 0.61 - position.x * 0.34);
        gnarledPosition.x += windX * 0.034 * windMask;
        gnarledPosition.z += windZ * 0.021 * windMask;
        vec4 viewPosition = modelViewMatrix * vec4(gnarledPosition, 1.0);
        vec4 worldPosition = modelMatrix * vec4(gnarledPosition, 1.0);
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vWorldPosition = worldPosition.xyz;
        vViewPosition = -viewPosition.xyz;
        vViewDepth = -viewPosition.z;
        vWash = aWash;
        vLocalY = position.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uInkDeep;
      uniform vec3 uInkMid;
      uniform vec3 uInkLight;
      uniform vec3 uPaper;
      uniform float uFogDensity;
      uniform float uProgress;
      uniform float uWash;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying float vViewDepth;
      varying float vWash;
      varying float vLocalY;

      ${noiseGlsl}

      ${fbmGlsl}

      void main() {
        vec3 normal = normalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        float lightBand = max(dot(normal, normalize(vec3(-0.38, 0.78, 0.52))), 0.0);
        vec3 ink = mix(uInkDeep, uInkMid, smoothstep(0.08, 0.42, lightBand));
        ink = mix(ink, uInkLight, smoothstep(0.68, 0.9, lightBand) * 0.22);

        float fiber = fbm(vec3(vUv.x * 12.0 + vWash * 3.0, vUv.y * 5.0, vWorldPosition.z * 2.8));
        float fineGrain = noise3d(vWorldPosition * 32.0);
        float brushStriation = 1.0 - smoothstep(0.025, 0.15, abs(fract(vUv.x * 29.0 + (fiber - 0.5) * 0.24) - 0.5));
        float brokenPigment = smoothstep(0.24, 0.74, fiber);
        ink = mix(ink, uInkDeep, brushStriation * brokenPigment * 0.2);
        ink = mix(ink, uInkLight, smoothstep(0.73, 0.94, fiber) * 0.06);
        float dryBrush = fbm(vec3(vUv.x * 37.0, vUv.y * 11.0, vWorldPosition.y * 1.7));
        float paperBreakup = smoothstep(0.73, 0.94, dryBrush);
        ink = mix(ink, uPaper, paperBreakup * 0.045);
        ink = mix(ink, uInkDeep, smoothstep(0.57, 0.82, fbm(vWorldPosition * 4.2)) * 0.16);
        float edge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        float edgeGrain = fbm(vWorldPosition * 19.0 + vec3(vUv.y * 2.0));
        float inkBleed = smoothstep(0.7, 1.02, edge + (edgeGrain - 0.5) * 0.34);
        ink = mix(ink, uPaper, inkBleed * 0.2);
        ink *= 0.91 + fineGrain * 0.16;
        ink = mix(ink, uInkMid, clamp((vWash + uWash) * 0.03, 0.0, 0.06));

        float drawNoise = fbm(vWorldPosition * vec3(7.6, 2.1, 7.6) + normal * 3.4);
        float drawFront = mix(-0.78, 9.42, uProgress) + (drawNoise - 0.5) * 0.48;
        float inkDistance = drawFront - vLocalY;
        if (inkDistance < -0.025) discard;
        float reveal = smoothstep(-0.02, 0.17, inkDistance);
        float wetEdge = 1.0 - smoothstep(0.015, 0.24, max(inkDistance, 0.0));
        ink = mix(ink, uInkMid, wetEdge * 0.28);
        float dryBreak = smoothstep(0.79, 0.98, fbm(vWorldPosition * 28.0 + vec3(vUv.y * 4.0)));
        reveal *= 1.0 - dryBreak * 0.065;
        float fogVisibility = exp(-uFogDensity * uFogDensity * max(vViewDepth, 0.0) * max(vViewDepth, 0.0));
        if (fogVisibility < 0.008) discard;
        gl_FragColor = vec4(ink, reveal * fogVisibility);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    toneMapped: false,
  });
}

export function createBrushStrokeMaterial(brushTexture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBrush: { value: brushTexture },
      uInk: { value: new THREE.Color("#0c0c0b") },
      uPaper: { value: new THREE.Color("#f9f8f6") },
      uFogDensity: { value: 0.24 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying float vViewDepth;
      varying float vLocalY;

      void main() {
        vec4 localPosition = instanceMatrix * vec4(position, 1.0);
        float heightMask = smoothstep(2.1, 4.7, localPosition.y);
        float radialMask = smoothstep(0.75, 3.05, length(localPosition.xz));
        float windMask = heightMask * radialMask;
        float windPhase = uTime * 1.72 + localPosition.x * 0.72 + localPosition.z * 1.13;
        localPosition.x += (sin(windPhase) + 0.28 * cos(uTime * 1.21 + localPosition.z)) * 0.062 * windMask;
        localPosition.z += cos(uTime * 1.48 + localPosition.z * 0.74 - localPosition.x * 0.5) * 0.043 * windMask;
        vec4 worldPosition = modelMatrix * localPosition;
        vec4 viewPosition = viewMatrix * worldPosition;
        vUv = uv;
        vWorldPosition = worldPosition.xyz;
        vViewDepth = -viewPosition.z;
        vLocalY = localPosition.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uBrush;
      uniform vec3 uInk;
      uniform vec3 uPaper;
      uniform float uFogDensity;
      uniform float uProgress;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying float vViewDepth;
      varying float vLocalY;

      ${noiseGlsl}

      void main() {
        float paperGrain = noise3d(vec3(vUv * 39.0, vWorldPosition.z * 12.0));
        float alpha = texture2D(uBrush, vUv).a;
        alpha *= mix(0.62, 1.0, paperGrain);
        float drawNoise = noise3d(vWorldPosition * vec3(7.0, 2.0, 7.0));
        float drawFront = mix(-0.78, 9.42, uProgress) + (drawNoise - 0.5) * 0.48;
        float inkDistance = drawFront - vLocalY;
        if (inkDistance < -0.025) discard;
        alpha *= smoothstep(-0.02, 0.17, inkDistance);
        float fogVisibility = exp(-uFogDensity * uFogDensity * max(vViewDepth, 0.0) * max(vViewDepth, 0.0));
        if (fogVisibility < 0.008) discard;
        alpha *= fogVisibility;
        if (alpha < 0.025) discard;
        float pigment = noise3d(vWorldPosition * 8.0 + vec3(vUv.y * 2.0));
        vec3 ink = mix(uInk, vec3(0.1, 0.1, 0.09), smoothstep(0.76, 0.98, pigment) * 0.12);
        float edgeBleed = smoothstep(0.72, 0.98, 1.0 - alpha) * 0.18;
        vec3 color = mix(ink, uPaper, edgeBleed);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
