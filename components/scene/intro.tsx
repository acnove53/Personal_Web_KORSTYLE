"use client";

import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";
import { createContactShadowMaterial, createGlossyInkMaterial } from "./ink-drop-material";
import { seedUnit, smoothStep } from "./math";

export type IntroTimeline = {
  elapsed: number;
  progress: number;
  fogDensity: number;
  complete: boolean;
  cameraZoom: number;
  phase: "title" | "seed" | "drop" | "splash" | "sprout" | "complete";
  // Set when the visitor skips the intro or prefers reduced motion: later steps snap instead of animating.
  instant: boolean;
  splash: {
    active: boolean;
    puddleScale: number;
    rippleScale: number;
    rippleFront: number;
    rippleOpacity: number;
    puddleOpacity: number;
    crownProgress: number;
    crownOpacity: number;
    dropletProgress: number;
    dropletOpacity: number;
  };
  seed: {
    x: number;
    y: number;
    z: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    opacity: number;
    visible: boolean;
    // 1 = hanging drop with a neck, 0 = free round drop.
    pinch: number;
    // Extra vertical stretch while the drop hangs under its own weight.
    sag: number;
    // 0..1 progress through the fall, used for the settling wobble.
    fall: number;
  };
  satellite: { y: number; scale: number; visible: boolean };
};

const introSproutDuration = 3;
const dropFallDuration = 1.08;
const seedStart = { x: 0.06, y: 3.85, z: 0, scaleX: 0, scaleY: 0, scaleZ: 0, opacity: 0, visible: false, pinch: 0.8, sag: 1, fall: 0 };
const satelliteStart = { y: 3.85, scale: 0, visible: false };

export function createIntroTimeline(): IntroTimeline {
  return {
    elapsed: 0,
    progress: 0,
    fogDensity: 0.24,
    complete: false,
    cameraZoom: 0,
    phase: "title",
    instant: false,
    splash: {
      active: false,
      puddleScale: 0,
      rippleScale: 0,
      rippleFront: 0,
      rippleOpacity: 0,
      puddleOpacity: 0,
      crownProgress: 0,
      crownOpacity: 0,
      dropletProgress: 0,
      dropletOpacity: 0,
    },
    seed: { ...seedStart },
    satellite: { ...satelliteStart },
  };
}

