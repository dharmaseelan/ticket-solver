import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath?.trim()) {
    return NextResponse.json({ error: "No projectPath provided" }, { status: 400 });
  }

  if (!fs.existsSync(projectPath)) {
    return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
  }

  try {
    fs.rmSync(projectPath, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg });
  }
}
