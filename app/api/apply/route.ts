import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const { projectPath, files }: {
    projectPath: string;
    files: { path: string; content: string; isFullFile: boolean }[];
  } = await req.json();

  if (!projectPath) {
    return NextResponse.json({ error: "No project path provided" }, { status: 400 });
  }

  if (!files?.length) {
    return NextResponse.json({ error: "No files to apply" }, { status: 400 });
  }

  if (!fs.existsSync(projectPath)) {
    return NextResponse.json({ error: `Project path not found: ${projectPath}` }, { status: 400 });
  }

  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const absPath = path.join(projectPath, file.path);

      // Safety check: never write a patch snippet as a full file
      if (!file.isFullFile) {
        skipped.push(file.path);
        continue;
      }

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, file.content, "utf-8");
      applied.push(file.path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${file.path}: ${msg}`);
    }
  }

  return NextResponse.json({ applied, skipped, errors });
}
