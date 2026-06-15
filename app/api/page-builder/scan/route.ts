import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const GIT = "/usr/bin/git";

function gitSafe(args: string[], cwd: string): string {
  try {
    return execFileSync(GIT, args, { cwd, timeout: 5000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).toString().trim();
  } catch {
    return "";
  }
}

function hasPageBuilderPackage(projectPath: string): boolean {
  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return "@sourceflow-uk/page-builder-cli" in deps;
  } catch {
    return false;
  }
}

function getBuilderPath(projectPath: string): string | null {
  if (fs.existsSync(path.join(projectPath, "src", "builder"))) return path.join(projectPath, "src", "builder");
  if (fs.existsSync(path.join(projectPath, "builder"))) return path.join(projectPath, "builder");
  return null;
}

function getComponentsPath(projectPath: string): string | null {
  if (fs.existsSync(path.join(projectPath, "src", "components"))) return path.join(projectPath, "src", "components");
  if (fs.existsSync(path.join(projectPath, "components"))) return path.join(projectPath, "components");
  return null;
}

type Component = {
  name: string;
  hasDefinitions: boolean;
  isPushed: boolean;
  usageCount: number;
  usagePages: { url: string; count: number; isDraft: boolean }[];
};

function getSfConfigPath(projectPath: string): string | null {
  const candidates = [
    path.join(projectPath, ".sourceflow", "config.json"),
    path.join(path.dirname(projectPath), ".sourceflow", "config.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const dynamicPagesCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch usage from the Sourceflow CMS dynamic_pages API (covers both live and draft pages)
async function getComponentUsageFromAPI(
  projectPath: string,
  componentNames: string[]
): Promise<Record<string, { url: string; count: number; isDraft: boolean }[]> | null> {
  try {
    const configPath = getSfConfigPath(projectPath);
    if (!configPath) { console.log("[scan] no .sourceflow/config.json for", projectPath); return null; }

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const dynamicPagesUrl: string = config.dynamicPagesUrl;
    if (!dynamicPagesUrl) { console.log("[scan] no dynamicPagesUrl in config"); return null; }

    type DynamicPage = { url_slug: string; is_draft: boolean; content: { component: string }[] };
    let pages: DynamicPage[];
    const cached = dynamicPagesCache.get(dynamicPagesUrl);
    if (cached && Date.now() < cached.expiresAt) {
      console.log("[scan] using cached dynamic_pages for", dynamicPagesUrl);
      pages = cached.data as DynamicPage[];
    } else {
      console.log("[scan] fetching", dynamicPagesUrl);
      const res = await fetch(dynamicPagesUrl, { signal: AbortSignal.timeout(30000), cache: "no-store" });
      if (!res.ok) { console.error("[scan] API returned", res.status); return null; }
      pages = await res.json();
      dynamicPagesCache.set(dynamicPagesUrl, { data: pages, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    console.log(`[scan] API returned ${pages.length} pages`);

    const result: Record<string, { url: string; count: number; isDraft: boolean }[]> = {};
    for (const name of componentNames) result[name] = [];

    for (const page of pages) {
      const pageUrl = "/" + page.url_slug;
      const isDraft = !!page.is_draft;
      for (const name of componentNames) {
        const count = (page.content ?? []).filter((block) => block.component === name).length;
        if (count > 0) result[name].push({ url: pageUrl, count, isDraft });
      }
    }

    const totalUsage = Object.values(result).reduce((s, arr) => s + arr.length, 0);
    console.log(`[scan] computed usage entries: ${totalUsage}`);
    return result;
  } catch (e) {
    console.error("[scan] getComponentUsageFromAPI threw:", e);
    return null;
  }
}

// Fallback: scan out/_next/data/ JSON files (no draft info available this way)
function buildUsageDataFromFiles(
  dir: string,
  componentNames: string[]
): Record<string, { url: string; count: number; isDraft: boolean }[]> {
  const result: Record<string, { url: string; count: number; isDraft: boolean }[]> = {};
  for (const name of componentNames) result[name] = [];

  function processFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const canonicalMatch = content.match(/"canonical"\s*:\s*"([^"]+)"/);
      const pageUrl = canonicalMatch ? canonicalMatch[1] : "/" + path.basename(filePath, ".json");
      for (const name of componentNames) {
        const regex = new RegExp(`"component"\\s*:\\s*"${name}"`, "g");
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          result[name].push({ url: pageUrl, count: matches.length, isDraft: false });
        }
      }
    } catch { /* ignore */ }
  }

  function walkDir(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) walkDir(fullPath);
        else if (entry.isFile() && entry.name.endsWith(".json")) processFile(fullPath);
      }
    } catch { /* ignore */ }
  }

  walkDir(dir);
  return result;
}

