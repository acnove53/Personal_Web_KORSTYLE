"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PineScene, type PortfolioNode } from "@/components/pine-scene";
import {
  aboutSummary,
  contact,
  portfolioEntries,
  stageCopy,
  type PortfolioEntry,
  type StageName,
} from "@/content/portfolio";

const stageOrder: { stage: StageName; label: string }[] = [
  { stage: "branches", label: "Projects" },
  { stage: "trunk", label: "About" },
  { stage: "roots", label: "Experience" },
];

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

let webglSupport: boolean | undefined;

function detectWebgl() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const subscribeNever = () => () => {};

function useWebglSupport() {
  return useSyncExternalStore(subscribeNever, detectWebgl, () => true);
}

class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function PinePortfolio() {
  const introTitleRef = useRef<HTMLDivElement>(null);
  const aboutTextRef = useRef<HTMLElement>(null);
  const chapterTextRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<StageName>("trunk");
  const [selected, setSelected] = useState<PortfolioNode | null>(null);
  const [scrollToStage, setScrollToStage] = useState<((stage: StageName) => void) | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [aboutTextRevealed, setAboutTextRevealed] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const webglSupported = useWebglSupport();
  const showScene = webglSupported && !sceneFailed;

  const connectScroll = useCallback((scroll: (stage: StageName) => void) => {
    setScrollToStage(() => scroll);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleSelect = useCallback((node: PortfolioNode | null) => {
    setSelected(node);
  }, []);

  const handleAboutTextReveal = useCallback(() => {
    setAboutTextRevealed(true);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setSceneReady(true);
  }, []);

  const shellState = showScene ? (sceneReady ? "scene-ready" : "") : "scene-ready scene-fallback";

  return (
    <MotionConfig reducedMotion="user">
      <main id="top" className={`portfolio-shell ${shellState}`}>
        <div className="scene-backdrop" aria-hidden="true" />
        {showScene ? (
          <div className="canvas-wrap" aria-label="Interactive ink-wash pine tree portfolio scene">
            <SceneErrorBoundary onError={() => setSceneFailed(true)}>
              <PineScene
                onStageChange={setStage}
                onSelectNode={handleSelect}
                selectedNode={selected}
                onConnectScroll={connectScroll}
                onIntroComplete={handleIntroComplete}
                onAboutTextReveal={handleAboutTextReveal}
                skipIntro={introSkipped || reducedMotion}
                reducedMotion={reducedMotion}
                introTitleRef={introTitleRef}
                aboutTextRef={aboutTextRef}
                chapterTextRef={chapterTextRef}
              />
            </SceneErrorBoundary>
          </div>
        ) : (
          <div className="canvas-fallback">
            <p className="fallback-note">The interactive ink-wash scene needs WebGL, so here is the plain version.</p>
            <PortfolioIndex includeAbout />
          </div>
        )}

        {showScene && (
          <section className="sr-only" aria-label="Portfolio index">
            <PortfolioIndex />
          </section>
        )}

        <div className="paper-grain" aria-hidden="true" />
        <div className="edge-vignette" aria-hidden="true" />

        <header className="site-header">
          <a className="wordmark" href="#top" aria-label="Jinyoung Jeon, home">
            <span className="wordmark-mark">J<span>J</span></span>
            <span className="wordmark-copy">
              <strong>JINYOUNG JEON</strong>
              <small>SOFTWARE · AI · SYSTEMS</small>
            </span>
          </a>
          <div className="header-right">
            <span className="availability"><i /> OPEN TO OPPORTUNITIES</span>
            <a className="contact-link" href={`mailto:${contact.email}`}>
              GET IN TOUCH <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        <div className="stage-index" aria-label="Portfolio chapters">
          <p className="index-caption">FIELD NOTES <span>2026</span></p>
          <div className="index-rule" />
          {stageOrder.map((item) => (
            <button
              key={item.stage}
              className={`stage-link ${stage === item.stage ? "is-current" : ""}`}
              onClick={() => scrollToStage?.(item.stage)}
              aria-current={stage === item.stage ? "step" : undefined}
            >
              <span className="stage-link-number" aria-hidden="true">{stageCopy[item.stage].mark}</span>
              <span className="stage-link-name">{item.label}</span>
              <span className="stage-link-dot" />
            </button>
          ))}
          <div className="index-bottom">SCROLL TO<br />MOVE THROUGH THE TREE</div>
        </div>

        {showScene && !selected && stage === "trunk" && (
          <div className="about-overlay" aria-hidden={!aboutTextRevealed}>
            <section
              ref={aboutTextRef}
              className={`chapter-intro chapter-trunk ${aboutTextRevealed ? "" : "chapter-intro-pending"}`}
            >
              <ChapterContent stage="trunk" scrollToStage={scrollToStage} />
            </section>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {sceneReady && !selected && stage !== "trunk" && (
            <motion.section
              key={stage}
              ref={chapterTextRef}
              className={`chapter-intro chapter-${stage}`}
              initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <ChapterContent stage={stage} scrollToStage={scrollToStage} />
            </motion.section>
          )}
        </AnimatePresence>

        <div className="scene-caption" aria-live="polite">
          <span className="caption-line" />
          <span>{stage === "branches" ? "THE CANOPY" : stage === "roots" ? "THE ROOT SYSTEM" : "THE LIVING STRUCTURE"}</span>
          <span className="caption-coordinates">37°33′ N&nbsp; 126°58′ E</span>
        </div>

        <div className="scroll-cue" aria-hidden="true">
          <span className="scroll-cue-label">SCROLL</span>
          <span className="scroll-cue-track"><i /></span>
          <span className="scroll-cue-directions">↑ PROJECTS<br />↓ EXPERIENCE</span>
        </div>

        <AnimatePresence>
          {selected && (
            <DetailCard key={selected.id} node={selected} onClose={() => setSelected(null)} />
          )}
        </AnimatePresence>

        <div ref={introTitleRef} className="intro-title" aria-hidden="true">
          <span>A Study in Systems</span>
        </div>

        {showScene && !sceneReady && !introSkipped && !reducedMotion && (
          <button className="skip-intro" type="button" onClick={() => setIntroSkipped(true)}>
            SKIP INTRO <span aria-hidden="true">→</span>
          </button>
        )}

        <footer className="site-footer">
          <span>© 2026 JINYOUNG DANIEL JEON</span>
          <span className="footer-center">FROM ROOTS TO REASONING</span>
          <span className="footer-links">
            {contact.links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>
            ))}
            <a href={`mailto:${contact.email}`}>SAY HELLO ↗</a>
          </span>
        </footer>
      </main>
    </MotionConfig>
  );
}

function ChapterContent({ stage, scrollToStage }: {
  stage: StageName;
  scrollToStage: ((stage: StageName) => void) | null;
}) {
  return (
    <>
      <p className="eyebrow">
        <span className="eyebrow-seal" aria-hidden="true">•</span>
        <span className="eyebrow-mark" aria-hidden="true">{stageCopy[stage].mark}</span>
        <span aria-hidden="true">/</span>
        {stageCopy[stage].chapter}
      </p>
      <h1>{stage === "trunk" ? <>Jinyoung<br />Daniel Jeon<span className="title-period">.</span></> : stageCopy[stage].title}</h1>
      <p className="chapter-tagline">{stageCopy[stage].note}</p>
      {stage === "trunk" ? (
        <>
          <p className="hero-summary">{aboutSummary}</p>
          <div className="hero-actions">
            <button className="text-action" onClick={() => scrollToStage?.("branches")}>
              EXPLORE SELECTED WORK <span aria-hidden="true">↗</span>
            </button>
            <span className="hero-location">ATLANTA, GA <span>·</span> GT ’25</span>
          </div>
        </>
      ) : (
        <p className="chapter-prompt">Select a glowing mark to open its field note.</p>
      )}
    </>
  );
}

function PortfolioIndex({ includeAbout = false }: { includeAbout?: boolean }) {
  const groups: { stage: PortfolioEntry["stage"]; heading: string }[] = [
    { stage: "branches", heading: "Selected projects" },
    { stage: "roots", heading: "Experience" },
  ];
  return (
    <div className="portfolio-index">
      {includeAbout && (
        <section>
          <h1>Jinyoung Daniel Jeon</h1>
          <p className="index-tagline">{stageCopy.trunk.note}</p>
          <p>{aboutSummary}</p>
        </section>
      )}
      {groups.map((group) => (
        <section key={group.stage}>
          <h2>{group.heading}</h2>
          {portfolioEntries.filter((entry) => entry.stage === group.stage).map((entry) => (
            <article key={entry.id}>
              <p className="index-category">{entry.category}</p>
              <h3>{entry.title}</h3>
              <p>{entry.description}</p>
              {entry.highlights && (
                <ul>
                  {entry.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                </ul>
              )}
              <p className="index-stack">{entry.stack.join(" · ")}</p>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function DetailCard({ node, onClose }: { node: PortfolioNode; onClose: () => void }) {
  return (
    <motion.aside
      className="detail-card"
      initial={{ opacity: 0, x: 36, filter: "blur(14px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 20, filter: "blur(10px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="detail-title"
      onWheel={(event) => {
        const card = event.currentTarget;
        const scrollable = card.scrollHeight > card.clientHeight + 1;
        if (!scrollable && Math.abs(event.deltaY) > 6) onClose();
      }}
    >
      <div className="detail-topline">
        <span className="detail-index">FIELD NOTE / {node.number}</span>
        <button className="detail-close" onClick={onClose} aria-label="Close field note">
          <span>BACK</span><i aria-hidden="true">×</i>
        </button>
      </div>
      <p className="detail-category">{node.category}</p>
      <h2 id="detail-title">{node.title}</h2>
      <div className="detail-divider"><span aria-hidden="true">•</span></div>
      <p className="detail-description">{node.description}</p>
      {node.highlights && (
        <ul className="detail-highlights">
          {node.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
        </ul>
      )}
      <div className="detail-bottom">
        <span className="detail-stack-label">TOOLS / METHODS</span>
        <div className="detail-stack">
          {node.stack.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <div className="detail-watermark">{node.number}</div>
      <button className="detail-return" onClick={onClose}>
        <span aria-hidden="true">←</span> RETURN TO {node.stage === "branches" ? "CANOPY" : "ROOTS"}
      </button>
    </motion.aside>
  );
}
