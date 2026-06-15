import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "No GITHUB_TOKEN set" }, { status: 500 });

  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const data = await res.json();
  return NextResponse.json({ login: data.login, name: data.name, avatar_url: data.avatar_url });
}
