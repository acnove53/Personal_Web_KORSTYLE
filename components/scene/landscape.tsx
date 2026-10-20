"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { IntroTimeline } from "./intro";
import { paintLandscapeLayer, paintMistBand, rangeRow, type LandscapeLayerSpec } from "./ink-painting";
import { createSunMaterial, createWaterfallMaterial } from "./landscape-materials";
import { smoothStep } from "./math";

type LayerDef = {
  id: string;
  z: number;
  baseY: number;
  follow: number;
  painting: LandscapeLayerSpec;
  mist: { bottom: number; height: number; seed: number; drift: number };
  waterfall?: { x: number; top: number; bottom: number; width: number; screenX: number };
};

const designCameraZ = 14.2;
const revealWindows: Record<string, [number, number]> = { far: [0, 0.55], middle: [0.2, 0.75], near: [0.4, 0.9] };
const inkColor = "#1b1a18";
const paperColor = "#f9f8f6";
const sunZ = -150;

// Listed far to near. baseY places each range at a fixed band of the screen in the canopy view;
// follow < 1 gives the layers parallax against the camera.
const layerDefs: LayerDef[] = [
  {
    id: "far",
    z: -124,
    baseY: -19.65,
    follow: 0.9,
    painting: {
      width: 260,
      height: 22,
      pxPerUnit: 9,
      seed: 89,
      inkAlpha: 0.2,
      dots: false,
      peaks: [
        ...rangeRow(891, { from: -118, to: 118, step: 22, base: 7, halfWidth: [12, 18], height: [6, 11], tone: 0.55, cragChance: 0 }),
        ...rangeRow(893, { from: -112, to: 112, step: 19, base: 2, halfWidth: [10, 16], height: [6, 12], tone: 0.85, cragChance: 0.15 }),
      ],
      clouds: [{ y: 6, amount: 0.7 }, { y: 2, amount: 0.8 }],
    },
    mist: { bottom: 0, height: 7, seed: 11, drift: 0.0012 },
  },
  {
    id: "middle",
    z: -84,
    baseY: -18.2,
    follow: 0.86,
    painting: {
      width: 180,
      height: 18,
      pxPerUnit: 13,
      seed: 43,
      inkAlpha: 0.34,
      dots: true,
      peaks: [
        ...rangeRow(431, { from: -80, to: 80, step: 16, base: 4, halfWidth: [9, 14], height: [6, 10], tone: 0.6, cragChance: 0.2 }),
        ...rangeRow(433, { from: -78, to: 78, step: 13, base: 0, halfWidth: [4, 7], height: [6, 11], tone: 0.9, cragChance: 0.65 }),
      ],
      clouds: [{ y: 3.5, amount: 0.8 }, { y: 1.2, amount: 0.9 }],
    },
    mist: { bottom: -1, height: 6, seed: 23, drift: -0.0018 },
  },
  {
    id: "near",
    z: -48,
    baseY: -17.3,
    follow: 0.82,
    painting: {
      width: 110,
      height: 17,
      pxPerUnit: 24,
      seed: 17,
      inkAlpha: 0.55,
      dots: true,
      // Kept low on the left so the chapter headings stay legible; the tallest crags and the
      // waterfall sit to the right of the trunk.
      peaks: [
        { x: 12, base: 0, halfWidth: 4.5, height: 8.5, shape: "crag", tone: 0.55 },
        { x: 30, base: 0, halfWidth: 5, height: 10, shape: "crag", tone: 0.6 },
        { x: -48, base: 0, halfWidth: 7, height: 6, shape: "crag", tone: 0.65 },
        { x: -36, base: 0, halfWidth: 7, height: 5.5, shape: "crag", tone: 0.7 },
        { x: -27, base: 0, halfWidth: 3, height: 6.8, shape: "pillar", tone: 0.75 },
        { x: -18, base: 0, halfWidth: 6, height: 6, shape: "crag", tone: 0.7, pine: true },
        { x: 2, base: 0, halfWidth: 6, height: 6.5, shape: "crag", tone: 0.7 },
        { x: -6, base: 0, halfWidth: 4, height: 7.5, shape: "pillar", tone: 0.75, pine: true },
        { x: 46, base: 0, halfWidth: 6, height: 7, shape: "crag", tone: 0.8 },
        { x: 38, base: 0, halfWidth: 5, height: 9, shape: "crag", tone: 0.85, pine: true },
        { x: 21.1, base: 0, halfWidth: 2.2, height: 11.6, shape: "crag", tone: 0.9 },
        { x: 17.6, base: 0, halfWidth: 3.2, height: 13.2, shape: "pillar", tone: 1, pine: true },
        { x: 24.6, base: 0, halfWidth: 3.4, height: 14.6, shape: "pillar", tone: 1.05, pine: true },
      ],
      clouds: [{ y: 2, amount: 0.9 }, { y: 4.5, amount: 0.55 }],
      cliffShadows: [{ x: 21.1, top: 11.8, bottom: 3, width: 3.2 }],
    },
    mist: { bottom: -1, height: 5, seed: 37, drift: 0.0024 },
    waterfall: { x: 21.1, top: 10.8, bottom: 2.2, width: 2.6, screenX: 0.6 },
  },
];

