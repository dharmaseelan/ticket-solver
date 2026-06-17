import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(req: NextRequest) {
  const { port }: { port: number } = await req.json();

  if (!port) {
    return NextResponse.json({ error: "port is required" }, { status: 400 });
  }

  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
  } catch {
    // Process may already be stopped
  }

  return NextResponse.json({ success: true });
}
