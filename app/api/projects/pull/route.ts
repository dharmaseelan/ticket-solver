import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";

const GIT = "/usr/bin/git";
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

function getRemoteUrl(cwd: string): string {
  try {
    return execFileSync(GIT, ["remote", "get-url", "origin"], { cwd, timeout: 5000, env: GIT_ENV }).toString().trim();
  } catch {
    return "";
  }
}

function injectToken(url: string, token: string): string {
  if (url.startsWith("https://github.com/")) {
    return url.replace("https://github.com/", `https://x-access-token:${token}@github.com/`);
  }
  return url;
}

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  try {
    const token = process.env.GITHUB_TOKEN?.trim();
    const remoteUrl = getRemoteUrl(projectPath);
    const authedUrl = token && remoteUrl ? injectToken(remoteUrl, token) : null;

    execFileSync(GIT, authedUrl ? ["pull", "--ff-only", authedUrl] : ["pull", "--ff-only"], {
      cwd: projectPath,
      timeout: 30000,
      env: GIT_ENV,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString().trim() ?? "";
    const stdout = (e as { stdout?: Buffer }).stdout?.toString().trim() ?? "";
    const raw = stderr || stdout || (e instanceof Error ? e.message : String(e));
    // Strip embedded token so it never reaches the client
    const error = raw.replace(/x-access-token:[^@]+@/g, "");
    return NextResponse.json({ success: false, error });
  }
}
