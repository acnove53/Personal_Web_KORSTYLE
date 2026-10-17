"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, ScrollControls, useScroll } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type StageName = "branches" | "trunk" | "roots";

export type PortfolioNode = {
  id: string;
  number: string;
  title: string;
  category: string;
  description: string;
  stack: string[];
  highlights?: string[];
  stage: "branches" | "roots";
  position: [number, number, number];
};

type BrushStroke = {
  position: THREE.Vector3;
  width: number;
  height: number;
  rotation: number;
};

type IntroTimeline = {
  elapsed: number;
  progress: number;
  fogDensity: number;
  complete: boolean;
};

const portfolioNodes: PortfolioNode[] = [
  {
    id: "timeslips",
    number: "01",
    title: "TimeSlips AI-Integrated Mobile App",
    category: "CURRENT PROJECT · AI / CARE",
    description: "An AI coaching platform that helps care facilitators build more meaningful moments with people living with dementia. Designed around a calm mobile workflow, with serverless services supporting timely, context-aware guidance.",
    stack: ["React Native", "AWS Serverless", "AWS Bedrock"],
    highlights: ["Context-aware coaching for care facilitators", "Scalable cloud-native architecture"],
    stage: "branches",
    position: [-0.85, 6.65, 0.35],
  },
  {
    id: "travel-health",
    number: "02",
    title: "AI-Powered Travel Health Coach",
    category: "PERSONAL PROJECT · AI / HEALTH",
    description: "A context-aware recommendation agent that helps travelers make dietary and health choices with local context in mind. Prompt design connects itinerary, food, and personal needs into a practical coaching experience.",
    stack: ["Python", "LLMs", "Prompt Design"],
    stage: "branches",
    position: [1.15, 6.1, 0.55],
  },
  {
    id: "neural-vision",
    number: "03",
    title: "Neural Networks & Vision Pipelines",
    category: "RESEARCH · MACHINE LEARNING",
    description: "From manually implementing backpropagation for a three-layer neural network in JAX to fine-tuning VGG19 on the PACE H100 cluster, these experiments explore how learning systems behave from the inside out.",
    stack: ["JAX", "VGG19", "PACE H100"],
    highlights: ["Classified 75 butterfly species", "Built backpropagation from scratch"],
    stage: "branches",
    position: [-1.35, 5.25, 0.45],
  },
  {
    id: "bytefight",
    number: "04",
    title: "ByteFight 2026 Autonomous Agent",
    category: "COMPETITION · AUTONOMOUS SYSTEMS",
    description: "A Python strategy agent that reasons about a changing game state and makes decisions under strict compute-time limits. Custom pathfinding heuristics help balance search depth with fast, reliable moves.",
    stack: ["Python", "Pathfinding", "Heuristics"],
    stage: "branches",
    position: [1.25, 4.75, 0.35],
  },
  {
    id: "jobjoe",
    number: "05",
    title: "JobJoe",
    category: "TEAM PROJECT · WEB PLATFORM",
    description: "A Django platform for organizing the job search, backed by a carefully structured SQLite database. As Scrum Master, I coordinated the team through two-week sprints and kept delivery focused.",
    stack: ["Django", "SQLite", "Scrum"],
    highlights: ["Optimized relational data model", "Facilitated two-week sprint cycles"],
    stage: "branches",
    position: [0.05, 7.25, -0.2],
  },
  {
    id: "northbound",
    number: "01",
    title: "NorthBound College",
    category: "FULL-STACK ENGINEER · CURRENT",
    description: "Engineered an AI-powered college admissions platform. I built typed data boundaries around model and API interactions so fast-moving product work could stay predictable and maintainable.",
    stack: ["Express", "PostgreSQL", "Gemini API", "Zod"],
    highlights: ["Enforced structured pipelines with Zod", "Documented APIs with OpenAPI 3.1"],
    stage: "roots",
    position: [-1.45, 0.9, 0.6],
  },
  {
    id: "katusa",
    number: "02",
    title: "19th ESC · U.S. Forces Korea",
    category: "KATUSA · SERGEANT",
    description: "Served as consecutive and simultaneous interpreter for the Command Sergeant Major. I bridged cultural gaps, supported leadership communications, and helped keep information moving across a force of more than 500 personnel.",
    stack: ["Interpretation", "Leadership", "Communication"],
    highlights: ["Supported communications for 500+ personnel", "Bridged Korean and U.S. military cultures"],
    stage: "roots",
    position: [1.25, 0.45, 0.45],
  },
  {
    id: "georgia-tech",
    number: "03",
    title: "Georgia Institute of Technology",
    category: "B.S. COMPUTER SCIENCE · 2025",
    description: "Studied Computer Science with concentrations in Intelligence and Devices. Faculty Honors and a 3.92 GPA reflect a sustained interest in the boundary where software meets physical systems.",
    stack: ["Intelligence", "Devices", "Hardware / Software"],
    highlights: ["Faculty Honors · 3.92 / 4.00 GPA", "Focus on hardware-software co-design"],
    stage: "roots",
    position: [0.05, -0.55, 0.15],
  },
];

