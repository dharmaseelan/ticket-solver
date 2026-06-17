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
  const { projectPath, packages }: { projectPath: string; packages: { name: string; version: string }[] } = await req.json();

  if (!projectPath?.trim() || !packages?.length) {
    return NextResponse.json({ error: "projectPath and packages are required" }, { status: 400 });
  }

  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
    NODE_AUTH_TOKEN: getNpmAuthToken(),
  };

  const packageArgs = packages.map((p) => `${p.name}@${p.version}`).join(" ");

  try {
    execSync(`npm install ${packageArgs} --legacy-peer-deps`, { cwd: projectPath, timeout: 180000, shell: "/bin/zsh", env });
  } catch (e: unknown) {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString().trim() ?? "";
    const stdout = (e as { stdout?: Buffer }).stdout?.toString().trim() ?? "";
    const error = stderr || stdout || (e instanceof Error ? e.message : String(e));
    return NextResponse.json({ success: false, error });
  }

  return NextResponse.json({ success: true });
}