async function getComponentUsage(
  projectPath: string,
  componentNames: string[]
): Promise<Record<string, { url: string; count: number; isDraft: boolean }[]>> {
  if (componentNames.length === 0) return {};

  // Primary: Sourceflow CMS API (has both live + draft pages)
  const apiResult = await getComponentUsageFromAPI(projectPath, componentNames);
  if (apiResult) return apiResult;

  // Fallback: scan built output files
  console.log("[scan] API failed, falling back to file scan for", projectPath);
  const candidates = [
    path.join(projectPath, "out", "_next", "data"),
    path.join(path.dirname(projectPath), "out", "_next", "data"),
  ];
  for (const dataDir of candidates) {
    if (fs.existsSync(dataDir)) {
      console.log("[scan] scanning", dataDir);
      return buildUsageDataFromFiles(dataDir, componentNames);
    }
  }

  console.log("[scan] no out/_next/data found, last resort scan of", projectPath);
  return buildUsageDataFromFiles(projectPath, componentNames);
}

function listComponents(
  folderPath: string,
  projectPath: string,
  usageData: Record<string, { url: string; count: number; isDraft: boolean }[]> = {}
): Component[] {
  try {
    return fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const hasDefinitions = fs.existsSync(path.join(folderPath, e.name, "definitions.sourceflow.mjs"));
        const relFolder = path.relative(projectPath, path.join(folderPath, e.name));
        const status = gitSafe(["status", "--porcelain", relFolder], projectPath);
        const isPushed = status.trim() === "";
        const pages = usageData[e.name] ?? [];
        const usageCount = pages.reduce((sum, p) => sum + p.count, 0);
        return { name: e.name, hasDefinitions, isPushed, usageCount, usagePages: pages };
      });
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { rootPath }: { rootPath: string } = await req.json();

  if (!rootPath?.trim()) {
    return NextResponse.json({ error: "No rootPath provided" }, { status: 400 });
  }

  if (!fs.existsSync(rootPath)) {
    return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const total = entries.length;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(enc.encode(JSON.stringify(data) + "\n"));

      try {
        const projects = [];
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          send({ type: "progress", current: i + 1, total, projectName: e.name });

          const projectPath = path.join(rootPath, e.name);
          const builderPath = getBuilderPath(projectPath);
          const hasBuilder = builderPath !== null;
          const hasPackage = hasPageBuilderPackage(projectPath);
          const isSetup = hasBuilder || hasPackage;
          const rawComponentNames = hasBuilder
            ? fs.readdirSync(builderPath!, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
            : [];
          const usageData = rawComponentNames.length > 0 ? await getComponentUsage(projectPath, rawComponentNames) : {};
          const components = hasBuilder ? listComponents(builderPath!, projectPath, usageData) : [];
          const builderNames = new Set(components.map((c) => c.name));
          const componentsPath = getComponentsPath(projectPath);
          const nonBuilderComponents = componentsPath
            ? listComponents(componentsPath, projectPath).filter((c) => !c.hasDefinitions && !builderNames.has(c.name) && c.name.toLowerCase() !== "shared")
            : [];
          projects.push({ name: e.name, path: projectPath, isSetup, hasBuilder, hasPackage, components, nonBuilderComponents });
        }
        send({ type: "done", projects });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", error: msg });
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
