"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, useScroll } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { portfolioEntries } from "@/content/portfolio";
import type { IntroTimeline } from "./intro";
import { buildPineGeometry, createBrushAlphaTexture, type PineGeometry } from "./pine-geometry";
import { createBrushStrokeMaterial, createSumiToonMaterial } from "./pine-materials";
import type { PortfolioNode } from "./types";

export function PineTree({
  intro,
  nodesReady,
  selectedNode,
  onSelectNode,
}: {
  intro: IntroTimeline;
  nodesReady: boolean;
  selectedNode: PortfolioNode | null;
  onSelectNode: (node: PortfolioNode | null) => void;
}) {
  const branchNodes = useRef<THREE.Group>(null);
  const rootNodes = useRef<THREE.Group>(null);
  const brushMesh = useRef<THREE.InstancedMesh>(null);
  const matricesReady = useRef(false);
  const scroll = useScroll();
  const geometry = useMemo<PineGeometry>(() => buildPineGeometry(), []);
  const nodes = useMemo<PortfolioNode[]>(() => portfolioEntries.map((node) => {
    const anchor = geometry.nodePositions[node.id];
    return {
      ...node,
      position: [anchor.x, anchor.y, anchor.z] as [number, number, number],
    };
  }), [geometry]);
  const brushTexture = useMemo(() => createBrushAlphaTexture(), []);
  const brushPlane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const brushMaterial = useMemo(() => createBrushStrokeMaterial(brushTexture), [brushTexture]);
  const structureMaterial = useMemo(() => createSumiToonMaterial(0.04, 0.55, 0), []);
  const foliageMaterial = useMemo(() => createSumiToonMaterial(0.16, 0.38, 1), []);
  const brushDummy = useMemo(() => new THREE.Object3D(), []);
  const brushRoll = useMemo(() => new THREE.Quaternion(), []);
  const brushAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const previousCameraRotation = useMemo(() => new THREE.Quaternion(0, 0, 0, 0), []);

  useEffect(() => () => {
    geometry.structure.dispose();
    geometry.canopy.dispose();
    brushTexture.dispose();
    brushPlane.dispose();
    brushMaterial.dispose();
    structureMaterial.dispose();
    foliageMaterial.dispose();
  }, [brushMaterial, brushPlane, brushTexture, foliageMaterial, geometry, structureMaterial]);

  useFrame(({ camera, clock }) => {
    const windTime = clock.elapsedTime;
    structureMaterial.uniforms.uProgress.value = intro.progress;
    structureMaterial.uniforms.uFogDensity.value = intro.fogDensity;
    structureMaterial.uniforms.uTime.value = windTime;
    foliageMaterial.uniforms.uProgress.value = intro.progress;
    foliageMaterial.uniforms.uFogDensity.value = intro.fogDensity;
    foliageMaterial.uniforms.uTime.value = windTime;
    brushMaterial.uniforms.uProgress.value = intro.progress;
    brushMaterial.uniforms.uFogDensity.value = intro.fogDensity;
    brushMaterial.uniforms.uTime.value = windTime;
    for (const [group, visible] of [
      [branchNodes.current, scroll.offset < 0.37],
      [rootNodes.current, scroll.offset > 0.63],
    ] as const) {
      if (!group) continue;
      // A hidden node never receives pointer-out, so clear the hover cursor it may have set.
      if (group.visible && !visible) document.body.style.cursor = "";
      group.visible = visible;
    }

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

      {nodesReady && (
        <>
          <group ref={branchNodes} visible={scroll.offset < 0.37}>
            {nodes.filter((node) => node.stage === "branches").map((node) => (
              <GlowNode
                key={node.id}
                node={node}
                active={selectedNode?.id === node.id}
                onClick={() => onSelectNode(node)}
              />
            ))}
          </group>
          <group ref={rootNodes} visible={scroll.offset > 0.63}>
            {nodes.filter((node) => node.stage === "roots").map((node) => (
              <GlowNode
                key={node.id}
                node={node}
                active={selectedNode?.id === node.id}
                onClick={() => onSelectNode(node)}
              />
            ))}
          </group>
        </>
      )}
    </group>
  );
}

function GlowNode({ node, active, onClick }: { node: PortfolioNode; active: boolean; onClick: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useEffect(() => () => { document.body.style.cursor = ""; }, []);

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
