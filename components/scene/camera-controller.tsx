"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";
import type { StageName } from "@/content/portfolio";
import { computeFraming, type ScreenRect } from "./framing";
import type { IntroTimeline } from "./intro";
import { smoothStep } from "./math";
import type { PortfolioNode } from "./types";

const treeOrigin = new THREE.Vector3(1.45, -2.8, 0);

export function CameraController({
  intro,
  nodes,
  onIntroComplete,
  onAboutTextReveal,
  aboutTextRef,
  chapterTextRef,
  onStageChange,
  selectedNode,
  onSelectNode,
  onConnectScroll,
  reducedMotion,
}: {
  intro: IntroTimeline;
  nodes: PortfolioNode[];
  onIntroComplete: () => void;
  onAboutTextReveal: () => void;
  aboutTextRef: { current: HTMLElement | null };
  chapterTextRef: { current: HTMLElement | null };
  onStageChange: (stage: StageName) => void;
  selectedNode: PortfolioNode | null;
  onSelectNode: (node: PortfolioNode | null) => void;
  onConnectScroll: (scrollToStage: (stage: StageName) => void) => void;
  reducedMotion: boolean;
}) {
  const scroll = useScroll();
  const lastStage = useRef<StageName>("trunk");
  const introCompleteNotified = useRef(false);
  const introZoomStarted = useRef(false);
  const introZoomTimeline = useRef<gsap.core.Timeline | null>(null);
  const zoom = useRef(0);
  const rawScrollOffset = useRef(0.5);
  const focusNode = useRef<PortfolioNode | null>(null);
  const dismissedNode = useRef<string | null>(null);
  const baseCamera = useMemo(() => new THREE.Vector3(), []);
  const baseTarget = useMemo(() => new THREE.Vector3(), []);
  const focusedCamera = useMemo(() => new THREE.Vector3(), []);
  const focusedTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const framing = useMemo(() => new THREE.Vector3(), []);
  const textRects = useRef<Partial<Record<StageName, ScreenRect>>>({});
  const lastTextMeasure = useRef(-1);
  const stagePoints = useMemo(() => {
    const branches = nodes.filter((node) => node.stage === "branches").map((node) => new THREE.Vector3(...node.position).add(treeOrigin));
    const roots = nodes.filter((node) => node.stage === "roots").map((node) => new THREE.Vector3(...node.position).add(treeOrigin));
    // The About view frames the whole tree, crown to roots, beside the name.
    return { branches, roots, trunk: [...branches, ...roots] };
  }, [nodes]);

  useEffect(() => () => {
    introZoomTimeline.current?.kill();
  }, []);

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
    // The chapter links are the keyboard route; the scroll container itself shouldn't be an unnamed Tab stop.
    element.tabIndex = -1;
    element.addEventListener("scroll", syncScrollInput, { passive: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(centerAtTrunk));
    onConnectScroll((stage) => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      const target = stage === "branches" ? 0.04 : stage === "trunk" ? 0.5 : 0.96;
      if (maxScroll > 0) element.scrollTo({ top: maxScroll * target, behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", syncScrollInput);
    };
  }, [onConnectScroll, reducedMotion, scroll.el]);

  useFrame(({ camera, gl, size, clock }, delta) => {
    // Scrolling is held at the trunk until the intro has landed on About: scrolling away
    // mid-intro would otherwise keep the About zoom (and with it the whole interface) from starting.
    if (!introCompleteNotified.current) {
      const element = scroll.el;
      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll > 0 && Math.abs(element.scrollTop - maxScroll * 0.5) > 1) element.scrollTop = maxScroll * 0.5;
      rawScrollOffset.current = 0.5;
    }
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
    // Piecewise so the trunk view (offset 0.5) stays at 1.05, where the intro and About zoom line up.
    const cameraY = offset < 0.5
      ? THREE.MathUtils.lerp(3.6, 1.05, offset / 0.5)
      : THREE.MathUtils.lerp(1.05, -2.4, (offset - 0.5) / 0.5);
    // The About zoom waits for the landscape to finish inking in around the drawn tree.
    const centered = stage === "trunk" && Math.abs(offset - 0.5) < 0.16 && intro.backgroundReveal >= 0.98;
    if (intro.instant && introZoomTimeline.current?.isActive()) {
      introZoomTimeline.current.progress(1);
      introZoomTimeline.current = null;
      if (aboutTextRef.current) gsap.set(aboutTextRef.current, { autoAlpha: 1, y: 0, filter: "blur(0px)" });
      onAboutTextReveal();
    }
    if (intro.complete && centered && !introZoomStarted.current && intro.instant) {
      introZoomStarted.current = true;
      intro.cameraZoom = 1;
      if (aboutTextRef.current) gsap.set(aboutTextRef.current, { autoAlpha: 1, y: 0, filter: "blur(0px)" });
      onAboutTextReveal();
    }
    if (intro.complete && centered && !introZoomStarted.current) {
      introZoomStarted.current = true;
      const timeline = gsap.timeline();
      timeline.to(intro, {
        cameraZoom: 1,
        duration: 1.35,
        ease: "power2.inOut",
      });
      if (aboutTextRef.current) {
        timeline.to(aboutTextRef.current, {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.37,
          ease: "power2.out",
          onStart: onAboutTextReveal,
        }, "<0.98");
      }
      introZoomTimeline.current = timeline;
    }
    const trunkProximity = 1 - smoothStep(0.015, 0.18, Math.abs(offset - 0.5));
    const trunkZoom = intro.cameraZoom * trunkProximity;
    const cameraX = 1.48;
    const cameraZ = 14.2;

    // Pan and pull back so the tree (and in the canopy and roots views, every dot) clears the chapter text.
    if (clock.elapsedTime - lastTextMeasure.current > 0.25) {
      lastTextMeasure.current = clock.elapsedTime;
      const canvasRect = gl.domElement.getBoundingClientRect();
      for (const textElement of [chapterTextRef.current, aboutTextRef.current]) {
        if (!textElement) continue;
        const measuredStage = (["branches", "trunk", "roots"] as const).find((name) => textElement.classList.contains(`chapter-${name}`));
        if (!measuredStage) continue;
        const rect = textElement.getBoundingClientRect();
        textRects.current[measuredStage] = {
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          right: rect.right - canvasRect.left,
          bottom: rect.bottom - canvasRect.top,
        };
      }
    }
    const fullFraming = !intro.complete
      ? { x: 0, y: 0, z: 0 }
      : computeFraming({
        points: stagePoints[stage],
        cameraX,
        cameraY,
        cameraZ,
        fov: (camera as THREE.PerspectiveCamera).fov,
        width: size.width,
        height: size.height,
        textRect: textRects.current[stage] ?? null,
      });
    // At About, the intro's closing move is this pan: the camera slides aside to make room for the name.
    const framingWeight = stage === "trunk" ? intro.cameraZoom : 1;
    framing.x = THREE.MathUtils.damp(framing.x, fullFraming.x * framingWeight, 3, delta);
    framing.y = THREE.MathUtils.damp(framing.y, fullFraming.y * framingWeight, 3, delta);
    framing.z = THREE.MathUtils.damp(framing.z, fullFraming.z * framingWeight, 3, delta);

    baseCamera.set(cameraX + framing.x, cameraY + framing.y, cameraZ + framing.z);
    baseTarget.set(cameraX + framing.x, cameraY + framing.y, 0);
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

    if (intro.instant && !introCompleteNotified.current) {
      camera.position.copy(cameraPosition);
    } else {
      const cameraDamping = introZoomStarted.current && !introCompleteNotified.current ? 16 : 5;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraPosition.x, cameraDamping, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraPosition.y, cameraDamping, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraPosition.z, cameraDamping, delta);
    }
    camera.lookAt(lookTarget);

    // Keep every node hidden until the trunk zoom has reached its target and
    // the camera itself has settled. Nodes become available on later scrolls.
    const framingSettled = Math.abs(framing.x - fullFraming.x * framingWeight)
      + Math.abs(framing.y - fullFraming.y * framingWeight)
      + Math.abs(framing.z - fullFraming.z * framingWeight) < 0.03;
    const cameraSettled = framingSettled && camera.position.distanceTo(cameraPosition) < 0.02;
    if (!introCompleteNotified.current && intro.complete && centered && trunkZoom > 0.999 && cameraSettled) {
      introCompleteNotified.current = true;
      onIntroComplete();
    }
  });

  return null;
}
