import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // three.js objects are mutable by design: R3F scenes update memoized materials,
    // geometries and shared timeline state inside useFrame and effects every frame.
    files: ["components/pine-scene.tsx", "components/scene/**"],
    rules: { "react-hooks/immutability": "off" },
  },
  {
    // The personal photos are resized once into public/tmi, and the site is a static export where next/image
    // cannot optimise anything at request time, so plain <img> is the right tool.
    files: ["components/pine-portfolio.tsx", "components/hollow-stage.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