type PineSceneProps = {
  onStageChange: (stage: StageName) => void;
  onSelectNode: (node: PortfolioNode | null) => void;
  selectedNode: PortfolioNode | null;
  onConnectScroll: (scrollToStage: (stage: StageName) => void) => void;
  onIntroComplete: () => void;
};

export function PineScene({ onStageChange, onSelectNode, selectedNode, onConnectScroll, onIntroComplete }: PineSceneProps) {
  const handleStage = useCallback(onStageChange, [onStageChange]);
  const handleScrollConnect = useCallback(onConnectScroll, [onConnectScroll]);
  const intro = useMemo<IntroTimeline>(() => ({ elapsed: 0, progress: 0, fogDensity: 0.24, complete: false }), []);

  return (
    <Canvas
      camera={{ position: [0.85, 1.4, 14.2], fov: 38, near: 0.1, far: 80 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      performance={{ min: 0.6 }}
      fallback={<div className="canvas-fallback">This portfolio needs WebGL to reveal the full scene.</div>}
    >
      <color attach="background" args={["#f9f8f6"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-6, 9, 8]} intensity={1.4} color="#fffaf2" />
      <directionalLight position={[6, 3, -5]} intensity={0.45} color="#9d9a96" />
      <IntroSequence intro={intro} />
      <EffectComposer multisampling={0} resolutionScale={0.75}>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.25}
          mipmapBlur
          resolutionScale={0.6}
        />
      </EffectComposer>
      <ScrollControls pages={3} damping={0.16} maxSpeed={0.9} distance={1}>
        <CameraController
          intro={intro}
          onIntroComplete={onIntroComplete}
          onStageChange={handleStage}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
          onConnectScroll={handleScrollConnect}
        />
        <PineTree intro={intro} selectedNode={selectedNode} onSelectNode={onSelectNode} />
      </ScrollControls>
    </Canvas>
  );
}

function IntroSequence({ intro }: { intro: IntroTimeline }) {
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2("#f9f8f6", 0.24), []);

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = fog;
    return () => {
      if (scene.fog === fog) scene.fog = previousFog;
    };
  }, [fog, scene]);

  useFrame((_, delta) => {
    intro.elapsed += Math.min(delta, 0.05);
    const fogClear = smoothStep(0, 1.25, intro.elapsed);
    fog.density = THREE.MathUtils.lerp(0.24, 0.008, fogClear);
    intro.fogDensity = fog.density;

    const drawProgress = smoothStep(0.82, 3.42, intro.elapsed);
    intro.progress = drawProgress;
    intro.complete = drawProgress >= 1;
  });

  return null;
}

