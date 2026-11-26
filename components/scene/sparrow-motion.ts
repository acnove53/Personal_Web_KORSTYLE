import * as THREE from "three";
import { smoothStep } from "./math";
import { restPose, type RigPose } from "./sparrow-rig";

// Procedural sparrow behaviour. Everything that can be tuned by feel is in `tuning`: timings are in seconds,
// angles in radians, distances in scene units (the tree is about 7 tall).

export type BirdRole = "forager" | "lookout" | "fidget";
type Action = "rest" | "look" | "peck" | "hop" | "flick" | "fluff" | "stretch";
type ActionWeights = Record<Exclude<Action, "rest">, number>;

type Profile = {
  weights: ActionWeights;
  gap: [number, number]; // pause between behaviours
  neutralHead: number; // resting head angle: positive looks down
  lookBack: number; // chance a look is over the shoulder
  hop: [number, number]; // hop distance
  hopHeight: number;
  hopTurn: number; // chance a hop turns the bird around
  pecks: [number, number]; // pecks per burst
  peckDepth: [number, number];
  cruiseRate: number; // wingbeats per second in flight
  burst: [number, number]; // wingbeats per burst
  glide: [number, number]; // seconds of glide between bursts
  flightSpeed: number;
};

export const tuning = {
  profiles: {
    // On the ground, feeding: peck, hop, lift the head to scan.
    forager: {
      weights: { peck: 6, hop: 3.4, look: 1.2, flick: 0.5, fluff: 0.1, stretch: 0 },
      gap: [0.12, 0.6], neutralHead: 0.22, lookBack: 0.1, hop: [0.16, 0.34], hopHeight: 0.07, hopTurn: 0.25,
      pecks: [2, 4], peckDepth: [0.8, 1.05], cruiseRate: 13, burst: [3, 5], glide: [0.12, 0.2], flightSpeed: 3.3,
    },
    // High on a limb, watching: head scans, tail flicks, mostly still.
    lookout: {
      weights: { peck: 0.25, hop: 0.3, look: 6, flick: 3, fluff: 0.5, stretch: 0.2 },
      gap: [0.25, 1.0], neutralHead: -0.05, lookBack: 0.3, hop: [0.1, 0.2], hopHeight: 0.05, hopTurn: 0.5,
      pecks: [1, 2], peckDepth: [0.5, 0.7], cruiseRate: 12, burst: [3, 5], glide: [0.14, 0.24], flightSpeed: 3,
    },
    // Low on a limb, restless: ruffles, stretches, hops to turn about.
    fidget: {
      weights: { peck: 0.3, hop: 2.6, look: 1, flick: 1, fluff: 4, stretch: 3 },
      gap: [0.2, 0.8], neutralHead: 0.04, lookBack: 0.15, hop: [0.08, 0.18], hopHeight: 0.05, hopTurn: 0.75,
      pecks: [1, 2], peckDepth: [0.5, 0.7], cruiseRate: 15, burst: [3, 4], glide: [0.08, 0.14], flightSpeed: 2.8,
    },
  } satisfies Record<BirdRole, Profile>,
  peck: { down: 0.09, contact: 0.05, up: 0.14, pause: [0.1, 0.28] },
  look: { saccade: 30, hold: [0.35, 1.1], angle: [-0.22, 0.3] },
  hop: { crouch: 0.07, flight: 0.2, land: 0.08 },
  flick: { up: 0.06, hold: 0.05, down: 0.14, angle: 0.38 },
  fluff: { duration: 0.95, shiverHz: 26, shiverAngle: 0.07 },
  stretch: { duration: 0.5 },
  rest: [6, 11] as [number, number],
  takeoff: { crouch: 0.1, flapRate: 15, legsOut: 0.18 },
  landing: { startAt: 0.7, flapRate: 6.5, pitch: 0.7, bounce: 0.04 },
  undulation: { amplitude: 0.05, rate: 0.5 },
};

export type Surface = {
  length: number; // world length of the strip
  dirX: 1 | -1; // which way along the screen increasing `s` runs
};

