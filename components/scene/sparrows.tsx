"use client";

import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IntroTimeline } from "./intro";
import { smoothStep } from "./math";
import type { PerchPoint } from "./pine-geometry";
import { paintSparrowAtlas, sparrowAtlas, sparrowFeet, sparrowPoseCell, type SparrowPose } from "./sparrow-painting";

// World size of one sprite cell. A perched sparrow fills about 60% of it, so roughly 0.7 of a unit tall.
const spriteSize = 1.2;
const flockSize = 3;
// Past this x (tree-local) a bird is off screen on any normal viewport.
const offscreenX = 12;
// How far the sprite's centre sits above its feet.
const crownBottomOffset = (sparrowFeet.y - 0.5) * spriteSize;
const flapCycle: SparrowPose[] = ["wingsUp", "wingsLevel", "wingsDown", "wingsLevel"];

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Reads one cell of the sheet, mirrors it when the bird faces left, and breaks the edge up like dry brush on paper.
const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uCell;
  uniform vec2 uGrid;
  uniform float uFlip;
  uniform float uOpacity;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 local = vec2(mix(vUv.x, 1.0 - vUv.x, uFlip), vUv.y);
    vec2 atlasUv = vec2((uCell.x + local.x) / uGrid.x, 1.0 - (uCell.y + 1.0 - local.y) / uGrid.y);
    vec4 texel = texture2D(uMap, atlasUv);
    float grain = hash(floor(vUv * 220.0) + uSeed);
    float alpha = texel.a * mix(0.86, 1.0, grain) * uOpacity;
    vec3 rgb = texel.a > 0.001 ? texel.rgb / texel.a : vec3(0.0);
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

type BirdState = "waiting" | "approach" | "perched" | "departing";

