import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    timeout: 5000,
    shell: "/bin/zsh",
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
    },
  }).toString().trim();
}

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();
  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No path provided" }, { status: 400 });
  }
  try {
    const branch = run("git branch --show-current", projectPath);

    let behind = 0;
    let ahead = 0;
    try {
      behind = parseInt(run(`git rev-list HEAD..origin/${branch} --count`, projectPath), 10) || 0;
      ahead = parseInt(run(`git rev-list origin/${branch}..HEAD --count`, projectPath), 10) || 0;
    } catch { /* no remote tracking branch */ }

    return NextResponse.json({ branch, behind, ahead });
  } catch {
    return NextResponse.json({ branch: null, behind: 0, ahead: 0 });
  }
}
