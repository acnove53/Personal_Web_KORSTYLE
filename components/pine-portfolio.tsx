"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  aboutSummary,
  contact,
  portfolioEntries,
  role,
  stageCopy,
  type PortfolioEntry,
  type StageName,
} from "@/content/portfolio";

const stageOrder: { stage: StageName; label: string }[] = [
  { stage: "branches", label: "Projects" },
  { stage: "trunk", label: "About" },
  { stage: "roots", label: "Experience" },
];

// three.js, R3F and the scene load as their own chunk, so the page shell and its text don't wait on them.
const PineScene = dynamic(() => import("@/components/pine-scene").then((mod) => mod.PineScene), { ssr: false });

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const introTitle = "A Study in Systems";
const fullName = "Jinyoung Daniel Jeon";

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

// A reload or return within the same browser session goes straight to the finished painting.
const introSeenKey = "pine-intro-seen";
let introSeenAtLoad: boolean | undefined;

function readIntroSeen() {
  if (introSeenAtLoad === undefined) {
    try {
      introSeenAtLoad = window.sessionStorage.getItem(introSeenKey) === "1";
    } catch {
      introSeenAtLoad = false;
    }
  }
  return introSeenAtLoad;
}

function useIntroSeen() {
  return useSyncExternalStore(subscribeNever, readIntroSeen, () => false);
}

