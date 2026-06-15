import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "history.json");

function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const entry = await req.json();

  const history = readHistory();
  history.unshift({ ...entry, savedAt: new Date().toISOString() });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");

  return NextResponse.json({ ok: true, total: history.length });
}

export async function GET() {
  return NextResponse.json({ history: readHistory() });
}
