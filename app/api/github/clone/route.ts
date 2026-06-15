import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import fs from "fs";

const GIT = "/usr/bin/git";

export async function POST(req: NextRequest) {
  const { cloneUrl, destinationPath }: { cloneUrl: string; destinationPath: string } = await req.json();

  if (!cloneUrl?.trim() || !destinationPath?.trim()) {
    return NextResponse.json({ error: "cloneUrl and destinationPath are required" }, { status: 400 });
  }

  if (fs.existsSync(destinationPath)) {
    return NextResponse.json({ error: `Destination already exists: ${destinationPath}` }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const authedUrl = token
    ? cloneUrl.replace("https://github.com/", `https://x-access-token:${token}@github.com/`)
    : cloneUrl;

  try {
    execFileSync(GIT, ["clone", authedUrl, destinationPath], {
      timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg });
  }
}
