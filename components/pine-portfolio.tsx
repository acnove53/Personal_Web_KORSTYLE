"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { PineScene, type PortfolioNode, type StageName } from "@/components/pine-scene";

const stageCopy: Record<StageName, { chapter: string; title: string; note: string }> = {
  branches: {
    chapter: "04 / CANOPY",
    title: "Ideas take shape.",
    note: "Selected work · five projects grown from the same root system.",
  },
  trunk: {
    chapter: "03 / TRUNK",
    title: "Jinyoung Daniel Jeon",
    note: "Bridging the gap between hardware and intelligence.",
  },
  roots: {
    chapter: "02 / ROOTS",
    title: "Built on understanding.",
    note: "Experience · the people, systems, and disciplines beneath the work.",
  },
};

const stageOrder: { stage: StageName; number: string; label: string }[] = [
  { stage: "branches", number: "04", label: "Projects" },
  { stage: "trunk", number: "03", label: "About" },
  { stage: "roots", number: "02", label: "Experience" },
];

export function PinePortfolio() {
  const [stage, setStage] = useState<StageName>("trunk");
  const [selected, setSelected] = useState<PortfolioNode | null>(null);
  const [scrollToStage, setScrollToStage] = useState<((stage: StageName) => void) | null>(null);

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

  return (
    <main id="top" className="portfolio-shell">
      <div className="scene-backdrop" aria-hidden="true" />
      <div className="canvas-wrap" aria-label="Interactive ink-wash pine tree portfolio scene">
        <PineScene
          onStageChange={setStage}
          onSelectNode={handleSelect}
          selectedNode={selected}
          onConnectScroll={connectScroll}
        />
      </div>

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
          <a className="contact-link" href="mailto:hello@jinyoungjeon.dev">
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
            <span className="stage-link-number">{item.number}</span>
            <span className="stage-link-name">{item.label}</span>
            <span className="stage-link-dot" />
          </button>
        ))}
        <div className="index-bottom">SCROLL TO<br />MOVE THROUGH THE TREE</div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!selected && (
          <motion.section
            key={stage}
            className={`chapter-intro chapter-${stage}`}
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow"><span className="eyebrow-seal">印</span>{stageCopy[stage].chapter}</p>
            <h1>{stage === "trunk" ? <>Jinyoung<br />Daniel Jeon<span className="title-period">.</span></> : stageCopy[stage].title}</h1>
            <p className="chapter-tagline">{stageCopy[stage].note}</p>
            {stage === "trunk" ? (
              <>
                <p className="hero-summary">
                  I am an engineer who seeks to understand low-level mechanisms before relying on
                  high-level applications. Just as I bridged languages and cultures as a KATUSA
                  interpreter, I now translate the strict rules of hardware into the flexible logic
                  of artificial intelligence. I build solid underlying structures and scalable
                  systems above them.
                </p>
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

      <div className="intro-fog" aria-hidden="true">
        <div className="fog-label"><span>一</span> A STUDY IN SYSTEMS</div>
      </div>

      <footer className="site-footer">
        <span>© 2026 JINYOUNG DANIEL JEON</span>
        <span className="footer-center">根から枝葉まで — FROM ROOTS TO REASONING</span>
        <a href="mailto:hello@jinyoungjeon.dev">SAY HELLO ↗</a>
      </footer>
    </main>
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
      onWheel={(event) => { if (Math.abs(event.deltaY) > 6) onClose(); }}
    >
      <div className="detail-topline">
        <span className="detail-index">FIELD NOTE / {node.number}</span>
        <button className="detail-close" onClick={onClose} aria-label="Close field note">
          <span>BACK</span><i aria-hidden="true">×</i>
        </button>
      </div>
      <p className="detail-category">{node.category}</p>
      <h2 id="detail-title">{node.title}</h2>
      <div className="detail-divider"><span>印</span></div>
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