export function InkLandscape({ intro, reducedMotion }: { intro: IntroTimeline; reducedMotion: boolean }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const sunRef = useRef<THREE.Mesh>(null);

  const layers = useMemo(() => layerDefs.map((def) => {
    const { width, height } = def.painting;
    const paintingTexture = paintLandscapeLayer(def.painting);
    const mistTexture = paintMistBand(def.mist.seed);
    mistTexture.repeat.x = width / (def.mist.height * 4);    return {
      ...def,
      paintingTexture,
      mistTexture,
      paintingGeometry: new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0),
      mistGeometry: new THREE.PlaneGeometry(width, def.mist.height).translate(0, def.mist.bottom + def.mist.height / 2, 0),
      paintingMaterial: new THREE.MeshBasicMaterial({
        color: inkColor,
        alphaMap: paintingTexture,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
      mistMaterial: new THREE.MeshBasicMaterial({
        color: paperColor,
        alphaMap: mistTexture,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    };
  }), []);
  const waterfallMaterial = useMemo(() => createWaterfallMaterial(), []);
  const sunMaterial = useMemo(() => createSunMaterial(), []);
  const unitPlane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(() => () => {
    layers.forEach((layer) => {
      layer.paintingTexture.dispose();
      layer.mistTexture.dispose();
      layer.paintingGeometry.dispose();
      layer.mistGeometry.dispose();
      layer.paintingMaterial.dispose();
      layer.mistMaterial.dispose();
    });
    waterfallMaterial.dispose();
    sunMaterial.dispose();
    unitPlane.dispose();
  }, [layers, sunMaterial, unitPlane, waterfallMaterial]);

  useFrame(({ camera }, delta) => {
    const perspective = camera as THREE.PerspectiveCamera;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    // The landscape inks in only after the tree is drawn, far ranges first, the sun and waterfall last.
    const background = intro.backgroundReveal;
    const reveal = smoothStep(0.6, 1, background);

    layers.forEach((layer, index) => {
      const group = groupRefs.current[index];
      if (!group) return;
      const [from, to] = revealWindows[layer.id] ?? [0, 1];
      const layerReveal = smoothStep(from, to, background);
      layer.paintingMaterial.opacity = layerReveal;
      layer.mistMaterial.opacity = layerReveal;
      let shift = 0;
      if (layer.waterfall) {
        // Keep the waterfall at the same fraction of the screen width on narrow and wide viewports.
        const halfWidth = (designCameraZ - layer.z) * tanHalfFov * perspective.aspect;
        shift = THREE.MathUtils.clamp(halfWidth * layer.waterfall.screenX - layer.waterfall.x, -24, 0);
      }
      group.position.x = 1.45 + (camera.position.x - 1.48) * layer.follow + shift;
      group.position.y = layer.baseY + camera.position.y * layer.follow;
      if (!reducedMotion) layer.mistTexture.offset.x += delta * layer.mist.drift;
    });

    if (!reducedMotion) waterfallMaterial.uniforms.uTime.value += delta;
    waterfallMaterial.uniforms.uOpacity.value = reveal * 0.92;

    const sun = sunRef.current;
    if (sun) {
      const halfHeight = (camera.position.z - sunZ) * tanHalfFov;
      const halfWidth = halfHeight * perspective.aspect;
      const radius = halfHeight * 0.095;
      // On portrait screens the chapter text fills the top, so the sun sits lower, between text and tree.
      const portrait = perspective.aspect < 1;
      sun.position.set(
        camera.position.x + halfWidth * (portrait ? 0.5 : 0.42),
        camera.position.y + halfHeight * (portrait ? 0.3 : 0.5),
        sunZ,
      );
      sun.scale.setScalar((radius * 2) / 0.86);
      // The sun belongs to the sky above the crown; it fades out as the camera moves down to the roots.
      sunMaterial.uniforms.uOpacity.value = reveal * 0.94 * smoothStep(-1.2, 0.2, camera.position.y);
    }
  });

  return (
    <group>
      <mesh ref={sunRef} geometry={unitPlane} material={sunMaterial} frustumCulled={false} raycast={() => {}} />
      {layers.map((layer, index) => (
        <group
          key={layer.id}
          ref={(group) => { groupRefs.current[index] = group; }}
          position={[1.45, layer.baseY + 1.05 * layer.follow, layer.z]}
        >
          <mesh geometry={layer.paintingGeometry} material={layer.paintingMaterial} frustumCulled={false} raycast={() => {}} />
          {layer.waterfall && (
            <mesh
              geometry={unitPlane}
              material={waterfallMaterial}
              position={[layer.waterfall.x, (layer.waterfall.top + layer.waterfall.bottom) / 2, 0.3]}
              scale={[layer.waterfall.width, layer.waterfall.top - layer.waterfall.bottom, 1]}
              frustumCulled={false}
              raycast={() => {}}
            />
          )}
          <mesh position={[0, 0, 3]} geometry={layer.mistGeometry} material={layer.mistMaterial} frustumCulled={false} raycast={() => {}} />
        </group>
      ))}
    </group>
  );
}