type Bird = {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  state: BirdState;
  timer: number;
  duration: number;
  perch: PerchPoint | null;
  curve: THREE.CatmullRomCurve3 | null;
  dir: 1 | -1;
  pose: SparrowPose;
  flapPhase: number;
  poseTimer: number;
  pecking: boolean;
  hopTimer: number;
  hopClock: number;
  opacity: number;
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function createBird(index: number, texture: THREE.Texture, geometry: THREE.PlaneGeometry): Bird {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uCell: { value: new THREE.Vector2(0, 0) },
      uGrid: { value: new THREE.Vector2(sparrowAtlas.columns, sparrowAtlas.rows) },
      uFlip: { value: 0 },
      uOpacity: { value: 0 },
      uSeed: { value: index * 17.3 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  const group = new THREE.Group();
  group.add(mesh);
  group.visible = false;
  return {
    group,
    mesh,
    material,
    state: "waiting",
    // Staggered first arrivals, so the flock doesn't land in unison.
    timer: 0,
    duration: 1.4 + index * 2.8 + Math.random() * 1.4,
    perch: null,
    curve: null,
    dir: 1,
    pose: "perched",
    flapPhase: Math.random(),
    poseTimer: 0,
    pecking: false,
    hopTimer: randomBetween(3, 7),
    hopClock: -1,
    opacity: 0,
  };
}

function setPose(bird: Bird, pose: SparrowPose) {
  if (bird.pose === pose) return;
  bird.pose = pose;
  const { column, row } = sparrowPoseCell(pose);
  bird.material.uniforms.uCell.value.set(column, row);
}

// A branch's pitch, from its tangent, so a perched bird sits level on the wood rather than on the horizontal.
function branchTilt(tangent: THREE.Vector3) {
  return Math.atan2(tangent.y * Math.sign(tangent.x || 1), Math.abs(tangent.x)) * 0.7;
}

function flightTilt(velocity: THREE.Vector3) {
  return Math.atan2(velocity.y * Math.sign(velocity.x || 1), Math.abs(velocity.x)) * 0.55;
}

export function Sparrows({ perches, intro, reducedMotion, selectedId }: {
  perches: PerchPoint[];
  intro: IntroTimeline;
  reducedMotion: boolean;
  selectedId: string | null;
}) {
  const scroll = useScroll();
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const taken = useRef(new Set<string>());
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), velocity: new THREE.Vector3() }), []);

  const { birds, texture, geometry } = useMemo(() => {
    const atlasTexture = new THREE.CanvasTexture(paintSparrowAtlas());
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
    atlasTexture.premultiplyAlpha = true;
    atlasTexture.anisotropy = 4;
    const plane = new THREE.PlaneGeometry(spriteSize, spriteSize);
    return {
      texture: atlasTexture,
      geometry: plane,
      birds: Array.from({ length: flockSize }, (_, index) => createBird(index, atlasTexture, plane)),
    };
  }, []);

  useEffect(() => () => {
    texture.dispose();
    geometry.dispose();
    for (const bird of birds) bird.material.dispose();
  }, [texture, geometry, birds]);

  const startApproach = (bird: Bird) => {
    const free = perches.filter((perch) => !taken.current.has(perch.id));
    if (free.length === 0) return false;
    const perch = free[Math.floor(Math.random() * free.length)];
    taken.current.add(perch.id);
    // Mostly come in from the perch's own side of the tree, so the flight doesn't cut across the crown.
    const side = (Math.random() < 0.8 ? Math.sign(perch.position.x) : -Math.sign(perch.position.x)) || 1;
    const dir = (-side) as 1 | -1;
    const z = perch.position.z + randomBetween(-0.2, 0.5);
    bird.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (offscreenX + Math.random()), perch.position.y + randomBetween(1.8, 3.6), z),
      new THREE.Vector3(side * randomBetween(5.2, 6.4), perch.position.y + randomBetween(1.2, 2.2), z),
      new THREE.Vector3(perch.position.x + side * 1.25, perch.position.y + 0.72, perch.position.z + 0.1),
      perch.position.clone(),
    ], false, "catmullrom", 0.5);
    bird.perch = perch;
    bird.dir = dir;
    bird.state = "approach";
    bird.timer = 0;
    bird.duration = randomBetween(3.6, 4.6);
    return true;
  };

  const startDeparture = (bird: Bird) => {
    const perch = bird.perch;
    if (!perch) return;
    // Leave toward the nearer edge, outward from the trunk.
    const exitDir = (Math.sign(perch.position.x) || 1) as 1 | -1;
    bird.dir = exitDir;
    const { x, y, z } = perch.position;
    bird.curve = new THREE.CatmullRomCurve3([
      perch.position.clone(),
      new THREE.Vector3(x + exitDir * 0.45, y + 0.5, z + 0.1),
      new THREE.Vector3(x + exitDir * 3.2, y + randomBetween(1.4, 2.4), z),
      new THREE.Vector3(exitDir * (offscreenX + Math.random()), y + randomBetween(2.6, 5), z - 0.2),
    ], false, "catmullrom", 0.5);
    bird.state = "departing";
    bird.timer = 0;
    bird.duration = randomBetween(2.8, 3.6);
  };

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const ready = intro.complete && intro.backgroundReveal >= 0.98;
    // Only the canopy and trunk views show the tree's crown; roots and open field notes are somewhere else.
    const inView = scroll.offset <= 0.66 && selectedRef.current === null;
    const target = ready && inView ? 1 : 0;
    const canFly = ready && scroll.offset <= 0.63 && selectedRef.current === null;

    for (const [index, bird] of birds.entries()) {
      bird.opacity += (target - bird.opacity) * Math.min(1, delta * 3.2);
      bird.material.uniforms.uOpacity.value = bird.opacity;
      bird.group.visible = bird.opacity > 0.01 && (bird.state !== "waiting" || reducedMotion);

      if (reducedMotion) {
        // No flight: two sparrows rest on fixed perches.
        const perch = perches[index === 0 ? 0 : 3] ?? perches[0];
        if (index > 1 || !perch) {
          bird.group.visible = false;
          continue;
        }
        bird.group.visible = bird.opacity > 0.01;
        bird.group.position.copy(perch.position);
        bird.group.rotation.z = branchTilt(perch.tangent);
        bird.dir = index === 0 ? 1 : -1;
        bird.material.uniforms.uFlip.value = bird.dir === -1 ? 1 : 0;
        bird.mesh.position.set((0.5 - sparrowFeet.x) * spriteSize * bird.dir, crownBottomOffset, 0);
        setPose(bird, "perched");
        continue;
      }

      if (bird.state === "waiting") {
        if (canFly) bird.timer += delta;
        if (bird.timer >= bird.duration && startApproach(bird)) bird.group.visible = true;
        continue;
      }

      bird.timer += delta;
      const progress = Math.min(1, bird.timer / bird.duration);
      let flight = 0; // 0 standing on the branch, 1 in the air

      if (bird.state === "approach" && bird.curve && bird.perch) {
        const u = easeOutCubic(progress);
        bird.curve.getPoint(u, scratch.point);
        bird.curve.getTangent(u, scratch.velocity);
        bird.group.position.copy(scratch.point);
        const landing = smoothStep(0.8, 0.97, progress);
        bird.group.rotation.z = THREE.MathUtils.lerp(flightTilt(scratch.velocity), branchTilt(bird.perch.tangent), landing) + 0.3 * smoothStep(0.78, 0.92, progress) * (1 - landing);
        // Wings beat fast on the way in, then slow and flare as the feet reach the wood.
        bird.flapPhase += delta * THREE.MathUtils.lerp(12, 6.5, smoothStep(0.45, 0.9, progress));
        setPose(bird, progress > 0.86 ? "landingFlare" : flapCycle[Math.floor(bird.flapPhase * 4) % 4]);
        flight = 1 - smoothStep(0.82, 1, progress);
        if (progress >= 1) {
          bird.state = "perched";
          bird.timer = 0;
          bird.duration = randomBetween(6, 11);
          bird.pecking = false;
          bird.poseTimer = randomBetween(0.9, 2.4);
          bird.hopTimer = randomBetween(2.5, 6);
          bird.hopClock = -1;
          bird.group.position.copy(bird.perch.position);
          bird.group.rotation.z = branchTilt(bird.perch.tangent);
          setPose(bird, "perched");
        }
      } else if (bird.state === "perched" && bird.perch) {
        bird.group.position.copy(bird.perch.position);
        bird.group.rotation.z = branchTilt(bird.perch.tangent);
        // Look about: now and then the head dips, as if pecking at the bark.
        bird.poseTimer -= delta;
        if (bird.poseTimer <= 0) {
          bird.pecking = !bird.pecking;
          bird.poseTimer = bird.pecking ? randomBetween(0.45, 1.1) : randomBetween(0.9, 2.6);
          setPose(bird, bird.pecking ? "perchedPeck" : "perched");
        }
        // A small hop-turn, so it doesn't stare one way the whole rest.
        bird.hopTimer -= delta;
        if (bird.hopTimer <= 0 && bird.hopClock < 0) bird.hopClock = 0;
        if (bird.hopClock >= 0) {
          bird.hopClock += delta / 0.3;
          if (bird.hopClock >= 0.5 && bird.hopClock - delta / 0.3 < 0.5) bird.dir = (-bird.dir) as 1 | -1;
          bird.group.position.y += Math.sin(Math.PI * Math.min(1, bird.hopClock)) * 0.09;
          if (bird.hopClock >= 1) {
            bird.hopClock = -1;
            bird.hopTimer = randomBetween(3, 8);
          }
        }
        if (bird.timer >= bird.duration) startDeparture(bird);
      } else if (bird.state === "departing" && bird.curve && bird.perch) {
        const u = progress ** 1.7;
        bird.curve.getPoint(u, scratch.point);
        bird.curve.getTangent(u, scratch.velocity);
        bird.group.position.copy(scratch.point);
        bird.group.rotation.z = flightTilt(scratch.velocity);
        bird.flapPhase += delta * 12;
        setPose(bird, flapCycle[Math.floor(bird.flapPhase * 4) % 4]);
        flight = smoothStep(0, 0.12, progress);
        if (progress >= 1) {
          taken.current.delete(bird.perch.id);
          bird.perch = null;
          bird.curve = null;
          bird.state = "waiting";
          bird.timer = 0;
          bird.duration = randomBetween(3.5, 8);
          bird.group.visible = false;
        }
      }

      bird.material.uniforms.uFlip.value = bird.dir === -1 ? 1 : 0;
      // Standing, the sprite hangs so its feet meet the branch; in the air it is centred on its path.
      bird.mesh.position.set(
        (0.5 - sparrowFeet.x) * spriteSize * bird.dir * (1 - flight),
        crownBottomOffset * (1 - flight) + 0.02 * flight,
        0,
      );
    }
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      {birds.map((bird, index) => <primitive key={index} object={bird.group} />)}
    </group>
  );
}
