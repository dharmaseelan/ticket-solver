import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

function getNpmAuthToken(): string {
  try {
    const npmrc = fs.readFileSync(path.join(os.homedir(), ".npmrc"), "utf8");
    const match = npmrc.match(/\/\/npm\.pkg\.github\.com\/:_authToken=(\S+)/);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const { projectPath, projectName }: { projectPath: string; projectName: string } = await req.json();

  if (!projectPath?.trim() || !projectName?.trim()) {
    return NextResponse.json({ error: "projectPath and projectName are required" }, { status: 400 });
  }

  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
    NODE_AUTH_TOKEN: getNpmAuthToken(),
  };

  function extractError(e: unknown): string {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString().trim() ?? "";
    const stdout = (e as { stdout?: Buffer }).stdout?.toString().trim() ?? "";
    return stderr || stdout || (e instanceof Error ? e.message : String(e));
  }

  try {
    execSync("npm install", { cwd: projectPath, timeout: 180000, shell: "/bin/zsh", env });
  } catch (e) {
    return NextResponse.json({ success: false, step: "npm install", error: extractError(e) });
  }

  try {
    execSync(`npx sourceflow init ${projectName}`, { cwd: projectPath, timeout: 60000, shell: "/bin/zsh", env });
  } catch (e) {
    return NextResponse.json({ success: false, step: "sourceflow init", error: extractError(e) });
  }

  return NextResponse.json({ success: true });
}
