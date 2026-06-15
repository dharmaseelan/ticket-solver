import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dir = searchParams.get("path") || os.homedir();

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();

    const parent = dir !== path.parse(dir).root ? path.dirname(dir) : null;

    return NextResponse.json({ current: dir, parent, folders });
  } catch {
    return NextResponse.json({ error: "Cannot read directory" }, { status: 400 });
  }
}
