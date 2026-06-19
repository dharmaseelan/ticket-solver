"use client";
import { useEffect, useState } from "react";
import { Megaphone, GitBranch, Laptop, GitPullRequest, RefreshCw } from "lucide-react";
import Link from "next/link";

type Section = { label: string; detail: string };
type Announcement = {
  date: string;
  title: string;
  body?: string;
  sections?: Section[];
};

type Project = {
  name: string;
  path: string;
  branch: string;
  behind: number;
  ahead: number;
  hasNodeModules: boolean;
  hasSourceflow: boolean;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    date: "17 Jun 2026",
    title: "Sentry is live",
    body: "Welcome to Sentry — Sourceflow's internal ticket triage and fix platform. More features coming soon.",
  },
  {
    date: "17 Jun 2026",
    title: "Page Builder — What it does",
    sections: [
      {
        label: "Overview",
        detail: "Page Builder is Sentry's component development workspace. Point it at any client project and it handles the rest — scanning, scaffolding, generating, and previewing components without leaving the app.",
      },
      {
        label: "Installation",
        detail: "Set your client project root and scaffold all required boilerplate files in one click. The tool checks what already exists and only installs what's missing.",
      },
      {
        label: "Component Scanner",
        detail: "Automatically scans the project and separates components into two groups — Page Builder components (inside src/builder/) and Non-Page Builder components. Yellow means files are missing, green means everything is in place.",
      },
      {
        label: "Code Viewer",
        detail: "Browse any component's files in a split-panel view — folder tree on the left, syntax-highlighted code on the right. Same atomOneDark theme throughout.",
      },
      {
        label: "AI Generation",
        detail: "Generate new components on demand. Sentry reads the source code and uses AI to produce realistic dummy props automatically — no test data needed.",
      },
      {
        label: "Live Preview",
        detail: "Open Preview spins up a local dev server and opens all generated components together on a single _pb-preview page. Hit Refresh to push updates without restarting the server.",
      },
      {
        label: "Project Isolation",
        detail: "Changing the root folder clears the session automatically — so you never accidentally mix components from different client projects.",
      },
    ],
  },
];

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [githubUser, setGithubUser] = useState<{ name: string | null; login: string } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullResult, setPullResult] = useState<Record<string, "ok" | "error">>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);

    fetch("/api/github/user")
      .then((r) => r.json())
      .then((d) => { if (d.login) setGithubUser(d); })
      .catch(() => {});

    const sfRootPath = localStorage.getItem("sfRootPath");
    if (sfRootPath) {
      fetch("/api/projects/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPath: sfRootPath }),
      })
        .then((r) => r.json())
        .then((d) => setProjects(d.projects?.slice(0, 5) ?? []))
        .catch(() => {});
    }

    return () => clearInterval(timer);
  }, []);

  async function refreshProjects() {
    const sfRootPath = localStorage.getItem("sfRootPath");
    if (!sfRootPath) return;
    setRefreshing(true);
    fetch("/api/projects/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootPath: sfRootPath }),
    }).then((r) => r.json()).then((d) => setProjects(d.projects?.slice(0, 5) ?? [])).catch(() => {}).finally(() => setRefreshing(false));
  }

  async function pullProject(p: Project) {
    setPulling(p.path);
    setPullResult((prev) => { const n = { ...prev }; delete n[p.path]; return n; });
    const res = await fetch("/api/projects/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: p.path }),
    }).then((r) => r.json());
    setPulling(null);
    setPullResult((prev) => ({ ...prev, [p.path]: res.success ? "ok" : "error" }));
    if (res.success) {
      setTimeout(() => setPullResult((prev) => { const n = { ...prev }; delete n[p.path]; return n; }), 2000);
    }
    if (res.success) {
      const sfRootPath = localStorage.getItem("sfRootPath");
      if (sfRootPath) {
        fetch("/api/projects/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootPath: sfRootPath }),
        }).then((r) => r.json()).then((d) => setProjects(d.projects?.slice(0, 5) ?? [])).catch(() => {});
      }
    }
  }

  const day = now?.toLocaleDateString("en-GB", { weekday: "long" }) ?? "";
  const date = now?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) ?? "";
  const greeting = now ? getGreeting(now.getHours()) : "Welcome";
  const name = githubUser?.name || githubUser?.login || "Developer";

  return (
    <div className="p-12 w-full">
    <div className="flex gap-10">

      {/* Left — main content */}
      <div className="flex-1 min-w-0">

        {/* Date */}
        {now && (
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-widest mb-0.5" style={{ color: "#484f58" }}>{day}</div>
            <div className="text-[13px]" style={{ color: "#8b949e" }}>{date}</div>
          </div>
        )}

        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-[28px] font-bold leading-tight mb-1" style={{ color: "#e6edf3" }}>
            {greeting}, {name}
          </h1>
          <p className="text-[13px]" style={{ color: "#484f58" }}>
            Here&apos;s what&apos;s new on Sentry.
          </p>
        </div>

        {/* Announcements */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={13} style={{ color: "#484f58" }} />
            <span className="text-[11px] uppercase tracking-widest" style={{ color: "#484f58" }}>Platform Updates</span>
          </div>

          <div className="flex flex-col gap-3">
            {ANNOUNCEMENTS.map((a, i) => (
              <div key={i} className="rounded-xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono" style={{ color: "#484f58" }}>{a.date}</span>
                  <span className="text-[10px]" style={{ color: "#484f58" }}>·</span>
                  <span className="text-[10px] font-normal" style={{ color: "rgb(72, 79, 88)" }}>Dharma</span>
                </div>
                <div className="text-[14px] font-semibold mb-3" style={{ color: "#e6edf3" }}>{a.title}</div>

                {a.body && (
                  <p className="text-[12px] leading-relaxed" style={{ color: "#8b949e" }}>{a.body}</p>
                )}

                {a.sections && (
                  <div className="flex flex-col gap-4">
                    {a.sections.map((s, si) => (
                      <div key={si} className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6e7681" }}>{s.label}</span>
                        <p className="text-[12px] leading-relaxed" style={{ color: "#8b949e" }}>{s.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — sidebar */}
      <div className="w-72 shrink-0">

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Laptop size={13} style={{ color: "#484f58" }} />
              <span className="text-[11px] uppercase tracking-widest" style={{ color: "#484f58" }}>Local Projects</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={refreshProjects} disabled={refreshing} className="cursor-pointer transition-opacity hover:opacity-70 disabled:opacity-40">
                <RefreshCw size={11} style={{ color: "#484f58" }} className={refreshing ? "animate-spin" : ""} />
              </button>
              <Link href="/projects" className="text-[10px] transition-opacity hover:opacity-70" style={{ color: "#484f58" }}>
                View all
              </Link>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl p-4 text-center" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <p className="text-[11px]" style={{ color: "#484f58" }}>No projects found. Set a root path in Projects.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((p) => (
                <div key={p.path} className="rounded-xl px-4 py-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="text-[12px] font-semibold truncate" style={{ color: "#e6edf3" }}>{p.name}</div>
                    <button
                      type="button"
                      onClick={() => pullProject(p)}
                      disabled={pulling === p.path}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] shrink-0 cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{
                        background: pullResult[p.path] === "ok" ? "#0d2b1d" : pullResult[p.path] === "error" ? "#2b0d0d" : "#21262d",
                        color: pullResult[p.path] === "ok" ? "#3fb950" : pullResult[p.path] === "error" ? "#f85149" : "#8b949e",
                        border: "1px solid #30363d",
                      }}
                    >
                      <GitPullRequest size={9} className={pulling === p.path ? "animate-spin" : ""} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GitBranch size={10} style={{ color: "#484f58" }} />
                    <span className="text-[10px] font-mono truncate" style={{ color: "#6e7681" }}>{p.branch}</span>
                    {p.behind > 0 && (
                      <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#1a1206", color: "#d29922" }}>
                        {p.behind} behind
                      </span>
                    )}
                    {p.behind === 0 && p.ahead === 0 && (
                      <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#0d2b1d", color: "#3fb950" }}>
                        up to date
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
    </div>
  );
}