export type Brain = {
  role: BirdRole;
  profile: Profile;
  action: Action;
  t: number;
  dur: number;
  wait: number;
  clock: number;
  // action data
  peckTimes: number[];
  peckDepth: number;
  lookSteps: { angle: number; look: 1 | -1; hold: number }[];
  hopFrom: number;
  hopTo: number;
  hopTurned: boolean;
  flickCount: number;
  // smoothed head
  headAngle: number;
  headLook: number;
  headTarget: number;
  headLookTarget: 1 | -1;
  // where the bird is along its surface, and how it faces
  s: number;
  facing: 1 | -1;
  lift: number;
  // flight
  flapPhase: number;
  flapTarget: number;
  gliding: boolean;
  glideLeft: number;
  undulation: number;
};

const random = (min: number, max: number) => min + Math.random() * (max - min);
const randomInt = (range: [number, number]) => Math.round(random(range[0], range[1]));
const rangeOf = (range: readonly number[]) => random(range[0], range[1]);

export function createBrain(role: BirdRole): Brain {
  const profile = tuning.profiles[role];
  return {
    role,
    profile,
    action: "rest",
    t: 0,
    dur: 0,
    wait: random(0.4, 1.4),
    clock: Math.random() * 10,
    peckTimes: [],
    peckDepth: 0.9,
    lookSteps: [],
    hopFrom: 0.5,
    hopTo: 0.5,
    hopTurned: false,
    flickCount: 1,
    headAngle: profile.neutralHead,
    headLook: 1,
    headTarget: profile.neutralHead,
    headLookTarget: 1,
    s: 0.5,
    facing: 1,
    lift: 0,
    flapPhase: 0,
    flapTarget: 4,
    gliding: false,
    glideLeft: 0,
    undulation: 0,
  };
}

// Back to a standing start, for when the bird has just landed.
export function settleBrain(brain: Brain) {
  brain.action = "rest";
  brain.t = 0;
  brain.wait = random(0.25, 0.8);
  brain.lift = 0;
  brain.headLook = 1;
  brain.headLookTarget = 1;
  brain.headTarget = brain.profile.neutralHead;
  brain.gliding = false;
  brain.undulation = 0;
}

function resetPose(pose: RigPose) {
  Object.assign(pose, restPose());
}

function chooseAction(brain: Brain): Exclude<Action, "rest"> {
  const entries = Object.entries(brain.profile.weights) as [Exclude<Action, "rest">, number][];
  let pick = Math.random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [name, weight] of entries) {
    pick -= weight;
    if (pick <= 0) return name;
  }
  return entries[0][0];
}

function startAction(brain: Brain, surface: Surface) {
  const profile = brain.profile;
  const action = chooseAction(brain);
  brain.action = action;
  brain.t = 0;

  switch (action) {
    case "look": {
      const steps = 1 + Math.floor(Math.random() * 3);
      brain.lookSteps = Array.from({ length: steps }, () => ({
        angle: rangeOf(tuning.look.angle) + profile.neutralHead * 0.5,
        look: (Math.random() < profile.lookBack ? -1 : 1) as 1 | -1,
        hold: rangeOf(tuning.look.hold),
      }));
      brain.dur = brain.lookSteps.reduce((sum, step) => sum + step.hold, 0) + 0.12;
      break;
    }
    case "peck": {
      const count = randomInt(profile.pecks);
      const times: number[] = [];
      let at = 0;
      for (let index = 0; index < count; index += 1) {
        times.push(at);
        at += tuning.peck.down + tuning.peck.contact + tuning.peck.up + rangeOf(tuning.peck.pause);
      }
      brain.peckTimes = times;
      brain.peckDepth = rangeOf(profile.peckDepth);
      brain.dur = at;
      break;
    }
    case "hop": {
      const distance = rangeOf(profile.hop);
      let direction = Math.random() < 0.5 ? -1 : 1;
      // Stay on the strip: turn back at the ends.
      const delta = (distance / surface.length) * direction;
      if (brain.s + delta < 0.04 || brain.s + delta > 0.96) direction = -direction;
      brain.hopFrom = brain.s;
      brain.hopTo = THREE.MathUtils.clamp(brain.s + (distance / surface.length) * direction, 0.03, 0.97);
      brain.hopTurned = false;
      brain.dur = tuning.hop.crouch + tuning.hop.flight + tuning.hop.land;
      break;
    }
    case "flick":
      brain.flickCount = Math.random() < 0.3 ? 2 : 1;
      brain.dur = (tuning.flick.up + tuning.flick.hold + tuning.flick.down + 0.08) * brain.flickCount;
      break;
    case "fluff":
      brain.dur = tuning.fluff.duration;
      break;
    case "stretch":
      brain.dur = tuning.stretch.duration;
      break;
  }
}

