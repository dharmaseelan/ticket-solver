import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PACKAGES = [
  { name: "@sourceflow-uk/ai-job-search", version: "1.0.5" },
];

// Candidate paths for an ai-job-search page in both App Router and Pages Router
const PAGE_CANDIDATES = [
  "app/ai-job-search/page.jsx",
  "app/ai-job-search/page.tsx",
  "app/ai-job-search/page.js",
  "pages/ai-job-search.jsx",
  "pages/ai-job-search.tsx",
  "pages/ai-job-search.js",
  "pages/ai-job-search/index.jsx",
  "pages/ai-job-search/index.tsx",
  "pages/ai-job-search/index.js",
];

function findAiJobSearchPage(projectPath: string): string | null {
  for (const candidate of PAGE_CANDIDATES) {
    const full = path.join(projectPath, candidate);
    if (fs.existsSync(full)) return candidate;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return NextResponse.json({ error: "No package.json found in this project" }, { status: 400 });
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const installed = { ...pkg.dependencies, ...pkg.devDependencies };
    const packages = PACKAGES.map((p) => ({ ...p, installed: !!installed[p.name] }));
    const missing = packages.filter((p) => !p.installed);
    const hasPackage = missing.length === 0;
    const pageFile = findAiJobSearchPage(projectPath);
    const isSetup = hasPackage && !!pageFile;
    return NextResponse.json({ packages, missing, hasPackage, pageFile, isSetup });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
