import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SLUG_CANDIDATES = [
  "pages/[...url_slugs]/index.jsx",
  "pages/[...url_slugs]/index.js",
  "pages/[...url_slugs]/index.page.jsx",
  "pages/[...url_slugs]/index.page.js",
  "pages/[...url_slug]/index.jsx",
  "pages/[...url_slug]/index.js",
  "pages/[...url_slug]/index.page.jsx",
  "pages/[...url_slug]/index.page.js",
  "pages/[...url_slugs].jsx",
  "pages/[...url_slugs].js",
  "pages/[...url_slug].jsx",
  "pages/[...url_slug].js",
  "pages/[url_slug].jsx",
  "pages/[url_slug].js",
  "src/pages/[...url_slugs]/index.jsx",
  "src/pages/[...url_slugs]/index.js",
  "src/pages/[...url_slug]/index.jsx",
  "src/pages/[...url_slug]/index.js",
  "src/pages/[url_slug].jsx",
  "src/pages/[url_slug].js",
];

const BOILERPLATE_SLUG = `import useDynamicPage from "@/hooks/useDynamicPage";
import useDynamicPages from "@/hooks/useDynamicPages";
import { DynamicPageSeo } from "@/ui/DynamicPageSeo";
import { ContentBlocks } from "@/ui/ContentBlocks";

export default function SimplePage({ prefix, title, seo, canonical, data }) {
  return (
    <>
      <DynamicPageSeo
        {...seo}
        title={seo?.title.length > 0 ? seo.title : title}
        canonical={seo?.canonical.length > 0 ? seo.canonical : canonical}
      />
      <ContentBlocks data={data} prefix={prefix} />
    </>
  );
}

export async function getStaticProps({ params: { url_slugs } }) {
  const url_slug = url_slugs.join("/");
  const page = useDynamicPage(url_slug);

  if (page?.is_draft === true) {
    return { notFound: true };
  }

  return {
    props: {
      prefix: \`page_\${url_slug.replaceAll(/[\\/\\-]/g, "_")}\`,
      title: page.title,
      seo: page.seo,
      canonical: \`/\${url_slug}\`,
      data: page.content,
    },
  };
}

export async function getStaticPaths() {
  const pages = useDynamicPages();
  const exclude = [];
  const paths = pages
    .filter((i) => !exclude.includes(i.url_slug))
    .map((i) => ({ params: { url_slugs: i.url_slug.split("/") } }));

  return {
    paths,
    fallback: false,
  };
}`;

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  // Find existing url_slug file
  let foundAt = "";
  let existingContent = "";
  for (const candidate of SLUG_CANDIDATES) {
    const fullPath = path.join(projectPath, candidate);
    if (fs.existsSync(fullPath)) {
      foundAt = candidate;
      existingContent = fs.readFileSync(fullPath, "utf8");
      break;
    }
  }

  if (!foundAt) {
    return NextResponse.json({ error: "No url_slug file found in this project" }, { status: 404 });
  }

  const prompt = `You are a Next.js developer merging Sourceflow Page Builder support into an existing dynamic page file.

## Page Builder boilerplate (pure page builder slug — use as reference for the pattern):
\`\`\`js
${BOILERPLATE_SLUG}
\`\`\`

## Existing site's dynamic page file (${foundAt}):
\`\`\`js
${existingContent}
\`\`\`

## Task:
Produce a merged file that combines BOTH — the existing site logic AND page builder support. Rules:
1. Keep ALL existing imports, components, logic, and JSX from the existing file intact
2. Add page builder imports grouped together at the top, preceded by the comment "// Page Builder Setup" on its own line: useDynamicPage, useDynamicPages, DynamicPageSeo, ContentBlocks (from "@/ui/ContentBlocks"), getDynamicPageStaticProps (from "@/functions/getDynamicPageStaticProps")
3. In the component: add \`isBuilder = false\` prop, add conditional — if isBuilder render DynamicPageSeo + ContentBlocks, else render existing JSX
4. In getStaticProps: at the very top join the url_slug param and call useDynamicPage — if a builder page is found, return getDynamicPageStaticProps immediately; else fall through to existing logic
5. In getStaticPaths: generate builder paths with useDynamicPages(), merge them with existing paths using spread [...builderPaths, ...existingPaths]
6. Output ONLY the raw JavaScript file content. No explanation. No markdown fences.`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
    }

    const aiData = await aiRes.json();
    let merged: string = aiData.content?.[0]?.text ?? "";

    // Strip any accidental markdown fences
    merged = merged.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

    const outputRel = "pages/page-builder-setup/index.js";
    const outputPath = path.join(projectPath, outputRel);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, merged + "\n", "utf8");

    return NextResponse.json({ success: true, outputPath: outputRel, content: merged, foundAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
