import { NextResponse } from "next/server";

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type RawRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  clone_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
};

async function fetchAllPages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers });
    const data: T[] = await res.json();
    if (!Array.isArray(data)) break;
    results.push(...data);

    const link: string = res.headers.get("link") || "";
    const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = match ? match[1] : null;
  }

  return results;
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "No GITHUB_TOKEN set" }, { status: 500 });

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  try {
    const [userRepos, orgs] = await Promise.all([
      fetchAllPages<RawRepo>("https://api.github.com/user/repos?per_page=100&sort=updated&type=owner", headers),
      fetchAllPages<{ login: string }>("https://api.github.com/user/orgs?per_page=100", headers),
    ]);

    const orgRepoArrays = await Promise.all(
      orgs.map((org) =>
        fetchAllPages<RawRepo>(`https://api.github.com/orgs/${org.login}/repos?per_page=100&sort=updated`, headers)
          .then((repos) => repos.map((r) => ({ ...r, source: org.login })))
      )
    );

    const personal = userRepos.map((r) => ({ ...r, source: "personal" }));
    const orgRepos = orgRepoArrays.flat();

    const seen = new Set(personal.map((r) => r.full_name));
    const deduped = orgRepos.filter((r) => !seen.has(r.full_name));

    const payload = { repos: [...personal, ...deduped] };
    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