function CameraController({
  intro,
  onIntroComplete,
  onStageChange,
  selectedNode,
  onSelectNode,
  onConnectScroll,
}: {
  intro: IntroTimeline;
  onIntroComplete: () => void;
  onStageChange: (stage: StageName) => void;
  selectedNode: PortfolioNode | null;
  onSelectNode: (node: PortfolioNode | null) => void;
  onConnectScroll: (scrollToStage: (stage: StageName) => void) => void;
}) {
  const scroll = useScroll();
  const lastStage = useRef<StageName>("trunk");
  const introCompleteNotified = useRef(false);
  const zoom = useRef(0);
  const introZoom = useRef(0);
  const rawScrollOffset = useRef(0.5);
  const focusNode = useRef<PortfolioNode | null>(null);
  const dismissedNode = useRef<string | null>(null);
  const baseCamera = useMemo(() => new THREE.Vector3(), []);
  const baseTarget = useMemo(() => new THREE.Vector3(), []);
  const focusedCamera = useMemo(() => new THREE.Vector3(), []);
  const focusedTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const element = scroll.el;
    const syncScrollInput = () => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll > 0) {
        rawScrollOffset.current = THREE.MathUtils.clamp(element.scrollTop / maxScroll, 0, 1);
      }
    };
    const centerAtTrunk = () => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll > 0) element.scrollTop = maxScroll * 0.5;
      syncScrollInput();
    };
    element.addEventListener("scroll", syncScrollInput, { passive: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(centerAtTrunk));
    onConnectScroll((stage) => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      const target = stage === "branches" ? 0.04 : stage === "trunk" ? 0.5 : 0.96;
      if (maxScroll > 0) element.scrollTo({ top: maxScroll * target, behavior: "smooth" });
    });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", syncScrollInput);
    };
  }, [onConnectScroll, scroll.el]);

  useFrame(({ camera }, delta) => {
    // Keep Drei's offset synchronized with its actual scroll element so both
    // wheel input and menu-driven scrollTo calls feed this camera controller.
    scroll.offset = rawScrollOffset.current;
    const offset = scroll.offset;
    const stage: StageName = offset < 0.37 ? "branches" : offset > 0.63 ? "roots" : "trunk";
    if (intro.complete && stage !== lastStage.current) {
      lastStage.current = stage;
      onStageChange(stage);
    }
    if (selectedNode) focusNode.current = selectedNode;
    if (!selectedNode) dismissedNode.current = null;
    if (selectedNode && dismissedNode.current !== selectedNode.id && Math.abs(offset - (selectedNode.stage === "branches" ? 0.04 : 0.96)) > 0.18) {
      dismissedNode.current = selectedNode.id;
      onSelectNode(null);
    }

    const targetZoom = selectedNode ? 1 : 0;
    zoom.current = THREE.MathUtils.damp(zoom.current, targetZoom, selectedNode ? 2.5 : 3.4, delta);

    // The center page is the trunk; offset 0 is the canopy and 1 is the roots.
    // Camera Y is assigned directly from ScrollControls every frame.
    const cameraY = THREE.MathUtils.lerp(4.5, -2.4, offset);
    const centered = Math.abs(offset - 0.5) < 0.16;
    const introZoomTarget = intro.complete && centered ? 1 : 0;
    introZoom.current = THREE.MathUtils.damp(introZoom.current, introZoomTarget, 1.8, delta);
    const trunkProximity = 1 - smoothStep(0.015, 0.18, Math.abs(offset - 0.5));
    const trunkZoom = introZoom.current * trunkProximity;
    if (!introCompleteNotified.current && trunkZoom > 0.985) {
      introCompleteNotified.current = true;
      onIntroComplete();
    }

    const cameraX = THREE.MathUtils.lerp(0.85, 1.48, trunkZoom);
    const cameraZ = THREE.MathUtils.lerp(14.2, 1.85, trunkZoom);
    baseCamera.set(cameraX, cameraY, cameraZ);
    baseTarget.set(cameraX, THREE.MathUtils.lerp(cameraY, 1.45, trunkZoom), 0);
    cameraPosition.copy(baseCamera);
    lookTarget.copy(baseTarget);

    if (focusNode.current) {
      const focus = focusNode.current;
      const nodeX = 1.45 + focus.position[0];
      const nodeY = -2.8 + focus.position[1];
      const nodeZ = focus.position[2];
      focusedCamera.set(nodeX, cameraY, 6.5);
      focusedTarget.set(nodeX, nodeY, nodeZ);
      cameraPosition.lerpVectors(baseCamera, focusedCamera, zoom.current);
      lookTarget.lerpVectors(baseTarget, focusedTarget, zoom.current);
      if (!selectedNode && zoom.current < 0.012) focusNode.current = null;
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraPosition.x, 5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraPosition.y, 5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraPosition.z, 5, delta);
    camera.lookAt(lookTarget);
  });

  return null;
}

type RadiusStop = readonly [number, number];

const trunkRadius: RadiusStop[] = [
  [0, 1.12], [0.12, 1.04], [0.3, 0.86], [0.53, 0.67], [0.72, 0.48], [0.9, 0.25], [1, 0.025],
];
const branchRadius: RadiusStop[] = [[0, 1.15], [0.18, 1], [0.48, 0.72], [0.76, 0.4], [0.94, 0.16], [1, 0.035]];
const twigRadius: RadiusStop[] = [[0, 1.05], [0.24, 0.86], [0.62, 0.55], [0.9, 0.22], [1, 0.04]];
const rootRadius: RadiusStop[] = [[0, 2.25], [0.13, 1.8], [0.4, 1.22], [0.72, 0.58], [0.94, 0.18], [1, 0.025]];

const trunkAnchors = [
  new THREE.Vector3(0.06, 0, 0.02),
  new THREE.Vector3(-0.24, 0.62, 0.16),
  new THREE.Vector3(-0.72, 1.3, -0.16),
  new THREE.Vector3(-1.02, 2.02, -0.3),
  new THREE.Vector3(-0.72, 2.72, -0.12),
  new THREE.Vector3(-0.12, 3.2, 0.22),
  new THREE.Vector3(0.54, 3.76, 0.32),
  new THREE.Vector3(0.52, 4.34, 0.04),
  new THREE.Vector3(-0.18, 4.91, -0.28),
  new THREE.Vector3(-0.68, 5.55, -0.36),
  new THREE.Vector3(-0.1, 6.13, -0.08),
  new THREE.Vector3(0.6, 6.7, 0.32),
  new THREE.Vector3(0.48, 7.36, 0.22),
  new THREE.Vector3(-0.12, 8.02, -0.12),
  new THREE.Vector3(-0.42, 8.78, -0.2),
];