export function IntroSequence({ intro, titleRef, skip }: {
  intro: IntroTimeline;
  titleRef: { current: HTMLDivElement | null };
  skip: boolean;
}) {
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2("#f9f8f6", 0.24), []);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    intro.elapsed = 0;
    intro.progress = 0;
    intro.complete = false;
    intro.cameraZoom = 0;
    intro.phase = "title";
    Object.assign(intro.splash, {
      active: false,
      puddleScale: 0,
      rippleScale: 0,
      rippleFront: 0,
      rippleOpacity: 0,
      puddleOpacity: 0,
      crownProgress: 0,
      crownOpacity: 0,
      dropletProgress: 0,
      dropletOpacity: 0,
    });
    Object.assign(intro.seed, seedStart);
    Object.assign(intro.satellite, satelliteStart);
    gsap.set(title, { opacity: 0, scale: 0.94, filter: "blur(12px)" });

    const timeline = gsap.timeline();
    timelineRef.current = timeline;
    timeline.to(title, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.85, ease: "sine.out" });
    timeline.to({}, { duration: 0.32 });
    timeline.to(title, {
      opacity: 0,
      scale: 0.84,
      filter: "blur(12px)",
      duration: 0.68,
      ease: "power2.in",
      onStart: () => { intro.phase = "seed"; },
    });
    // The drop swells while hanging from a thinning neck, sagging under its weight.
    timeline.to(intro.seed, {
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 1,
      pinch: 1,
      sag: 1.14,
      duration: 0.56,
      ease: "power2.out",
      onStart: () => { intro.seed.visible = true; },
    }, "<+=0.12");
    timeline.addLabel("release");
    // The neck snaps: the drop rounds out, and the broken neck becomes a small satellite droplet.
    timeline.to(intro.seed, { pinch: 0, sag: 1, duration: 0.14, ease: "power3.out" }, "release");
    timeline.set(intro.satellite, { y: 3.85 + 0.3, scale: 1, visible: true }, "release+=0.04");
    timeline.to(intro.satellite, {
      y: 0.02,
      duration: dropFallDuration + 0.06,
      ease: "power2.in",
      onComplete: () => { intro.satellite.visible = false; },
    }, "release+=0.04");
    timeline.to(intro.seed, {
      y: 0,
      fall: 1,
      duration: dropFallDuration,
      ease: "power2.in",
      onStart: () => { intro.phase = "drop"; },
    }, "release");
    timeline.call(() => {
      intro.phase = "splash";
      Object.assign(intro.splash, {
        active: true,
        puddleScale: 0,
        rippleScale: 0,
        rippleFront: 0,
        rippleOpacity: 1,
        puddleOpacity: 1,
        crownProgress: 0,
        crownOpacity: 1,
        dropletProgress: 0,
        dropletOpacity: 1,
      });
    }, undefined, `release+=${dropFallDuration}`);
    timeline.addLabel("impact", `release+=${dropFallDuration}`);
    timeline.to(intro.seed, {
      scaleX: 1.55,
      scaleY: 0.045,
      scaleZ: 1.55,
      duration: 0.12,
      ease: "power4.out",
    }, "impact");
    timeline.to(intro.seed, {
      opacity: 0,
      duration: 0.18,
      ease: "power1.out",
      onComplete: () => { intro.seed.visible = false; },
    }, "impact+=0.025");
    timeline.to(intro.splash, {
      puddleScale: 2.15,
      duration: 0.3,
      ease: "expo.out",
    }, "impact");
    timeline.to(intro.splash, {
      rippleScale: 3.6,
      rippleFront: 1,
      duration: 0.78,
      ease: "power2.out",
    }, "impact");
    timeline.to(intro.splash, {
      crownProgress: 1,
      duration: 1.02,
      ease: "none",
    }, "impact");
    timeline.to(intro.splash, {
      dropletProgress: 1,
      duration: 1.1,
      ease: "none",
    }, "impact");
    timeline.addLabel("puddle-rest", "impact+=0.78");
    timeline.to({}, { duration: 0.2 }, "puddle-rest");
    timeline.to(intro.splash, {
      rippleOpacity: 0,
      duration: 0.3,
      ease: "power1.out",
      onStart: () => {
        intro.phase = "sprout";
        intro.elapsed = 0;
      },
      onComplete: () => { intro.splash.active = false; },
    }, "puddle-rest+=0.2");
    timeline.to(intro.splash, {
      dropletOpacity: 0,
      duration: 0.25,
      ease: "power1.out",
    }, "puddle-rest+=0.2");
    timeline.to(intro.splash, {
      puddleOpacity: 0,
      duration: 0.32,
      ease: "power1.out",
    }, "puddle-rest+=0.2");
    timeline.to(intro.splash, {
      crownOpacity: 0,
      duration: 0.28,
      ease: "power1.out",
    }, "puddle-rest+=0.2");
    timeline.eventCallback("onComplete", () => {
      intro.seed.visible = false;
      intro.splash.active = false;
    });

    return () => {
      timeline.kill();
      if (timelineRef.current === timeline) timelineRef.current = null;
    };
  }, [intro, titleRef]);

  useEffect(() => {
    if (!skip) return;
    intro.instant = true;
    if (intro.phase === "complete") return;
    timelineRef.current?.kill();
    timelineRef.current = null;
    if (titleRef.current) gsap.set(titleRef.current, { opacity: 0 });
    intro.seed.visible = false;
    intro.satellite.visible = false;
    intro.splash.active = false;
    intro.elapsed = introSproutDuration;
    intro.phase = "complete";
  }, [intro, skip, titleRef]);

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = fog;
    return () => {
      if (scene.fog === fog) scene.fog = previousFog;
    };
  }, [fog, scene]);

  useFrame((_, delta) => {
    if (intro.phase === "sprout" || intro.phase === "complete") {
      if (intro.phase === "sprout") intro.elapsed += Math.min(delta, 0.05);
      const fogClear = smoothStep(0, 1.05, intro.elapsed);
      fog.density = THREE.MathUtils.lerp(0.24, 0.011, fogClear);
      intro.fogDensity = fog.density;
      intro.progress = smoothStep(0, 2.65, intro.elapsed);
      intro.complete = intro.progress >= 1;
      if (intro.complete) intro.phase = "complete";
    } else {
      fog.density = 0.24;
      intro.fogDensity = fog.density;
      intro.progress = 0;
      intro.complete = false;
    }
  });

  return null;
}

