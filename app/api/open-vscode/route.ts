import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST(req: NextRequest) {
  const { projectPath }: { projectPath: string } = await req.json();

  if (!projectPath) {
    return NextResponse.json({ error: "No project path provided" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    exec(`code "${projectPath}"`, (err) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ ok: true }));
      }
    });
  });
}
