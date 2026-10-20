"use client";

import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";
import { createContactShadowMaterial, createGlossyInkMaterial } from "./ink-drop-material";
import { seedUnit, smoothStep } from "./math";
import { createLakeMaterial } from "./water-materials";

export type IntroTimeline = {
  elapsed: number;
  progress: number;
  fogDensity: number;
  complete: boolean;
  cameraZoom: number;
  phase: "title" | "seed" | "drop" | "splash" | "sprout" | "complete";
  // Set when the visitor skips the intro or prefers reduced motion: later steps snap instead of animating.
  instant: boolean;
  // 0..1: the landscape inks in after the tree has finished drawing, before the About zoom.
  backgroundReveal: number;
  backgroundElapsed: number;
  splash: {
    active: boolean;
    // Seconds since impact; every part of the splash is a function of this clock.
    time: number;
    // The still lake fades in under the falling drop.
    lake: number;
    // Everything fades out as the tree grows.
    fade: number;
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
const splashDuration = 2.4;
const backgroundRevealDuration = 1.6;
const seedStart = { x: 0.06, y: 3.85, z: 0, scaleX: 0, scaleY: 0, scaleZ: 0, opacity: 0, visible: false, pinch: 0.8, sag: 1, fall: 0 };
const satelliteStart = { y: 3.85, scale: 0, visible: false };
const splashStart = { active: false, time: 0, lake: 0, fade: 0 };

// Splash choreography, in seconds after impact.
const crownPeak = 0.16;
const crownGone = 0.62;
const jetStart = 0.3;
const jetPeak = 0.75;
const jetGone = 1.25;
const jetHeight = 1.05;
const jetDropRelease = 0.8;
const jetDropLanding = 1.3;
const jetDropGravity = 11.6;
const jetDropLift = 0.8;

export function createIntroTimeline(): IntroTimeline {
  return {
    elapsed: 0,
    progress: 0,
    fogDensity: 0.24,
    complete: false,
    cameraZoom: 0,
    phase: "title",
    instant: false,
    backgroundReveal: 0,
    backgroundElapsed: 0,
    splash: { ...splashStart },
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
    const glyphs = title.querySelectorAll<HTMLElement>(".intro-glyph");
    const dots = title.querySelectorAll<HTMLElement>(".intro-dot");

    intro.elapsed = 0;
    intro.progress = 0;
    intro.complete = false;
    intro.cameraZoom = 0;
    intro.phase = "title";
    intro.backgroundReveal = 0;
    intro.backgroundElapsed = 0;
    Object.assign(intro.splash, splashStart);
    Object.assign(intro.seed, seedStart);
    Object.assign(intro.satellite, satelliteStart);
    gsap.set(title, { opacity: 0, scale: 0.94, filter: "blur(12px)" });
    gsap.set(glyphs, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" });
    gsap.set(dots, { opacity: 0, scale: 0.2, x: 0, y: 0 });

    // Distance from a dot to the title's centre, which is where the 3D drop forms (the screen centre).
    const toCenter = (axis: "x" | "y") => (_index: number, dot: HTMLElement) => {
      const box = title.getBoundingClientRect();
      const own = dot.getBoundingClientRect();
      return axis === "x"
        ? box.left + box.width / 2 - (own.left + own.width / 2)
        : box.top + box.height / 2 - (own.top + own.height / 2);
    };

    const timeline = gsap.timeline();
    timelineRef.current = timeline;
    timeline.to(title, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.85, ease: "sine.out" });
    timeline.to({}, { duration: 0.32 });
    // Each letter condenses into a bead of ink, outer letters first...
    timeline.addLabel("condense");
    timeline.to(glyphs, {
      opacity: 0,
      scale: 0.35,
      y: 6,
      filter: "blur(6px)",
      duration: 0.42,
      ease: "power2.in",
      stagger: { each: 0.03, from: "edges" },
      onStart: () => { intro.phase = "seed"; },
    }, "condense");
    timeline.to(dots, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out", stagger: { each: 0.03, from: "edges" } }, "condense+=0.12");
    // ...then the beads run together to the centre, where they become the drop.
    timeline.to(dots, { x: toCenter("x"), scale: 0.55, duration: 0.62, ease: "power2.in", stagger: { each: 0.02, from: "edges" } }, "condense+=0.5");
    timeline.to(dots, { y: toCenter("y"), duration: 0.62, ease: "back.in(1.6)", stagger: { each: 0.02, from: "edges" } }, "condense+=0.5");
    timeline.to(dots, { opacity: 0, duration: 0.16, ease: "power1.in" }, "condense+=1.0");
    timeline.set(title, { opacity: 0 }, "condense+=1.2");
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
    }, "condense+=0.86");
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
      onStart: () => {
        intro.phase = "drop";
        intro.splash.active = true;
      },
    }, "release");
    // The still lake appears beneath the falling drop.
    timeline.to(intro.splash, { lake: 1, duration: 0.7, ease: "sine.out" }, "release+=0.15");
    timeline.addLabel("impact", `release+=${dropFallDuration}`);
    timeline.call(() => { intro.phase = "splash"; }, undefined, "impact");
    timeline.to(intro.seed, { scaleX: 1.4, scaleY: 0.08, scaleZ: 1.4, duration: 0.07, ease: "power4.out" }, "impact");
    timeline.to(intro.seed, {
      opacity: 0,
      duration: 0.09,
      ease: "power1.out",
      onComplete: () => { intro.seed.visible = false; },
    }, "impact+=0.02");
    timeline.to(intro.splash, { time: splashDuration, duration: splashDuration, ease: "none" }, "impact");
    // The tree starts drawing itself out of the spreading ink while the ripples die away.
    timeline.call(() => {
      intro.phase = "sprout";
      intro.elapsed = 0;
    }, undefined, "impact+=1.6");
    timeline.to(intro.splash, {
      fade: 1,
      duration: 0.8,
      ease: "power1.in",
      onComplete: () => { intro.splash.active = false; },
    }, "impact+=1.6");
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
    intro.backgroundReveal = 1;
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
    // Once the tree is drawn, the landscape inks in around it.
    if (intro.complete && intro.backgroundReveal < 1) {
      intro.backgroundElapsed += Math.min(delta, 0.1);
      intro.backgroundReveal = intro.instant ? 1 : smoothStep(0, backgroundRevealDuration, intro.backgroundElapsed);
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
      // A faint shadow on the water that tightens as the drop nears the surface.
      const casting = state.visible && (intro.phase === "seed" || intro.phase === "drop" || intro.phase === "splash");
      shadow.visible = casting;
      if (casting) {
        const height = Math.max(0, state.y);
        const nearness = 1 - Math.min(1, height / 3.85);
        shadow.position.set(state.x, 0.004, state.z);
        shadow.scale.setScalar((0.1 + 0.07 * height) * 2 * Math.max(state.scaleX, 0.001));
        shadowMaterial.uniforms.uOpacity.value = 0.18 * nearness * nearness * state.opacity;
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

type Droplet = { angle: number; start: number; radius: number; height: number; outward: number; upward: number; size: number };

// The ink lands in a still lake: a crown sheet whose rim breaks into jets and droplets, a central
// rebound jet that pinches off a drop, rings of ripples, and ink blooming over the water.
export function ImpactSplash({ intro }: { intro: IntroTimeline }) {
  const crown = useRef<THREE.Mesh>(null);
  const lake = useRef<THREE.Mesh>(null);
  const jet = useRef<THREE.Mesh>(null);
  const jetDrop = useRef<THREE.Mesh>(null);
  const droplets = useRef<THREE.InstancedMesh>(null);
  const crownGeometry = useMemo(() => createCrownSheetGeometry(128), []);
  const lakeGeometry = useMemo(() => new THREE.RingGeometry(0.0001, 4.5, 220, 140), []);
  const jetGeometry = useMemo(() => createJetGeometry(), []);
  const jetDropGeometry = useMemo(() => new THREE.SphereGeometry(0.065, 24, 18), []);
  const dropletGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  const crownMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const lakeMaterial = useMemo(() => createLakeMaterial(), []);
  const jetMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const jetDropMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const dropletMaterial = useMemo(() => createGlossyInkMaterial(), []);
  const particleTransform = useMemo(() => new THREE.Object3D(), []);
  // Half the droplets break off the crown's cusps; the rest are finer, faster spray from the impact.
  const dropletLayout = useMemo<Droplet[]>(() => Array.from({ length: 64 }, (_, index) => {
    const fromCusp = index < 32;
    const cusp = index % 16;
    return fromCusp
      ? {
        angle: (cusp / 16) * Math.PI * 2 + (seedUnit(23, index) - 0.5) * 0.12,
        start: crownPeak - 0.03 + seedUnit(29, index) * 0.08,
        radius: 0.88,
        height: 0.55,
        outward: 1.2 + seedUnit(41, index) * 0.9,
        upward: 1.3 + seedUnit(59, index) * 1.3,
        size: 0.022 + Math.pow(seedUnit(71, index), 2) * 0.024,
      }
      : {
        angle: seedUnit(83, index) * Math.PI * 2,
        start: 0.02 + seedUnit(89, index) * 0.06,
        radius: 0.35,
        height: 0.1,
        outward: 1.8 + seedUnit(97, index) * 1.4,
        upward: 1.8 + seedUnit(101, index) * 1.6,
        size: 0.008 + seedUnit(103, index) * 0.012,
      };
  }), []);

  useEffect(() => () => {
    for (const geometry of [crownGeometry, lakeGeometry, jetGeometry, jetDropGeometry, dropletGeometry]) geometry.dispose();
    for (const material of [crownMaterial, lakeMaterial, jetMaterial, jetDropMaterial, dropletMaterial]) material.dispose();
  }, [crownGeometry, crownMaterial, dropletGeometry, dropletMaterial, jetDropGeometry, jetDropMaterial, jetGeometry, jetMaterial, lakeGeometry, lakeMaterial]);

  useFrame(() => {
    const splash = intro.splash;
    const meshes = [crown.current, lake.current, jet.current, jetDrop.current, droplets.current];
    if (!splash.active) {
      for (const mesh of meshes) if (mesh) mesh.visible = false;
      return;
    }
    const t = splash.time;
    const impacted = intro.phase !== "drop";
    const keep = 1 - splash.fade;
    const origin = intro.seed;

    if (lake.current) {
      lake.current.visible = true;
      lake.current.position.set(origin.x, 0.006, origin.z);
      lakeMaterial.uniforms.uTime.value = impacted ? t : 0;
      lakeMaterial.uniforms.uSecondTime.value = jetDropLanding;
      lakeMaterial.uniforms.uLake.value = splash.lake * keep;
      lakeMaterial.uniforms.uBloom.value = impacted ? keep : 0;
    }

    if (crown.current) {
      const rise = smoothStep(0, crownPeak * 0.75, t) * (1 - smoothStep(crownPeak, crownGone, t));
      crown.current.visible = impacted && rise > 0.002;
      if (crown.current.visible) {
        updateCrown(crownGeometry, t, rise);
        crown.current.position.set(origin.x, 0, origin.z);
        crownMaterial.uniforms.uOpacity.value = keep;
      }
    }

    if (jet.current) {
      const grow = smoothStep(jetStart, jetPeak, t);
      const sink = 1 - smoothStep(jetDropRelease, jetGone, t);
      const height = jetHeight * grow * sink;
      jet.current.visible = impacted && height > 0.01;
      jet.current.position.set(origin.x, 0, origin.z);
      jet.current.scale.set(1 - 0.25 * (1 - sink), Math.max(height, 0.001), 1 - 0.25 * (1 - sink));
      jetMaterial.uniforms.uOpacity.value = keep;
    }

    if (jetDrop.current) {
      // Sits on the column's tip until it pinches off, flies up a little, then falls back in.
      let y = -1;
      if (t > jetStart && t < jetDropRelease) y = jetHeight * smoothStep(jetStart, jetPeak, t);
      else if (t >= jetDropRelease) {
        const flight = t - jetDropRelease;
        y = jetHeight + jetDropLift * flight - 0.5 * jetDropGravity * flight * flight;
      }
      jetDrop.current.visible = impacted && y > 0.02 && t > jetStart + 0.15;
      jetDrop.current.position.set(origin.x, y, origin.z);
      jetDropMaterial.uniforms.uOpacity.value = keep;
    }

    const mesh = droplets.current;
    if (!mesh) return;
    mesh.visible = impacted;
    dropletMaterial.uniforms.uOpacity.value = keep;
    const gravity = 9.8;
    dropletLayout.forEach((droplet, index) => {
      const flight = t - droplet.start;
      const y = droplet.height + droplet.upward * flight - 0.5 * gravity * flight * flight;
      if (flight <= 0 || y < 0) {
        particleTransform.scale.setScalar(0);
      } else {
        const reach = droplet.radius + droplet.outward * flight;
        particleTransform.position.set(origin.x + Math.cos(droplet.angle) * reach, y, origin.z + Math.sin(droplet.angle) * reach);
        // Stretched along its flight direction, as fast droplets are.
        const verticalSpeed = droplet.upward - gravity * flight;
        const speed = Math.hypot(droplet.outward, verticalSpeed);
        particleTransform.scale.set(droplet.size, droplet.size * (1 + speed * 0.12), droplet.size);
        particleTransform.rotation.set(0, -droplet.angle, -Math.atan2(droplet.outward, verticalSpeed));
      }
      particleTransform.updateMatrix();
      mesh.setMatrixAt(index, particleTransform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      <mesh ref={lake} geometry={lakeGeometry} material={lakeMaterial} rotation={[-Math.PI / 2, 0, 0]} visible={false} frustumCulled={false} renderOrder={3} />
      <mesh ref={crown} geometry={crownGeometry} material={crownMaterial} visible={false} frustumCulled={false} renderOrder={5} />
      <mesh ref={jet} geometry={jetGeometry} material={jetMaterial} visible={false} frustumCulled={false} renderOrder={5} />
      <mesh ref={jetDrop} geometry={jetDropGeometry} material={jetDropMaterial} visible={false} renderOrder={6} />
      <instancedMesh
        ref={droplets}
        args={[dropletGeometry, dropletMaterial, dropletLayout.length]}
        visible={false}
        frustumCulled={false}
        renderOrder={6}
      />
    </group>
  );
}

const crownRings = 5;

function createCrownSheetGeometry(segments: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < crownRings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      positions.push(0, 0, 0);
      uvs.push(segment / segments, ring / (crownRings - 1));
    }
  }
  for (let ring = 0; ring < crownRings - 1; ring++) {
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
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(positions.length).fill(0), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// The crown: a crater floor rising into a thin sheet whose lip flares outward and lifts ~16 cusps
// (the jets that shed droplets).
function updateCrown(geometry: THREE.BufferGeometry, t: number, rise: number) {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const segments = positions.count / crownRings;
  const radius = 0.22 + 0.72 * smoothStep(0, 0.3, t);
  const ringRadius = [0.25, 0.55, 0.8, 0.95, 1.05];
  const ringHeight = [-0.06, 0.12, 0.42, 0.78, 0.92];
  for (let ring = 0; ring < crownRings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const wobble = Math.sin(angle * 5 + 0.7) * 0.04 + Math.cos(angle * 11 - 0.4) * 0.02;
      const cusp = Math.pow(Math.max(0, Math.cos(angle * 8 + Math.sin(angle * 3) * 0.3)), 10);
      const lip = ring === crownRings - 1;
      const r = radius * (ringRadius[ring] + (lip ? cusp * 0.07 : 0) + wobble * (ring / crownRings));
      const h = rise * 0.6 * (ringHeight[ring] + (lip ? cusp * 0.55 : 0) + wobble);
      positions.setXYZ(ring * segments + segment, Math.cos(angle) * r, 0.01 + h, Math.sin(angle) * r);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

// The rebound column, normalised to height 1: a broad base narrowing to a neck under a bulb.
function createJetGeometry() {
  const profile = [
    [0.12, 0], [0.075, 0.12], [0.052, 0.35], [0.045, 0.62], [0.04, 0.82], [0.03, 0.9], [0.012, 0.94], [0, 0.95],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(profile, 32);
}
