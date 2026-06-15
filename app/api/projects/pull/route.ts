import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";

const GIT = "/usr/bin/git";

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  try {
    execFileSync(GIT, ["pull", "--ff-only"], {
      cwd: projectPath,
      timeout: 30000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg });
  }
}