export function SeedParticle({ intro }: { intro: IntroTimeline }) {
  const seedRef = useRef<THREE.Mesh>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const seedGeometry = new THREE.SphereGeometry(0.14, 48, 36);
    const position = seedGeometry.getAttribute("position");
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const angle = Math.atan2(z, x);
      // Surface tension keeps a real drop nearly spherical; only a faint ripple of irregularity remains.
      const irregularity = 1 + Math.sin(angle * 3 + (y / 0.14) * 4.2) * 0.012;
      position.setXYZ(index, x * irregularity, y, z * irregularity);
    }
    position.needsUpdate = true;
    seedGeometry.computeVertexNormals();
    seedGeometry.computeBoundingSphere();
    return seedGeometry;
  }, []);
  const satelliteGeometry = useMemo(() => new THREE.SphereGeometry(0.035, 20, 16), []);
  const shadowGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const dropMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const satelliteMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const shadowMaterial = useMemo(() => createContactShadowMaterial(), []);

  useEffect(() => () => {
    geometry.dispose();
    satelliteGeometry.dispose();
    shadowGeometry.dispose();
    dropMaterial.dispose();
    satelliteMaterial.dispose();
    shadowMaterial.dispose();
  }, [dropMaterial, geometry, satelliteGeometry, satelliteMaterial, shadowGeometry, shadowMaterial]);

  useFrame(() => {
    const seed = seedRef.current;
    const satellite = satelliteRef.current;
    const shadow = shadowRef.current;
    const state = intro.seed;
    if (seed) {
      seed.visible = state.visible;
      if (state.visible) {
        let scaleX = state.scaleX;
        let scaleY = state.scaleY * state.sag;
        let scaleZ = state.scaleZ;
        if (intro.phase === "drop") {
          // After letting go the drop oscillates between tall and wide, settling quickly; volume is kept.
          const time = state.fall * dropFallDuration;
          const stretch = 1 + 0.08 * Math.exp(-3 * time) * Math.cos(Math.PI * 2 * 5 * time);
          const side = 1 / Math.sqrt(stretch);
          scaleY *= stretch;
          scaleX *= side;
          scaleZ *= side;
        }
        seed.position.set(state.x, state.y, state.z);
        seed.scale.set(scaleX, scaleY, scaleZ);
        dropMaterial.uniforms.uPinch.value = state.pinch;
        dropMaterial.uniforms.uOpacity.value = state.opacity;
      }
    }
    if (satellite) {
      const satelliteState = intro.satellite;
      satellite.visible = satelliteState.visible;
      if (satelliteState.visible) {
        satellite.position.set(state.x, satelliteState.y, state.z);
        satellite.scale.setScalar(satelliteState.scale);
        satelliteMaterial.uniforms.uOpacity.value = state.opacity;
      }
    }
    if (shadow) {
      // High up, the shadow is wide and faint; it tightens and darkens as the drop nears the surface.
      const casting = state.visible && (intro.phase === "seed" || intro.phase === "drop" || intro.phase === "splash");
      shadow.visible = casting;
      if (casting) {
        const height = Math.max(0, state.y);
        const nearness = 1 - Math.min(1, height / 3.85);
        shadow.position.set(state.x, 0.004, state.z);
        shadow.scale.setScalar((0.1 + 0.07 * height) * 2 * Math.max(state.scaleX, 0.001));
        shadowMaterial.uniforms.uOpacity.value = 0.34 * nearness * nearness * state.opacity;
      }
    }
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      <mesh ref={shadowRef} geometry={shadowGeometry} material={shadowMaterial} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2} />
      <mesh ref={satelliteRef} geometry={satelliteGeometry} material={satelliteMaterial} visible={false} renderOrder={10} />
      <mesh ref={seedRef} geometry={geometry} material={dropMaterial} visible={false} renderOrder={10} />
    </group>
  );
}

