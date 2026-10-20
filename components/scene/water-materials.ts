import * as THREE from "three";
import { noiseGlsl } from "./pine-materials";

// Radial waves on the lake after the drop lands. Each packet is a ring train that spreads outward,
// fades with time and distance, and leaves still water behind its front.
const wavesGlsl = /* glsl */ `
uniform float uTime;
uniform float uSecondTime;

float wavePacket(float r, float t, float speed, float k, float amplitude, float decay) {
  if (t <= 0.0) return 0.0;
  float front = speed * t;
  float mask = smoothstep(front + 0.05, front - 0.45, r) * smoothstep(front - 2.6, front - 1.2, r);
  float phase = k * (r - front * 1.35);
  return amplitude * sin(phase) * mask * exp(-decay * t) / (1.0 + 2.2 * r);
}

float lakeHeight(float r) {
  float t = uTime;
  float h = wavePacket(r, t, 1.9, 26.0, 0.05, 1.5)
    + wavePacket(r, t - 0.05, 1.25, 41.0, 0.032, 2.1)
    + wavePacket(r, t - uSecondTime, 1.5, 34.0, 0.022, 2.0);
  // The crater left by the impact, filling back in.
  h -= 0.07 * exp(-r * r * 28.0) * smoothstep(0.0, 0.03, t) * exp(-t * 5.0);
  return h;
}
`;

export function createLakeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSecondTime: { value: 1.3 },
      uLake: { value: 0 },
      uBloom: { value: 0 },
      uInk: { value: new THREE.Color("#0a0a09") },
    },
    vertexShader: /* glsl */ `
      ${wavesGlsl}
      varying vec2 vPlane;
      varying float vHeight;
      void main() {
        vec3 p = position;
        float r = length(p.xy);
        float h = lakeHeight(r);
        p.z += h;
        vPlane = p.xy;
        vHeight = h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${wavesGlsl}
      uniform float uLake;
      uniform float uBloom;
      uniform vec3 uInk;
      varying vec2 vPlane;
      varying float vHeight;

      ${noiseGlsl}

      float fbm2(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise3d(p);
          p = p * 2.03 + vec3(7.0, 13.0, 3.0);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        float r = length(vPlane);
        float edge = 1.0 - smoothstep(2.6, 4.4, r);

        // Still water: a faint grey wash, a little deeper toward the middle distance.
        float water = 0.07 * edge;

        // Ripples painted as fine ink rings where the surface is steep, pale where it faces the light.
        float slope = (lakeHeight(r + 0.012) - lakeHeight(r - 0.012)) / 0.024;
        float rings = smoothstep(0.12, 0.7, abs(slope)) * 0.62 * edge;
        float glint = smoothstep(0.25, 0.9, -slope) * edge;

        // Ink spreading over the water in feathery, marbled rings (suminagashi).
        float bloomTime = clamp(uTime / 1.6, 0.0, 1.0);
        float bloomRadius = 1.65 * sqrt(bloomTime);
        float warp = fbm2(vec3(vPlane * 2.2, uTime * 0.25));
        float warped = r + (warp - 0.5) * 0.4;
        float bands = 0.5 + 0.5 * sin(warped * 30.0 + warp * 7.0);
        float inside = 1.0 - smoothstep(bloomRadius * 0.7, bloomRadius, warped);
        float feather = smoothstep(0.4, 0.75, fbm2(vec3(vPlane * 6.0, 3.0)));
        float bloom = (smoothstep(0.3, 0.8, bands) * 0.65 + exp(-r * r * 6.0) * 0.5) * inside * mix(0.7, 1.0, feather);
        bloom *= smoothstep(0.0, 0.05, uTime) * uBloom;

        float alpha = (water + rings * (1.0 - glint * 0.6)) * uLake + bloom * 0.85;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uInk, clamp(alpha, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}
