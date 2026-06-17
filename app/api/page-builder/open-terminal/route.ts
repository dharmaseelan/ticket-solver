import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { createServer } from "net";
import fs from "fs";
import path from "path";
import os from "os";

function findProjectRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findProjectRoot(parent);
}

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(start, () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
    server.on("error", () => resolve(findFreePort(start + 1)));
  });
}

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "projectPath is required" }, { status: 400 });
  }

  const root = findProjectRoot(projectPath);
  const port = await findFreePort(3001);

  let envPrefix = "";
  const envFile = path.join(root, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...rest] = t.split("=");
      if (k.trim() === "API_URL") {
        let v = rest.join("=").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        envPrefix = `API_URL='${v}' `;
        break;
      }
    }
  }

  const escapedRoot = root.replace(/'/g, "\\'");
  const cmd = `cd '${escapedRoot}' && ${envPrefix}npm run dev -- -p ${port}`;
  const appleCmd = cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const scriptPath = path.join(os.tmpdir(), "sf-open-terminal.applescript");
  fs.writeFileSync(scriptPath, `do shell script "open -a 'Visual Studio Code' '${escapedRoot}'"
delay 4
set the clipboard to "${appleCmd}"
tell application "System Events"
  tell process "Code"
    keystroke "\`" using {control down, shift down}
    delay 2.5
    keystroke "v" using {command down}
    delay 0.5
    key code 36
  end tell
end tell`);

  try {
    execSync(`osascript "${scriptPath}"`);
    return NextResponse.json({ success: true, port, root });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
