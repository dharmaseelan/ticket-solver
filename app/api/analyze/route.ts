import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// Finds the first complete JSON object by counting braces — avoids greedy-regex mismatch
function extractJSON(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function listDirRecursive(dirPath: string, maxDepth = 3, depth = 0): string[] {
  if (depth > maxDepth) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const rel = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...listDirRecursive(rel, maxDepth, depth + 1));
      } else if (/\.(tsx?|jsx?|css|scss)$/.test(entry.name)) {
        results.push(rel);
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── CMS page lookup helpers ──────────────────────────────────────────────────

function extractPageSlug(ticketText: string, knownSlugs: string[] = []): string | null {
  const lower = ticketText.toLowerCase();

  // Try URL patterns first
  const urlPatterns = [
    /https?:\/\/[^\s]+\/([a-z0-9][a-z0-9/-]*[a-z0-9])/ig,
    /pages affected[:\s]+[^\n]*\/([a-z0-9][a-z0-9/-]*[a-z0-9])/ig,
  ];
  for (const pattern of urlPatterns) {
    const match = pattern.exec(ticketText);
    if (match?.[1]) return match[1].toLowerCase().replace(/\/$/, "");
  }

  // Reverse lookup — check if any known slug appears in the ticket text
  // Sort longest first so "about-harvey-nash" beats "about"
  const sorted = [...knownSlugs].sort((a, b) => b.length - a.length);
  for (const slug of sorted) {
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\s|/)${escaped}(\\s|/|$)`, "i").test(lower)) {
      return slug;
    }
  }

  return null;
}

function getPagesArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.category_values)) return obj.category_values as Record<string, unknown>[];
    if (Array.isArray(obj.pages)) return obj.pages as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
  }
  return [];
}

function getPageSlug(page: Record<string, unknown>): string {
  return String(page.url_slug ?? page.url ?? page.slug ?? page.path ?? "").toLowerCase();
}

function getPageTitle(page: Record<string, unknown>): string {
  const t = page.title ?? page.name ?? "";
  if (typeof t === "object" && t !== null) {
    const loc = t as Record<string, unknown>;
    return String(loc.en ?? Object.values(loc)[0] ?? "");
  }
  return String(t);
}

function findPage(filePath: string, slug: string): Record<string, unknown> | null {
  try {
    const raw = readFileSafe(filePath);
    if (!raw) return null;
    const pages = getPagesArray(JSON.parse(raw));
    return pages.find((page) => {
      const url = getPageSlug(page);
      return url === slug || url.endsWith(`/${slug}`) || url.replace(/^\//, "") === slug;
    }) ?? null;
  } catch {
    return null;
  }
}

function resolveComponentFiles(projectPath: string, componentNames: string[]): string[] {
  const searchDirs = ["src/builder", "src/components", "src/sections"];
  const results: string[] = [];
  for (const name of componentNames) {
    for (const dir of searchDirs) {
      const dirPath = path.join(projectPath, dir, name);
      if (!fs.existsSync(dirPath)) continue;
      try {
        const entries = fs.readdirSync(dirPath);
        const jsFiles = entries.filter((e) => /\.(jsx?|tsx?)$/.test(e));
        for (const file of jsFiles) {
          results.push(`${dir}/${name}/${file}`);
        }
      } catch { /* ignore */ }
      break;
    }
  }
  return results;
}

type CmsPageInfo = {
  slug: string;
  type: "page-builder" | "cms-page" | "not-found";
  title: string;
  components?: string[];
  files?: string[];
  componentProps?: Array<{ component: string; props: Record<string, unknown> }>;
};

function getCmsPageInfo(projectPath: string, ticketText: string): CmsPageInfo | null {
  const sfDir = path.join(projectPath, ".sourceflow");
  if (!fs.existsSync(sfDir)) return null;

  const dynamicPagesFile = path.join(sfDir, "dynamic_pages.json");
  const pagesFile = path.join(sfDir, "pages.json");

  // Collect all known slugs for reverse lookup
  const knownSlugs: string[] = [];
  for (const file of [dynamicPagesFile, pagesFile]) {
    try {
      const raw = readFileSafe(file);
      if (!raw) continue;
      getPagesArray(JSON.parse(raw)).forEach((p) => {
        const s = getPageSlug(p);
        if (s) knownSlugs.push(s);
      });
    } catch { /* ignore */ }
  }

  const slug = extractPageSlug(ticketText, knownSlugs);
  if (!slug) return null;

  if (fs.existsSync(dynamicPagesFile)) {
    const match = findPage(dynamicPagesFile, slug);
    if (match) {
      const contentItems = (match.content as Array<{ component: string; props?: Record<string, unknown> }>) ?? [];
      const components = contentItems.map((c) => c.component).filter(Boolean);
      const allProps = contentItems.map((c) => ({ component: c.component, props: c.props ?? {} }));
      return { slug, type: "page-builder", title: getPageTitle(match), components, componentProps: allProps };
    }
  }

  if (fs.existsSync(pagesFile)) {
    const match = findPage(pagesFile, slug);
    if (match) {
      return { slug, type: "cms-page", title: getPageTitle(match) };
    }
  }

  return { slug, type: "not-found", title: "" };
}

// ── CMS stats ────────────────────────────────────────────────────────────────

type CmsStats = {
  pageBuilderPages: number;
  pageBuilderLive: number;
  pageBuilderDraft: number;
  cmsPages: number;
  categories: number;
  basePages: number;
};

function getCmsStats(projectPath: string): CmsStats | null {
  const sfDir = path.join(projectPath, ".sourceflow");
  if (!fs.existsSync(sfDir)) return null;

  let pageBuilderPages = 0;
  let pageBuilderLive = 0;
  let pageBuilderDraft = 0;
  let cmsPages = 0;
  let categories = 0;
  let basePages = 0;

  try {
    const dynRaw = readFileSafe(path.join(sfDir, "dynamic_pages.json"));
    if (dynRaw) {
      const dyn = JSON.parse(dynRaw);
      if (Array.isArray(dyn)) {
        pageBuilderPages = dyn.length;
        pageBuilderDraft = dyn.filter((p: { is_draft?: boolean }) => p.is_draft).length;
        pageBuilderLive = pageBuilderPages - pageBuilderDraft;
      }
    }
  } catch { /* ignore */ }

  try {
    const pagesRaw = readFileSafe(path.join(sfDir, "pages.json"));
    if (pagesRaw) {
      const pages = JSON.parse(pagesRaw);
      cmsPages = Array.isArray(pages.category_values) ? pages.category_values.length : 0;
    }
  } catch { /* ignore */ }

  try {
    const cmsRaw = readFileSafe(path.join(sfDir, "cms.json"));
    if (cmsRaw) {
      const cms = JSON.parse(cmsRaw);
      categories = Array.isArray(cms.categories) ? cms.categories.length : 0;
    }
  } catch { /* ignore */ }

  // Count hardcoded base pages (*.page.js/jsx/tsx) excluding _app/_document
  try {
    const searchDirs = ["src/pages", "pages"].map(d => path.join(projectPath, d)).filter(d => fs.existsSync(d));
    for (const dir of searchDirs) {
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
            walk(path.join(d, entry.name));
          } else if (entry.isFile() && /\.page\.(js|jsx|tsx)$/.test(entry.name) && !entry.name.startsWith("_")) {
            basePages++;
          }
        }
      };
      walk(dir);
    }
    const appDir = path.join(projectPath, "app");
    if (fs.existsSync(appDir)) {
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "api") {
            walk(path.join(d, entry.name));
          } else if (entry.isFile() && /^page\.(js|jsx|tsx)$/.test(entry.name)) {
            basePages++;
          }
        }
      };
      walk(appDir);
    }
  } catch { /* ignore */ }

  return { pageBuilderPages, pageBuilderLive, pageBuilderDraft, cmsPages, categories, basePages };
}

function buildProjectContext(projectPath: string): string {
  const parts: string[] = [];

  // package.json
  const pkg = readFileSafe(path.join(projectPath, "package.json"));
  if (pkg) {
    try {
      const { dependencies = {}, devDependencies = {} } = JSON.parse(pkg);
      const deps = Object.keys({ ...dependencies, ...devDependencies }).join(", ");
      parts.push(`Dependencies: ${deps}`);
    } catch {
      parts.push(`package.json: ${pkg.slice(0, 500)}`);
    }
  }

  // File tree from src/ or app/ — cap at 120 files to avoid oversized prompts
  const srcDirs = ["src", "app", "pages", "components"].map((d) =>
    path.join(projectPath, d)
  );

  const files: string[] = [];
  for (const dir of srcDirs) {
    files.push(...listDirRecursive(dir));
    if (files.length >= 120) break;
  }

  if (files.length > 0) {
    const normalised = projectPath.endsWith("/") ? projectPath : projectPath + "/";
    const relFiles = files.slice(0, 120).map((f) => f.replace(normalised, ""));
    parts.push(`Project files:\n${relFiles.join("\n")}`);
  }

  // .sourceflow — list page slugs/names so AI can identify which pages exist
  const sfDir = path.join(projectPath, ".sourceflow");
  if (fs.existsSync(sfDir)) {
    try {
      const sfParts: string[] = [];

      const readPageList = (file: string, label: string, limit = 60) => {
        try {
          const raw = fs.readFileSync(file, "utf-8");
          const data = JSON.parse(raw);
          // pages.json wraps pages in category_values; dynamic_pages.json is a top-level array
          const pages: Record<string, unknown>[] = Array.isArray(data)
            ? data as Record<string, unknown>[]
            : ((data.category_values ?? data.pages ?? data.results ?? []) as Record<string, unknown>[]);
          const lines = pages.slice(0, limit).map((page) => {
            const url = String(page.url_slug ?? page.url ?? page.slug ?? page.path ?? "").replace(/^\//, "");
            const titleRaw = page.title ?? page.name ?? "";
            const name = typeof titleRaw === "object" && titleRaw !== null
              ? String((titleRaw as Record<string, unknown>).en ?? Object.values(titleRaw as object)[0] ?? "")
              : String(titleRaw);
            return url ? `  ${url}${name ? ` — ${name}` : ""}` : null;
          }).filter(Boolean);
          if (lines.length > 0) sfParts.push(`${label}:\n${lines.join("\n")}`);
        } catch { /* ignore */ }
      };

      readPageList(path.join(sfDir, "dynamic_pages.json"), "Page-builder pages (dynamic_pages.json)");
      readPageList(path.join(sfDir, "pages.json"), "Category pages (pages.json)");

      if (sfParts.length > 0) parts.push(sfParts.join("\n\n"));
    } catch { /* ignore */ }
  }

  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set in .env.local" }, { status: 500 });
  }

  const { request, projectPaths }: { request: string; projectPaths?: string[] } = await req.json();

  if (!request?.trim()) {
    return NextResponse.json({ error: "No request provided" }, { status: 400 });
  }

  // Build combined project context from all provided paths
  let projectContext = "";
  const validPaths = (projectPaths || []).filter((p) => p?.trim());
  if (validPaths.length > 0) {
    const sections: string[] = [];
    for (const pp of validPaths) {
      try {
        if (!fs.existsSync(pp)) {
          return NextResponse.json({ error: `Project path not found: ${pp}` }, { status: 400 });
        }
        const ctx = buildProjectContext(pp);
        if (ctx) {
          const label = validPaths.length > 1 ? `Project: ${pp}\n` : "";
          sections.push(`${label}${ctx}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: `Failed to read project at ${pp}: ${msg}` }, { status: 500 });
      }
    }
    projectContext = sections.join("\n\n---\n\n");
  }

  const contextSection = projectContext
    ? `\n\nProject context:\n${projectContext}`
    : "";

  // Resolve CMS stats + page info for all projects
  const allCmsStats = validPaths
    .map((p) => ({
      name: p.split("/").filter(Boolean).pop() || p,
      path: p,
      stats: getCmsStats(p),
      pageInfo: getCmsPageInfo(p, request),
    }))
    .filter((item): item is { name: string; path: string; stats: CmsStats; pageInfo: CmsPageInfo | null } => item.stats !== null);
  const cmsStats = allCmsStats.length > 0 ? allCmsStats : null;

  // For the component context prompt, use the first project that has a page-builder match
  const firstPbInfo = allCmsStats.find((item) => item.pageInfo?.type === "page-builder" && item.pageInfo.components?.length)?.pageInfo ?? null;
  const componentContext = firstPbInfo?.type === "page-builder" && firstPbInfo.components?.length
    ? `\n\nThis ticket mentions a page-builder page: "${firstPbInfo.slug}"${firstPbInfo.title ? ` (${firstPbInfo.title})` : ""}.\nComponents on this page: ${firstPbInfo.components.join(", ")}.\nFrom this list, identify which component(s) are most likely responsible for the issue.`
    : "";

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are an expert developer working at Sourceflow, a UK-based headless CMS and recruitment technology company. You have deep knowledge of all Sourceflow projects, packages, and conventions.

