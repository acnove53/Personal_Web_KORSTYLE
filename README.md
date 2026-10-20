# Jinyoung Daniel Jeon — Interactive Portfolio

A Next.js App Router portfolio with a React Three Fiber ink-wash pine scene. The scene starts at the trunk (About); scrolling upward reveals project nodes in the canopy, and scrolling downward reveals experience nodes among the exposed roots. Clicking a node focuses the camera and opens its field note.

Visitors can skip the intro, and it is skipped automatically for anyone whose system prefers reduced motion. Without WebGL the page falls back to a plain HTML version of the same content, which is also always present for screen readers and search engines.

## Getting started

This project uses [pnpm](https://pnpm.io/) (version pinned in `package.json`).

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`.

## Editing content

All text lives in [`content/portfolio.ts`](content/portfolio.ts): the About summary, chapter copy, projects, experience, and contact details. Before publishing, replace the placeholder email (`hello@jinyoungjeon.dev`) and add any profile links there.

## Project layout

- `app/` — layout (fonts, metadata), page, global styles, favicon
- `components/pine-portfolio.tsx` — HTML overlay: header, chapter navigation, About panel, field-note card, fallback view
- `components/pine-scene.tsx` — the R3F `Canvas`, lights, bloom, and scroll container
- `components/scene/` — scene pieces: intro sequence and ink splash, camera controller, mountains, tree geometry, ink shaders, tree and glow nodes

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS 4 (base reset) with bespoke paper-and-ink styles
- React Three Fiber, Drei `ScrollControls` and `Html`, postprocessing bloom
- GSAP for the intro timeline, Framer Motion for chapter and field-note transitions

The tree, mountains, and brush textures are generated procedurally at runtime, so the scene does not depend on external model or image assets.
