import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CORE_PACKAGES = [
  { name: "@sourceflow-uk/page-builder-cli", version: "2.0.2" },
  { name: "@sourceflow-uk/eslint-plugin-page-builder-cli", version: "1.1.9" },
  { name: "@sourceflow-uk/sourceflow-content", version: "0.0.20" },
  { name: "@sourceflow-uk/sourceflow-sdk", version: "0.38.0" },
];

const FRESH_SETUP_PACKAGES = [
  { name: "aos", version: "2.3.4" },
];

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
    const isFreshSetup = !installed["@sourceflow-uk/page-builder-cli"];
    const required = isFreshSetup ? [...CORE_PACKAGES, ...FRESH_SETUP_PACKAGES] : CORE_PACKAGES;
    const packages = required.map((p) => ({ ...p, installed: !!installed[p.name] }));
    const missing = packages.filter((p) => !p.installed);
    return NextResponse.json({ isSetup: missing.length === 0, packages, missing });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