function rememberIntroSeen() {
  try {
    window.sessionStorage.setItem(introSeenKey, "1");
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the intro simply plays again.
  }
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
  const returnFocusId = useRef<string | null>(null);
  const [stage, setStage] = useState<StageName>("trunk");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [scrollToStage, setScrollToStage] = useState<((stage: StageName) => void) | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [aboutTextRevealed, setAboutTextRevealed] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [introSprouted, setIntroSprouted] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const introSeen = useIntroSeen();
  const webglSupported = useWebglSupport();
  const skipIntro = introSkipped || reducedMotion || introSeen;
  const showScene = webglSupported && !sceneFailed;
  const selected = portfolioEntries.find((entry) => entry.id === selectedId) ?? null;

  const connectScroll = useCallback((scroll: (stage: StageName) => void) => {
    setScrollToStage(() => scroll);
  }, []);

  const openEntry = useCallback((id: string | null) => {
    if (id) returnFocusId.current = id;
    setHighlightedId(null);
    setSelectedId(id);
  }, []);

  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Closing a field note hands focus back to the entry that opened it, once the chapter list is back.
  const closeEntry = useCallback(() => {
    if (!selectedIdRef.current) return;
    setSelectedId(null);
    const id = returnFocusId.current;
    if (!id) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-entry-id="${id}"]`)?.focus({ preventScroll: true });
    }));
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEntry();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeEntry]);

  const handleAboutTextReveal = useCallback(() => {
    setAboutTextRevealed(true);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setSceneReady(true);
    rememberIntroSeen();
  }, []);

  const handleIntroSprout = useCallback(() => {
    setIntroSprouted(true);
  }, []);

  const shellState = showScene
    ? `${sceneReady ? "scene-ready" : ""} ${introSprouted ? "intro-sprouted" : ""}`
    : "scene-ready scene-fallback";
  const nameHeadingShown = showScene && !selected && stage === "trunk";

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className={`portfolio-shell ${shellState}`}>
        <div className="scene-backdrop" aria-hidden="true" />

        <header className="site-header">
          <a className="wordmark" href="#top" aria-label={`${fullName}, home`}>
            <span className="wordmark-mark" aria-hidden="true"><span>J</span><span>J</span></span>
            <span className="wordmark-copy">
              <strong>JINYOUNG DANIEL JEON</strong>
              <small>SOFTWARE · AI · SYSTEMS</small>
            </span>
          </a>
          <div className="header-right">
            <span className="availability"><i aria-hidden="true" /> OPEN TO OPPORTUNITIES</span>
            <a className="contact-link" href={`mailto:${contact.email}`}>
              GET IN TOUCH <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        <nav className="stage-index" aria-label="Chapters">
          <p className="index-caption" aria-hidden="true">FIELD NOTES <span>2026</span></p>
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
              <span className="stage-link-dot" aria-hidden="true" />
            </button>
          ))}
          <div className="index-bottom" aria-hidden="true">SCROLL TO<br />MOVE THROUGH THE TREE</div>
        </nav>

        <main className="portfolio-main">
          {showScene ? (
            <div className="canvas-wrap" aria-label="Interactive ink-wash pine tree portfolio scene">
              <SceneErrorBoundary onError={() => setSceneFailed(true)}>
                <PineScene
                  onStageChange={setStage}
                  onSelectId={openEntry}
                  selectedId={selectedId}
                  highlightedId={highlightedId}
                  onHighlightId={setHighlightedId}
                  onConnectScroll={connectScroll}
                  onIntroComplete={handleIntroComplete}
                  onIntroSprout={handleIntroSprout}
                  onAboutTextReveal={handleAboutTextReveal}
                  skipIntro={skipIntro}
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

          {showScene && !nameHeadingShown && <h1 className="sr-only">{fullName}</h1>}

          {showScene && (
            <section className="sr-only" aria-label="Portfolio index">
              <PortfolioIndex />
            </section>
          )}

          {showScene && !selected && stage === "trunk" && (
            // The layer centres the text; the section itself is left free for the reveal's transform.
            <div className="about-layer">
              <section
                ref={aboutTextRef}
                className={`chapter-trunk ${aboutTextRevealed ? "" : "chapter-intro-pending"}`}
                aria-hidden={!aboutTextRevealed}
              >
                <ChapterContent stage="trunk" scrollToStage={scrollToStage} onOpen={openEntry} highlightedId={null} onHighlight={setHighlightedId} />
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
                <ChapterContent stage={stage} scrollToStage={scrollToStage} onOpen={openEntry} highlightedId={highlightedId} onHighlight={setHighlightedId} />
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selected && (
              <DetailCard key="field-note" entry={selected} onClose={closeEntry} onOpen={openEntry} />
            )}
          </AnimatePresence>
        </main>

        <div className="paper-grain" aria-hidden="true" />
        <div className="edge-vignette" aria-hidden="true" />

        <div className="scene-caption" aria-hidden="true">
          <span className="caption-line" />
          <span>{stage === "branches" ? "THE CANOPY" : stage === "roots" ? "THE ROOT SYSTEM" : "THE LIVING STRUCTURE"}</span>
          <span className="caption-coordinates">SEOUL&nbsp; 37°33′ N&nbsp; 126°58′ E</span>
        </div>

        <div className="scroll-cue" aria-hidden="true">
          <span className="scroll-cue-label">SCROLL</span>
          <span className="scroll-cue-track"><i /></span>
          <span className="scroll-cue-directions">↑ PROJECTS<br />↓ EXPERIENCE</span>
        </div>

        <div ref={introTitleRef} className="intro-title" aria-hidden="true">
          {/* Each letter carries an ink dot: the intro condenses the letters into dots that run together into the drop. */}
          <span className="intro-line">
            {Array.from(introTitle).map((character, index) => (
              character === " "
                ? <span key={index} className="intro-space"> </span>
                : (
                  <span key={index} className="intro-letter">
                    <span className="intro-glyph">{character}</span>
                    <i className="intro-dot" />
                  </span>
                )
            ))}
          </span>
        </div>

        {showScene && !sceneReady && !skipIntro && (
          <button className="skip-intro" type="button" onClick={() => setIntroSkipped(true)}>
            SKIP INTRO <span aria-hidden="true">→</span>
          </button>
        )}

        <footer className="site-footer">
          <span>© 2026 {fullName.toUpperCase()}</span>
          <span className="footer-center" aria-hidden="true">FROM ROOTS TO REASONING</span>
          <span className="footer-links">
            {contact.links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label.toUpperCase()} ↗</a>
            ))}
            <a href={`mailto:${contact.email}`}>SAY HELLO ↗</a>
          </span>
        </footer>
      </div>
    </MotionConfig>
  );
}

function ChapterContent({ stage, scrollToStage, onOpen, highlightedId, onHighlight }: {
  stage: StageName;
  scrollToStage: ((stage: StageName) => void) | null;
  highlightedId: string | null;
  onOpen: (id: string) => void;
  onHighlight: (id: string | null) => void;
}) {
  const copy = stageCopy[stage];
  const eyebrow = (
    <p className="eyebrow">
      <span className="eyebrow-mark" aria-hidden="true">{copy.mark}</span>
      <span aria-hidden="true">/</span>
      {copy.chapter}
    </p>
  );

  if (stage === "trunk") {
    return (
      <>
        {eyebrow}
        <h1>Jinyoung<br />Daniel Jeon<span className="title-period" aria-hidden="true">.</span></h1>
        <p className="hero-role">{role}</p>
        <p className="chapter-tagline">{copy.note}</p>
        <p className="hero-summary">{aboutSummary}</p>
        <div className="hero-actions">
          <button className="text-action" type="button" onClick={() => scrollToStage?.("branches")}>
            <span aria-hidden="true">↑</span> PROJECTS
          </button>
          <button className="text-action" type="button" onClick={() => scrollToStage?.("roots")}>
            <span aria-hidden="true">↓</span> EXPERIENCE
          </button>
        </div>
        <p className="hero-meta">
          ATLANTA, GA <span aria-hidden="true">·</span> GEORGIA TECH CS ’27
          {contact.links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label.toUpperCase()} ↗</a>
          ))}
        </p>
      </>
    );
  }

  const entries = portfolioEntries.filter((entry) => entry.stage === stage);
  // Projects sit above About and Experience below it, so each chapter points to the other.
  const other = stage === "branches"
    ? { stage: "roots" as const, arrow: "↓", label: "EXPERIENCE" }
    : { stage: "branches" as const, arrow: "↑", label: "PROJECTS" };
  return (
    <>
      {eyebrow}
      <h2>{copy.title}</h2>
      <p className="chapter-tagline">{copy.note}</p>
      <ol className="chapter-list" onMouseLeave={() => onHighlight(null)}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={highlightedId === entry.id ? "is-highlighted" : undefined}
              data-entry-id={entry.id}
              onClick={() => onOpen(entry.id)}
              onMouseEnter={() => onHighlight(entry.id)}
              onFocus={() => onHighlight(entry.id)}
              onBlur={() => onHighlight(null)}
            >
              <span className="chapter-list-number">{entry.number}</span>
              <span className="chapter-list-title">{entry.short}</span>
              <span className="chapter-list-kind">{entry.category.split(" · ")[0]}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="hero-actions chapter-next">
        <button className="text-action" type="button" onClick={() => scrollToStage?.(other.stage)}>
          <span aria-hidden="true">{other.arrow}</span> {other.label}
        </button>
      </div>
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
          <h1>{fullName}</h1>
          <p className="index-tagline">{role} · {stageCopy.trunk.note}</p>
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
              {entry.link && <a href={entry.link.href} target="_blank" rel="noreferrer">{entry.link.label} ↗</a>}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function DetailCard({ entry, onClose, onOpen }: {
  entry: PortfolioEntry;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const siblings = portfolioEntries.filter((item) => item.stage === entry.stage);
  const index = siblings.findIndex((item) => item.id === entry.id);
  const previous = siblings[(index - 1 + siblings.length) % siblings.length];
  const next = siblings[(index + 1) % siblings.length];

  // Focus follows the note: on open, and again when paging to the previous or next one.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [entry.id]);

  return (
    <motion.aside
      className="detail-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="detail-title"
      initial={{ opacity: 0, x: 36, filter: "blur(14px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 20, filter: "blur(10px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="detail-topline">
        <span className="detail-index">FIELD NOTE {entry.number}</span>
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close field note">
          <span>CLOSE</span><i aria-hidden="true">×</i>
        </button>
      </div>
      <p className="detail-category">{entry.category}</p>
      <h2 id="detail-title" ref={headingRef} tabIndex={-1}>{entry.title}</h2>
      <div className="detail-divider" aria-hidden="true"><span>•</span></div>
      <p className="detail-description">{entry.description}</p>
      {entry.highlights && (
        <ul className="detail-highlights">
          {entry.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
        </ul>
      )}
      <div className="detail-bottom">
        <span className="detail-stack-label">TOOLS / METHODS</span>
        <div className="detail-stack">
          {entry.stack.map((item) => <span key={item}>{item}</span>)}
        </div>
        {entry.link && (
          <a className="detail-link" href={entry.link.href} target="_blank" rel="noreferrer">
            {entry.link.label} <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      <div className="detail-watermark" aria-hidden="true">{entry.number}</div>
      <div className="detail-pager">
        <button type="button" onClick={() => onOpen(previous.id)} aria-label={`Previous: ${previous.title}`}>
          <span aria-hidden="true">←</span> {previous.short}
        </button>
        <span aria-hidden="true">{index + 1} / {siblings.length}</span>
        <button type="button" onClick={() => onOpen(next.id)} aria-label={`Next: ${next.title}`}>
          {next.short} <span aria-hidden="true">→</span>
        </button>
      </div>
    </motion.aside>
  );
}
