import * as THREE from "three";
import { noiseGlsl } from "./pine-materials";

const passThroughVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function createSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uCore: { value: new THREE.Color("#e2622a") },
      uRim: { value: new THREE.Color("#b3311d") },
    },
    vertexShader: passThroughVertex,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uCore;
      uniform vec3 uRim;
      varying vec2 vUv;

      ${noiseGlsl}

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float edge = 0.86
          + (noise3d(vec3(cos(angle) * 3.0, sin(angle) * 3.0, 1.7)) - 0.5) * 0.06
          + (noise3d(vec3(p * 9.0, 4.2)) - 0.5) * 0.03;
        float disc = 1.0 - smoothstep(edge - 0.04, edge + 0.01, radius);
        vec3 color = mix(uCore, uRim, smoothstep(0.0, edge, radius));
        float pigment = 0.9 + 0.1 * noise3d(vec3(p * 6.0, 9.1));
        float alpha = disc * pigment * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

export function createWaterfallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPaper: { value: new THREE.Color("#f9f8f6") },
      uInk: { value: new THREE.Color("#1b1a18") },
    },
    vertexShader: passThroughVertex,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uPaper;
      uniform vec3 uInk;
      varying vec2 vUv;

      ${noiseGlsl}

      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float channel = 0.36 + 0.08 * (1.0 - vUv.y);
        float body = 1.0 - smoothstep(channel * 0.55, channel, across);
        // Sampling at y + time moves the streak pattern downward.
        float flow = vUv.y * 5.0 + uTime * 0.45;
        float streaks = noise3d(vec3(vUv.x * 46.0, flow, 0.0));
        float fine = noise3d(vec3(vUv.x * 120.0, flow * 2.3, 3.7));
        float water = body * (0.74 + 0.26 * smoothstep(0.35, 0.75, streaks));
        float lip = smoothstep(1.0, 0.94, vUv.y);
        float mist = (1.0 - smoothstep(0.0, 0.32, vUv.y))
          * (1.0 - smoothstep(0.15, 1.0, across))
          * (0.65 + 0.35 * noise3d(vec3(vUv * 6.0, uTime * 0.2)));
        float alpha = max(water * lip, mist) * uOpacity;
        if (alpha < 0.004) discard;
        float shade = (1.0 - smoothstep(0.2, 0.6, streaks)) * 0.16 + (1.0 - fine) * 0.06;
        vec3 color = mix(uPaper, uInk, shade * body * (1.0 - mist));
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}
