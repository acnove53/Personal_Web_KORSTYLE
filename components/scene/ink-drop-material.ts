import * as THREE from "three";

// A wet, glossy ink surface: near-black body, a Fresnel rim that mirrors the bright paper world at
// grazing angles, a soft sky/ground reflection, and one sharp highlight from the scene's key light.
// uPinch pulls the top of a sphere into the neck a hanging drop has just before it lets go.
export function createGlossyInkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uPinch: { value: 0 },
      uInk: { value: new THREE.Color("#060606") },
      uSky: { value: new THREE.Color("#f9f8f6") },
      uGround: { value: new THREE.Color("#2e2c29") },
      uLight: { value: new THREE.Vector3(-6, 9, 8).normalize() },
    },
    vertexShader: /* glsl */ `
      uniform float uPinch;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 p = position;
        float radius = max(length(p), 1e-4);
        float height = p.y / radius;
        float upper = smoothstep(0.1, 1.0, height);
        p.xz *= 1.0 - uPinch * upper * upper * 0.55;
        p.y += uPinch * pow(max(height, 0.0), 3.0) * radius * 0.9;

        vec4 local = vec4(p, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 world = modelMatrix * local;
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uInk;
      uniform vec3 uSky;
      uniform vec3 uGround;
      uniform vec3 uLight;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 toCamera = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normal, toCamera), 0.0, 1.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 4.0);
        vec3 reflected = reflect(-toCamera, normal);
        vec3 environment = mix(uGround, uSky, smoothstep(-0.25, 0.35, reflected.y));
        vec3 color = mix(uInk, environment, fresnel * 0.85);
        float alignment = max(dot(reflected, uLight), 0.0);
        color += vec3(pow(alignment, 220.0) * 1.3 + pow(alignment, 18.0) * 0.08);
        gl_FragColor = vec4(color, uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

// A soft round ink shadow on the ground, darkest in the centre.
export function createContactShadowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uInk: { value: new THREE.Color("#0a0a09") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uInk;
      varying vec2 vUv;

      void main() {
        float distanceFromCenter = length(vUv - 0.5) * 2.0;
        float falloff = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter);
        float alpha = falloff * falloff * uOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(uInk, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}
