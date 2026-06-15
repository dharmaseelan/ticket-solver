import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "rate-limit.json");

export async function GET() {
  try {
    if (!fs.existsSync(FILE)) return NextResponse.json(null);
    const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}
