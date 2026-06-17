import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function findProjectRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findProjectRoot(parent);
}

export async function POST(req: NextRequest) {
  const { projectPath, compName }: { projectPath: string; compName: string } = await req.json();

  const root = findProjectRoot(projectPath);
  const dir = path.join(root, "src", "builder", compName);

  if (!fs.existsSync(dir)) {
    return NextResponse.json({ files: [] });
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jsx?|tsx?|mjs|scss|css)$/.test(f))
    .map((name) => ({
      name,
      content: fs.readFileSync(path.join(dir, name), "utf8"),
    }));

  return NextResponse.json({ files });
}
