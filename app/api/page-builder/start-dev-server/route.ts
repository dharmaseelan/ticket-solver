import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function findProjectRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findProjectRoot(parent);
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export async function POST(req: NextRequest) {
  const { projectPath, port }: { projectPath: string; port: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "projectPath is required" }, { status: 400 });
  }

  const root = findProjectRoot(projectPath);
  const portNum = port || "3001";
  const logFile = path.join(os.tmpdir(), `sf-dev-${portNum}.log`);

  // Parse .env files and inject into child env so next.config.js sees them immediately
  const envVars = {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
    ...parseEnvFile(path.join(root, `.env.${process.env.NODE_ENV ?? "development"}`)),
    ...parseEnvFile(path.join(root, `.env.${process.env.NODE_ENV ?? "development"}.local`)),
  };

  const child = spawn(`npm run dev -- -p ${portNum}`, {
    cwd: root,
    detached: true,
    stdio: ["ignore", fs.openSync(logFile, "w"), fs.openSync(logFile, "a")],
    shell: true,
    env: { ...process.env, ...envVars },
  });
  child.unref();

  return NextResponse.json({ success: true, pid: child.pid, root, logFile });
}
