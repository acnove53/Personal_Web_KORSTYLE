import type { PortfolioEntry } from "@/content/portfolio";

export type PortfolioNode = PortfolioEntry & {
  position: [number, number, number];
};
