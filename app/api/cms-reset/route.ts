import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(req: NextRequest) {
  const { projectPaths }: { projectPaths: string[] } = await req.json();

  if (!projectPaths?.length) {
    return NextResponse.json({ error: "No project paths provided" }, { status: 400 });
  }

  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
  };

  const results: { path: string; success: boolean; error?: string }[] = [];

  for (const p of projectPaths) {
    try {
      console.log("[cms-reset] running in:", p);
      const output = execSync("npx sourceflow reset", {
        cwd: p,
        timeout: 60000,
        shell: "/bin/zsh",
        env,
      }).toString();
      console.log("[cms-reset] success:", output.slice(0, 200));
      results.push({ path: p, success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[cms-reset] error:", msg);
      results.push({ path: p, success: false, error: msg });
    }
  }

  return NextResponse.json({ results });
}
