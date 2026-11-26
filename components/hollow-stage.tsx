"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { selfPortrait, tmiCards } from "@/content/portfolio";

// What the camera finds inside the hollow: the owner, drawn in ink, and a few personal things on cards.
export function HollowStage({ onClose, reducedMotion }: { onClose: () => void; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const card = tmiCards[index];
  const lead = reducedMotion ? 0 : 0.85;

  const go = useCallback((step: number) => {
    setIndex((value) => (value + step + tmiCards.length) % tmiCards.length);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Focus follows the card: when it opens, and again when paging.
  useEffect(() => {
    const timer = window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), index === 0 ? lead * 1000 + 450 : 0);
    return () => window.clearTimeout(timer);
  }, [index, lead]);

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
      <motion.div
        className="hollow-figure"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 26, filter: "blur(16px)" }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { delay: lead + 0.15, duration: reducedMotion ? 0.2 : 0.95, ease: [0.22, 1.2, 0.36, 1] },
        }}
        exit={{ opacity: 0, scale: 0.92, filter: "blur(10px)", transition: { duration: 0.3 } }}
      >
        <div className="ink-portrait">
          <img src={selfPortrait.src} alt={selfPortrait.alt} draggable={false} />
        </div>
      </motion.div>

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
        <p className="tmi-count">{String(index + 1).padStart(2, "0")} / {String(tmiCards.length).padStart(2, "0")}</p>
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
      </motion.aside>
    </motion.div>
  );
}
