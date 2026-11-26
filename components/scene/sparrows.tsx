"use client";

import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IntroTimeline } from "./intro";
import { smoothStep } from "./math";
import type { PerchPoint } from "./pine-geometry";
import { approachStyles, createBrain, settleBrain, stepFlight, stepPerched, tuning, type ApproachStyle, type Brain, type BirdRole, type Surface } from "./sparrow-motion";
import { paintSparrowAtlas } from "./sparrow-painting";
import { createSparrowAssets, createSparrowRig, restPose, type RigPose, type SparrowAssets, type SparrowRig } from "./sparrow-rig";

// World size of one sprite cell; a perched sparrow is about 0.5 tall.
const spriteSize = 0.85;
// Past this x (tree-local) a bird is off screen on any normal viewport.
const offscreenX = 12.5;

const roles: BirdRole[] = ["forager", "lookout", "fidget"];

// Where each bird lives: the forager feeds on the cliff top, the lookout takes the high limbs, the fidget the low ones.
function domainOf(role: BirdRole, perch: PerchPoint) {
  if (role === "forager") return perch.kind === "ground";
  const high = perch.id.startsWith("timeslips") || perch.id.startsWith("travel-health");
  return perch.kind === "branch" && (role === "lookout" ? high : !high);
}

type StripSurface = Surface & { perch: PerchPoint; lengths: number[] };

function createSurface(perch: PerchPoint): StripSurface {
  const lengths = [0];
  for (let index = 1; index < perch.path.length; index += 1) {
    lengths.push(lengths[index - 1] + perch.path[index].distanceTo(perch.path[index - 1]));
  }
  const first = perch.path[0];
  const last = perch.path[perch.path.length - 1];
  return { perch, lengths, length: lengths[lengths.length - 1], dirX: last.x >= first.x ? 1 : -1 };
}

function surfacePoint(surface: StripSurface, s: number, out: THREE.Vector3) {
  const target = THREE.MathUtils.clamp(s, 0, 1) * surface.length;
  const { path } = surface.perch;
  let index = 1;
  while (index < path.length - 1 && surface.lengths[index] < target) index += 1;
  const start = surface.lengths[index - 1];
  const span = Math.max(1e-6, surface.lengths[index] - start);
  return out.copy(path[index - 1]).lerp(path[index], (target - start) / span);
}

type BirdState = "waiting" | "approach" | "perched" | "departing";