const canopyLimbs = [
  { y: 7.96, side: -1, reach: 2.75, lift: 0.48, bow: 0.12, seed: 1 },
  { y: 7.56, side: 1, reach: 2.7, lift: 0.17, bow: -0.34, seed: 2 },
  { y: 7.02, side: -1, reach: 3.45, lift: 0.42, bow: -0.3, seed: 3 },
  { y: 6.62, side: 1, reach: 3.3, lift: 0.2, bow: -0.42, seed: 4 },
  { y: 5.98, side: -1, reach: 4.08, lift: 0.08, bow: -0.42, seed: 5 },
  { y: 5.58, side: 1, reach: 3.72, lift: 0.26, bow: -0.3, seed: 6 },
  { y: 4.96, side: -1, reach: 2.8, lift: 0.25, bow: -0.08, seed: 7 },
  { y: 5.18, side: 1, reach: 2.45, lift: 0.34, bow: -0.18, seed: 8 },
];

function sampleRadius(t: number, stops: readonly RadiusStop[]) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [fromT, fromRadius] = stops[i];
    const [toT, toRadius] = stops[i + 1];
    if (t <= toT) {
      const linear = THREE.MathUtils.clamp((t - fromT) / (toT - fromT), 0, 1);
      const eased = linear * linear * (3 - 2 * linear);
      return THREE.MathUtils.lerp(fromRadius, toRadius, eased);
    }
  }
  return stops[stops.length - 1][1];
}

function curveThrough(points: THREE.Vector3[]) {
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
}

