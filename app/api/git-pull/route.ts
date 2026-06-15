import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";

const GIT = "/usr/bin/git";
const baseEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

function git(args: string[], cwd: string): string {
  return execFileSync(GIT, args, { cwd, timeout: 30000, env: baseEnv }).toString().trim();
}

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();
  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No project path provided" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN?.trim();

  try {
    const branch = git(["branch", "--show-current"], projectPath);
    let behind = 0;
    try { behind = parseInt(git(["rev-list", `HEAD..origin/${branch}`, "--count"], projectPath), 10) || 0; } catch { /* ignore */ }

    if (behind === 0) {
      return NextResponse.json({ success: true, pulled: 0, message: "Already up to date" });
    }

    const pullArgs = token
      ? ["-c", `url.https://x-access-token:${token}@github.com/.insteadOf=https://github.com/`, "pull", "--ff-only"]
      : ["pull", "--ff-only"];

    git(pullArgs, projectPath);
    return NextResponse.json({ success: true, pulled: behind });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, pulled: 0, error: msg });
  }
}
