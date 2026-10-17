# Jinyoung Daniel Jeon — Interactive Portfolio

A Next.js App Router portfolio foundation with a React Three Fiber ink-wash pine scene. The scene starts at the trunk; scrolling upward reveals project nodes in the canopy, and scrolling downward reveals experience nodes among the exposed roots. Clicking a node focuses the camera and opens its field note.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS 4 with bespoke paper-and-ink styles
- React Three Fiber, Drei `ScrollControls` and `CameraControls`
- Framer Motion for chapter and field-note transitions

The low-poly tree is assembled from tapered mesh strokes at runtime, so the scene does not depend on external model or image assets.

Before publishing, replace the example contact address (`hello@jinyoungjeon.dev`) with the preferred email address.
