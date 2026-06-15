import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";

const GIT = "/usr/bin/git";
const baseEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

function git(args: string[], cwd: string): string {
  return execFileSync(GIT, args, { cwd, timeout: 30000, env: baseEnv }).toString().trim();
}

export async function POST(req: NextRequest) {
  const { projectPaths }: { projectPaths: string[] } = await req.json();
  if (!projectPaths?.length) {
    return NextResponse.json({ error: "No project paths provided" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const results: { path: string; success: boolean; behind: number; ahead: number; error?: string }[] = [];

  for (const p of projectPaths) {
    try {
      const branch = git(["branch", "--show-current"], p);

      if (token) {
        const remoteUrl = git(["remote", "get-url", "origin"], p);
        const authedUrl = remoteUrl.startsWith("https://github.com/")
          ? `https://x-access-token:${token}@github.com/${remoteUrl.slice("https://github.com/".length)}`
          : remoteUrl;
        git(["fetch", authedUrl, "+refs/heads/*:refs/remotes/origin/*"], p);
      } else {
        git(["fetch", "origin"], p);
      }

      let behind = 0, ahead = 0;
      if (branch) {
        try { behind = parseInt(git(["rev-list", `HEAD..origin/${branch}`, "--count"], p), 10) || 0; } catch { /* ignore */ }
        try { ahead = parseInt(git(["rev-list", `origin/${branch}..HEAD`, "--count"], p), 10) || 0; } catch { /* ignore */ }
      }

      results.push({ path: p, success: true, behind, ahead });
    } catch (e) {
      results.push({ path: p, success: false, behind: 0, ahead: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ results });
}
