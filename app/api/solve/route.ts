import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a senior Sourceflow developer producing production-ready fixes.

## Sourceflow Platform
Sourceflow is a headless CMS platform for recruitment/staffing agencies. It manages jobs, blogs, pages, and site globals via a cloud backend. Data is synced locally via the Sourceflow CLI into a \`.sourceflow/\` folder as JSON files.

## Project Stacks
- POC/Standard: Next.js 16, React 18, Bootstrap 5, SASS, react-slick, Swiper, React-Bootstrap, Reactstrap
- Aurelius: Next.js 16, React 19, Tailwind CSS v4, Radix UI, CVA, clsx, Embla Carousel, Lucide, react-icons
- Both share @sourceflow-uk packages: SDK, job-search, forms, tracker, page-builder, head

## Core Packages
- \`@sourceflow-uk/sourceflow-sdk\` — fetches pages, jobs, blogs, globals from \`.sourceflow/\` JSON files
- \`@sourceflow-uk/page-builder-cli\` — CLI that compiles builder components via \`sfprepare\`
- \`@sourceflow-uk/sourceflow-content\` — renders rich text/HTML from the CMS
- \`@sourceflow-uk/job-search\` — job listing, search, and filtering component
- \`@sourceflow-uk/sourceflowapplicationform\` — job application form component

## Page Builder System
- Builder components live in \`builder/\` — each has a \`definitions.sourceflow.mjs\` schema defining CMS editor props
- \`ui/ContentBlocks/\` maps CMS block names to React components dynamically
- Pages rendered from \`.sourceflow/dynamic_pages.json\` via \`pages/[...url_slugs]/index.js\`
- \`pages/components.js\` is an iframe preview used by the CMS to show components visually
- \`npm run sfprepare\` compiles components into HTML gallery for the CMS editor

## Key Data Files (inside \`.sourceflow/\`)
- \`dynamic_pages.json\` — all CMS pages with slugs, SEO, and content blocks
- \`global.json\` — site-wide settings and globals
- \`jobs.json\` — job listings
- \`blogs.json\` — blog posts

## Common Issues
- Missing \`.sourceflow/\` folder → run \`npx sourceflow init <project-name>\`
- Stale data → run \`npx sourceflow reset\`
- Components not showing in CMS → run \`npm run sfprepare\`
- Jobs not showing → check \`hooks/useJobs.js\` and \`.sourceflow/jobs.json\`

Components live in src/components or src/sections.
Always add inline comments explaining what the fix does and why.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOURCEFLOW CMS — understand this before fixing anything:

The project uses Sourceflow's own CMS. Two key files are always provided:

1. dynamic_pages.json — lists every PAGE-BUILDER page and the components on each page.
   Use this to: identify which page a ticket refers to, see which components are rendered on it,
   and find the component responsible for the broken feature.

2. pages.json — lists CATEGORY pages (e.g. job listings, blog index).
   Use this to: identify if the ticket is about a category/listing page rather than a built page.

PAGE TYPE DETECTION — do this first:
- Search dynamic_pages.json for the page slug or name from the ticket.
  → Found: it is a PAGE-BUILDER page. Find the component causing the issue and fix it in src/components or src/sections.
- Search pages.json for the page.
  → Found: it is a CATEGORY page. Fix the relevant template or listing component.
- Not found in either: it is a HARDCODED page. Fix it in src/pages/ or app/ directly.

Always state the page type in the first changes bullet, e.g.:
  "Page-builder page — fixed ContactForm component"
  "Category page — fixed JobListings template"
  "Hardcoded page — fixed src/pages/about.tsx"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DETERMINE FIX TYPE FIRST — before writing any code:
- Inspect the component props provided from the CMS. If a field value is clearly broken (incomplete URL, empty required field, invalid slug, missing reference) — that is a CMS DATA issue, not a code bug.
- Only generate a code fix if the problem is in the component logic/rendering itself.

Return ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "fixType": "code",
  "changes": ["short bullet point of what you changed", "another change"],
  "files": [
    {
      "path": "relative/path/from/project/root.tsx",
      "content": "complete file or patch content here",
      "isFullFile": false
    }
  ],
  "cmsActions": []
}

For a CMS fix, use this shape instead:
{
  "fixType": "cms",
  "changes": ["one-line summary of the CMS problem"],
  "files": [],
  "cmsActions": [
    {
      "component": "ComponentName",
      "field": "fieldName",
      "currentValue": "the bad value from CMS",
      "issue": "one sentence — why this value is broken",
      "fix": "max 10 words — the exact value to set, or the exact action to take"
    }
  ]
}

Rules for "changes":
- Max 6 items, max 8 words each
- Developer-level language — be specific
- First bullet must state page type and component/file

If isFullFile is true: content is the entire file.
If isFullFile is false: content is a clearly marked patch/snippet with surrounding context lines.`;