type Bird = {
  role: BirdRole;
  rig: SparrowRig;
  brain: Brain;
  pose: RigPose;
  state: BirdState;
  timer: number;
  duration: number;
  surface: StripSurface | null;
  curve: THREE.CatmullRomCurve3 | null;
  curveLength: number;
  speed: number;
  style: ApproachStyle;
  lastStyle: ApproachStyle | null;
  settle: number;
  opacity: number;
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

function createBird(role: BirdRole, index: number, assets: SparrowAssets): Bird {
  return {
    role,
    rig: createSparrowRig(assets, spriteSize, index + 1),
    brain: createBrain(role),
    pose: restPose(),
    state: "waiting",
    timer: 0,
    // Staggered first arrivals, so the flock doesn't land in unison.
    duration: 1.6 + index * 3.1 + Math.random() * 1.4,
    surface: null,
    curve: null,
    curveLength: 1,
    speed: 3,
    style: "direct",
    lastStyle: null,
    settle: 99,
    opacity: 0,
  };
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
  const scratch = useMemo(() => ({
    point: new THREE.Vector3(),
    ahead: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    behind: new THREE.Vector3(),
  }), []);

  const surfaces = useMemo(() => perches.map(createSurface), [perches]);
  const { assets, birds } = useMemo(() => {
    const sheet = createSparrowAssets(paintSparrowAtlas());
    return { assets: sheet, birds: roles.map((role, index) => createBird(role, index, sheet)) };
  }, []);

  useEffect(() => () => {
    for (const bird of birds) bird.rig.dispose();
    assets.dispose();
  }, [assets, birds]);

  const slopeAt = (surface: StripSurface, s: number) => {
    surfacePoint(surface, s - 0.06, scratch.behind);
    surfacePoint(surface, s + 0.06, scratch.ahead);
    const dx = scratch.ahead.x - scratch.behind.x;
    const dy = scratch.ahead.y - scratch.behind.y;
    return Math.atan2(dy * Math.sign(dx || 1), Math.abs(dx));
  };

  const startApproach = (bird: Bird) => {
    const free = surfaces.filter((surface) => domainOf(bird.role, surface.perch) && !taken.current.has(surface.perch.id));
    if (free.length === 0) return;
    const surface = free[Math.floor(Math.random() * free.length)];
    taken.current.add(surface.perch.id);
    const target = surface.perch.position;
    // Mostly come in from the perch's own side of the tree, so the flight doesn't cut across the crown.
    const sameSide = bird.role === "forager" ? Math.random() < 0.5 : Math.random() < 0.8;
    const ownSide = Math.sign(target.x - 0.5) || 1;
    const side = sameSide ? ownSide : -ownSide;
    const z = target.z + randomBetween(-0.15, 0.4);
    // Each arrival picks a different style from the bird's last one.
    const styles = (Object.keys(approachStyles) as ApproachStyle[]).filter((name) => name !== bird.lastStyle);
    const style = styles[Math.floor(Math.random() * styles.length)];
    bird.style = style;
    bird.lastStyle = style;
    const edgeY = style === "slow" ? randomBetween(1.6, 2.2) : style === "swoop" ? randomBetween(3.4, 4.2) : style === "glide" ? randomBetween(4.2, 5.2) : randomBetween(2.6, 4);
    const edge = new THREE.Vector3(side * (offscreenX + Math.random()), target.y + edgeY, z);
    const landing = target.clone();
    const at = (x: number, height: number, depth = z) => new THREE.Vector3(x, target.y + height, depth);
    let points: THREE.Vector3[];
    if (style === "slow") {
      // Low and unhurried: a long, shallow glide in that stays near the height of the perch.
      points = [
        edge,
        at(side * randomBetween(6.5, 7.5), randomBetween(1.4, 1.9)),
        at(side * randomBetween(3.6, 4.4), randomBetween(1.5, 2.0)),
        at(target.x + side * randomBetween(1.6, 2.1), randomBetween(0.7, 1.0), target.z + 0.1),
        landing,
      ];
    } else if (style === "glide") {
      // One long, gentle slope down from high up, with a single easy bend.
      points = [
        edge,
        at(side * randomBetween(7, 8), randomBetween(3.6, 4.4)),
        at(side * randomBetween(3.6, 4.4), randomBetween(2.2, 2.8), z + 0.3),
        at(target.x + side * randomBetween(1.4, 1.9), randomBetween(0.9, 1.2), target.z + 0.1),
        landing,
      ];
    } else if (style === "swoop") {
      // Down from above in swings from side to side, each narrower than the last.
      points = [
        edge,
        at(side * randomBetween(5.4, 6.4), randomBetween(3.1, 3.7)),
        at(target.x + side * randomBetween(2.3, 2.9), randomBetween(2.3, 2.7)),
        at(target.x - side * randomBetween(1.5, 1.9), randomBetween(1.6, 1.9)),
        at(target.x + side * randomBetween(0.9, 1.2), randomBetween(1.0, 1.2), target.z + 0.1),
        at(target.x - side * randomBetween(0.3, 0.5), randomBetween(0.45, 0.6), target.z + 0.1),
        landing,
      ];
    } else {
      points = [
        edge,
        at(side * randomBetween(6, 7.4), randomBetween(1.6, 2.6)),
        at(target.x + side * randomBetween(1.5, 2.1), randomBetween(0.6, 1.0), target.z + 0.1),
        landing,
      ];
    }
    bird.curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    bird.curveLength = bird.curve.getLength();
    bird.speed = bird.brain.profile.flightSpeed * approachStyles[style].speed;
    bird.surface = surface;
    bird.state = "approach";
    bird.timer = 0;
    bird.brain.facing = (-side) as 1 | -1;
    bird.brain.flapPhase = 0;
    bird.brain.flapTarget = 4;
    bird.brain.gliding = false;
  };

  const startDeparture = (bird: Bird) => {
    const { surface } = bird;
    if (!surface) return;
    const from = surfacePoint(surface, bird.brain.s, new THREE.Vector3());
    // Leave toward the outer end of a limb; the forager picks a side.
    const exit = (bird.role === "forager" ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(from.x - 0.5) || 1) as 1 | -1;
    bird.curve = new THREE.CatmullRomCurve3([
      from,
      new THREE.Vector3(from.x + exit * 0.45, from.y + 0.45, from.z + 0.1),
      new THREE.Vector3(from.x + exit * 3.2, from.y + randomBetween(1.4, 2.4), from.z),
      new THREE.Vector3(exit * (offscreenX + Math.random()), from.y + randomBetween(3, 5.5), from.z - 0.2),
    ], false, "catmullrom", 0.5);
    bird.curveLength = bird.curve.getLength();
    bird.speed = bird.brain.profile.flightSpeed;
    bird.state = "departing";
    bird.timer = 0;
    bird.brain.facing = exit;
    bird.brain.flapPhase = 0;
    bird.brain.flapTarget = 3;
    bird.brain.gliding = false;
  };

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const ready = intro.complete && intro.backgroundReveal >= 0.98;
    const offset = scroll.offset;
    const noNote = selectedRef.current === null;

    for (const [index, bird] of birds.entries()) {
      const { rig, brain, pose } = bird;
      const ground = bird.role === "forager";
      // Only the canopy or only the cliff top is on screen at a time; each bird works its own.
      const inView = ground ? offset >= 0.3 : offset <= 0.66;
      const canFly = ground ? offset >= 0.34 : offset <= 0.63;
      const target = ready && inView && noNote ? 1 : 0;
      bird.opacity += (target - bird.opacity) * Math.min(1, dt * 3.2);
      rig.opacity.value = bird.opacity;

      if (reducedMotion) {
        // No flight: the two tree sparrows rest on fixed perches.
        const surface = !ground ? surfaces.find((item) => domainOf(bird.role, item.perch)) : undefined;
        if (!surface) {
          rig.root.visible = false;
          continue;
        }
        Object.assign(pose, restPose());
        pose.headAngle = bird.role === "lookout" ? -0.05 : 0.05;
        rig.setPose(pose);
        surfacePoint(surface, 0.5, rig.root.position);
        rig.root.rotation.z = slopeAt(surface, 0.5) * 0.7;
        rig.root.scale.x = index === 1 ? 1 : -1;
        rig.root.visible = bird.opacity > 0.01;
        continue;
      }

      if (bird.state === "waiting") {
        rig.root.visible = false;
        if (ready && canFly && noNote) bird.timer += dt;
        if (bird.timer >= bird.duration) startApproach(bird);
        continue;
      }

      rig.root.visible = bird.opacity > 0.01;
      bird.timer += dt;

      if (bird.state === "approach" && bird.curve) {
        // Constant cruise speed, then a smooth braking over the last third of the path.
        const { braking, endSpeed } = approachStyles[bird.style];
        const cruiseTime = (braking * bird.curveLength) / bird.speed;
        const brakeTime = (2 * (1 - braking) * bird.curveLength) / (bird.speed + endSpeed);
        const duration = cruiseTime + brakeTime;
        let distance: number;
        if (bird.timer <= cruiseTime) {
          distance = bird.speed * bird.timer;
        } else {
          const tau = Math.min(bird.timer - cruiseTime, brakeTime);
          const decel = (endSpeed - bird.speed) / brakeTime;
          distance = braking * bird.curveLength + bird.speed * tau + 0.5 * decel * tau * tau;
        }
        const progress = Math.min(1, distance / bird.curveLength);
        bird.curve.getPointAt(progress, scratch.point);
        bird.curve.getTangentAt(progress, scratch.tangent);
        const speedNow = bird.timer <= cruiseTime ? bird.speed : THREE.MathUtils.lerp(bird.speed, endSpeed, (bird.timer - cruiseTime) / brakeTime);
        const vx = scratch.tangent.x * speedNow;
        const vy = scratch.tangent.y * speedNow;
        // The swoop turns about at each swing; a dead band stops the bird flickering round at the turning points.
        if (Math.abs(vx) > (bird.style === "swoop" ? 0.25 : 0.05)) brain.facing = vx >= 0 ? 1 : -1;
        const landingBlend = smoothStep(0.65, 0.96, progress);
        const lift = stepFlight(brain, dt, pose, {
          phase: progress >= 0.6 ? "landing" : "cruise",
          progress,
          elapsed: bird.timer,
          vx: vx * brain.facing,
          vy,
          style: bird.style,
        }) * (1 - landingBlend);
        rig.setPose(pose);
        rig.root.position.copy(scratch.point);
        rig.root.position.y += lift;
        rig.root.rotation.z = 0;
        rig.root.scale.x = brain.facing;

        if (bird.timer >= duration && bird.surface) {
          bird.state = "perched";
          bird.timer = 0;
          bird.duration = randomBetween(tuning.rest[0], tuning.rest[1]) * (bird.role === "fidget" ? 0.7 : 1);
          bird.settle = 0;
          brain.s = 0.5;
          settleBrain(brain);
        }
      } else if (bird.state === "perched" && bird.surface) {
        bird.settle += dt;
        stepPerched(brain, dt, pose, bird.surface);
        // Just landed: wings and tail are still open, the body bounces once, then everything folds.
        if (bird.settle < 0.3) {
          const k = smoothStep(0, 0.3, bird.settle);
          if (k < 0.85) pose.wingMode = "flap";
          pose.wingFrame = THREE.MathUtils.lerp(0.5, 2.4, k);
          pose.wingFrameFar = pose.wingFrame + 0.4;
          pose.tailFan = k < 0.55 ? 1 : 0;
          pose.bodyPitch += 0.3 * (1 - k);
          brain.lift += tuning.landing.bounce * Math.sin(Math.PI * Math.min(1, bird.settle / 0.22));
        }
        rig.setPose(pose);
        surfacePoint(bird.surface, brain.s, rig.root.position);
        rig.root.position.y += brain.lift;
        rig.root.rotation.z = slopeAt(bird.surface, brain.s) * 0.7;
        rig.root.scale.x = brain.facing;
        if (bird.timer >= bird.duration && ready && noNote && canFly) startDeparture(bird);
      } else if (bird.state === "departing" && bird.curve) {
        // A crouch, then a spring and a climbing, bounding flight; speed builds from nothing.
        const crouch = tuning.takeoff.crouch;
        if (bird.timer < crouch) {
          Object.assign(pose, restPose());
          pose.bodyScaleY = 1 - 0.14 * smoothStep(0, crouch, bird.timer);
          pose.bodyPitch = -0.1;
          rig.setPose(pose);
          rig.root.position.copy(bird.curve.getPointAt(0));
          rig.root.scale.x = brain.facing;
          rig.root.rotation.z = 0;
        } else {
          const flightTime = bird.timer - crouch;
          const total = (bird.curveLength / bird.speed) * 1.35;
          const p = Math.min(1, flightTime / total);
          const progress = p ** 1.6;
          bird.curve.getPointAt(progress, scratch.point);
          bird.curve.getTangentAt(progress, scratch.tangent);
          const speedNow = bird.speed * (0.3 + 0.9 * Math.min(1, flightTime / 1.2));
          const vx = scratch.tangent.x * speedNow;
          const vy = scratch.tangent.y * speedNow;
          const lift = stepFlight(brain, dt, pose, {
            phase: flightTime < 0.55 ? "takeoff" : "cruise",
            progress: p,
            elapsed: flightTime,
            vx: vx * brain.facing,
            vy,
          });
          rig.setPose(pose);
          rig.root.position.copy(scratch.point);
          rig.root.position.y += lift;
          rig.root.rotation.z = 0;
          rig.root.scale.x = brain.facing;
          if (p >= 1) {
            if (bird.surface) taken.current.delete(bird.surface.perch.id);
            bird.surface = null;
            bird.curve = null;
            bird.state = "waiting";
            bird.timer = 0;
            bird.duration = randomBetween(3.5, 8) * (bird.role === "fidget" ? 0.7 : 1);
            rig.root.visible = false;
          }
        }
      }
    }
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      {birds.map((bird) => <primitive key={bird.role} object={bird.rig.root} />)}
    </group>
  );
}
