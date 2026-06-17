import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { port }: { port: string } = await req.json();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch(`http://localhost:${port}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return NextResponse.json({ running: true });
  } catch {
    return NextResponse.json({ running: false });
  }
}
