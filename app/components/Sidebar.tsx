"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { History, Zap, PanelLeftClose, PanelLeftOpen, LayoutTemplate, FolderGit2, BrainCircuit } from "lucide-react";
import { useState, useEffect } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [githubUser, setGithubUser] = useState<{ login: string; name: string | null; avatar_url: string } | null>(null);

  useEffect(() => {
    fetch("/api/github/user")
      .then((r) => r.json())
      .then((d) => { if (d.login) setGithubUser(d); })
      .catch(() => {});

    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistoryCount(d.history?.length ?? 0))
      .catch(() => {});

    const sfRootPath = localStorage.getItem("sfRootPath");
    if (sfRootPath) {
      fetch("/api/projects/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPath: sfRootPath }),
      })
        .then((r) => r.json())
        .then((d) => setProjectCount(d.projects?.length ?? 0))
        .catch(() => {});
    }
  }, [pathname]);

  useEffect(() => {
    const handler = (e: Event) => {
      setProjectCount((e as CustomEvent).detail?.count ?? 0);
    };
    window.addEventListener("projects-updated", handler);
    return () => window.removeEventListener("projects-updated", handler);
  }, []);

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 56 : 260,
        background: "#0d1117",
        borderRight: "1px solid #30363d",
        transition: "width 0.2s ease",
      }}
    >
      {/* Logo + toggle */}
      <div
        className="flex items-center gap-3 border-b shrink-0"
        style={{
          borderColor: "#30363d",
          padding: collapsed ? "16px 12px" : "16px 16px",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="font-bold leading-tight truncate" style={{ color: "#ffffff", fontSize: 24 }}>
                Sync
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ color: "#484f58" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {[
          { href: "/", label: "Tickets", icon: Zap },
          { href: "/page-builder-setup", label: "Page Builder", icon: LayoutTemplate },
          { href: "/ai-job-search", label: "AI Job Search", icon: BrainCircuit },
          { href: "/projects", label: "Projects", icon: FolderGit2, count: projectCount },
          { href: "/history", label: "History", icon: History, count: historyCount },
        ].map(({ href, label, icon: Icon, count }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className="flex items-center rounded-xl text-[13px] font-medium transition-colors"
              style={{
                gap: collapsed ? 0 : 12,
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "#58a6ff18" : "transparent",
                color: active ? "#58a6ff" : "#6e7681",
                border: active ? "1px solid #58a6ff28" : "1px solid transparent",
              }}
            >
              <Icon size={16} />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {count != null && count > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                      style={{ background: active ? "#58a6ff30" : "#21262d", color: active ? "#58a6ff" : "#8b949e" }}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* GitHub profile */}
      {githubUser && (
        <div
          className="shrink-0 flex items-center border-t"
          style={{
            borderColor: "#30363d",
            padding: collapsed ? "12px 0" : "12px 16px",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: collapsed ? 0 : 10,
          }}
        >
          <Image src={githubUser.avatar_url} alt="" width={28} height={28} className="rounded-full shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#e6edf3] truncate">{githubUser.name || githubUser.login}</div>
              <div className="text-[10px] text-[#484f58] truncate">@{githubUser.login}</div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
