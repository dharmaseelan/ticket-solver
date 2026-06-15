"use client";
import { useState } from "react";
import { Phase, Solution, ProjectResult } from "./types";
import { LogConsole } from "./components/LogConsole";
import { FolderPicker } from "./components/FolderPicker";
import { SolutionPanel } from "./components/SolutionPanel";
import { makeLog, type LogEntry } from "./lib/log";
import { Plus, X, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

type Requirement = {
  title: string;
  description: string;
  points: string[];
  relevantFiles: string[];
};

type CmsStats = {
  pageBuilderPages: number;
  pageBuilderLive: number;
  pageBuilderDraft: number;
  cmsPages: number;
  categories: number;
  basePages: number;
};

type CmsStatsEntry = { name: string; stats: CmsStats; pageInfo: CmsPageInfo | null };

type CmsPageInfo = {
  slug: string;
  type: "page-builder" | "cms-page" | "not-found";
  title: string;
  components?: string[];
  files?: string[];
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [projectPaths, setProjectPaths] = useState<string[]>(() => {
    if (typeof window === "undefined") return [""];
    const pending = localStorage.getItem("openInTicket");
    if (pending) { localStorage.removeItem("openInTicket"); return [pending]; }
    return [""];
  });
  const [request, setRequest] = useState("");
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [cmsStats, setCmsStats] = useState<CmsStatsEntry[] | null>(null);
  const [cmsExpanded, setCmsExpanded] = useState<Record<number, boolean>>({});
  const [solutions, setSolutions] = useState<ProjectResult[]>([]);
  const [godfatherNote, setGodfatherNote] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [projectProgress, setProjectProgress] = useState<{ percent: number; step: string; status: "waiting" | "running" | "done" }[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [cmsResetState, setCmsResetState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [cmsResetProgress, setCmsResetProgress] = useState(0);
  const [npmInstallState, setNpmInstallState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [npmInstallProgress, setNpmInstallProgress] = useState(0);
  const [branches, setBranches] = useState<Record<number, string>>({});
  const [gitCounts, setGitCounts] = useState<Record<number, { behind: number; ahead: number }>>({});
  const [gitFetchState, setGitFetchState] = useState<Record<number, "idle" | "running" | "done" | "error">>({});
  const [gitFetchError, setGitFetchError] = useState<Record<number, string>>({});

  const log = (msg: string, type: LogEntry["type"] = "info") =>
    setLogs((prev) => [...prev, makeLog(msg, type)]);

  const canSubmit = request.trim().length > 0;

  function addPath() {
    setProjectPaths((prev) => [...prev, ""]);
  }

  function removePath(i: number) {
    setProjectPaths((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePath(i: number, value: string) {
    setProjectPaths((prev) => prev.map((p, idx) => (idx === i ? value : p)));
    if (value.trim()) {
      // Get branch name quickly from local git
      fetch("/api/git-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: value.trim() }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.branch) setBranches((prev) => ({ ...prev, [i]: d.branch }));
          else setBranches((prev) => { const n = { ...prev }; delete n[i]; return n; });
        })
        .catch(() => {});

      // Auto-fetch from remote to show accurate behind count
      setGitFetchState((prev) => ({ ...prev, [i]: "running" }));
      fetch("/api/git-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPaths: [value.trim()] }),
      })
        .then((r) => r.json())
        .then((d) => {
          const result = d.results?.[0];
          if (result?.success) {
            setGitCounts((prev) => ({ ...prev, [i]: { behind: result.behind, ahead: result.ahead } }));
          }
          setGitFetchState((prev) => ({ ...prev, [i]: "idle" }));
        })
        .catch(() => setGitFetchState((prev) => ({ ...prev, [i]: "idle" })));
    } else {
      setBranches((prev) => { const n = { ...prev }; delete n[i]; return n; });
      setGitCounts((prev) => { const n = { ...prev }; delete n[i]; return n; });
      setGitFetchState((prev) => { const n = { ...prev }; delete n[i]; return n; });
    }
  }

  async function resetCms() {
    const paths = projectPaths.filter((p) => p.trim());
    if (!paths.length) return;
    setCmsResetState("running");
    setCmsResetProgress(0);

    let progress = 0;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8 + 3, 88);
      setCmsResetProgress(Math.round(progress));
    }, 400);

    try {
      const res = await fetch("/api/cms-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPaths: paths }),
      });
      const data = await res.json();
      clearInterval(ticker);
      setCmsResetProgress(100);
      const allOk = data.results?.every((r: { success: boolean }) => r.success);
      setCmsResetState(allOk ? "done" : "error");
      setTimeout(() => { setCmsResetState("idle"); setCmsResetProgress(0); }, 3000);
    } catch {
      clearInterval(ticker);
      setCmsResetState("error");
      setCmsResetProgress(0);
      setTimeout(() => setCmsResetState("idle"), 3000);
    }
  }

  async function npmInstall() {
    const paths = projectPaths.filter((p) => p.trim());
    if (!paths.length) return;
    setNpmInstallState("running");
    setNpmInstallProgress(0);

    let progress = 0;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8 + 3, 88);
      setNpmInstallProgress(Math.round(progress));
    }, 400);

    try {
      const res = await fetch("/api/npm-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPaths: paths }),
      });
      const data = await res.json();
      clearInterval(ticker);
      setNpmInstallProgress(100);
      const allOk = data.results?.every((r: { success: boolean }) => r.success);
      setNpmInstallState(allOk ? "done" : "error");
      setTimeout(() => { setNpmInstallState("idle"); setNpmInstallProgress(0); }, 3000);
    } catch {
      clearInterval(ticker);
      setNpmInstallState("error");
      setNpmInstallProgress(0);
      setTimeout(() => setNpmInstallState("idle"), 3000);
    }
  }

  async function gitPull(i: number, projectPath: string) {
    if (!projectPath.trim()) return;
    setGitFetchState((prev) => ({ ...prev, [i]: "running" }));
    try {
      const res = await fetch("/api/git-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      });
      const data = await res.json();
      if (data.success) {
        setGitCounts((prev) => ({ ...prev, [i]: { behind: data.pulled, ahead: 0 } }));
        setGitFetchState((prev) => ({ ...prev, [i]: "done" }));
        setTimeout(() => {
          setGitCounts((prev) => ({ ...prev, [i]: { behind: 0, ahead: 0 } }));
          setGitFetchState((prev) => ({ ...prev, [i]: "idle" }));
        }, 4000);
      } else {
        setGitFetchError((prev) => ({ ...prev, [i]: data.error ?? "Pull failed" }));
        setGitFetchState((prev) => ({ ...prev, [i]: "error" }));
        setTimeout(() => setGitFetchState((prev) => ({ ...prev, [i]: "idle" })), 5000);
      }
    } catch (e) {
      setGitFetchError((prev) => ({ ...prev, [i]: e instanceof Error ? e.message : String(e) }));
      setGitFetchState((prev) => ({ ...prev, [i]: "error" }));
      setTimeout(() => setGitFetchState((prev) => ({ ...prev, [i]: "idle" })), 5000);
    }
  }

  const activePaths = projectPaths.filter((p) => p.trim());

  async function analyzeChanges() {
    if (!canSubmit) return;
    setPhase("analyzing");
    setLogs([]);
    setRequirement(null);
    setSolutions([]);
    setError("");

    try {
      log("Analysing your ticket...");
      if (activePaths.length > 0) {
        log(`Reading ${activePaths.length} project${activePaths.length > 1 ? "s" : ""}...`);
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request,
          projectPaths: activePaths.length > 0 ? activePaths : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to analyse");

      log("Done.", "success");
      setRequirement(data.requirement);
      if (data.cmsStats) setCmsStats(data.cmsStats);
      setPhase("analyzed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      log(msg, "error");
      setError(msg);
      setPhase("error");
    }
  }

  async function proceedWithChanges() {
    if (!requirement) return;
    const paths = activePaths;
    if (paths.length === 0) return;

    setPhase("solving");
    setError("");
    setProjectProgress(paths.map(() => ({ percent: 0, step: "", status: "waiting" })));

    const results: ProjectResult[] = [];

    const updateProgress = (i: number, patch: Partial<{ percent: number; step: string; status: "waiting" | "running" | "done" }>) => {
      setProjectProgress((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
    };

    try {
      for (let i = 0; i < paths.length; i++) {
        const pPath = paths[i];

        updateProgress(i, { status: "running", percent: 0, step: "Starting..." });

        const res = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request,
            requirement,
            projectPath: pPath.trim(),
            godfatherNote: godfatherNote.trim() || undefined,
            model,
          }),
        });

        if (!res.body) throw new Error("No response stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const event = JSON.parse(line.slice(6));

            if (event.error) throw new Error(event.error);

            const patch: Partial<{ percent: number; step: string; status: "waiting" | "running" | "done" }> = { status: "running" };
            if (event.step) patch.step = event.step;
            if (typeof event.percent === "number") patch.percent = event.percent;
            updateProgress(i, patch);

            if (event.solution) {
              results.push({ projectPath: pPath, solution: event.solution as Solution });
            }
          }
        }

        updateProgress(i, { status: "done", percent: 100, step: "Done" });
      }

      setSolutions(results);
      setPhase("solved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setRequirement(null);
    setCmsStats(null);
    setSolutions([]);
    setProjectProgress([]);
    setLogs([]);
    setRequest("");
    setGodfatherNote("");
    setError("");
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#ede5dc]">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="mb-6">
          <div className="text-[18px] font-bold text-white">Tickets</div>
          <div className="text-[12px] text-[#8b949e] mt-1">Analyse and resolve support tickets with AI.</div>
        </div>

        {/* Input form */}
        {(phase === "idle" || phase === "error") && (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <label className="block text-[11px] text-[#8b949e] uppercase tracking-widest mb-3">
                Project root path{projectPaths.length > 1 ? "s" : ""}              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {projectPaths.map((p, i) => (
                  <div key={i} className="flex flex-col gap-1">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updatePath(i, e.target.value)}
                        placeholder="/Users/dharma/projects/client-site"
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 text-[13px] text-[#e8ddd4] outline-none placeholder-[#6e7681]"
                        style={{ paddingRight: branches[i] ? "90px" : undefined }}
                      />
                      {branches[i] && (
                        <span
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff30" }}
                        >
                          {branches[i]}
                        </span>
                      )}
                    </div>
                    {projectPaths[i].trim() && (
                      <button
                        type="button"
                        onClick={() => gitPull(i, projectPaths[i])}
                        disabled={gitFetchState[i] === "running"}
                        title={gitFetchState[i] === "error" ? gitFetchError[i] : undefined}
                        className="flex items-center gap-1 text-[11px] px-2 rounded-lg transition-colors cursor-pointer shrink-0 h-9"
                        style={(() => {
                          const state = gitFetchState[i];
                          if (state === "error") return { background: "#1a0808", color: "#ef4444", border: "1px solid #3a1010" };
                          if (state === "done") return { background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff30" };
                          return { background: "#0d1117", color: "#8b949e", border: "1px solid #30363d" };
                        })()}
                      >
                        <RefreshCw size={10} className={gitFetchState[i] === "running" ? "animate-spin" : ""} />
                        {gitFetchState[i] === "running"
                          ? (gitCounts[i]?.behind > 0 ? "Pulling..." : "Checking...")
                          : gitFetchState[i] === "error" ? "Failed"
                          : gitFetchState[i] === "done"
                          ? (gitCounts[i]?.behind > 0 ? `✓ Pulled ${gitCounts[i].behind}` : "✓ Up to date")
                          : gitCounts[i]?.behind > 0
                          ? <span className="flex items-center gap-1">Pull <span className="font-mono">{gitCounts[i].behind}<span style={{ marginTop: "-2px" }} className="inline-block text-[13px]">↓</span></span></span>
                          : "Pull"
                        }
                      </button>
                    )}
                    <FolderPicker onSelect={(path) => updatePath(i, path)} />
                    {projectPaths.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePath(i)}
                        className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors cursor-pointer p-1.5"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {gitFetchState[i] === "error" && gitFetchError[i] && (
                    <div className="text-[10px] font-mono text-[#ef4444] px-1 truncate" title={gitFetchError[i]}>
                      {gitFetchError[i]}
                    </div>
                  )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={addPath}
                  className="flex items-center gap-1.5 text-[12px] text-[#8b949e] hover:text-[#c9d1d9] transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  Add another project
                </button>

                {activePaths.length > 0 && (
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={npmInstall}
                    disabled={npmInstallState === "running"}
                    className="relative overflow-hidden flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{
                      background: npmInstallState === "done" ? "#0d1f38" : npmInstallState === "error" ? "#1a0808" : "#0d1117",
                      color: npmInstallState === "done" ? "#58a6ff" : npmInstallState === "error" ? "#ef4444" : "#8b949e",
                      border: `1px solid ${npmInstallState === "done" ? "#58a6ff30" : npmInstallState === "error" ? "#3a1010" : "#30363d"}`,
                    }}
                  >
                    {npmInstallState === "running" && (
                      <span
                        className="absolute inset-0 transition-all duration-300"
                        style={{ width: `${npmInstallProgress}%`, background: "#58a6ff15" }}
                      />
                    )}
                    <span className="relative z-10">
                      {npmInstallState === "running"
                        ? `Installing ${npmInstallProgress}%`
                        : npmInstallState === "done"
                        ? "✓ Installed"
                        : npmInstallState === "error"
                        ? "Install failed"
                        : "npm install"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={resetCms}
                    disabled={cmsResetState === "running"}
                    className="relative overflow-hidden flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{
                      background: cmsResetState === "done" ? "#0d1f38" : cmsResetState === "error" ? "#1a0808" : "#0d1117",
                      color: cmsResetState === "done" ? "#58a6ff" : cmsResetState === "error" ? "#ef4444" : "#8b949e",
                      border: `1px solid ${cmsResetState === "done" ? "#58a6ff30" : cmsResetState === "error" ? "#3a1010" : "#30363d"}`,
                    }}
                  >
                    {cmsResetState === "running" && (
                      <span
                        className="absolute inset-0 transition-all duration-300"
                        style={{ width: `${cmsResetProgress}%`, background: "#58a6ff15" }}
                      />
                    )}
                    <span className="relative z-10">
                      {cmsResetState === "running"
                        ? `Resetting ${cmsResetProgress}%`
                        : cmsResetState === "done"
                        ? "✓ CMS Reset"
                        : cmsResetState === "error"
                        ? "Reset failed"
                        : "Reset CMS"}
                    </span>
                  </button>
                  </div>
                )}
              </div>

            </div>

            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <label className="block text-[11px] text-[#8b949e] uppercase tracking-widest mb-2">
                Ticket description
              </label>
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                    e.preventDefault();
                    analyzeChanges();
                  }
                }}
                placeholder={'Paste the client\'s ticket — e.g. "the apply button on job listings is broken and not submitting the form"'}
                rows={5}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 text-[13px] text-[#e8ddd4] outline-none mb-4 placeholder-[#6e7681] resize-none leading-relaxed"
              />
              {/* Model selector */}
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Model</div>
                <div className="flex gap-2">
                  {[
                    { id: "claude-haiku-4-5",  label: "Haiku 4.5",  desc: "Fast & cheap",  icon: "⚡" },
                    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "Recommended",   icon: "✦", badge: true },
                    { id: "claude-opus-4-8",   label: "Opus 4.8",   desc: "Most capable",  icon: "◆" },
                  ].map((m) => {
                    const active = model === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModel(m.id)}
                        className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-md transition-all cursor-pointer relative"
                        style={{
                          background: active ? "#0d1f38" : "#0d1117",
                          border: `1px solid ${active ? "#58a6ff60" : "#30363d"}`,
                          boxShadow: active ? "0 0 0 1px #58a6ff20" : "none",
                        }}
                      >
                        {m.badge && !active && (
                          <span
                            className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                            style={{ background: "#58a6ff20", color: "#58a6ff", border: "1px solid #58a6ff30" }}
                          >
                            default
                          </span>
                        )}
                        <span className="text-[14px] leading-none" style={{ opacity: active ? 1 : 0.4 }}>{m.icon}</span>
                        <span className="text-[12px] font-semibold leading-none" style={{ color: active ? "#58a6ff" : "#666" }}>
                          {m.label}
                        </span>
                        <span className="text-[10px] leading-none" style={{ color: active ? "#58a6ff70" : "#30363d" }}>
                          {m.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={analyzeChanges}
                  disabled={!canSubmit}
                  className="py-2 px-5 rounded-md text-[13px] font-semibold transition-opacity hover:opacity-80 active:opacity-70"
                  style={{
                    background: "#1f6feb",
                    color: "#ffffff",
                    opacity: canSubmit ? 1 : 0.35,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                >
                  Analyse Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-xl p-4 mb-4 text-[13px] leading-relaxed animate-fade-in" style={{ background: "#1a0808", border: "1px solid #3a1010", color: "#ef4444" }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <LogConsole logs={logs} />

        {/* Analysing spinner */}
        {phase === "analyzing" && (
          <div className="flex items-center gap-3 py-4 text-[13px] text-[#8b949e]">
            <div className="w-2.5 h-2.5 rounded-full pulse-dot" style={{ background: "#58a6ff" }} />
            Analysing ticket...
          </div>
        )}

        {/* Solving progress — per project rows */}
        {phase === "solving" && projectProgress.length > 0 && (
          <div className="animate-fade-in rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            <div className="text-[11px] uppercase tracking-widest mb-4 text-[#8b949e]">Applying fixes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {projectProgress.map((p, i) => {
                const name = activePaths[i]?.split("/").pop() || activePaths[i];
                const isDone = p.status === "done";
                const isRunning = p.status === "running";
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isDone && (
                          <span className="text-[13px]" style={{ color: "#58a6ff" }}>✓</span>
                        )}
                        {isRunning && (
                          <div className="w-2 h-2 rounded-full pulse-dot shrink-0" style={{ background: "#58a6ff" }} />
                        )}
                        {p.status === "waiting" && (
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#30363d" }} />
                        )}
                        <span className="text-[13px] font-semibold" style={{ color: isDone ? "#fff" : isRunning ? "#fff" : "#444" }}>
                          {name}
                        </span>
                      </div>
                      <span className="text-[12px] font-bold" style={{ color: isDone ? "#58a6ff" : isRunning ? "#58a6ff" : "#333" }}>
                        {isDone ? "Done ✓" : isRunning ? `${p.percent}%` : "Waiting..."}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: "#30363d" }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${p.percent}%`,
                          background: isDone ? "#58a6ff60" : "#58a6ff",
                        }}
                      />
                    </div>
                    {isRunning && p.step && (
                      <div className="text-[11px] text-[#8b949e] mt-1 truncate">{p.step}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Requirement card + proceed */}
        {phase === "analyzed" && requirement && (
          <div className="animate-fade-in">

            <div className="rounded-2xl p-5 mb-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "#58a6ff" }}>
                Requirement
              </div>
              <div className="text-[15px] font-semibold text-white leading-snug mb-2">
                {requirement.title}
              </div>
              <div className="text-[13px] text-[#888] mb-4 leading-relaxed">
                {requirement.description}
              </div>
              {requirement.points.length > 0 && (
                <ul className="space-y-2">
                  {requirement.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-[#ccc]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#58a6ff" }} />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(() => {
              const confirmedFiles = cmsStats?.[0]?.pageInfo?.files;
              const filesToShow = confirmedFiles?.length ? confirmedFiles : requirement.relevantFiles;
              const isConfirmed = !!confirmedFiles?.length;
              return filesToShow?.length > 0 ? (
                <div className="rounded-xl p-4 mb-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[11px] uppercase tracking-widest text-[#8b949e]">
                      Files likely involved
                    </div>
                    {isConfirmed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff40" }}>
                        confirmed from CMS
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {filesToShow.map((file, i) => (
                      <li key={i} className="text-[12px] font-mono text-[#666]">
                        {file}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            {cmsStats && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="text-[11px] uppercase tracking-widest mb-3 text-[#8b949e]">
                  Sourceflow CMS
                </div>

                {cmsStats.map((entry, idx) => {
                  const isOpen = cmsExpanded[idx] === true;
                  return (
                    <div key={idx}>
                      {/* Collapsible project header — only shown for multiple projects */}
                      {cmsStats.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCmsExpanded((prev) => ({ ...prev, [idx]: !isOpen }))}
                          className="w-full flex items-center gap-1.5 mb-2 cursor-pointer"
                        >
                          <span style={{ color: "#58a6ff", fontSize: 10 }}>◈</span>
                          <span className="text-[12px] font-semibold text-[#ccc] flex-1 text-left">{entry.name}</span>
                          {isOpen ? <ChevronDown size={12} color="#555" /> : <ChevronRight size={12} color="#555" />}
                        </button>
                      )}

                      {/* Collapsible content */}
                      {(cmsStats.length === 1 || isOpen) && (
                        <>
                          {/* Stat boxes */}
                          <div className="flex gap-3 mb-3">
                            <div className="flex-1 rounded-lg px-3 py-2.5" style={{ background: "#0d1117", border: "1px solid #30363d" }}>
                              <div className="text-[18px] font-bold text-center" style={{ color: "#58a6ff" }}>{entry.stats.pageBuilderPages}</div>
                              <div className="text-[10px] text-[#8b949e] mt-0.5 text-center leading-tight">Page builder</div>
                              <div className="flex justify-center gap-2 mt-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#0d2614", color: "#3fb950" }}>
                                  {entry.stats.pageBuilderLive} live
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#1f1a0a", color: "#d29922" }}>
                                  {entry.stats.pageBuilderDraft} draft
                                </span>
                              </div>
                            </div>
                            {[
                              { label: "Base pages", value: entry.stats.basePages },
                              { label: "Categories pages", value: entry.stats.cmsPages },
                              { label: "Categories", value: entry.stats.categories },
                            ].map((stat) => (
                              <div key={stat.label} className="flex-1 rounded-lg px-3 py-2.5 text-center flex flex-col items-center justify-center" style={{ background: "#0d1117", border: "1px solid #30363d" }}>
                                <div className="text-[18px] font-bold" style={{ color: "#58a6ff" }}>{stat.value}</div>
                                <div className="text-[10px] text-[#8b949e] mt-0.5 leading-tight">{stat.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Detected page for this project */}
                          {entry.pageInfo && (
                            <div className="rounded-lg px-3 py-3 mb-3" style={{ background: "#0d1117", border: "1px solid #30363d" }}>
                              <div className="flex items-center justify-between mb-3">
                                {entry.pageInfo.title && (
                                  <div>
                                    <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-0.5">Page Title</div>
                                    <div className="text-[13px] font-semibold text-[#ccc]">{entry.pageInfo.title}</div>
                                  </div>
                                )}
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                                  style={
                                    entry.pageInfo.type === "page-builder"
                                      ? { background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff40" }
                                      : entry.pageInfo.type === "cms-page"
                                      ? { background: "#0d1520", color: "#60a5fa", border: "1px solid #60a5fa40" }
                                      : { background: "#1a1410", color: "#888", border: "1px solid #30363d" }
                                  }
                                >
                                  {entry.pageInfo.type === "page-builder" ? "Page Builder" : entry.pageInfo.type === "cms-page" ? "CMS Page" : "Not Found"}
                                </span>
                              </div>

                              <div className="mb-3">
                                <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-0.5">Page URL</div>
                                <div className="text-[12px] font-mono text-[#666]">/{entry.pageInfo.slug}</div>
                              </div>

                              {entry.pageInfo.type === "not-found" && (
                                <div className="text-[11px] text-[#8b949e]">No CMS entry found — likely a hardcoded page.</div>
                              )}

                              {entry.pageInfo.components && entry.pageInfo.components.length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-1.5">Components on this page</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {entry.pageInfo.components.map((c) => (
                                      <span key={c} className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "#161b22", color: "#888", border: "1px solid #30363d" }}>
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Divider between projects */}
                      {cmsStats.length > 1 && idx < cmsStats.length - 1 && (
                        <div className="mb-3" style={{ borderTop: "1px solid #21262d" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Godfather Note */}
            <div className="rounded-xl p-4 mb-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <label className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "#58a6ff" }}>
                Developer Note
              </label>
              <p className="text-[11px] text-[#8b949e] mb-3">Any extra context the AI should know before fixing this.</p>
              <textarea
                value={godfatherNote}
                onChange={(e) => setGodfatherNote(e.target.value)}
                placeholder={'e.g. "Don\'t touch the styles. This component is shared across 3 pages."'}
                rows={3}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 text-[13px] text-[#e8ddd4] outline-none placeholder-[#6e7681] resize-none leading-relaxed"
              />
            </div>

            {activePaths.length > 1 && (
              <div className="rounded-lg px-4 py-3 mb-3 text-[12px]" style={{ background: "#0d1f38", border: "1px solid #58a6ff20", color: "#58a6ff80" }}>
                Fix will be applied to {activePaths.length} projects: {activePaths.map(p => p.split("/").pop()).join(", ")}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mb-4">
              <button
                onClick={reset}
                className="text-[12px] text-[#8b949e] hover:text-[#c9d1d9] cursor-pointer transition-colors"
              >
                ↩ Start over
              </button>
              <button
                type="button"
                onClick={proceedWithChanges}
                className="py-2 px-5 rounded-md text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-80 active:opacity-70"
                style={{ background: "#1f6feb", color: "#ffffff" }}
              >
                Proceed with Changes{activePaths.length > 1 ? ` (${activePaths.length} projects)` : ""}
              </button>
            </div>
          </div>
        )}

        {/* Solution */}
        {phase === "solved" && solutions.length > 0 && (
          <SolutionPanel
            projects={solutions}
            ticketSubject={requirement?.title || ""}
            ticketRequest={request}
            godfatherNote={godfatherNote}
            onBack={reset}
          />
        )}

      </div>
    </div>
  );
}