// One frame of a bird standing on its perch (a limb, or the ground): picks behaviours and writes the rig pose.
export function stepPerched(brain: Brain, dt: number, pose: RigPose, surface: Surface) {
  const profile = brain.profile;
  brain.clock += dt;
  resetPose(pose);
  brain.lift = 0;
  brain.headTarget = profile.neutralHead;
  brain.headLookTarget = 1;
  const breath = Math.sin(brain.clock * Math.PI * 2 * 1.7);
  pose.bodyScaleY = 1 + 0.012 * breath;
  let headOverride: number | null = null;

  if (brain.action === "rest") {
    brain.wait -= dt;
    if (brain.wait <= 0) startAction(brain, surface);
  } else {
    brain.t += dt;
    const t = brain.t;
    switch (brain.action) {
      case "look": {
        let clock = 0;
        for (const step of brain.lookSteps) {
          if (t < clock + step.hold) {
            brain.headTarget = step.angle;
            brain.headLookTarget = step.look;
            break;
          }
          clock += step.hold;
        }
        break;
      }
      case "peck": {
        const { down, contact, up } = tuning.peck;
        for (const start of brain.peckTimes) {
          const u = t - start;
          if (u < 0 || u > down + contact + up) continue;
          let amount = 1;
          if (u < down) amount = smoothStep(0, down, u);
          else if (u > down + contact) amount = 1 - smoothStep(down + contact, down + contact + up, u);
          headOverride = THREE.MathUtils.lerp(profile.neutralHead, brain.peckDepth, amount);
          pose.bodyPitch = -amount * 0.1;
          pose.tailAngle = amount * 0.16;
          pose.bodyScaleY -= amount * 0.02;
        }
        break;
      }
      case "hop": {
        const { crouch, flight, land } = tuning.hop;
        if (t < crouch) {
          const amount = smoothStep(0, crouch, t);
          pose.bodyScaleY = 1 - 0.1 * amount;
          pose.bodyScaleX = 1 + 0.04 * amount;
          pose.bodyPitch = -0.1 * amount;
        } else if (t < crouch + flight) {
          if (!brain.hopTurned) {
            brain.hopTurned = true;
            const heading = (Math.sign(brain.hopTo - brain.hopFrom) * surface.dirX || 1) as 1 | -1;
            if (heading !== brain.facing && Math.random() < 0.9) brain.facing = heading;
            else if (Math.random() < profile.hopTurn) brain.facing = (-brain.facing) as 1 | -1;
          }
          const v = (t - crouch) / flight;
          brain.s = THREE.MathUtils.lerp(brain.hopFrom, brain.hopTo, smoothStep(0, 1, v));
          brain.lift = profile.hopHeight * Math.sin(Math.PI * v);
          pose.bodyScaleY = 1 + 0.05 * Math.sin(Math.PI * v);
          pose.legs = 2;
          pose.wingMode = "flap";
          pose.wingFrame = 2 - 1.3 * Math.sin(Math.PI * v);
          pose.wingFrameFar = pose.wingFrame + 0.4;
          pose.bodyPitch = 0.12 * Math.sin(Math.PI * v);
        } else {
          brain.s = brain.hopTo;
          const amount = 1 - smoothStep(crouch + flight, crouch + flight + land, t);
          pose.bodyScaleY = 1 - 0.07 * amount;
          pose.bodyPitch = -0.05 * amount;
        }
        break;
      }
      case "flick": {
        const { up, hold, down, angle } = tuning.flick;
        const each = up + hold + down + 0.08;
        const u = t % each;
        const amount = u < up ? smoothStep(0, up, u) : u < up + hold ? 1 : 1 - smoothStep(up + hold, up + hold + down, u);
        pose.tailAngle = angle * amount;
        pose.bodyPitch = 0.03 * amount;
        break;
      }
      case "fluff": {
        const { duration, shiverHz, shiverAngle } = tuning.fluff;
        const rise = smoothStep(0, 0.2, t);
        const fall = 1 - smoothStep(duration * 0.68, duration, t);
        pose.fluff = rise * fall;
        pose.bodyScaleX = 1 + 0.04 * pose.fluff;
        const shiver = smoothStep(0.2, 0.28, t) * (1 - smoothStep(duration * 0.55, duration * 0.66, t));
        pose.shiver = Math.sin(t * Math.PI * 2 * shiverHz) * shiverAngle * shiver;
        pose.wingAngle = 0.05 * pose.fluff;
        break;
      }
      case "stretch": {
        const v = t / tuning.stretch.duration;
        const amount = Math.sin(Math.PI * Math.min(1, v));
        pose.wingMode = "flap";
        pose.wingFrame = 2 - 1.6 * amount;
        pose.wingFrameFar = pose.wingFrame + 0.3;
        pose.tailFan = amount > 0.55 ? 1 : 0;
        pose.bodyPitch = 0.1 * amount;
        break;
      }
    }
    if (brain.t >= brain.dur) {
      if (brain.action === "hop") brain.s = brain.hopTo;
      brain.action = "rest";
      brain.wait = random(profile.gap[0], profile.gap[1]);
    }
  }

  // The head eases toward whatever the behaviour wants, with quick saccades; pecks drive it directly.
  const ease = 1 - Math.exp(-tuning.look.saccade * dt);
  brain.headAngle += (brain.headTarget - brain.headAngle) * ease;
  brain.headLook += (brain.headLookTarget - brain.headLook) * ease;
  if (headOverride !== null) brain.headAngle = headOverride;
  pose.headAngle = brain.headAngle;
  pose.headLook = brain.headLook;
}

