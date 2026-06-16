import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return NextResponse.json({ error: "No package.json found" }, { status: 400 });
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return NextResponse.json({
      scripts: pkg.scripts ?? {},
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
