import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PREVIEW_ID = "__sf-ticket-solver-preview__";

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "projectPath is required" }, { status: 400 });
  }

  function findDynamicPages(dir: string): string | null {
    const candidate = path.join(dir, ".sourceflow", "dynamic_pages.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    return findDynamicPages(parent);
  }

  const jsonPath = findDynamicPages(projectPath);
  if (!jsonPath) {
    return NextResponse.json({ success: true }); // nothing to clean up
  }

  try {
    const pages: unknown[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const filtered = pages.filter((p: unknown) => (p as { id: string }).id !== PREVIEW_ID);
    fs.writeFileSync(jsonPath, JSON.stringify(filtered, null, 2), "utf8");
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