export function ImpactSplash({ intro }: { intro: IntroTimeline }) {
  const crown = useRef<THREE.Mesh>(null);
  const puddle = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const droplets = useRef<THREE.InstancedMesh>(null);
  const crownGeometry = useMemo(() => createCrownSheetGeometry(96), []);
  const puddleGeometry = useMemo(() => createInkPuddleGeometry(), []);
  const rippleGeometry = useMemo(() => new THREE.CircleGeometry(1, 96), []);
  const dropletGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  const crownMaterial = useMemo(() => createCrownMaterial(), []);
  const puddleMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  }), []);
  const rippleMaterial = useMemo(() => createImpactRippleMaterial(), []);
  const dropletMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const particleTransform = useMemo(() => new THREE.Object3D(), []);
  const particleLayout = useMemo(() => Array.from({ length: 64 }, (_, index) => ({
    angle: seedUnit(23, index) * Math.PI * 2,
    reach: 0.72 + seedUnit(41, index) * 1.3,
    apex: 2 + seedUnit(59, index) * 0.8,
    flightTime: 0.72 + seedUnit(67, index) * 0.46,
    // Splash droplets are a small fraction of the drop's size (radius 0.14), or they read as marbles.
    size: 0.012 + Math.pow(seedUnit(71, index), 2) * 0.03,
  })), []);

  useEffect(() => () => {
    crownGeometry.dispose();
    puddleGeometry.dispose();
    rippleGeometry.dispose();
    dropletGeometry.dispose();
    crownMaterial.dispose();
    puddleMaterial.dispose();
    rippleMaterial.dispose();
    dropletMaterial.dispose();
  }, [crownGeometry, crownMaterial, dropletGeometry, dropletMaterial, puddleGeometry, puddleMaterial, rippleGeometry, rippleMaterial]);

  useFrame(({ clock }) => {
    const splash = intro.splash;
    if (!splash.active) {
      if (crown.current) crown.current.visible = false;
      if (puddle.current) puddle.current.visible = false;
      if (ripple.current) ripple.current.visible = false;
      if (droplets.current) droplets.current.visible = false;
      return;
    }
    if (crown.current) {
      const progress = THREE.MathUtils.clamp(splash.crownProgress, 0, 1);
      const rise = progress < 0.2
        ? smoothStep(0, 0.2, progress)
        : 1 - smoothStep(0.2, 1, progress);
      const expansion = smoothStep(0, 0.22, progress);
      const positions = crownGeometry.getAttribute("position") as THREE.BufferAttribute;
      const segments = positions.count / 3;
      for (let ring = 0; ring < 3; ring++) {
        for (let segment = 0; segment < segments; segment++) {
          const angle = (segment / segments) * Math.PI * 2;
          const rippleNoise = Math.sin(angle * 7 + 0.5) * 0.045 + Math.cos(angle * 13 - 0.8) * 0.022;
          const jet = Math.pow(Math.max(0, Math.cos(angle * 9 + Math.sin(angle * 3) * 0.35)), 18);
          const baseRadius = 0.22 + expansion * 0.68;
          const ringRadius = ring === 0 ? baseRadius * 0.28 : ring === 1 ? baseRadius * 0.69 : baseRadius * (1 + rippleNoise);
          const sheetHeight = ring === 0
            ? 0.025
            : ring === 1
              ? rise * (0.3 + rippleNoise * 0.35)
              : rise * (0.62 + jet * 0.44 + rippleNoise);
          const index = ring * segments + segment;
          positions.setXYZ(index, Math.cos(angle) * ringRadius, 0.022 + sheetHeight, Math.sin(angle) * ringRadius);
        }
      }
      positions.needsUpdate = true;
      crownGeometry.computeVertexNormals();
      crown.current.visible = splash.active && splash.crownOpacity > 0.002;
      crownMaterial.uniforms.uOpacity.value = splash.crownOpacity;
    }
    if (puddle.current) {
      puddle.current.visible = splash.active && splash.puddleOpacity > 0.002;
      puddle.current.position.set(intro.seed.x, 0.009, intro.seed.z);
      puddle.current.scale.setScalar(splash.puddleScale);
      puddleMaterial.opacity = splash.puddleOpacity;
    }
    if (ripple.current) {
      ripple.current.visible = splash.active && splash.rippleOpacity > 0.002;
      ripple.current.position.set(intro.seed.x, 0.012, intro.seed.z);
      ripple.current.scale.setScalar(splash.rippleScale);
      rippleMaterial.uniforms.uFront.value = splash.rippleFront;
      rippleMaterial.uniforms.uOpacity.value = splash.rippleOpacity;
      rippleMaterial.uniforms.uTime.value = clock.elapsedTime;
    }

    const mesh = droplets.current;
    if (!mesh) return;
    mesh.visible = splash.active && splash.dropletOpacity > 0.002;
    dropletMaterial.uniforms.uOpacity.value = splash.dropletOpacity;
    const elapsed = THREE.MathUtils.clamp(splash.dropletProgress, 0, 1) * 1.1;
    particleLayout.forEach((particle, index) => {
      const particleProgress = THREE.MathUtils.clamp(elapsed / particle.flightTime, 0, 1);
      const travel = particleProgress * particle.reach;
      const height = 4 * particle.apex * particleProgress * (1 - particleProgress);
      const landingScale = 1 - smoothStep(0.82, 1, particleProgress);
      particleTransform.position.set(
        intro.seed.x + Math.cos(particle.angle) * travel,
        0.022 + height,
        intro.seed.z + Math.sin(particle.angle) * travel,
      );
      particleTransform.scale.set(particle.size * 0.72, particle.size * 1.55 * landingScale, particle.size * 0.72);
      particleTransform.rotation.set(Math.cos(particle.angle) * 0.24, 0, -Math.sin(particle.angle) * 0.24);
      particleTransform.updateMatrix();
      mesh.setMatrixAt(index, particleTransform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      <mesh
        ref={crown}
        geometry={crownGeometry}
        material={crownMaterial}
        visible={false}
        frustumCulled={false}
        renderOrder={5}
      />
      <mesh
        ref={puddle}
        geometry={puddleGeometry}
        material={puddleMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={0}
        visible={false}
        renderOrder={3}
      />
      <mesh
        ref={ripple}
        geometry={rippleGeometry}
        material={rippleMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={0}
        visible={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={droplets}
        args={[dropletGeometry, dropletMaterial, particleLayout.length]}
        visible={false}
        frustumCulled={false}
        renderOrder={6}
      />
    </group>
  );
}

function createCrownSheetGeometry(segments: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const radii = [0.28, 0.68, 0.98];

  for (let ring = 0; ring < 3; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radii[ring], 0.022, Math.sin(angle) * radii[ring]);
      uvs.push(segment / segments, ring / 2);
    }
  }

  for (let ring = 0; ring < 2; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCrownMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float ribs = pow(max(0.0, sin(vUv.x * 6.2831853 * 9.0 + 0.7)), 16.0);
        float wetEdge = smoothstep(0.72, 1.0, vUv.y);
        vec3 ink = mix(vec3(0.012), vec3(0.052), vUv.y * 0.7);
        ink = mix(ink, vec3(0.14), ribs * wetEdge * 0.42);
        gl_FragColor = vec4(ink, uOpacity);
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

function createInkPuddleGeometry() {
  const geometry = new THREE.CircleGeometry(1, 128);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const radius = Math.hypot(x, y);
    if (radius < 0.001) continue;
    const angle = Math.atan2(y, x);
    const edgeVariation = 1
      + Math.sin(angle * 5 + 0.4) * 0.055
      + Math.sin(angle * 11 - 0.7) * 0.025
      + Math.cos(angle * 17 + 1.3) * 0.012;
    positions.setXY(index, x * edgeVariation, y * edgeVariation);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createImpactRippleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFront: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uInk: { value: new THREE.Color("#000000") },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uFront;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec3 uInk;
      varying vec2 vUv;

      void main() {
        float radius = length(vUv - 0.5) * 2.0;
        float wavePhase = (radius - uFront) * 72.0 - uTime * 1.7;
        float radialDisplacement = sin(wavePhase) * 0.018 * exp(-abs(radius - uFront) * 11.0);
        float waveDistance = abs(radius + radialDisplacement - uFront);
        float crown = exp(-waveDistance * 92.0);
        float trailingRing = exp(-abs(radius - uFront + 0.065) * 44.0);
        float paperFade = 1.0 - smoothstep(0.96, 1.0, radius);
        float alpha = (crown * 0.88 + trailingRing * 0.3) * paperFade * uOpacity;
        if (alpha < 0.006) discard;
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
