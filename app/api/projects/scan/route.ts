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

export async function POST(req: NextRequest) {
  const { rootPath }: { rootPath: string } = await req.json();

  if (!rootPath?.trim()) {
    return NextResponse.json({ error: "No rootPath provided" }, { status: 400 });
  }

  if (!fs.existsSync(rootPath)) {
    return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
  }

  try {
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });

    const projects = entries
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(rootPath, e.name, ".git")))
      .map((e) => {
        const projectPath = path.join(rootPath, e.name);
        const branch = gitSafe(["branch", "--show-current"], projectPath);
        const behind = parseInt(gitSafe(["rev-list", `HEAD..origin/${branch}`, "--count"], projectPath), 10) || 0;
        const ahead = parseInt(gitSafe(["rev-list", `origin/${branch}..HEAD`, "--count"], projectPath), 10) || 0;
        const hasNodeModules = fs.existsSync(path.join(projectPath, "node_modules"));
        const hasSourceflow = fs.existsSync(path.join(projectPath, ".sourceflow"));
        return { name: e.name, path: projectPath, branch, behind, ahead, hasNodeModules, hasSourceflow };
      });

    return NextResponse.json({ projects });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
