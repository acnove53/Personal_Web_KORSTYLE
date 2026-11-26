"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { selfPortrait, tmiCards } from "@/content/portfolio";

const tilts = [-2.4, 1.8, -1.2, 2.6, -1.9];

// What the camera finds inside the hollow: a small lit room. The owner in a round window, and a handful of
// photographs pinned to paper; pick one to read the story behind it.
export function HollowStage({ onClose, reducedMotion }: { onClose: () => void; reducedMotion: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const polaroidRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastOpened = useRef(0);
  const first = useRef(true);
  const lead = reducedMotion ? 0 : 0.85;
  const card = index === null ? null : tmiCards[index];

  const go = useCallback((step: number) => {
    setIndex((value) => (value === null ? value : (value + step + tmiCards.length) % tmiCards.length));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Focus follows the view: the heading when the room opens or a story opens, the photo you came from when going back.
  useEffect(() => {
    if (index !== null) lastOpened.current = index;
    const wait = first.current ? lead * 1000 + 450 : 0;
    const timer = window.setTimeout(() => {
      if (index === null && !first.current) polaroidRefs.current[lastOpened.current]?.focus({ preventScroll: true });
      else headingRef.current?.focus({ preventScroll: true });
      first.current = false;
    }, wait);
    return () => window.clearTimeout(timer);
  }, [index, lead]);

  const rise = (delay: number) => ({
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(10px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { delay, duration: reducedMotion ? 0.2 : 0.55, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  });

  return (
    <motion.div
      className="hollow-stage"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tmi-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: lead, duration: reducedMotion ? 0.2 : 0.6 } }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <motion.figure
        className="hollow-figure"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 22, filter: "blur(14px)" }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { delay: lead + 0.15, duration: reducedMotion ? 0.2 : 0.9, ease: [0.22, 1.15, 0.36, 1] },
        }}
        exit={{ opacity: 0, scale: 0.94, filter: "blur(10px)", transition: { duration: 0.3 } }}
      >
        <div className="moon-window">
          <img src={selfPortrait.src} alt={selfPortrait.alt} draggable={false} />
        </div>
        <figcaption>
          <span>Jinyoung Daniel Jeon</span>
          <i className="name-seal" aria-hidden="true">전</i>
        </figcaption>
      </motion.figure>

      <motion.aside
        className="tmi-card"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 36, filter: "blur(14px)" }}
        animate={{
          opacity: 1,
          x: 0,
          filter: "blur(0px)",
          transition: { delay: lead + 0.5, duration: reducedMotion ? 0.2 : 0.6, ease: [0.22, 1, 0.36, 1] },
        }}
        exit={{ opacity: 0, x: 20, filter: "blur(10px)", transition: { duration: 0.3 } }}
      >
        <div className="detail-topline">
          <span className="detail-index">A FEW THINGS ABOUT ME</span>
          <button className="detail-close" type="button" onClick={onClose} aria-label="Close and leave the hollow">
            <span>CLOSE</span><i aria-hidden="true">×</i>
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {card === null || index === null ? (
            <motion.div key="board" {...rise(0)}>
              <h2 id="tmi-title" ref={headingRef} tabIndex={-1}>Pick a photo.</h2>
              <p className="tmi-text">Five small things that are not on a résumé.</p>
              <ul className="tmi-board">
                {tmiCards.map((item, i) => {
                  const cover = item.photos?.[0];
                  return (
                    <li key={item.title}>
                      <button
                        ref={(node) => { polaroidRefs.current[i] = node; }}
                        type="button"
                        className="tmi-polaroid"
                        style={{ "--tilt": `${tilts[i % tilts.length]}deg` } as React.CSSProperties}
                        onClick={() => setIndex(i)}
                      >
                        {cover && <img src={cover.src} alt="" loading="lazy" decoding="async" draggable={false} />}
                        <span>{item.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ) : (
            <motion.div key={`card-${index}`} {...rise(0)}>
              <p className="tmi-count">
                <button className="tmi-back" type="button" onClick={() => setIndex(null)}>
                  <span aria-hidden="true">←</span> ALL PHOTOS
                </button>
                <span>{String(index + 1).padStart(2, "0")} / {String(tmiCards.length).padStart(2, "0")}</span>
              </p>
              <h2 id="tmi-title" ref={headingRef} tabIndex={-1}>{card.title}</h2>
              <p className="tmi-text">{card.text}</p>
              {card.photos && (
                <ul className="tmi-photos" aria-label="Photos">
                  {card.photos.map((item) => (
                    <li key={item.src}>
                      <img src={item.src} alt={item.alt} loading="lazy" decoding="async" draggable={false} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="detail-pager">
                <button type="button" onClick={() => go(-1)} aria-label="Previous">
                  <span aria-hidden="true">←</span> PREV
                </button>
                <span aria-hidden="true">{index + 1} / {tmiCards.length}</span>
                <button type="button" onClick={() => go(1)} aria-label="Next">
                  NEXT <span aria-hidden="true">→</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </motion.div>
  );
}
