"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { ScrollControls } from "@react-three/drei";
import { useCallback, useMemo, useRef, useState } from "react";
import type { StageName } from "@/content/portfolio";
import { CameraController } from "@/components/scene/camera-controller";
import { createIntroTimeline, ImpactSplash, IntroSequence, SeedParticle, type IntroTimeline } from "@/components/scene/intro";
import { InkLandscape } from "@/components/scene/landscape";
import { buildPineGeometry } from "@/components/scene/pine-geometry";
import { createPortfolioNodes, PineTree } from "@/components/scene/pine-tree";
import type { PortfolioNode } from "@/components/scene/types";

export type { PortfolioNode } from "@/components/scene/types";

type PineSceneProps = {
  onStageChange: (stage: StageName) => void;
  onSelectId: (id: string | null) => void;
  selectedId: string | null;
  highlightedId: string | null;
  onHighlightId: (id: string | null) => void;
  onConnectScroll: (scrollToStage: (stage: StageName) => void) => void;
  onIntroComplete: () => void;
  onIntroSprout: () => void;
  onAboutTextReveal: () => void;
  skipIntro: boolean;
  reducedMotion: boolean;
  introTitleRef: { current: HTMLDivElement | null };
  aboutTextRef: { current: HTMLElement | null };
  chapterTextRef: { current: HTMLElement | null };
};

export function PineScene({
  onStageChange,
  onSelectId,
  selectedId,
  highlightedId,
  onHighlightId,
  onConnectScroll,
  onIntroComplete,
  onIntroSprout,
  onAboutTextReveal,
  skipIntro,
  reducedMotion,
  introTitleRef,
  aboutTextRef,
  chapterTextRef,
}: PineSceneProps) {
  const [nodesReady, setNodesReady] = useState(false);
  const handleIntroComplete = useCallback(() => {
    setNodesReady(true);
    onIntroComplete();
  }, [onIntroComplete]);
  const intro = useMemo(() => createIntroTimeline(), []);

  return (
    <Canvas
      camera={{ position: [1.48, 1.05, 14.2], fov: 38, near: 0.1, far: 180 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      performance={{ min: 0.6 }}
    >
      <color attach="background" args={["#f9f8f6"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-6, 9, 8]} intensity={1.4} color="#fffaf2" />
      <directionalLight position={[6, 3, -5]} intensity={0.45} color="#9d9a96" />
      <IntroSequence intro={intro} titleRef={introTitleRef} skip={skipIntro} />
      <IntroSproutWatcher intro={intro} onSprout={onIntroSprout} />
      <SeedParticle intro={intro} />
      <ImpactSplash intro={intro} />
      {/* Only the HDR glow nodes exceed a luminance of 1; the paper and ink stay out of the bloom pass. */}
      <EffectComposer multisampling={0} resolutionScale={0.75}>
        <Bloom
          intensity={0.7}
          luminanceThreshold={1}
          luminanceSmoothing={0.2}
          mipmapBlur
          resolutionScale={0.6}
        />
      </EffectComposer>
      <ScrollControls pages={3} damping={0.16} maxSpeed={0.9} distance={1}>
        <TreeWithCamera
          intro={intro}
          nodesReady={nodesReady}
          onIntroComplete={handleIntroComplete}
          onAboutTextReveal={onAboutTextReveal}
          aboutTextRef={aboutTextRef}
          chapterTextRef={chapterTextRef}
          onStageChange={onStageChange}
          selectedId={selectedId}
          highlightedId={highlightedId}
          onHighlightId={onHighlightId}
          onSelectId={onSelectId}
          onConnectScroll={onConnectScroll}
          reducedMotion={reducedMotion}
        />
      </ScrollControls>
    </Canvas>
  );
}

// Tells the page once the tree starts drawing, so the header (and with it the name) can arrive with the tree.
function IntroSproutWatcher({ intro, onSprout }: { intro: IntroTimeline; onSprout: () => void }) {
  const notified = useRef(false);
  useFrame(() => {
    if (notified.current || (intro.phase !== "sprout" && intro.phase !== "complete")) return;
    notified.current = true;
    onSprout();
  });
  return null;
}

// Lives inside the Canvas so the tree geometry is only built in the browser, never during server rendering.
function TreeWithCamera({
  intro,
  nodesReady,
  onIntroComplete,
  onAboutTextReveal,
  aboutTextRef,
  chapterTextRef,
  onStageChange,
  selectedId,
  highlightedId,
  onHighlightId,
  onSelectId,
  onConnectScroll,
  reducedMotion,
}: {
  intro: IntroTimeline;
  nodesReady: boolean;
  onIntroComplete: () => void;
  onAboutTextReveal: () => void;
  aboutTextRef: { current: HTMLElement | null };
  chapterTextRef: { current: HTMLElement | null };
  onStageChange: (stage: StageName) => void;
  selectedId: string | null;
  highlightedId: string | null;
  onHighlightId: (id: string | null) => void;
  onSelectId: (id: string | null) => void;
  onConnectScroll: (scrollToStage: (stage: StageName) => void) => void;
  reducedMotion: boolean;
}) {
  const geometry = useMemo(() => buildPineGeometry(), []);
  const nodes = useMemo(() => createPortfolioNodes(geometry), [geometry]);
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;
  const onSelectNode = useCallback((node: PortfolioNode | null) => onSelectId(node?.id ?? null), [onSelectId]);

  return (
    <>
      <CameraController
        intro={intro}
        nodes={nodes}
        onIntroComplete={onIntroComplete}
        onAboutTextReveal={onAboutTextReveal}
        aboutTextRef={aboutTextRef}
        chapterTextRef={chapterTextRef}
        onStageChange={onStageChange}
        selectedNode={selectedNode}
        onSelectNode={onSelectNode}
        onConnectScroll={onConnectScroll}
        reducedMotion={reducedMotion}
      />
      <InkLandscape intro={intro} reducedMotion={reducedMotion} />
      <PineTree
        intro={intro}
        geometry={geometry}
        nodes={nodes}
        nodesReady={nodesReady}
        selectedNode={selectedNode}
        highlightedId={highlightedId}
        onHighlightId={onHighlightId}
        onSelectNode={onSelectNode}
      />
    </>
  );
}
