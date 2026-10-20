export type StageName = "branches" | "trunk" | "roots";

export type PortfolioEntry = {
  id: string;
  number: string;
  title: string;
  category: string;
  description: string;
  stack: string[];
  highlights?: string[];
  stage: "branches" | "roots";
};

// TODO: replace the placeholder email and fill in any profile links before publishing.
export const contact: {
  email: string;
  links: { label: string; href: string }[];
} = {
  email: "hello@jinyoungjeon.dev",
  links: [
    // { label: "GITHUB", href: "https://github.com/..." },
    // { label: "LINKEDIN", href: "https://www.linkedin.com/in/..." },
  ],
};

// mark: 上 (top), 中 (middle), 下 (bottom) — where each chapter sits on the tree.
export const stageCopy: Record<StageName, { mark: string; chapter: string; title: string; note: string }> = {
  branches: {
    mark: "上",
    chapter: "CANOPY",
    title: "Ideas take shape.",
    note: "Selected work · five projects grown from the same root system.",
  },
  trunk: {
    mark: "中",
    chapter: "TRUNK",
    title: "Jinyoung Daniel Jeon",
    note: "Bridging the gap between hardware and intelligence.",
  },
  roots: {
    mark: "下",
    chapter: "ROOTS",
    title: "Built on understanding.",
    note: "Experience · the people, systems, and disciplines beneath the work.",
  },
};

export const aboutSummary =
  "I am an engineer who seeks to understand low-level mechanisms before relying on high-level applications. Just as I bridged languages and cultures as a KATUSA interpreter, I now translate the strict rules of hardware into the flexible logic of artificial intelligence. I build solid underlying structures and scalable systems above them.";

export const portfolioEntries: PortfolioEntry[] = [
  {
    id: "timeslips",
    number: "01",
    title: "TimeSlips AI-Integrated Mobile App",
    category: "CURRENT PROJECT · AI / CARE",
    description: "An AI coaching platform that helps care facilitators build more meaningful moments with people living with dementia. Designed around a calm mobile workflow, with serverless services supporting timely, context-aware guidance.",
    stack: ["React Native", "AWS Serverless", "AWS Bedrock"],
    highlights: ["Context-aware coaching for care facilitators", "Scalable cloud-native architecture"],
    stage: "branches",
  },
  {
    id: "travel-health",
    number: "02",
    title: "AI-Powered Travel Health Coach",
    category: "PERSONAL PROJECT · AI / HEALTH",
    description: "A context-aware recommendation agent that helps travelers make dietary and health choices with local context in mind. Prompt design connects itinerary, food, and personal needs into a practical coaching experience.",
    stack: ["Python", "LLMs", "Prompt Design"],
    stage: "branches",
  },
  {
    id: "neural-vision",
    number: "03",
    title: "Neural Networks & Vision Pipelines",
    category: "RESEARCH · MACHINE LEARNING",
    description: "From manually implementing backpropagation for a three-layer neural network in JAX to fine-tuning VGG19 on the PACE H100 cluster, these experiments explore how learning systems behave from the inside out.",
    stack: ["JAX", "VGG19", "PACE H100"],
    highlights: ["Classified 75 butterfly species", "Built backpropagation from scratch"],
    stage: "branches",
  },
  {
    id: "bytefight",
    number: "04",
    title: "ByteFight 2026 Autonomous Agent",
    category: "COMPETITION · AUTONOMOUS SYSTEMS",
    description: "A Python strategy agent that reasons about a changing game state and makes decisions under strict compute-time limits. Custom pathfinding heuristics help balance search depth with fast, reliable moves.",
    stack: ["Python", "Pathfinding", "Heuristics"],
    stage: "branches",
  },
  {
    id: "jobjoe",
    number: "05",
    title: "JobJoe",
    category: "TEAM PROJECT · WEB PLATFORM",
    description: "A Django platform for organizing the job search, backed by a carefully structured SQLite database. As Scrum Master, I coordinated the team through two-week sprints and kept delivery focused.",
    stack: ["Django", "SQLite", "Scrum"],
    highlights: ["Optimized relational data model", "Facilitated two-week sprint cycles"],
    stage: "branches",
  },
  {
    id: "northbound",
    number: "01",
    title: "NorthBound College",
    category: "FULL-STACK ENGINEER · CURRENT",
    description: "Engineered an AI-powered college admissions platform. I built typed data boundaries around model and API interactions so fast-moving product work could stay predictable and maintainable.",
    stack: ["Express", "PostgreSQL", "Gemini API", "Zod"],
    highlights: ["Enforced structured pipelines with Zod", "Documented APIs with OpenAPI 3.1"],
    stage: "roots",
  },
  {
    id: "katusa",
    number: "02",
    title: "19th ESC · U.S. Forces Korea",
    category: "KATUSA · SERGEANT",
    description: "Served as consecutive and simultaneous interpreter for the Command Sergeant Major. I bridged cultural gaps, supported leadership communications, and helped keep information moving across a force of more than 500 personnel.",
    stack: ["Interpretation", "Leadership", "Communication"],
    highlights: ["Supported communications for 500+ personnel", "Bridged Korean and U.S. military cultures"],
    stage: "roots",
  },
  {
    id: "georgia-tech",
    number: "03",
    title: "Georgia Institute of Technology",
    category: "B.S. COMPUTER SCIENCE · 2025",
    description: "Studied Computer Science with concentrations in Intelligence and Devices. Faculty Honors and a 3.92 GPA reflect a sustained interest in the boundary where software meets physical systems.",
    stack: ["Intelligence", "Devices", "Hardware / Software"],
    highlights: ["Faculty Honors · 3.92 / 4.00 GPA", "Focus on hardware-software co-design"],
    stage: "roots",
  },
];