function makeOrganicTube(
  curve: THREE.CatmullRomCurve3,
  baseRadius: number,
  stops: readonly RadiusStop[],
  radialSegments: number,
  tubularSegments: number,
  seed: number,
  wash: number,
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const washes: number[] = [];
  const roughness: number[] = [];
  const indices: number[] = [];
  const ringSize = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const pathWobble = Math.sin(t * 19 + seed * 1.7) * Math.sin(t * 7.4 + seed * 0.61);
    center.x += pathWobble * baseRadius * 0.15;
    center.z += Math.cos(t * 16 + seed * 0.9) * Math.sin(t * 5.2 + seed) * baseRadius * 0.13;
    const radius = baseRadius * sampleRadius(t, stops);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;
      const roughBark = Math.sin(angle * 5 + t * 18 + seed * 0.6) * Math.sin(t * 13 + seed);
      const irregularity = 1
        + 0.09 * Math.sin(angle * 3 + seed) * Math.sin(t * 9 + seed * 0.7)
        + 0.052 * Math.sin(angle * 7 + t * 28 + seed * 1.4)
        + 0.038 * Math.sin(angle * 2 + t * 17 + seed * 0.42)
        + roughBark * 0.055;
      const radialX = Math.cos(angle) * radius * irregularity;
      const radialY = Math.sin(angle) * radius * irregularity;
      positions.push(
        center.x + normal.x * radialX + binormal.x * radialY,
        center.y + normal.y * radialX + binormal.y * radialY,
        center.z + normal.z * radialX + binormal.z * radialY,
      );
      uvs.push(u, t);
      washes.push(wash + 0.07 * Math.sin(t * 14 + seed) + 0.035 * Math.cos(angle * 4 + seed));
      roughness.push(baseRadius);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = ringSize * i + j;
      const b = ringSize * (i + 1) + j;
      const c = ringSize * (i + 1) + j + 1;
      const d = ringSize * i + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aWash", new THREE.Float32BufferAttribute(washes, 1));
  geometry.setAttribute("aRoughness", new THREE.Float32BufferAttribute(roughness, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergeTubeGeometries(parts: THREE.BufferGeometry[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const washes: number[] = [];
  const roughness: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const part of parts) {
    const position = part.getAttribute("position");
    const normal = part.getAttribute("normal");
    const uv = part.getAttribute("uv");
    const wash = part.getAttribute("aWash");
    const rough = part.getAttribute("aRoughness");
    const index = part.getIndex();
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
      washes.push(wash.getX(i));
      roughness.push(rough.getX(i));
    }
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
    }
    vertexOffset += position.count;
    part.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute("aWash", new THREE.Float32BufferAttribute(washes, 1));
  merged.setAttribute("aRoughness", new THREE.Float32BufferAttribute(roughness, 1));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

const trunkSpline = curveThrough(trunkAnchors);

function trunkCenterAt(y: number) {
  let previous = trunkSpline.getPointAt(0);
  const samples = 112;
  for (let i = 1; i <= samples; i++) {
    const next = trunkSpline.getPointAt(i / samples);
    if (next.y >= y) {
      const blend = THREE.MathUtils.clamp((y - previous.y) / Math.max(0.0001, next.y - previous.y), 0, 1);
      return previous.clone().lerp(next, blend);
    }
    previous = next;
  }
  return trunkSpline.getPointAt(1);
}

function seedUnit(seed: number, index: number) {
  const value = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function weatheredCurve(points: THREE.Vector3[], seed: number, amplitude: number) {
  const last = points.length - 1;
  const weathered = points.map((point, index) => {
    if (index === 0 || index === last) return point.clone();
    const amount = amplitude * (0.55 + seedUnit(seed, index * 7 + 2) * 0.9);
    return point.clone().add(new THREE.Vector3(
      (seedUnit(seed, index * 11 + 1) * 2 - 1) * amount,
      (seedUnit(seed, index * 13 + 3) * 2 - 1) * amount * 0.72,
      (seedUnit(seed, index * 17 + 5) * 2 - 1) * amount,
    ));
  });
  return curveThrough(weathered);
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function createBrushAlphaTexture() {
  const width = 128;
  const height = 256;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const taper = Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.66);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const grain = seedUnit(x * 0.37 + 1.2, y * 0.23 + 4.8);
      const drift = 0.035 * Math.sin(v * 18) + 0.018 * Math.sin(v * 47 + grain * 4);
      const halfWidth = taper * (0.24 + 0.035 * Math.sin(v * 23 + 0.7));
      const edgeDistance = Math.abs(u - (0.5 + drift));
      let alpha = 1 - smoothStep(halfWidth - 0.015, halfWidth + 0.025, edgeDistance);
      const bristle = Math.sin(u * 104 + v * 5 + grain * 3) * 0.5 + 0.5;
      const dryGap = smoothStep(0.91, 0.99, bristle) * smoothStep(0.08, 0.24, taper);
      alpha *= (0.56 + grain * 0.44) * (1 - dryGap * 0.76);
      const index = (y * width + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(THREE.MathUtils.clamp(alpha, 0, 1) * 255);
    }
  }

  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addBrushCluster(target: BrushStroke[], center: THREE.Vector3, span: number, seed: number, density: number) {
  const lobes = [
    new THREE.Vector3(-0.31, 0.02, 0.08),
    new THREE.Vector3(0.2, 0.12, -0.13),
    new THREE.Vector3(0.03, -0.08, 0.25),
    new THREE.Vector3(0.38, -0.04, 0.15),
    new THREE.Vector3(-0.12, 0.16, -0.22),
  ];
  for (let i = 0; i < density; i++) {
    const lobeIndex = Math.floor(seedUnit(seed, i * 3 + 6) * lobes.length);
    const lobe = lobes[lobeIndex];
    const angle = seedUnit(seed, i * 5 + 2) * Math.PI * 2 + seed * 0.29;
    const ring = (seedUnit(seed, i * 7 + 4) + seedUnit(seed, i * 9 + 1) + seedUnit(seed, i * 11 + 3)) / 3;
    const heightNoise = seedUnit(seed, i * 13 + 8);
    const height = span * (0.48 + heightNoise * 0.76);
    const width = height * (0.085 + seedUnit(seed, i * 17 + 5) * 0.15);
    const spread = span * (0.19 + ring * 0.36);
    const position = center.clone()
      .addScaledVector(lobe, span * (0.45 + seedUnit(seed, i * 19 + 2) * 0.45))
      .add(new THREE.Vector3(
        Math.cos(angle) * spread * 0.52,
        Math.sin(angle) * spread * 0.19 + height * (0.06 + heightNoise * 0.16),
        Math.sin(angle) * spread * 0.46 + (seedUnit(seed, i * 23 + 4) - 0.5) * span * 0.34,
      ));
    target.push({
      position,
      width,
      height,
      rotation: angle + Math.PI * 0.5 + (seedUnit(seed, i * 29 + 7) - 0.5) * 0.95,
    });
  }
}

function makeBarkRidges() {
  const segments = 144;
  const frames = trunkSpline.computeFrenetFrames(segments, false);
  const strokes = [
    { start: 0.06, end: 0.3, angle: -0.95, seed: 1, width: 0.019 },
    { start: 0.12, end: 0.42, angle: -0.42, seed: 2, width: 0.026 },
    { start: 0.04, end: 0.25, angle: 0.28, seed: 3, width: 0.014 },
    { start: 0.21, end: 0.49, angle: -1.05, seed: 4, width: 0.022 },
    { start: 0.29, end: 0.58, angle: -0.48, seed: 5, width: 0.017 },
    { start: 0.35, end: 0.61, angle: 0.16, seed: 6, width: 0.024 },
    { start: 0.47, end: 0.72, angle: -0.88, seed: 7, width: 0.016 },
    { start: 0.53, end: 0.78, angle: -0.35, seed: 8, width: 0.025 },
    { start: 0.62, end: 0.84, angle: 0.34, seed: 9, width: 0.016 },
    { start: 0.73, end: 0.96, angle: -0.72, seed: 10, width: 0.018 },
    { start: 0.81, end: 0.99, angle: -0.2, seed: 11, width: 0.013 },
  ];
  const ridges: THREE.BufferGeometry[] = [];

  for (const stroke of strokes) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 7; i++) {
      const along = i / 7;
      const t = THREE.MathUtils.lerp(stroke.start, stroke.end, along);
      const frameIndex = Math.min(segments, Math.round(t * segments));
      const normal = frames.normals[frameIndex];
      const binormal = frames.binormals[frameIndex];
      const frontFacingAngle = Math.atan2(binormal.z, normal.z);
      const angle = frontFacingAngle + stroke.angle + Math.sin(along * 8 + stroke.seed) * 0.12;
      const radial = normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle)).normalize();
      const surfaceRadius = 0.72 * sampleRadius(t, trunkRadius);
      points.push(trunkSpline.getPointAt(t).addScaledVector(radial, surfaceRadius * 1.075 + 0.012));
    }
    const curve = curveThrough(points);
    ridges.push(makeOrganicTube(
      curve,
      stroke.width,
      [[0, 0.08], [0.18, 0.75], [0.55, 1], [0.84, 0.62], [1, 0.04]],
      6,
      30,
      stroke.seed * 1.73,
      0.28 + (stroke.seed % 3) * 0.07,
    ));
  }
  return ridges;
}