## Sourceflow Platform
Sourceflow is a headless CMS platform for recruitment/staffing agencies. It manages jobs, blogs, pages, and site globals via a cloud backend. Data is synced locally via the Sourceflow CLI into a \`.sourceflow/\` folder as JSON files.

## Key CLI Commands
- \`npx sourceflow init <project-name>\` — initialises a project, creates the \`.sourceflow/\` folder with JSON data files
- \`npx sourceflow reset\` — re-fetches and rebuilds all \`.sourceflow/\` JSON data
- \`npm run sfprepare\` — compiles page builder components into an HTML gallery for the CMS editor

## Core Packages
- \`@sourceflow-uk/sourceflow-sdk\` — core SDK for fetching pages, jobs, blogs, globals from \`.sourceflow/\` JSON files
- \`@sourceflow-uk/page-builder-cli\` — CLI that compiles builder components (\`sfprepare\`)
- \`@sourceflow-uk/sourceflow-content\` — renders rich text/HTML content from the CMS
- \`@sourceflow-uk/job-search\` — job listing, search, and filtering component
- \`@sourceflow-uk/sourceflowapplicationform\` — job application form component

## Page Builder System
- Builder components live in \`builder/\` — each is a React component with a \`definitions.sourceflow.mjs\` schema
- The schema defines what props the CMS editor exposes to content editors
- \`ui/ContentBlocks/\` maps CMS block names to React components dynamically
- Pages are rendered from \`.sourceflow/dynamic_pages.json\` via \`pages/[...url_slugs]/index.js\`
- \`pages/components.js\` is an iframe preview page used by the CMS to show components visually

## Key Data Files (inside \`.sourceflow/\`)
- \`dynamic_pages.json\` — all CMS pages with slugs, SEO, and content blocks
- \`global.json\` — site-wide settings and globals
- \`jobs.json\` — job listings
- \`blogs.json\` — blog posts
- \`metadata.json\` — SEO metadata

## Common Issues
- Missing \`.sourceflow/\` folder → run \`npx sourceflow init <project-name>\`
- Stale data → run \`npx sourceflow reset\`
- Components not showing in CMS → run \`npm run sfprepare\`
- Auth errors on npm install → \`NODE_AUTH_TOKEN\` must be set in \`~/.npmrc\` for \`npm.pkg.github.com\`
- Jobs not showing → check \`hooks/useJobs.js\` and \`.sourceflow/jobs.json\``,
        messages: [
          {
            role: "user",
            content: `Read this support ticket and explain what the client wants in plain English — short, clear, simple words anyone can understand.${contextSection}${componentContext}

Ticket:
"${request}"

Return ONLY a JSON object in this exact shape:
{
  "title": "One short sentence — the main thing they want",
  "description": "One sentence — why they want it or what problem it solves",
  "points": ["short bullet 1", "short bullet 2"],
  "relevantFiles": ["relative/path/to/file.tsx"],
  "affectedComponents": ["ComponentName"]
}

Rules:
- No tech words in title/description/points. Write like you're texting a friend.
- Title: max 10 words
- Description: max 15 words
- Points: specific things they need, max 5 items, max 8 words each
- relevantFiles: only if a projectPath was given — list files most likely involved, max 5. Empty array if no project context.
- affectedComponents: only if a page-builder component list was provided — pick 1-2 component names from that list most likely causing the issue. Empty array otherwise.
- No markdown, no explanation, just the JSON.`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || data.error || `API error ${response.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const raw = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";

    const jsonStr = extractJSON(raw);
    if (!jsonStr) {
      return NextResponse.json({ error: "Could not parse response", raw }, { status: 502 });
    }

    const result = JSON.parse(jsonStr);

    // Resolve files per project for all page-builder matches
    if (result.affectedComponents?.length) {
      allCmsStats.forEach((item) => {
        if (item.pageInfo) {
          item.pageInfo.files = resolveComponentFiles(item.path, result.affectedComponents);
          if (item.pageInfo.componentProps) {
            item.pageInfo.componentProps = item.pageInfo.componentProps.filter((cp) =>
              result.affectedComponents.includes(cp.component)
            );
          }
        }
      });
    }

    return NextResponse.json({ requirement: result, cmsStats });
  } catch (err) {
    const message = err instanceof Error
      ? `${err.message}${err.cause ? ` (cause: ${err.cause})` : ""}`
      : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