function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, "utf-8"); } catch { return null; }
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
  const sorted = [...knownSlugs].sort((a, b) => b.length - a.length);
  for (const slug of sorted) {
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\s|/)${escaped}(\\s|/|$)`, "i").test(lower)) {
      return slug;
    }
  }

  return null;
}

// Fix 1 & 2: correct field name (url_slug) and pages.json traversal (category_values)
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

function findPageInJson(filePath: string, slug: string): Record<string, unknown> | null {
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

function summarisePages(filePath: string, label: string, limit = 60): string {
  try {
    const raw = readFileSafe(filePath);
    if (!raw) return "";
    const pages = getPagesArray(JSON.parse(raw));
    const lines = pages.slice(0, limit).map((page) => {
      const url = getPageSlug(page);
      const name = getPageTitle(page);
      return url ? `  ${url}${name ? ` — ${name}` : ""}` : null;
    }).filter(Boolean);
    if (lines.length === 0) return "";
    return `${label} (${lines.length} pages):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// Fix 3: resolve page-builder component names to their actual source files
function resolveComponentFiles(
  projectPath: string,
  componentNames: string[]
): Array<{ relPath: string; content: string }> {
  const searchDirs = ["src/builder", "src/components", "src/sections"];
  const results: Array<{ relPath: string; content: string }> = [];
  for (const name of componentNames) {
    for (const dir of searchDirs) {
      const dirPath = path.join(projectPath, dir, name);
      if (!fs.existsSync(dirPath)) continue;
      try {
        const entries = fs.readdirSync(dirPath);
        const mainFile =
          entries.find((e) => /^index\.(jsx?|tsx?)$/i.test(e)) ??
          entries.find((e) => new RegExp(`^${name}\\.(jsx?|tsx?)$`, "i").test(e)) ??
          entries.find((e) => /\.(jsx?|tsx?)$/.test(e));
        if (mainFile) {
          const relPath = `${dir}/${name}/${mainFile}`;
          const content = readFileSafe(path.join(projectPath, relPath));
          if (content) results.push({ relPath, content: content.slice(0, 3000) });
        }
      } catch { /* ignore */ }
      break;
    }
  }
  return results;
}

