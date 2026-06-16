import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const FILES = [
  { key: "hooks/useDynamicPage.js", label: "useDynamicPage.js", group: "hooks" },
  { key: "hooks/useDynamicPages.js", label: "useDynamicPages.js", group: "hooks" },
  { key: "hooks/useGlobal.js", label: "useGlobal.js", group: "hooks" },
  { key: "hooks/useIsPreview.js", label: "useIsPreview.js", group: "hooks" },
  { key: "hooks/useSourceFlowCollection.js", label: "useSourceFlowCollection.js", group: "hooks" },
  { key: "ui/AnimateIn/index.jsx", label: "AnimateIn/index.jsx", group: "ui" },
  { key: "ui/AnimateIn/component.jsx", label: "AnimateIn/component.jsx", group: "ui" },
  { key: "ui/ContentBlocks/index.jsx", label: "ContentBlocks/index.jsx", group: "ui" },
  { key: "ui/ContentBlocks/component.jsx", label: "ContentBlocks/component.jsx", group: "ui" },
  { key: "ui/DynamicPageSeo/index.jsx", label: "DynamicPageSeo/index.jsx", group: "ui" },
  { key: "ui/DynamicPageSeo/component.jsx", label: "DynamicPageSeo/component.jsx", group: "ui" },
  { key: "pages/page-builder-setup/index.js", label: "page-builder-setup/index.js", group: "pages" },
  { key: "pages/components.js", label: "components.js", group: "pages" },
  { key: "builder/index.js", label: "index.js", group: "builder" },
  { key: "builder/definitions.generic.mjs", label: "definitions.generic.mjs", group: "builder" },
  { key: "builder/Content/index.jsx", label: "Content/index.jsx", group: "builder" },
  { key: "builder/Content/definitions.sourceflow.mjs", label: "Content/definitions.sourceflow.mjs", group: "builder" },
  { key: "builder/Content/styles.module.scss", label: "Content/styles.module.scss", group: "builder" },
];

function altExt(key: string): string | null {
  if (key.endsWith(".js")) return key.slice(0, -3) + ".jsx";
  if (key.endsWith(".jsx")) return key.slice(0, -4) + ".js";
  return null;
}

function findFile(projectPath: string, key: string): { exists: boolean; content: string } {
  const candidates = [
    key,
    `src/${key}`,
  ];

  const alt = altExt(key);
  if (alt) {
    candidates.push(alt, `src/${alt}`);
  }

  // pages/components.js may be named components.page.js in some projects
  if (key === "pages/components.js") {
    candidates.push("pages/components.page.js", "src/pages/components.page.js");
  }

  for (const candidate of candidates) {
    const fullPath = path.join(projectPath, candidate);
    if (fs.existsSync(fullPath)) {
      let content = "";
      try { content = fs.readFileSync(fullPath, "utf8"); } catch { /* ignore */ }
      return { exists: true, content };
    }
  }

  return { exists: false, content: "" };
}

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  const files = FILES.map((f) => {
    const { exists, content } = findFile(projectPath, f.key);
    return { ...f, exists, content };
  });

  const missing = files.filter((f) => !f.exists);

  return NextResponse.json({ files, missing });
}