function buildPineGeometry() {
  const structureParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];
  const foliageStrokes: BrushStroke[] = [];
  structureParts.push(makeOrganicTube(trunkSpline, 0.72, trunkRadius, 26, 176, 0.8, 0.12));
  structureParts.push(...makeBarkRidges());

  // Nebari roots flare from the trunk and travel visibly across the ground plane.
  const rootArms = [
    { angle: -3.1, reach: 3.8, lift: -0.31, seed: 1 },
    { angle: -2.4, reach: 2.65, lift: -0.19, seed: 2 },
    { angle: -1.25, reach: 3.25, lift: -0.36, seed: 3 },
    { angle: -0.15, reach: 2.52, lift: -0.2, seed: 4 },
    { angle: 0.35, reach: 3.55, lift: -0.3, seed: 5 },
    { angle: 0.95, reach: 2.28, lift: -0.16, seed: 6 },
    { angle: 1.75, reach: 3.12, lift: -0.34, seed: 7 },
    { angle: 2.75, reach: 2.72, lift: -0.23, seed: 8 },
  ];
  for (const root of rootArms) {
    const direction = new THREE.Vector3(Math.cos(root.angle), 0, Math.sin(root.angle)).normalize();
    const start = trunkCenterAt(0.16);
    const rootCurve = weatheredCurve([
      start.clone(),
      start.clone().addScaledVector(direction, root.reach * 0.18).add(new THREE.Vector3(0, 0.1, 0)),
      start.clone().addScaledVector(direction, root.reach * 0.46).add(new THREE.Vector3(-direction.z * 0.12, 0.025, direction.x * 0.12)),
      start.clone().addScaledVector(direction, root.reach * 0.74).add(new THREE.Vector3(direction.z * 0.13, root.lift * 0.42, -direction.x * 0.13)),
      start.clone().addScaledVector(direction, root.reach).add(new THREE.Vector3(0, root.lift, 0)),
    ], root.seed * 3.7, 0.13);
    structureParts.push(makeOrganicTube(rootCurve, 0.29, rootRadius, 16, 68, root.seed, 0.25));

    for (const t of [0.42, 0.68, 0.86]) {
      const joint = rootCurve.getPointAt(t);
      const forkSide = t > 0.6 ? -1 : 1;
      const forkDirection = new THREE.Vector3(-direction.z * forkSide, 0, direction.x * forkSide);
      const fork = weatheredCurve([
        joint,
        joint.clone().addScaledVector(forkDirection, 0.2).add(new THREE.Vector3(0, -0.035, 0)),
        joint.clone().addScaledVector(forkDirection, 0.46).add(new THREE.Vector3(0, -0.1, 0)),
        joint.clone().addScaledVector(forkDirection, 0.66).add(new THREE.Vector3(0, -0.17, 0)),
      ], root.seed + t * 9, 0.075);
      structureParts.push(makeOrganicTube(fork, 0.075, twigRadius, 9, 26, root.seed + t, 0.34));
    }
  }

  // Each hand-shaped bough reaches sideways and lifts into a distinct pine pad.
  canopyLimbs.forEach((limb) => {
    const direction = new THREE.Vector3(limb.side, 0, 0);
    const trunkPoint = trunkCenterAt(limb.y);
    const depth = (seedUnit(limb.seed, 1) - 0.5) * 2.4;
    const sway = (seedUnit(limb.seed, 2) - 0.5) * 0.36;
    const primaryCurve = weatheredCurve([
      trunkPoint,
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.2).add(new THREE.Vector3(sway, 0.38 + limb.lift * 0.2, depth * 0.38)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.48).add(new THREE.Vector3(-sway * 0.4, limb.lift + limb.bow, depth * 0.82)),
      trunkPoint.clone().addScaledVector(direction, limb.reach * 0.76).add(new THREE.Vector3(sway * 0.7, limb.lift + limb.bow * 0.55, depth)),
      trunkPoint.clone().addScaledVector(direction, limb.reach).add(new THREE.Vector3(-sway, limb.lift, depth * 0.7)),
    ], limb.seed * 4.1, 0.16);
    const tier = Math.max(0, (8.1 - limb.y) * 0.012);
    canopyParts.push(makeOrganicTube(primaryCurve, 0.16 - tier, branchRadius, 12, 56, limb.seed, 0.22 + tier));

    const twigLocations = limb.seed % 2 === 0 ? [0.29, 0.53, 0.83] : [0.38, 0.56, 0.72, 0.91];
    for (const [twigIndex, t] of twigLocations.entries()) {
      const base = primaryCurve.getPointAt(t);
      const twigSide = twigIndex % 2 === 0 ? -limb.side : limb.side;
      const twigReach = limb.reach * (0.15 - t * 0.035);
      const twigCurve = weatheredCurve([
        base,
        base.clone().add(new THREE.Vector3(limb.side * twigReach * 0.24, 0.2, twigSide * 0.1)),
        base.clone().add(new THREE.Vector3(limb.side * twigReach * 0.63, 0.38 + limb.lift * 0.16, depth * 0.45 + twigSide * 0.16)),
        base.clone().add(new THREE.Vector3(limb.side * twigReach, 0.32 + limb.lift * 0.2, depth * 0.62 + twigSide * 0.2)),
      ], limb.seed * 7 + twigIndex, 0.085);
      canopyParts.push(makeOrganicTube(twigCurve, 0.046, twigRadius, 8, 24, limb.seed + twigIndex, 0.34));
      addBrushCluster(foliageStrokes, twigCurve.getPointAt(1), 0.42 + (twigIndex % 2) * 0.08, limb.seed * 7 + twigIndex, 22);

      const forkBase = twigCurve.getPointAt(0.58);
      const forkCurve = weatheredCurve([
        forkBase,
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.08, 0.16, twigSide * 0.03)),
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.22, 0.29, twigSide * 0.11)),
        forkBase.clone().add(new THREE.Vector3(limb.side * 0.31, 0.34, twigSide * 0.16)),
      ], limb.seed * 13 + twigIndex, 0.07);
      canopyParts.push(makeOrganicTube(forkCurve, 0.024, twigRadius, 7, 16, limb.seed + twigIndex * 2, 0.4));
      if (twigIndex % 2 === 0) addBrushCluster(foliageStrokes, forkCurve.getPointAt(1), 0.29, limb.seed * 11 + twigIndex, 14);
    }

    for (const [padIndex, t] of [0.4, 0.68, 0.96].entries()) {
      const padSize = padIndex === 2 ? 0.64 : 0.43;
      addBrushCluster(foliageStrokes, primaryCurve.getPointAt(t), padSize, limb.seed * 17 + padIndex, padIndex === 2 ? 44 : 28);
    }
  });

  return {
    structure: mergeTubeGeometries(structureParts),
    canopy: mergeTubeGeometries(canopyParts),
    foliage: foliageStrokes,
  };
}

