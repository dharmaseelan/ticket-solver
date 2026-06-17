import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PREVIEW_ID = "__sf-ticket-solver-preview__";
const PREVIEW_SLUG = "_pb-preview";

function findProjectRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findProjectRoot(parent);
}

function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return null; }
}

function gatherComponentSource(root: string, compName: string): string {
  const candidates = [
    path.join(root, "src", "builder", compName),
    path.join(root, "src", "components", compName),
  ];
  const parts: string[] = [];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (/\.(jsx?|tsx?|mjs)$/.test(file)) {
        const content = readFileSafe(path.join(dir, file));
        if (content) parts.push(`// ${path.join(dir, file)}\n${content}`);
      }
    }
  }
  return parts.join("\n\n");
}

async function generatePropsWithAI(compName: string, source: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return {};

  const prompt = `You are helping generate dummy preview props for a React component called "${compName}".

Here is the component's source code:
\`\`\`
${source.slice(0, 8000)}
\`\`\`

Based on the component, return a JSON object of realistic dummy props so we can preview how it looks.
Rules:
- For title props: use the component name as the value (e.g. if the component is "HeroBanner", use "HeroBanner")
- For other text/heading props: use short realistic placeholder text (e.g. "Welcome to Our Team")
- For HTML/formatted_text props: use simple HTML like "<p>Sample content goes here.</p>"
- For boolean props: use true or false based on what makes the component visible
- For template/array props (lists of items): include 2-3 sample items
- For image/file props: use null
- For button props: include label and href="#"
- Do NOT include props that are internal (global, pathPrefix, post)
- Only return the JSON object, no explanation`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return {};

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  // Extract JSON from the response
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  const { components }: { components: { projectPath: string; compName: string }[] } = await req.json();

  if (!components?.length) {
    return NextResponse.json({ error: "components array is required" }, { status: 400 });
  }

  const firstPath = components[0].projectPath;

  function findDynamicPages(dir: string): string | null {
    const candidate = path.join(dir, ".sourceflow", "dynamic_pages.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    return findDynamicPages(parent);
  }

  const jsonPath = findDynamicPages(firstPath);
  if (!jsonPath) {
    return NextResponse.json({ error: `dynamic_pages.json not found (searched from ${firstPath} upward)` }, { status: 400 });
  }

  try {
    const contentBlocks = await Promise.all(
      components.map(async ({ projectPath, compName }, i) => {
        const root = findProjectRoot(projectPath);
        const source = gatherComponentSource(root, compName);
        const props = source ? await generatePropsWithAI(compName, source) : {};
        return { id: `preview-block-${i}`, component: compName, props };
      })
    );

    const pages: unknown[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const filtered = pages.filter((p: unknown) => (p as { id: string }).id !== PREVIEW_ID);

    const previewEntry = {
      id: PREVIEW_ID,
      title: "SF Preview",
      url_slug: PREVIEW_SLUG,
      metadata: {},
      seo: { title: "", robots: "", keywords: "", canonical: "", description: "" },
      content: contentBlocks,
      is_draft: false,
    };

    filtered.unshift(previewEntry);
    fs.writeFileSync(jsonPath, JSON.stringify(filtered, null, 2), "utf8");

    return NextResponse.json({ success: true, url: `http://localhost:3000/${PREVIEW_SLUG}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
