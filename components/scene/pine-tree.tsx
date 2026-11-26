"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, useScroll } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { portfolioEntries } from "@/content/portfolio";
import type { IntroTimeline } from "./intro";
import { paintNeedleAtlas, paintWashCloud } from "./ink-painting";
import type { FoliageSprite, PineGeometry } from "./pine-geometry";
import { createFoliageMaterial, createInkTrunkMaterial } from "./pine-materials";
import type { PortfolioNode } from "./types";

// One upright sprite per needle fan or wash cloud; the vertex shader turns each to face the camera.
function createFoliageMesh(sprites: FoliageSprite[], material: THREE.ShaderMaterial, renderOrder: number) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const attribute = (pick: (sprite: FoliageSprite) => number) =>
    new THREE.InstancedBufferAttribute(new Float32Array(sprites.map(pick)), 1);
  geometry.setAttribute("aVariant", attribute((sprite) => sprite.variant));
  geometry.setAttribute("aTone", attribute((sprite) => sprite.tone));
  geometry.setAttribute("aTilt", attribute((sprite) => sprite.tilt));
  const mesh = new THREE.InstancedMesh(geometry, material, sprites.length);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  sprites.forEach((sprite, index) => {
    mesh.setMatrixAt(index, matrix.compose(sprite.position, rotation, scale.set(sprite.width, sprite.height, 1)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.raycast = () => {};
  return mesh;
}

export function createPortfolioNodes(geometry: PineGeometry): PortfolioNode[] {
  return portfolioEntries.map((node) => {
    const anchor = geometry.nodePositions[node.id];
    return {
      ...node,
      position: [anchor.x, anchor.y, anchor.z] as [number, number, number],
    };
  });
}

export function PineTree({
  intro,
  geometry,
  nodes,
  nodesReady,
  selectedNode,
  highlightedId,
  onHighlightId,
  onSelectNode,
}: {
  intro: IntroTimeline;
  geometry: PineGeometry;
  nodes: PortfolioNode[];
  nodesReady: boolean;
  selectedNode: PortfolioNode | null;
  highlightedId: string | null;
  onHighlightId: (id: string | null) => void;
  onSelectNode: (node: PortfolioNode | null) => void;
}) {
  const [visibleNodeStage, setVisibleNodeStage] = useState<"branches" | "roots" | null>(null);
  const shownNodeStage = useRef<"branches" | "roots" | null>(null);
  const scroll = useScroll();
  const structureMaterial = useMemo(() => createInkTrunkMaterial({ wash: 0.5, noiseStrength: 0.55, windStrength: 0 }), []);
  const canopyMaterial = useMemo(() => createInkTrunkMaterial({ wash: 0.56, noiseStrength: 0.38, windStrength: 1 }), []);
  const cliffMaterial = useMemo(() => createInkTrunkMaterial({ wash: 0.3, noiseStrength: 0.4, windStrength: 0 }), []);
  const needleAtlas = useMemo(() => paintNeedleAtlas(), []);
  const washTexture = useMemo(() => paintWashCloud(), []);
  const needleMesh = useMemo(
    () => createFoliageMesh(geometry.needles, createFoliageMaterial(needleAtlas, { atlas: true, opacity: 0.95 }), 3),
    [geometry, needleAtlas],
  );
  const washMesh = useMemo(
    () => createFoliageMesh(geometry.washes, createFoliageMaterial(washTexture, { atlas: false, opacity: 0.82 }), 2),
    [geometry, washTexture],
  );
  const foliageMaterials = [needleMesh.material, washMesh.material] as THREE.ShaderMaterial[];

  useEffect(() => () => {
    geometry.structure.dispose();
    geometry.canopy.dispose();
    geometry.cliff.dispose();
    structureMaterial.dispose();
    canopyMaterial.dispose();
    cliffMaterial.dispose();
    needleAtlas.dispose();
    washTexture.dispose();
    for (const mesh of [needleMesh, washMesh]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }, [canopyMaterial, cliffMaterial, geometry, needleAtlas, needleMesh, structureMaterial, washMesh, washTexture]);

  useFrame(({ clock }) => {
    const windTime = clock.elapsedTime;
    for (const material of [structureMaterial, canopyMaterial, cliffMaterial, ...foliageMaterials]) {
      material.uniforms.uProgress.value = intro.progress;
      material.uniforms.uFogDensity.value = intro.fogDensity;
      material.uniforms.uTime.value = windTime;
    }
    // The cliff belongs to the landscape: it inks in with the background, after the tree is drawn.
    cliffMaterial.uniforms.uReveal.value = intro.backgroundReveal;
    // Dots are mounted only for the chapter in view: drei's Html labels ignore a hidden parent group.
    const nodeStage = scroll.offset < 0.37 ? "branches" : scroll.offset > 0.63 ? "roots" : null;
    if (nodeStage !== shownNodeStage.current) {
      shownNodeStage.current = nodeStage;
      setVisibleNodeStage(nodeStage);
    }
  });

  return (
    <group position={[1.45, -2.8, 0]}>
      <mesh geometry={geometry.structure} material={structureMaterial} />
      <mesh geometry={geometry.canopy} material={canopyMaterial} />
      <mesh geometry={geometry.cliff} material={cliffMaterial} />
      <primitive object={washMesh} />
      <primitive object={needleMesh} />

      {nodesReady && visibleNodeStage && nodes.filter((node) => node.stage === visibleNodeStage).map((node) => (
        <GlowNode
          key={node.id}
          node={node}
          active={selectedNode?.id === node.id}
          highlighted={highlightedId === node.id}
          onHighlight={(on) => onHighlightId(on ? node.id : null)}
          onClick={() => onSelectNode(node)}
        />
      ))}
    </group>
  );
}

function GlowNode({ node, active, highlighted, onHighlight, onClick }: {
  node: PortfolioNode;
  active: boolean;
  highlighted: boolean;
  onHighlight: (on: boolean) => void;
  onClick: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const emphasis = useRef(0);

  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  useFrame(({ clock }, delta) => {
    // Pointing at the entry in the chapter list swells its dot and widens the ring.
    emphasis.current = THREE.MathUtils.damp(emphasis.current, highlighted || active ? 1 : 0, 10, delta);
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.8 + Number(node.number)) * 0.08;
    if (mesh.current) mesh.current.scale.setScalar(pulse * (1 + emphasis.current * 0.3));
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.45 + Number(node.number)) * 0.12 + emphasis.current * 0.6);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick();
  };

  return (
    <group position={node.position}>
      <mesh
        ref={mesh}
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; onHighlight(true); }}
        onPointerOut={() => { document.body.style.cursor = ""; onHighlight(false); }}
      >
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
          className={`node-action ${highlighted ? "is-highlighted" : ""}`}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onPointerEnter={() => onHighlight(true)}
          onPointerLeave={() => onHighlight(false)}
          onClick={(event) => { event.stopPropagation(); onClick(); }}
        >
          <span className="node-label"><span>{node.number}</span><i /><em>{node.short}</em></span>
        </button>
      </Html>
    </group>
  );
}
