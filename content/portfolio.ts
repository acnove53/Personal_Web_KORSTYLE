export type StageName = "branches" | "trunk" | "roots";

export type PortfolioEntry = {
  id: string;
  number: string;
  title: string;
  /** A few words: the dot's label in the scene and the chapter list's lead. */
  short: string;
  /** When it happened, shown on the chapter list row. */
  period: string;
  category: string;
  description: string;
  stack: string[];
  highlights?: string[];
  /** Optional outbound link (repo, demo, write-up) shown at the foot of the field note. */
  link?: { label: string; href: string };
  stage: "branches" | "roots";
};

// Links appear in the About text and the footer. The résumé PDF lives in public/Jinyoung_Jeon_Resume.pdf; add LinkedIn
// the same way.
export const contact: {
  email: string;
  links: { label: string; href: string }[];
} = {
  email: "jjeon99@gatech.edu",
  links: [
    { label: "GitHub", href: "https://github.com/acnove53" },
    // { label: "LinkedIn", href: "https://www.linkedin.com/in/..." },
    { label: "Résumé", href: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/Jinyoung_Jeon_Resume.pdf` },
  ],
};

export const skillGroups: { label: string; items: string }[] = [
  { label: "AI / ML", items: "PyTorch, JAX, NumPy, Flax NNX, Computer Vision, NLP/LLMs, Model Training & Evaluation, AWS Bedrock" },
  { label: "Languages & frameworks", items: "Python, C/C++, Java, SQL, JavaScript/TypeScript, React Native, Django, Express" },
  { label: "Databases", items: "PostgreSQL, SQLite, MongoDB, DynamoDB, Drizzle ORM" },
  { label: "Cloud & tools", items: "AWS (API Gateway, Lambda, S3, SSM, KMS), Docker, OpenAPI, REST, Git/GitHub, Agile/Scrum, Linux/PACE HPC, Appwrite" },
];

export const honors: { title: string; detail: string; date: string }[] = [
  { title: "Faculty Honors", detail: "Georgia Institute of Technology, perfect 4.0 term", date: "Fall 2025" },
  { title: "Army Achievement Medal", detail: "U.S. Department of the Army, awarded twice for leadership and cross-cultural communication", date: "Mar, Jul 2025" },
  { title: "ByteFight 2026 Tournament", detail: "AI strategy developer, autonomous agent under strict compute limits", date: "Mar – Apr 2026" },
];

// A few personal things, shown from the hollow in the trunk. Photos live in public/tmi (resized, no metadata).
const photoBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const photo = (name: string, alt: string) => ({ src: `${photoBase}/tmi/${name}.jpg`, alt });

export type TmiCard = {
  title: string;
  text: string;
  photos?: { src: string; alt: string }[];
};

export const selfPortrait = photo("me", "Jinyoung smiling in a beanie at a turquoise mountain lake");

export const tmiCards: TmiCard[] = [
  {
    title: "Mountains, lakes and long hikes",
    text: "My favorite place in the world is Banff, in the Rockies near Calgary. I love being out in nature, mountains most of all: hiking up to a good view, and fishing whenever there is water nearby.",
    photos: [
      photo("banff-view", "The town of Banff in the valley below a big mountain"),
      photo("lookout", "At a mountain lookout above Banff"),
      photo("lake-louise", "Standing at Lake Louise with hands on a beanie"),
      photo("forest", "A forested mountainside under a cloudy sky"),
      photo("fishing", "Holding up a redfish on a fishing boat"),
      photo("chipmunk", "A small striped squirrel on a trail"),
    ],
  },
  {
    title: "The peer counselor",
    text: "In the army I was a peer counselor: regular check-ins with the soldiers around me, juniors and seniors alike, and extra time for the ones who were having a hard time.",
    photos: [
      photo("counseling", "Taking notes during a counseling session with U.S. and Korean soldiers"),
      photo("army", "Army portrait in front of the U.S. and Korean flags"),
    ],
  },
  {
    title: "Big dogs, small zoo",
    text: "I love animals, big dogs most of all. At the moment I share a home with my roommate's big cat and a small Mexican xolo.",
    photos: [
      photo("cat-nap", "The big cat asleep on a blanket"),
      photo("cat-belly", "The same cat, belly up on the bed"),
      photo("xolo", "A small xolo puppy held gently by the chin"),
    ],
  },
  {
    title: "Bass on Sundays",
    text: "I play acoustic guitar and bass. These days I serve on my church's worship team on bass.",
    photos: [photo("bass", "Playing bass on stage with an in-ear monitor, a drum kit in the foreground")],
  },
  {
    title: "Always moving",
    text: "Four days a week at the gym and two running. I have run a 10K and I am training for a 20K. A little soccer when it comes up, and a big Manchester United fan.",
    photos: [
      photo("jerseys", "Two Manchester United home shirts on the wall, with army caps and dog tags hanging on them"),
      photo("gym", "A mirror selfie at the gym with a rack of dumbbells"),
    ],
  },
];

export const role = "Full-stack & AI engineer";

// mark: 上 (top), 中 (middle), 下 (bottom) — where each chapter sits on the tree.
export const stageCopy: Record<StageName, { mark: string; chapter: string; title: string; note: string }> = {
  branches: {
    mark: "上",
    chapter: "PROJECTS",
    title: "Ideas take shape.",
    note: "Five projects grown from the same root system.",
  },
  trunk: {
    mark: "中",
    chapter: "ABOUT",
    title: "Jinyoung Daniel Jeon",
    note: "Bridging the gap between hardware and intelligence.",
  },
  roots: {
    mark: "下",
    chapter: "EXPERIENCE",
    title: "Built on understanding.",
    note: "The people, systems, and disciplines beneath the work.",
  },
};

export const aboutSummary =
  "I build full-stack and AI systems, and I like to understand the layer underneath before I build on top of it. As a KATUSA sergeant I interpreted between Korean and U.S. forces; now I translate the strict rules of hardware into the flexible logic of artificial intelligence.";

export const portfolioEntries: PortfolioEntry[] = [
  {
    id: "timeslips",
    number: "01",
    title: "TimeSlips AI-Integrated Mobile App",
    short: "TimeSlips",
    period: "SEP 2026 – PRESENT",
    category: "SEP 2026 – PRESENT · AI / CARE",
    description: "An AI coaching platform that helps care facilitators build more meaningful moments with people living with dementia. Designed around a calm mobile workflow, with serverless services supporting timely, context-aware guidance.",
    stack: ["React Native", "AWS Serverless", "AWS Bedrock"],
    highlights: ["Real-time session sync on API Gateway, Lambda and DynamoDB", "Bedrock AI coach keeps sensitive transcripts away from public LLMs", "On-device speech-to-text (ExecuTorch, Whisper) with zero-trust Appwrite OAuth"],
    stage: "branches",
  },
  {
    id: "travel-health",
    number: "02",
    title: "AI-Powered Travel Health Coach",
    short: "Travel Health Coach",
    period: "APR 2026",
    category: "APR 2026 · CLAUDE BUILDER CLUB · AI / HEALTH",
    description: "A context-aware recommendation agent that helps travelers make dietary and health choices with local context in mind. Prompt design connects itinerary, food, and personal needs into a practical coaching experience.",
    stack: ["Python", "LLMs", "Prompt Design"],
    highlights: ["Compares food options in transit versus at home"],
    stage: "branches",
  },
  {
    id: "neural-vision",
    number: "03",
    title: "Neural Networks & Vision Pipelines",
    short: "Vision Pipelines",
    period: "MAR – APR 2026",
    category: "MAR – APR 2026 · MACHINE LEARNING",
    description: "From manually implementing backpropagation for a three-layer neural network in JAX to fine-tuning VGG19 on the PACE H100 cluster, these experiments explore how learning systems behave from the inside out.",
    stack: ["JAX", "VGG19", "PACE H100"],
    highlights: ["97.7% MNIST accuracy from a from-scratch JAX network", "Classified 75 butterfly species at over 90% validation accuracy", "Trained at scale on Georgia Tech’s PACE H100 cluster"],
    stage: "branches",
  },
  {
    id: "bytefight",
    number: "04",
    title: "ByteFight 2026 Autonomous Agent",
    short: "ByteFight Agent",
    period: "MAR – APR 2026",
    category: "MAR – APR 2026 · COMPETITION",
    description: "A Python strategy agent that reasons about a changing game state and makes decisions under strict compute-time limits. Custom pathfinding heuristics help balance search depth with fast, reliable moves.",
    stack: ["Python", "Pathfinding", "Heuristics"],
    highlights: ["Custom pathfinding and stamina-optimization logic"],
    stage: "branches",
  },
  {
    id: "jobjoe",
    number: "05",
    title: "JobJoe",
    short: "JobJoe",
    period: "AUG – DEC 2025",
    category: "AUG – DEC 2025 · TEAM PROJECT",
    description: "A global job-matching engine built on Django and backed by a carefully structured SQLite database. As Scrum Master, I led a team of five and kept delivery focused.",
    stack: ["Django", "SQLite", "Scrum"],
    highlights: ["Optimized relational data model", "Led a 5-member team as Scrum Master"],
    stage: "branches",
  },
  {
    id: "northbound",
    number: "06",
    title: "NorthBound College",
    short: "NorthBound",
    period: "JUN – AUG 2026",
    category: "FULL-STACK ENGINEER · JUN – AUG 2026",
    description: "Engineered an AI-powered college admissions platform. I built typed data boundaries around model and API interactions so fast-moving product work could stay predictable and maintainable.",
    stack: ["Express", "PostgreSQL", "Gemini API", "Zod"],
    highlights: ["SSE-streaming AI Consultant and School Advisor on Gemini", "Zod and OpenAPI 3.1 as the single source of truth for API and LLM output"],
    stage: "roots",
  },
  {
    id: "katusa",
    number: "07",
    title: "19th ESC · U.S. Forces Korea",
    short: "KATUSA · USFK",
    period: "MAR 2024 – JUL 2025",
    category: "MAR 2024 – JUL 2025 · SERGEANT",
    description: "Served as consecutive and simultaneous interpreter for the Command Sergeant Major. I bridged cultural gaps, supported leadership communications, and served as primary Executive Assistant, and led diplomatic ceremonies for 500+ personnel.",
    stack: ["Interpretation", "Leadership", "Communication"],
    highlights: ["Interpreted at ROK-US combined exercises and ceremonies", "Led ceremonies for 500+ personnel and peer-counseled junior soldiers", "Army Achievement Medal, awarded twice (2025)"],
    stage: "roots",
  },
  {
    id: "georgia-tech",
    number: "08",
    title: "Georgia Institute of Technology",
    short: "Georgia Tech",
    period: "2023 – 2027",
    category: "B.S. COMPUTER SCIENCE · 2023 – 2027",
    description: "Studying Computer Science on the Intelligence and Devices threads. A 3.91 GPA and Faculty Honors reflect a sustained interest in the boundary where software meets physical systems.",
    stack: ["Intelligence", "Devices", "Hardware / Software"],
    highlights: ["3.91 / 4.00 GPA", "Faculty Honors, Fall 2025 (perfect 4.0 term)"],
    stage: "roots",
  },
];
