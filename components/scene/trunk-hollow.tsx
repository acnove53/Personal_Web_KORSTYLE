"use client";

import { Html, useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { IntroTimeline } from "./intro";
import type { HollowSpot } from "./pine-geometry";

const holeWidth = 0.74;
const holeHeight = 0.93;
const textureWidth = 256;
const textureHeight = 320;

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An ink-wash knothole: an uneven almond of near-black, bleeding softly into the bark, with a few cracks around it.
function paintHollow() {
  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const random = createRandom(4421);
  const cx = textureWidth / 2;
  const cy = textureHeight / 2;

  // Cracks first, so the hole sits over their roots.
  context.lineCap = "round";
  for (let index = 0; index < 11; index += 1) {
    const angle = (index / 11) * Math.PI * 2 + random() * 0.4;
    const startRadius = 0.66 + random() * 0.1;
    const length = 22 + random() * 34;
    const sx = cx + Math.cos(angle) * 62 * startRadius;
    const sy = cy + Math.sin(angle) * 92 * startRadius;
    const ex = sx + Math.cos(angle + (random() - 0.5) * 0.7) * length;
    const ey = sy + Math.sin(angle + (random() - 0.5) * 0.7) * length * 1.15;
    context.strokeStyle = `rgba(22, 17, 14, ${0.28 + random() * 0.3})`;
    context.lineWidth = 1.2 + random() * 2.2;
    context.beginPath();
    context.moveTo(sx, sy);
    context.quadraticCurveTo((sx + ex) / 2 + (random() - 0.5) * 10, (sy + ey) / 2 + (random() - 0.5) * 10, ex, ey);
    context.stroke();
  }

  // The opening: a wobbling almond, taller than wide, drawn twice so the edge bleeds.
  const outline: [number, number][] = [];
  const steps = 48;
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const wobble = 1 + (random() - 0.5) * 0.14 + Math.sin(angle * 3 + 1.3) * 0.05;
    // Pinched toward the top, like a split in the bark.
    const pinch = 1 - 0.16 * Math.max(0, -Math.sin(angle));
    outline.push([cx + Math.cos(angle) * 52 * wobble * pinch, cy + Math.sin(angle) * 86 * wobble]);
  }
  const trace = () => {
    context.beginPath();
    outline.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.closePath();
  };
  context.save();
  context.shadowColor = "rgba(14, 10, 8, 0.65)";
  context.shadowBlur = 24;
  context.fillStyle = "rgba(10, 8, 6, 0.95)";
  trace();
  context.fill();
  context.restore();
  const depth = context.createRadialGradient(cx, cy - 8, 4, cx, cy, 90);
  depth.addColorStop(0, "#050403");
  depth.addColorStop(0.7, "#0d0a08");
  depth.addColorStop(1, "rgba(16, 12, 9, 0.97)");
  context.fillStyle = depth;
  trace();
  context.fill();
  // A faint lighter lip along the lower edge, where the bark catches the light.
  context.strokeStyle = "rgba(190, 176, 158, 0.28)";
  context.lineWidth = 3;
  context.beginPath();
  for (let index = Math.floor(steps * 0.08); index <= Math.floor(steps * 0.45); index += 1) {
    const [x, y] = outline[index];
    if (index === Math.floor(steps * 0.08)) context.moveTo(x + 2, y + 4);
    else context.lineTo(x + 2, y + 4);
  }
  context.stroke();
  return canvas;
}

export function TrunkHollow({ hollow, intro, open, onOpen }: {
  hollow: HollowSpot;
  intro: IntroTimeline;
  open: boolean;
  onOpen: () => void;
}) {
  const scroll = useScroll();
  const meshRef = useRef<THREE.Mesh>(null);
  const hover = useRef(false);
  const shown = useRef(0);
  const [active, setActive] = useState(false);

  const { texture, material, geometry, quaternion, position } = useMemo(() => {
    const map = new THREE.CanvasTexture(paintHollow());
    map.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      toneMapped: false,
    });
    return {
      texture: map,
      material: mat,
      geometry: new THREE.PlaneGeometry(holeWidth, holeHeight),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), hollow.normal),
      position: hollow.position.clone().addScaledVector(hollow.normal, 0.03),
    };
  }, [hollow]);

  useEffect(() => () => {
    texture.dispose();
    material.dispose();
    geometry.dispose();
  }, [texture, material, geometry]);

  useFrame((_, delta) => {
    const ready = intro.complete && intro.backgroundReveal >= 0.98;
    // Only the About view looks at the trunk's middle; elsewhere the hole is hidden.
    const target = ready && Math.abs(scroll.offset - 0.5) < 0.16 ? 1 : 0;
    shown.current += (target - shown.current) * Math.min(1, delta * 3);
    material.opacity = shown.current;
    const mesh = meshRef.current;
    if (mesh) {
      mesh.visible = shown.current > 0.01;
      const scale = THREE.MathUtils.lerp(mesh.scale.x, hover.current && !open ? 1.1 : 1, Math.min(1, delta * 8));
      mesh.scale.set(scale, scale, 1);
    }
    const nowActive = shown.current > 0.6;
    if (nowActive !== active) setActive(nowActive);
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={position}
        quaternion={quaternion}
        renderOrder={1}
        visible={false}
        onClick={(event) => {
          event.stopPropagation();
          if (!open) onOpen();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          hover.current = true;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          hover.current = false;
          document.body.style.cursor = "";
        }}
      />
      {active && !open && (
        <Html center position={position} zIndexRange={[10, 0]}>
          <button
            className="hollow-action"
            type="button"
            aria-label="Look inside the hollow in the trunk"
            onClick={onOpen}
          />
        </Html>
      )}
    </group>
  );
}
