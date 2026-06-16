"use client";
import { useEffect, useState } from "react";
import { Search, Lock, Globe, GitBranch, X, RefreshCw, ChevronDown, ChevronRight, Trash2, Laptop } from "lucide-react";
import { FolderPicker } from "@/app/components/FolderPicker";
import { ToastContainer, type ToastItem } from "@/app/components/Toast";


type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  clone_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
  source: string;
};

type CloneState = "idle" | "cloning" | "done" | "error";

type LocalProject = {
  name: string;
  path: string;
  branch: string;
  behind: number;
  ahead: number;
  hasNodeModules: boolean;
  hasSourceflow: boolean;
};

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
};

export default function ProjectsPage() {


  // GitHub clone state
  const [repos, setRepos] = useState<Repo[]>([]);
  const [githubUser, setGithubUser] = useState<{ login: string; name: string | null; avatar_url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [rootPathInput, setRootPathInput] = useState("");
  const [cloneStates, setCloneStates] = useState<Record<number, CloneState>>({});
  const [cloneErrors, setCloneErrors] = useState<Record<number, string>>({});
  const [cloneProgress, setCloneProgress] = useState<Record<number, number>>({});

  // Local projects state
  const [sfRootPath, setSfRootPath] = useState("");
  const [sfRootInput, setSfRootInput] = useState("");
  const [localProjects, setLocalProjects] = useState<LocalProject[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [sfExpanded, setSfExpanded] = useState(true);
  const [pullState, setPullState] = useState<Record<string, "pulling" | "done" | "error">>({});
  const [setupState, setSetupState] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [setupProgress, setSetupProgress] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; path: string } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function addToast(toast: Omit<ToastItem, "id">) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    const cloneRoot = localStorage.getItem("cloneRootPath") || "";
    setRootPath(cloneRoot);
    setRootPathInput(cloneRoot);

    const sfRoot = localStorage.getItem("sfRootPath") || "";
    setSfRootPath(sfRoot);
    setSfRootInput(sfRoot);
    if (sfRoot) scanProjects(sfRoot);
  }, []);

  useEffect(() => {
    fetch("/api/github/user")
      .then((r) => r.json())
      .then((d) => { if (d.login) setGithubUser(d); })
      .catch(() => {});

    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRepos(d.repos || []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  async function scanProjects(path: string) {
    setScanLoading(true);
    setScanError("");
    setPullState({});
    setSetupState({});
    setSetupProgress({});
    const res = await fetch("/api/projects/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootPath: path }),
    });
    const data = await res.json();
    setScanLoading(false);
    if (data.error) setScanError(data.error);
    else {
      const projects = data.projects || [];
      setLocalProjects(projects);
      window.dispatchEvent(new CustomEvent("projects-updated", { detail: { count: projects.length } }));
    }
  }

  function saveSfRoot() {
    const v = sfRootInput.trim().replace(/\/$/, "");
    setSfRootPath(v);
    localStorage.setItem("sfRootPath", v);
    scanProjects(v);
  }


  function saveRootPath() {
    const v = rootPathInput.trim().replace(/\/$/, "");
    setRootPath(v);
    localStorage.setItem("cloneRootPath", v);
  }

  async function pullProject(projectPath: string, projectName: string) {
    setPullState((prev) => ({ ...prev, [projectPath]: "pulling" }));
    const res = await fetch("/api/projects/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath }),
    }).then((r) => r.json());
    setPullState((prev) => ({ ...prev, [projectPath]: res.success ? "done" : "error" }));
    if (res.success) {
      addToast({ type: "success", title: `Pulled ${projectName}`, message: "Already up to date or fast-forwarded." });
      if (sfRootPath) setTimeout(() => scanProjects(sfRootPath), 500);
    } else {
      addToast({ type: "error", title: `Pull failed — ${projectName}`, message: res.error });
    }
  }

  async function setupProject(projectPath: string, projectName: string) {
    setSetupState((prev) => ({ ...prev, [projectPath]: "running" }));
    setSetupProgress((prev) => ({ ...prev, [projectPath]: 0 }));

    let progress = 0;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 5 + 2, 88);
      setSetupProgress((prev) => ({ ...prev, [projectPath]: Math.round(progress) }));
    }, 400);

    const res = await fetch("/api/projects/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, projectName }),
    }).then((r) => r.json());

    clearInterval(ticker);

    if (res.success) {
      setSetupProgress((prev) => ({ ...prev, [projectPath]: 100 }));
      setSetupState((prev) => ({ ...prev, [projectPath]: "done" }));
      addToast({ type: "success", title: `Installed ${projectName}`, message: "npm install and sourceflow init completed." });
    } else {
      setSetupProgress((prev) => ({ ...prev, [projectPath]: 0 }));
      setSetupState((prev) => ({ ...prev, [projectPath]: "error" }));
      addToast({ type: "error", title: `Install failed — ${projectName} (${res.step})`, message: res.error });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const path = deleteTarget.path;
    setDeleteTarget(null);
    await fetch("/api/projects/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: path }),
    });
    if (sfRootPath) scanProjects(sfRootPath);
  }

  async function cloneRepo(repo: Repo) {
    if (!rootPath) return;
    const dest = `${rootPath}/${repo.name}`;
    setCloneStates((prev) => ({ ...prev, [repo.id]: "cloning" }));
    setCloneErrors((prev) => { const n = { ...prev }; delete n[repo.id]; return n; });
    setCloneProgress((prev) => ({ ...prev, [repo.id]: 0 }));

    let progress = 0;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8 + 3, 88);
      setCloneProgress((prev) => ({ ...prev, [repo.id]: Math.round(progress) }));
    }, 300);

    const res = await fetch("/api/github/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cloneUrl: repo.clone_url, destinationPath: dest }),
    });
    const data = await res.json();
    clearInterval(ticker);

    if (data.success) {
      setCloneProgress((prev) => ({ ...prev, [repo.id]: 100 }));
      setCloneStates((prev) => ({ ...prev, [repo.id]: "done" }));
      setTimeout(() => setCloneStates((prev) => ({ ...prev, [repo.id]: "idle" })), 4000);
    } else {
      setCloneProgress((prev) => ({ ...prev, [repo.id]: 0 }));
      setCloneErrors((prev) => ({ ...prev, [repo.id]: data.error || "Clone failed" }));
      setCloneStates((prev) => ({ ...prev, [repo.id]: "error" }));
      setTimeout(() => setCloneStates((prev) => ({ ...prev, [repo.id]: "idle" })), 6000);
    }
  }

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by source
  const sources = Array.from(new Set(filtered.map((r) => r.source)));

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl p-6 w-full max-w-sm mx-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            <div className="text-[15px] font-semibold text-white mb-1">Delete project?</div>
            <div className="text-[12px] text-[#8b949e] mb-1">This will permanently delete:</div>
            <div className="text-[12px] font-semibold mb-1" style={{ color: "#f85149" }}>{deleteTarget.name}</div>
            <div className="text-[11px] font-mono text-[#484f58] mb-5 truncate">{deleteTarget.path}</div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#21262d", color: "#ccc", border: "1px solid #30363d" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#da3633", color: "#ffffff", border: "1px solid #f8514950" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <div className="text-[18px] font-bold text-white">Projects</div>
        <div className="text-[12px] text-[#8b949e] mt-1">Clone from GitHub or browse your local Sourceflow projects.</div>
      </div>

      {/* Clone GitHub Repo section */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#161b22", border: "1px solid #30363d" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#8b949e">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span className="text-[11px] uppercase tracking-widest text-[#8b949e]">Clone GitHub Repo</span>
          </div>
          {githubUser && (
            <div className="flex items-center gap-1.5">
              {githubUser.avatar_url && (
                <img src={githubUser.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-[11px] text-[#8b949e]">{githubUser.name || githubUser.login}</span>
            </div>
          )}
        </div>

        {/* Root destination path */}
        <div className="mb-4">
          <div className="text-[11px] text-[#8b949e] mb-1.5">Clone destination root</div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 px-3 py-2 rounded-lg text-[12px] truncate" style={{ background: "#0d1117", border: "1px solid #30363d", color: rootPathInput ? "#e8ddd4" : "#6e7681" }}>
              {rootPathInput || "Pick a folder..."}
            </div>
            <FolderPicker onSelect={(path) => setRootPathInput(path)} />
            <button
              type="button"
              onClick={saveRootPath}
              disabled={!rootPathInput}
              className="px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: "#1f6feb", color: "#fff", opacity: rootPathInput ? 1 : 0.4, cursor: rootPathInput ? "pointer" : "not-allowed" }}
            >
              Set
            </button>
          </div>
          {rootPath && (
            <div className="text-[10px] text-[#3fb950] mt-1.5">Repos will clone to: {rootPath}/&lt;repo-name&gt;</div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6e7681" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-3 py-2 text-[12px] text-[#e8ddd4] outline-none placeholder-[#6e7681]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
              <X size={12} color="#6e7681" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="text-[12px] text-[#ef4444] mb-4">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-[#8b949e] py-4">
            <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: "#58a6ff" }} />
            Loading repos...
          </div>
        )}

        {/* Prompt to search */}
        {!loading && !error && !search && (
          <div className="text-[12px] text-[#484f58] py-2">Start typing to search repos...</div>
        )}

        {/* Repo list grouped by source */}
        {!loading && !error && search && (
          <div className="flex flex-col gap-5">
            {sources.map((source) => {
              const sourceRepos = filtered.filter((r) => r.source === source);
              return (
                <div key={source}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[11px] font-semibold" style={{ color: "#58a6ff" }}>
                      {source === "personal" ? "Personal" : source}
                    </div>
                    <div className="text-[10px] text-[#484f58]">{sourceRepos.length} repos</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {sourceRepos.map((repo) => {
                      const state = cloneStates[repo.id] || "idle";
                      const cloneErr = cloneErrors[repo.id];
                      return (
                        <div
                          key={repo.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                          style={{ background: "#0d1117", border: "1px solid #21262d" }}
                        >
                          {/* Privacy icon */}
                          <div className="shrink-0" title={repo.private ? "Private" : "Public"}>
                            {repo.private
                              ? <Lock size={12} color="#6e7681" />
                              : <Globe size={12} color="#6e7681" />
                            }
                          </div>

                          {/* Repo info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-[#e6edf3] truncate">{repo.name}</span>
                              {repo.language && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: LANG_COLORS[repo.language] || "#8b949e" }}
                                  />
                                  <span className="text-[10px] text-[#8b949e]">{repo.language}</span>
                                </span>
                              )}
                            </div>
                            {repo.description && (
                              <div className="text-[11px] text-[#8b949e] truncate mt-0.5">{repo.description}</div>
                            )}
                            {cloneErr && (
                              <div className="text-[10px] text-[#ef4444] mt-0.5 truncate" title={cloneErr}>{cloneErr}</div>
                            )}
                          </div>

                          {/* Branch */}
                          <div className="flex items-center gap-1 shrink-0">
                            <GitBranch size={10} color="#484f58" />
                            <span className="text-[10px] text-[#484f58]">{repo.default_branch}</span>
                          </div>

                          {/* Clone button */}
                          <button
                            type="button"
                            onClick={() => cloneRepo(repo)}
                            disabled={!rootPath || state === "cloning"}
                            className="relative overflow-hidden shrink-0 text-[11px] px-2.5 py-1 rounded-md font-semibold transition-opacity hover:opacity-80 cursor-pointer"
                            style={{
                              background: state === "done" ? "#0d2614" : state === "error" ? "#1a0808" : state === "cloning" ? "#0d1f38" : "#1f6feb",
                              color: state === "done" ? "#3fb950" : state === "error" ? "#ef4444" : "#fff",
                              opacity: !rootPath || state === "cloning" ? 0.5 : 1,
                              cursor: !rootPath ? "not-allowed" : "pointer",
                            }}
                            title={!rootPath ? "Set a clone destination root first" : undefined}
                          >
                            {state === "cloning" && (
                              <span
                                className="absolute inset-0 transition-all duration-300"
                                style={{ width: `${cloneProgress[repo.id] ?? 0}%`, background: "#58a6ff20" }}
                              />
                            )}
                            <span className="relative z-10">
                              {state === "cloning" ? `Cloning ${cloneProgress[repo.id] ?? 0}%` : state === "done" ? "✓ Cloned" : state === "error" ? "Failed" : "Clone"}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-[12px] text-[#8b949e] py-4 text-center">No repos found.</div>
            )}
          </div>
        )}
      </div>

      {/* Sourceflow Projects section */}
      <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
        <button
          type="button"
          onClick={() => setSfExpanded((v) => !v)}
          className="w-full flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Laptop size={14} color="#8b949e" />
            <span className="text-[11px] uppercase tracking-widest text-[#8b949e]">Local Projects</span>
            {localProjects.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#21262d", color: "#8b949e" }}>
                {localProjects.length}
              </span>
            )}
          </div>
          {sfExpanded ? <ChevronDown size={13} color="#555" /> : <ChevronRight size={13} color="#555" />}
        </button>

        {sfExpanded && (<>
        {/* Root folder picker */}
        <div className="mb-4">
          <div className="text-[11px] text-[#8b949e] mb-1.5 mt-4">Projects root folder</div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 px-3 py-2 rounded-lg text-[12px] truncate" style={{ background: "#0d1117", border: "1px solid #30363d", color: sfRootInput ? "#e8ddd4" : "#6e7681" }}>
              {sfRootInput || "Pick a folder..."}
            </div>
            <FolderPicker onSelect={(path) => setSfRootInput(path)} />
            <button
              type="button"
              onClick={saveSfRoot}
              disabled={!sfRootInput}
              className="px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: "#1f6feb", color: "#fff", opacity: sfRootInput ? 1 : 0.4, cursor: sfRootInput ? "pointer" : "not-allowed" }}
            >
              Set
            </button>
            {sfRootPath && (
              <button
                type="button"
                onClick={() => scanProjects(sfRootPath)}
                className="p-2 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#0d1117", border: "1px solid #30363d" }}
                title="Refresh"
              >
                <RefreshCw size={13} color="#8b949e" />
              </button>
            )}
          </div>
        </div>

        {/* Scan loading */}
        {scanLoading && (
          <div className="flex items-center gap-2 text-[12px] text-[#8b949e] py-3">
            <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: "#58a6ff" }} />
            Scanning projects...
          </div>
        )}

        {/* Scan error */}
        {scanError && <div className="text-[12px] text-[#ef4444] py-2">{scanError}</div>}

        {/* Project list */}
        {!scanLoading && !scanError && localProjects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {localProjects.map((project) => (
              <div
                key={project.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ background: "#0d1117", border: "1px solid #21262d" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#e6edf3] truncate">{project.name}</div>
                  <div className="text-[10px] text-[#484f58] font-mono truncate mt-0.5">{project.path}</div>
                </div>

                {/* Branch */}
                {project.branch && (
                  <div className="flex items-center gap-1 shrink-0">
                    <GitBranch size={10} color="#484f58" />
                    <span className="text-[10px] text-[#484f58]">{project.branch}</span>
                  </div>
                )}

                {/* Behind/ahead */}
                {project.behind > 0 && (
                  <span className="text-[10px] font-mono shrink-0" style={{ color: "#d29922" }}>
                    {project.behind}↓
                  </span>
                )}
                {project.ahead > 0 && (
                  <span className="text-[10px] font-mono shrink-0" style={{ color: "#3fb950" }}>
                    {project.ahead}↑
                  </span>
                )}

                {/* Pull origin */}
                <button
                  type="button"
                  onClick={() => pullProject(project.path, project.name)}
                  disabled={pullState[project.path] === "pulling"}
                  className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: pullState[project.path] === "done" ? "#0d2b1d" : pullState[project.path] === "error" ? "#2b0d0d" : "#21262d",
                    color: pullState[project.path] === "done" ? "#3fb950" : pullState[project.path] === "error" ? "#f85149" : "#ccc",
                    border: `1px solid ${pullState[project.path] === "done" ? "#3fb95030" : pullState[project.path] === "error" ? "#f8514930" : "#30363d"}`,
                  }}
                >
                  <RefreshCw size={10} className={pullState[project.path] === "pulling" ? "animate-spin" : ""} />
                  Pull
                </button>

                {/* VS Code */}
                <button
                  type="button"
                  onClick={() => fetch("/api/open-vscode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectPath: project.path }) })}
                  className="shrink-0 flex items-center justify-center p-1.5 rounded-md cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#21262d", color: "#ccc", border: "1px solid #30363d" }}
                  title="Open in VS Code"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.86V4.14a1.5 1.5 0 0 0-.85-1.553zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                  </svg>
                </button>

                {/* Install */}
                <button
                  type="button"
                  onClick={() => setupProject(project.path, project.name)}
                  disabled={setupState[project.path] === "running"}
                  className="relative overflow-hidden shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={(() => {
                    const needsSetup = !project.hasNodeModules || !project.hasSourceflow;
                    const s = setupState[project.path];
                    if (s === "done") return { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" };
                    if (s === "error") return { background: "#2b0d0d", color: "#f85149", border: "1px solid #f8514930" };
                    if (s === "running") return { background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff30" };
                    if (needsSetup) return { background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff50" };
                    return { background: "#21262d", color: "#ccc", border: "1px solid #30363d" };
                  })()}
                >
                  {setupState[project.path] === "running" && (
                    <span
                      className="absolute inset-0 transition-all duration-300"
                      style={{ width: `${setupProgress[project.path] ?? 0}%`, background: "#58a6ff20" }}
                    />
                  )}
                  <span className="relative z-10">
                    {setupState[project.path] === "running"
                      ? `Installing ${setupProgress[project.path] ?? 0}%`
                      : setupState[project.path] === "done"
                      ? "✓ Done"
                      : setupState[project.path] === "error"
                      ? "Failed"
                      : "Install"}
                  </span>
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ name: project.name, path: project.path })}
                  className="shrink-0 flex items-center justify-center p-1.5 rounded-md cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#2b0d0d", color: "#f85149", border: "1px solid #f8514930" }}
                  title="Delete project"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!scanLoading && !scanError && sfRootPath && localProjects.length === 0 && (
          <div className="text-[12px] text-[#484f58] py-2">No git projects found in this folder.</div>
        )}

        {!sfRootPath && !scanLoading && (
          <div className="text-[12px] text-[#484f58] py-2">Set a root folder to see your local projects.</div>
        )}
        </>)}
      </div>
    </div>
  );
}
