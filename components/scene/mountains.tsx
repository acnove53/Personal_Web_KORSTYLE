"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { seedUnit, smoothStep } from "./math";

type MountainLayerSpec = {
  id: string;
  z: number;
  width: number;
  height: number;
  baseY: number;
  follow: number;
  opacity: number;
  softness: number;
  color: string;
  seed: number;
};

const mountainLayerSpecs: MountainLayerSpec[] = [
  {
    id: "near", z: -48, width: 88, height: 9.5, baseY: -13.8,
    follow: 0.82, opacity: 0.48, softness: 0.12, color: "#77736c", seed: 17,
  },
  {
    id: "middle", z: -84, width: 142, height: 14, baseY: -23.5,
    follow: 0.86, opacity: 0.38, softness: 0.34, color: "#928f89", seed: 43,
  },
  {
    id: "far", z: -124, width: 208, height: 20, baseY: -36.5,
    follow: 0.9, opacity: 0.3, softness: 0.58, color: "#aeaca6", seed: 89,
  },
];

export function MountainLayers() {
  const layerRefs = useRef<(THREE.Group | null)[]>([]);
  const layers = useMemo(() => mountainLayerSpecs.map((spec) => {
    const washTexture = createMountainWashTexture(spec.seed + 307, spec.softness);
    return {
      ...spec,
      geometry: buildMountainGeometry(spec),
      washTexture,
      material: new THREE.MeshBasicMaterial({
        color: "#ffffff",
        opacity: 1,
        transparent: true,
        vertexColors: true,
        alphaMap: washTexture,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
    };
  }), []);

  useEffect(() => () => {
    layers.forEach(({ geometry, material, washTexture }) => {
      geometry.dispose();
      washTexture.dispose();
      material.dispose();
    });
  }, [layers]);

  useFrame(({ camera }) => {
    layers.forEach((layer, index) => {
      const group = layerRefs.current[index];
      if (!group) return;
      group.position.x = 1.45 + (camera.position.x - 1.48) * layer.follow;
      group.position.y = layer.baseY + camera.position.y * layer.follow;
    });
  });

  return (
    <group>
      {layers.map((layer, index) => (
        <group
          key={layer.id}
          ref={(group) => { layerRefs.current[index] = group; }}
          position={[1.45, layer.baseY + 1.05 * layer.follow, layer.z]}
        >
          <mesh geometry={layer.geometry} material={layer.material} frustumCulled={false} raycast={() => {}} />
        </group>
      ))}
    </group>
  );
}

function buildMountainGeometry(layer: MountainLayerSpec) {
  const horizontalSegments = 144;
  const verticalSegments = 18;
  const peakCount = Math.round(7 - layer.softness * 3.4);
  const peaks = Array.from({ length: peakCount }, (_, index) => ({
    center: (index + 0.5 + (seedUnit(layer.seed, index) - 0.5) * 0.55) / peakCount,
    height: layer.height * (0.42 + seedUnit(layer.seed, index + 31) * 0.55),
    leftWidth: 0.052 + seedUnit(layer.seed, index + 67) * 0.075 + layer.softness * 0.025,
    rightWidth: 0.06 + seedUnit(layer.seed, index + 97) * 0.092 + layer.softness * 0.034,
  }));
  const ridgeHeights: number[] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const ink = new THREE.Color(layer.color);
  const rowSize = verticalSegments + 1;

  for (let column = 0; column <= horizontalSegments; column++) {
    const u = column / horizontalSegments;
    let ridgeHeight = layer.height * 0.025;

    for (const peak of peaks) {
      const offset = u - peak.center;
      const width = offset < 0 ? peak.leftWidth : peak.rightWidth;
      const distance = Math.abs(offset) / width;
      const mountainFace = Math.pow(Math.max(0, 1 - distance), 1.08 - layer.softness * 0.42);
      const shoulder = Math.exp(-Math.pow(distance - 0.72, 2) / 0.12) * 0.07;
      ridgeHeight = Math.max(ridgeHeight, peak.height * (0.025 + mountainFace * 0.91 + shoulder));
    }

    const edgeFade = Math.min(smoothStep(0, 0.035, u), smoothStep(0, 0.035, 1 - u));
    const contourNoise = 0.94
      + 0.025 * Math.sin(u * (38 - layer.softness * 15) + layer.seed)
      + 0.018 * Math.sin(u * 83 + layer.seed * 0.37)
      + seedUnit(layer.seed, column + 211) * 0.025 * (1 - layer.softness);
    ridgeHeights.push(ridgeHeight * edgeFade * contourNoise);
  }

  for (let column = 0; column <= horizontalSegments; column++) {
    const u = column / horizontalSegments;
    const x = (u - 0.5) * layer.width;
    const ridgeHeight = ridgeHeights[column];
    const cloudLine = 0.16 + 0.045 * Math.sin(u * 16 + layer.seed) + 0.025 * Math.sin(u * 37 + layer.seed * 0.4);

    for (let row = 0; row <= verticalSegments; row++) {
      const v = row / verticalSegments;
      positions.push(x, ridgeHeight * v, 0);
      uvs.push(u, v);

      const cloudFade = smoothStep(0.015, 0.09, v);
      const mistBand = Math.exp(-Math.pow((v - cloudLine) / 0.105, 2));
      const grain = 0.88 + seedUnit(layer.seed, column * 23 + row * 41) * 0.12 * (1 - layer.softness);
      const pigment = 0.9 + seedUnit(layer.seed, column * 17 + row * 29 + 503) * 0.1;
      const summitFeather = 1 - layer.softness * 0.32 * smoothStep(0.84, 1, v);
      colors.push(
        ink.r * pigment,
        ink.g * pigment,
        ink.b * pigment,
        layer.opacity * cloudFade * (1 - mistBand * 0.32) * grain * summitFeather,
      );
    }
  }

  for (let column = 0; column < horizontalSegments; column++) {
    for (let row = 0; row < verticalSegments; row++) {
      const a = column * rowSize + row;
      const b = (column + 1) * rowSize + row;
      const c = (column + 1) * rowSize + row + 1;
      const d = column * rowSize + row + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createMountainWashTexture(seed: number, softness: number) {
  const width = 384;
  const height = 192;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const noise = seedUnit(seed + x * 0.31, y * 0.53 + 11);
      const cloudCenter = 0.17 + 0.055 * Math.sin(u * 15 + seed) + 0.028 * Math.sin(u * 31 + seed * 0.6);
      const cloud = Math.exp(-Math.pow((v - cloudCenter) / 0.095, 2));
      const streak = Math.sin(u * 112 + Math.sin(v * 29 + seed) * 2.1 + seed * 0.4) * 0.5 + 0.5;
      const dryBrush = smoothStep(0.9, 0.99, streak)
        * smoothStep(0.22, 0.42, v)
        * (1 - smoothStep(0.76, 0.94, v));
      const grain = 0.83 + noise * 0.17 * (1 - softness * 0.55);
      const baseWash = 0.88 + smoothStep(0.015, 0.3, v) * 0.12;
      const alpha = THREE.MathUtils.clamp((grain - cloud * 0.34 - dryBrush * 0.3) * baseWash, 0.3, 1);
      const pixel = (y * width + x) * 4;
      pixels[pixel] = 255;
      pixels[pixel + 1] = Math.round(alpha * 255);
      pixels[pixel + 2] = 255;
      pixels[pixel + 3] = 255;
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