function buildSourceflowContext(projectPath: string, ticketText: string, affectedComponents: string[] = []): string {
  const sfDir = path.join(projectPath, ".sourceflow");
  if (!fs.existsSync(sfDir)) return "";

  const dynamicPagesFile = path.join(sfDir, "dynamic_pages.json");
  const pagesFile = path.join(sfDir, "pages.json");

  // Collect known slugs for reverse lookup
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
  const parts: string[] = [];

  if (slug) {
    if (fs.existsSync(dynamicPagesFile)) {
      const match = findPageInJson(dynamicPagesFile, slug);
      if (match) {
        parts.push(`--- dynamic_pages.json match for "${slug}" ---\n${JSON.stringify(match, null, 2).slice(0, 6000)}`);

        const contentItems = (match.content as Array<{ component: string; props?: Record<string, unknown> }>) ?? [];
        const components = contentItems.map((c) => c.component).filter(Boolean);

        if (components.length > 0) {
          parts.push(`Components on this page: ${components.join(", ")}`);

          // Include CMS props for affected components so Claude can spot bad data
          const targets = affectedComponents.length > 0
            ? contentItems.filter((c) => affectedComponents.includes(c.component))
            : contentItems;
          if (targets.length > 0) {
            parts.push(
              "CMS props for affected component(s):\n" +
              targets.map((c) => `--- ${c.component} props ---\n${JSON.stringify(c.props ?? {}, null, 2)}`).join("\n\n")
            );
          }

          // Resolve source files only for affected components (or all if none specified)
          const toResolve = affectedComponents.length > 0 ? affectedComponents : components;
          const componentFiles = resolveComponentFiles(projectPath, toResolve);
          if (componentFiles.length > 0) {
            parts.push(
              "Component source files:\n" +
              componentFiles.map((f) => `--- ${f.relPath} ---\n${f.content}`).join("\n\n")
            );
          }
        }
      }
    }
    if (fs.existsSync(pagesFile)) {
      const match = findPageInJson(pagesFile, slug);
      if (match) {
        parts.push(`--- pages.json match for "${slug}" ---\n${JSON.stringify(match, null, 2).slice(0, 4000)}`);
      }
    }
    if (parts.length === 0) {
      parts.push(`No entry found for slug "${slug}" in dynamic_pages.json or pages.json — this is likely a HARDCODED page.`);
    }
  }

  // Always include the full page listing so Claude can identify the right page
  // even when no URL was found in the ticket
  if (fs.existsSync(dynamicPagesFile)) {
    const summary = summarisePages(dynamicPagesFile, "Page-builder pages (dynamic_pages.json)");
    if (summary) parts.push(summary);
  }
  if (fs.existsSync(pagesFile)) {
    const summary = summarisePages(pagesFile, "Category pages (pages.json)");
    if (summary) parts.push(summary);
  }

  if (parts.length === 0) return "";

  return `--- SOURCEFLOW CMS DATA ---\n\n${parts.join("\n\n")}`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500 });
  }

  const { request, requirement, projectPath, godfatherNote, model = "claude-sonnet-4-6" } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        // Step 1: Read project files + .sourceflow (0–20%)
        send({ step: "Reading project files...", percent: 5 });
        let fileContext = "";
        const relevantFiles: string[] = requirement.relevantFiles || [];
        const originalContents: Record<string, string> = {};

        if (projectPath && relevantFiles.length > 0) {
          const sections: string[] = [];
          for (let i = 0; i < relevantFiles.length; i++) {
            const relFile = relevantFiles[i];
            send({
              step: `Reading ${relFile}`,
              percent: Math.round(5 + ((i + 1) / relevantFiles.length) * 12),
            });
            const content = readFileSafe(path.join(projectPath, relFile));
            if (content) {
              originalContents[relFile] = content;
              sections.push(`--- ${relFile} ---\n${content}`);
            }
          }
          if (sections.length > 0) {
            fileContext = `\n\nExisting file contents:\n${sections.join("\n\n")}`;
          }
        }

        // Step 1b: Read .sourceflow data to detect page type
        let sourceflowContext = "";
        if (projectPath) {
          send({ step: "Reading Sourceflow CMS data...", percent: 18 });
          sourceflowContext = buildSourceflowContext(projectPath, request, requirement.affectedComponents ?? []);
          if (sourceflowContext) {
            sourceflowContext = `\n\n${sourceflowContext}`;
          }
        }

        // Step 2: Call Claude (20–80%)
        send({ step: "Sending to Claude...", percent: 22 });

        let percent = 22;
        let fileIdx = 0;
        const ticker = setInterval(() => {
          if (percent < 75) {
            percent = Math.min(percent + 2, 75);
            const label = relevantFiles[fileIdx % Math.max(relevantFiles.length, 1)];
            fileIdx++;
            send({
              step: label ? `Analysing ${label}...` : "Generating fix...",
              percent,
            });
          }
        }, 700);

        const claudeRes = await fetch(ANTHROPIC_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            messages: [{
              role: "user",
              content: `Generate a fix for this ticket.
${godfatherNote ? `
⚠️ GODFATHER NOTE — HIGHEST PRIORITY. FOLLOW THIS EXACTLY:
"${godfatherNote}"

STRICT RULES:
- Set isFullFile TRUE. Return the COMPLETE file.
- Copy every single line from the original file EXACTLY as-is — same whitespace, same formatting, same comments.
- Apply ONLY the change described in the Godfather Note. Nothing else.
- Do NOT refactor, reformat, rename, or remove anything else.
- If the note says "comment out", use {/* */} for JSX or /* */ for JS — do not delete.
` : ""}
Original ticket:
"${request}"

What the client wants:
- ${requirement.title}
- ${requirement.description}
${requirement.points.map((p: string) => `- ${p}`).join("\n")}

Project root: ${projectPath || "(not provided)"}${sourceflowContext}${fileContext}

Produce the fix with inline comments.`,
            }],
          }),
        });

        clearInterval(ticker);

        // Persist rate-limit info from response headers for the dashboard widget
        try {
          const rl = {
            tokensLimit: Number(claudeRes.headers.get("anthropic-ratelimit-tokens-limit") ?? 0),
            tokensRemaining: Number(claudeRes.headers.get("anthropic-ratelimit-tokens-remaining") ?? 0),
            tokensReset: claudeRes.headers.get("anthropic-ratelimit-tokens-reset") ?? null,
            requestsLimit: Number(claudeRes.headers.get("anthropic-ratelimit-requests-limit") ?? 0),
            requestsRemaining: Number(claudeRes.headers.get("anthropic-ratelimit-requests-remaining") ?? 0),
            updatedAt: new Date().toISOString(),
          };
          fs.writeFileSync(path.join(process.cwd(), "rate-limit.json"), JSON.stringify(rl), "utf-8");
        } catch { /* non-fatal */ }

        const claudeData = await claudeRes.json();
        if (!claudeRes.ok || claudeData.error) {
          throw new Error(claudeData.error?.message || `API error ${claudeRes.status}`);
        }

        const raw = claudeData.content?.find((b: { type: string }) => b.type === "text")?.text || "";
        const jsonStr = extractJSON(raw);
        if (!jsonStr) throw new Error("Could not parse Claude response");

        const solution = JSON.parse(jsonStr);

        // Attach original content to each file for diff view
        if (solution.files) {
          solution.files = solution.files.map((f: { path: string }) => ({
            ...f,
            originalContent: originalContents[f.path] ?? null,
          }));
        }

        // Step 3: Apply files (80–100%) — skip entirely for CMS fixes
        if (solution.fixType === "cms") {
          send({ step: "CMS fix identified — no code changes needed.", percent: 100, solution });
          return;
        }

        if (projectPath && solution.files?.length > 0) {
          for (let i = 0; i < solution.files.length; i++) {
            const file = solution.files[i];
            const pct = Math.round(80 + ((i + 1) / solution.files.length) * 18);

            if (!file.isFullFile) {
              send({ step: `Skipping patch-only file: ${file.path}`, percent: pct });
              continue;
            }

            send({ step: `Writing ${file.path}...`, percent: pct });
            try {
              const absPath = path.join(projectPath, file.path);
              fs.mkdirSync(path.dirname(absPath), { recursive: true });
              fs.writeFileSync(absPath, file.content, "utf-8");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              throw new Error(`Failed to write ${file.path}: ${msg}`);
            }
          }
        }

        send({ step: "Done!", percent: 100, solution });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