export type FlightPhase = "takeoff" | "cruise" | "landing";

// How a bird arrives: the bounding flight, a slow, hovering one, or a wings-spread swoop that zigzags down.
export type ApproachStyle = "direct" | "slow" | "swoop" | "glide";

export const approachStyles: Record<ApproachStyle, { speed: number; braking: number; endSpeed: number }> = {
  direct: { speed: 1, braking: 0.7, endSpeed: 0.35 },
  slow: { speed: 0.5, braking: 0.45, endSpeed: 0.25 },
  swoop: { speed: 0.72, braking: 0.6, endSpeed: 0.3 },
  // Wings out and still, sinking slowly down a long, shallow slope.
  glide: { speed: 0.46, braking: 0.55, endSpeed: 0.25 },
};

// One frame of a bird in the air. Returns a vertical offset for the bounding flight path (climb while flapping,
// sink while gliding).
export function stepFlight(
  brain: Brain,
  dt: number,
  pose: RigPose,
  info: { phase: FlightPhase; progress: number; elapsed: number; vx: number; vy: number; style?: ApproachStyle },
) {
  const profile = brain.profile;
  resetPose(pose);
  const { phase, progress, elapsed } = info;
  const style = info.style ?? "direct";

  let rate = profile.cruiseRate;
  if (phase === "takeoff") rate = tuning.takeoff.flapRate;
  if (phase === "landing") rate = THREE.MathUtils.lerp(profile.cruiseRate * 0.85, tuning.landing.flapRate, smoothStep(0.1, 0.9, progress));

  if (phase === "cruise" && style === "slow") {
    // Slow flight: steady, fairly deep wingbeats with no glides, body tilted up.
    brain.gliding = false;
    rate = profile.cruiseRate * 0.62;
    brain.flapPhase += dt * rate;
  } else if (phase === "cruise" && style === "glide") {
    // Gliding: no wingbeats at all, only a faint flutter of the open wings.
    brain.gliding = false;
    brain.flapPhase += dt * 0.7;
  } else if (phase === "cruise" && style === "swoop") {
    // Swooping: wings held out, rocking gently instead of beating.
    brain.gliding = false;
    brain.flapPhase += dt * 2.4;
  } else if (phase === "cruise") {
    if (!brain.gliding) {
      brain.flapPhase += dt * rate;
      if (brain.flapPhase >= brain.flapTarget) {
        brain.gliding = true;
        brain.glideLeft = rangeOf(profile.glide);
      }
    } else {
      brain.glideLeft -= dt;
      if (brain.glideLeft <= 0) {
        brain.gliding = false;
        brain.flapPhase = 0;
        brain.flapTarget = randomInt(profile.burst);
      }
    }
  } else {
    brain.gliding = false;
    brain.flapPhase += dt * rate;
  }

  const cycle = brain.flapPhase % 1;
  const beat = (offset: number) => 2 - 2 * Math.cos(Math.PI * 2 * (cycle - offset));
  const rock = (offset: number) => 2.3 + 0.8 * Math.sin(Math.PI * 2 * (cycle - offset));
  if (style === "glide" && phase === "cruise") {
    pose.wingMode = "flap";
    pose.wingFrame = 2.1 + 0.18 * Math.sin(Math.PI * 2 * cycle);
    pose.wingFrameFar = 2.1 + 0.18 * Math.sin(Math.PI * 2 * (cycle - 0.1));
    pose.tailFan = 1;
  } else if ((style === "swoop" || style === "glide") && phase !== "takeoff") {
    pose.wingMode = "flap";
    pose.wingFrame = phase === "landing" ? beat(0) * 0.6 + rock(0) * 0.4 : rock(0);
    pose.wingFrameFar = phase === "landing" ? pose.wingFrame : rock(0.08);
    pose.tailFan = 1;
  } else if (brain.gliding) {
    pose.wingMode = "tucked";
  } else {
    pose.wingMode = "flap";
    pose.wingFrame = beat(0);
    pose.wingFrameFar = beat(0.06);
  }

  const forward = Math.max(0.2, Math.abs(info.vx));
  pose.bodyPitch = Math.atan2(info.vy, forward) * 0.6 + 0.05 * Math.sin(Math.PI * 2 * cycle);
  if (style === "slow") pose.bodyPitch += 0.26;
  if (style === "glide" && phase === "cruise") pose.bodyPitch = pose.bodyPitch * 0.5 + 0.06;
  // Banking into each turn of the swoop.
  if (style === "swoop" && phase === "cruise") pose.bodyPitch += 0.12 * Math.sin(Math.PI * cycle);
  if (style === "slow" && phase === "cruise") pose.tailFan = 1;
  pose.headAngle = -0.04;
  pose.legs = 0;

  if (phase === "takeoff" && elapsed < tuning.takeoff.legsOut) pose.legs = 2;
  if (phase === "landing") {
    const flare = smoothStep(tuning.landing.startAt, 0.96, progress);
    pose.bodyPitch += tuning.landing.pitch * flare;
    pose.tailFan = flare > 0.35 ? 1 : 0;
    pose.tailAngle = -0.3 * flare;
    pose.legs = flare > 0.2 ? 2 : 0;
    pose.wingAngle = 0.08 * flare;
  }

  // Bounding flight: rise during the burst, sink during the glide.
  const { amplitude, rate: undulationRate } = tuning.undulation;
  const bounding = phase === "cruise" && style === "direct";
  const target = bounding ? (brain.gliding ? -amplitude : amplitude) : 0;
  brain.undulation += (target - brain.undulation) * Math.min(1, dt * undulationRate * 8);
  return brain.undulation;
}