function createSumiToonMaterial(wash: number, noiseStrength: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInkDeep: { value: new THREE.Color("#080807") },
      uInkMid: { value: new THREE.Color("#11110f") },
      uInkLight: { value: new THREE.Color("#1a1a1a") },
      uPaper: { value: new THREE.Color("#f9f8f6") },
      uFogDensity: { value: 0.24 },
      uProgress: { value: 0 },
      uWash: { value: wash },
      uNoiseStrength: { value: noiseStrength },
    },
    vertexShader: `
      attribute float aWash;
      attribute float aRoughness;
      uniform float uNoiseStrength;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying float vViewDepth;
      varying float vWash;
      varying float vLocalY;

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

      void main() {
        float broadNoise = noise3d(position * vec3(3.8, 1.65, 3.8) + vec3(2.3, 7.1, 4.6));
        float barkNoise = noise3d(position * vec3(17.0, 5.3, 17.0) + vec3(13.4, 2.8, 9.1));
        float ridgeNoise = 1.0 - abs(noise3d(position * vec3(7.0, 2.3, 7.0) + vec3(4.2, 8.7, 1.6)) * 2.0 - 1.0);
        float displacement = ((broadNoise - 0.5) * 1.45 + (barkNoise - 0.5) * 0.55 + (ridgeNoise - 0.48) * 0.48) * aRoughness * uNoiseStrength;
        vec3 gnarledPosition = position + normalize(normal) * displacement;
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

function createBrushStrokeMaterial(brushTexture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBrush: { value: brushTexture },
      uInk: { value: new THREE.Color("#0c0c0b") },
      uPaper: { value: new THREE.Color("#f9f8f6") },
      uFogDensity: { value: 0.24 },
      uProgress: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying float vViewDepth;
      varying float vLocalY;

      void main() {
        vec4 localPosition = instanceMatrix * vec4(position, 1.0);
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

function PineTree({
  intro,
  selectedNode,
  onSelectNode,
}: {
  intro: IntroTimeline;
  selectedNode: PortfolioNode | null;
  onSelectNode: (node: PortfolioNode | null) => void;
}) {
  const branchNodes = useRef<THREE.Group>(null);
  const rootNodes = useRef<THREE.Group>(null);
  const brushMesh = useRef<THREE.InstancedMesh>(null);
  const matricesReady = useRef(false);
  const nodes = portfolioNodes;
  const scroll = useScroll();
  const geometry = useMemo(buildPineGeometry, []);
  const brushTexture = useMemo(createBrushAlphaTexture, []);
  const brushPlane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const brushMaterial = useMemo(() => createBrushStrokeMaterial(brushTexture), [brushTexture]);
  const structureMaterial = useMemo(() => createSumiToonMaterial(0.04, 0.55), []);
  const foliageMaterial = useMemo(() => createSumiToonMaterial(0.16, 0.38), []);
  const brushDummy = useMemo(() => new THREE.Object3D(), []);
  const brushRoll = useMemo(() => new THREE.Quaternion(), []);
  const brushAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const previousCameraRotation = useMemo(() => new THREE.Quaternion(0, 0, 0, 0), []);

  useEffect(() => () => brushTexture.dispose(), [brushTexture]);

  useFrame(({ camera }) => {
    structureMaterial.uniforms.uProgress.value = intro.progress;
    structureMaterial.uniforms.uFogDensity.value = intro.fogDensity;
    foliageMaterial.uniforms.uProgress.value = intro.progress;
    foliageMaterial.uniforms.uFogDensity.value = intro.fogDensity;
    brushMaterial.uniforms.uProgress.value = intro.progress;
    brushMaterial.uniforms.uFogDensity.value = intro.fogDensity;
    if (branchNodes.current) branchNodes.current.visible = scroll.offset < 0.37;
    if (rootNodes.current) rootNodes.current.visible = scroll.offset > 0.63;

    if (brushMesh.current && (!matricesReady.current || camera.quaternion.angleTo(previousCameraRotation) > 0.0005)) {
      geometry.foliage.forEach((stroke, index) => {
        brushDummy.position.copy(stroke.position);
        brushRoll.setFromAxisAngle(brushAxis, stroke.rotation);
        brushDummy.quaternion.copy(camera.quaternion).multiply(brushRoll);
        brushDummy.scale.set(stroke.width, stroke.height, 1);
        brushDummy.updateMatrix();
        brushMesh.current?.setMatrixAt(index, brushDummy.matrix);
      });
      brushMesh.current.instanceMatrix.needsUpdate = true;
      previousCameraRotation.copy(camera.quaternion);
      matricesReady.current = true;
    }
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      <mesh geometry={geometry.structure} material={structureMaterial} />
      <mesh geometry={geometry.canopy} material={foliageMaterial} />
      <instancedMesh
        ref={brushMesh}
        args={[brushPlane, brushMaterial, geometry.foliage.length]}
        frustumCulled={false}
      />

      <group ref={branchNodes}>
        {nodes.filter((node) => node.stage === "branches").map((node) => (
          <GlowNode
            key={node.id}
            node={node}
            active={selectedNode?.id === node.id}
            onClick={() => onSelectNode(node)}
          />
        ))}
      </group>
      <group ref={rootNodes}>
        {nodes.filter((node) => node.stage === "roots").map((node) => (
          <GlowNode
            key={node.id}
            node={node}
            active={selectedNode?.id === node.id}
            onClick={() => onSelectNode(node)}
          />
        ))}
      </group>
    </group>
  );
}

function GlowNode({ node, active, onClick }: { node: PortfolioNode; active: boolean; onClick: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.8 + Number(node.number)) * 0.08;
    if (mesh.current) mesh.current.scale.setScalar(pulse * (active ? 1.22 : 1));
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.45 + Number(node.number)) * 0.12);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick();
  };

  return (
    <group position={node.position}>
      <mesh ref={mesh} onClick={handleClick} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <sphereGeometry args={[0.105, 12, 10]} />
        <meshStandardMaterial color="#f4c79d" emissive="#d9381e" emissiveIntensity={2.2} roughness={0.3} toneMapped={false} />
      </mesh>
      <mesh ref={ring} position={[0, 0, -0.02]}>
        <ringGeometry args={[0.14, 0.17, 24]} />
        <meshBasicMaterial color="#d9381e" transparent opacity={0.58} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.035]}>
        <circleGeometry args={[0.26, 24]} />
        <meshBasicMaterial color="#d9381e" transparent opacity={0.055} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0.24, 0.23, 0.08]} distanceFactor={9} zIndexRange={[10, 0]}>
        <button
          className="node-action"
          type="button"
          aria-label={`Open ${node.title} field note`}
          aria-pressed={active}
          onClick={(event) => { event.stopPropagation(); onClick(); }}
        >
          <span className="node-label"><span>{node.number}</span><i /></span>
        </button>
      </Html>
    </group>
  );
}
