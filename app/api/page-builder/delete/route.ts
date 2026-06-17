import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function findProjectRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findProjectRoot(parent);
}

function getBuilderPath(projectPath: string): string | null {
  const root = findProjectRoot(projectPath);
  if (fs.existsSync(path.join(root, "src", "builder"))) return path.join(root, "src", "builder");
  if (fs.existsSync(path.join(root, "builder"))) return path.join(root, "builder");
  return null;
}

export async function POST(req: NextRequest) {
  const { projectPath, componentName }: { projectPath: string; componentName: string } = await req.json();

  if (!projectPath?.trim() || !componentName?.trim()) {
    return NextResponse.json({ error: "projectPath and componentName are required" }, { status: 400 });
  }

  const builderPath = getBuilderPath(projectPath);
  if (!builderPath) {
    return NextResponse.json({ error: "No builder folder found in project" }, { status: 400 });
  }

  const componentDir = path.join(builderPath, componentName);
  if (!fs.existsSync(componentDir)) {
    return NextResponse.json({ error: `Component folder not found: ${componentDir}` }, { status: 404 });
  }

  try {
    fs.rmSync(componentDir, { recursive: true, force: true });

    // Remove the export line from builder/index.js or index.jsx
    const indexFile =
      fs.existsSync(path.join(builderPath, "index.jsx")) ? path.join(builderPath, "index.jsx") :
      fs.existsSync(path.join(builderPath, "index.js")) ? path.join(builderPath, "index.js") :
      null;

    if (indexFile) {
      const content = fs.readFileSync(indexFile, "utf8");
      // Match both single and double quote variants, with or without trailing semicolon/whitespace
      const exportRegex = new RegExp(
        `^export\\s*\\{\\s*${componentName}\\s*\\}\\s*from\\s*['"]\\.\/${componentName}['"];?\\r?$`,
        "m"
      );
      if (exportRegex.test(content)) {
        const updated = content.replace(exportRegex, "").replace(/\n{2,}/g, "\n").trimEnd() + "\n";
        fs.writeFileSync(indexFile, updated, "utf8");
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
