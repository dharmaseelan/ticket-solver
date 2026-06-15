"use client";

import { useState, useEffect } from "react";
import { LayoutTemplate, Puzzle, RefreshCw, ChevronDown, ChevronRight, Package, FolderOpen, AlertCircle, X, Trash2 } from "lucide-react";
import { FolderPicker } from "@/app/components/FolderPicker";

type Tab = "setup" | "components";

type Component = {
  name: string;
  hasDefinitions: boolean;
  isPushed: boolean;
  usageCount: number;
  usagePages: { url: string; count: number; isDraft: boolean }[];
};

type PBProject = {
  name: string;
  path: string;
  isSetup: boolean;
  hasBuilder: boolean;
  hasPackage: boolean;
  components: Component[];
  nonBuilderComponents: Component[];
};

export default function PageBuilderSetupPage() {
  const [activeTab, setActiveTab] = useState<Tab>("setup");

  // Page Builder Setup tab state (independent)
  const [setupRootInput, setSetupRootInput] = useState("");
  const [setupRootPath, setSetupRootPath] = useState("");
  const [setupScanning, setSetupScanning] = useState(false);
  const [setupScanError, setSetupScanError] = useState("");

  // Add Components tab state
  const [pbRootInput, setPbRootInput] = useState("");
  const [pbRootPath, setPbRootPath] = useState("");
  const [projects, setProjects] = useState<PBProject[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; projectName: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [generateState, setGenerateState] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [generateProgress, setGenerateProgress] = useState<Record<string, number>>({});
  const [generatedEntries, setGeneratedEntries] = useState<Record<string, { projectPath: string; compName: string; projectName: string; files: { name: string; content: string }[] }>>({});
  const [deleteGeneratedTarget, setDeleteGeneratedTarget] = useState<string | null>(null);
  const [generatedExpanded, setGeneratedExpanded] = useState<Record<string, boolean>>({});
  const [generatedFileTab, setGeneratedFileTab] = useState<Record<string, number>>({});
  const [selectedBuilderComp, setSelectedBuilderComp] = useState<{ projectPath: string; compName: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pbRootPath") || "";
    setPbRootPath(saved);
    setPbRootInput(saved);
    if (saved) scanProjects(saved);

    const savedSetup = localStorage.getItem("pbSetupRootPath") || "";
    setSetupRootPath(savedSetup);
    setSetupRootInput(savedSetup);

    try {
      const savedEntries = localStorage.getItem("pbGeneratedEntries");
      if (savedEntries) setGeneratedEntries(JSON.parse(savedEntries));
    } catch { /* ignore */ }
  }, []);

  async function scanProjects(root: string) {
    setScanning(true);
    setScanError("");
    setScanProgress(null);

    try {
      const res = await fetch("/api/page-builder/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPath: root }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "progress") {
            setScanProgress({ current: msg.current, total: msg.total, projectName: msg.projectName });
          } else if (msg.type === "done") {
            const scanned: PBProject[] = msg.projects || [];
            setProjects(scanned);
            setGenerateState((prev) => {
              const next = { ...prev };
              for (const project of scanned) {
                for (const comp of project.nonBuilderComponents) {
                  delete next[`${project.path}::${comp.name}`];
                }
              }
              return next;
            });
          } else if (msg.type === "error") {
            setScanError(msg.error);
          }
        }
      }
    } catch {
      setScanError("Failed to scan projects");
    }

    setScanning(false);
    setScanProgress(null);
  }

  function saveRoot() {
    const v = pbRootInput.trim().replace(/\/$/, "");
    setPbRootPath(v);
    localStorage.setItem("pbRootPath", v);
    scanProjects(v);
  }

  function saveSetupRoot() {
    const v = setupRootInput.trim().replace(/\/$/, "");
    setSetupRootPath(v);
    localStorage.setItem("pbSetupRootPath", v);
    setSetupScanning(true);
    setSetupScanError("");
    fetch("/api/page-builder/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootPath: v }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSetupScanning(false);
        if (data.error) setSetupScanError(data.error);
      })
      .catch(() => { setSetupScanning(false); setSetupScanError("Failed to validate path"); });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const setupProjects = projects.filter((p) => p.isSetup);

  async function generateComponent(projectPath: string, componentName: string) {
    const key = `${projectPath}::${componentName}`;
    setGenerateState((prev) => ({ ...prev, [key]: "running" }));
    setGenerateProgress((prev) => ({ ...prev, [key]: 0 }));

    let progress = 0;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 4 + 1, 88);
      setGenerateProgress((prev) => ({ ...prev, [key]: Math.round(progress) }));
    }, 400);

    const res = await fetch("/api/page-builder/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, componentName }),
    }).then((r) => r.json());

    clearInterval(ticker);

    if (res.success) {
      setGenerateProgress((prev) => ({ ...prev, [key]: 100 }));
      setGenerateState((prev) => ({ ...prev, [key]: "done" }));
      if (res.files) {
        const project = setupProjects.find((p) => p.path === projectPath);
        setGeneratedEntries((prev) => {
          const next = { ...prev, [key]: { projectPath, compName: componentName, projectName: project?.name ?? "", files: res.files } };
          localStorage.setItem("pbGeneratedEntries", JSON.stringify(next));
          return next;
        });
        setGeneratedExpanded((prev) => ({ ...prev, [key]: true }));
        setGeneratedFileTab((prev) => ({ ...prev, [key]: 0 }));
      }
      setSelected((prev) => ({ ...prev, [projectPath]: (prev[projectPath] ?? []).filter((n) => n !== componentName) }));
      if (pbRootPath) setTimeout(() => scanProjects(pbRootPath), 500);
    } else {
      setGenerateProgress((prev) => ({ ...prev, [key]: 0 }));
      setGenerateState((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  async function generateAll(projectPath: string) {
    const names = selected[projectPath] ?? [];
    for (const name of names) {
      await generateComponent(projectPath, name);
    }
  }

  // Components in /components folder without definitions.sourceflow.mjs
  const missingDefinitions = setupProjects
    .map((p) => ({ project: p, components: p.nonBuilderComponents }))
    .filter((p) => p.components.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      {/* Delete generated component confirmation */}
      {deleteGeneratedTarget && (() => {
        const entry = generatedEntries[deleteGeneratedTarget];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="rounded-xl p-6 w-full max-w-sm mx-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <div className="text-[15px] font-semibold text-white mb-1">Remove generated component?</div>
              <div className="text-[12px] text-[#8b949e] mb-1">This will remove from the viewer:</div>
              <div className="text-[12px] font-semibold mb-5" style={{ color: "#f85149" }}>{entry?.compName}</div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteGeneratedTarget(null)}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#21262d", color: "#ccc", border: "1px solid #30363d" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const entry = generatedEntries[deleteGeneratedTarget];
                    if (entry) {
                      await fetch("/api/page-builder/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ projectPath: entry.projectPath, componentName: entry.compName }),
                      });
                      if (pbRootPath) scanProjects(pbRootPath);
                    }
                    setGeneratedEntries((prev) => {
                      const next = { ...prev };
                      delete next[deleteGeneratedTarget];
                      localStorage.setItem("pbGeneratedEntries", JSON.stringify(next));
                      return next;
                    });
                    setDeleteGeneratedTarget(null);
                  }}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#da3633", color: "#ffffff", border: "1px solid #f8514950" }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mb-6">
        <div className="text-[18px] font-bold text-white">Page Builder</div>
        <div className="text-[12px] text-[#8b949e] mt-1">Manage page builder setup and components.</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#30363d]">
        <button
          onClick={() => setActiveTab("setup")}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "setup"
              ? "border-[#58a6ff] text-white"
              : "border-transparent text-[#8b949e] hover:text-white"
          }`}
        >
          <LayoutTemplate size={14} />
          Page Builder Setup
        </button>
        <button
          onClick={() => setActiveTab("components")}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "components"
              ? "border-[#58a6ff] text-white"
              : "border-transparent text-[#8b949e] hover:text-white"
          }`}
        >
          <Puzzle size={14} />
          Add Components
        </button>
      </div>

      {/* Page Builder Setup tab */}
      {activeTab === "setup" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            <div className="text-[11px] text-[#8b949e] mb-1.5">Projects root folder</div>
            <div className="flex gap-2 items-center">
              <div
                className="flex-1 px-3 py-2 rounded-lg text-[12px] truncate"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: setupRootInput ? "#e8ddd4" : "#6e7681" }}
              >
                {setupRootInput || "Pick a folder..."}
              </div>
              <FolderPicker onSelect={(path) => setSetupRootInput(path)} />
              {setupRootPath && (
                <button
                  type="button"
                  onClick={() => fetch("/api/open-vscode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectPath: setupRootPath }) })}
                  className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
                  title="Open in VS Code"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.86V4.14a1.5 1.5 0 0 0-.85-1.553zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                  </svg>
                </button>
              )}
              {setupRootPath && (
                <button
                  type="button"
                  onClick={saveSetupRoot}
                  className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#0d1117", border: "1px solid #30363d" }}
                  title="Refresh"
                >
                  <RefreshCw size={13} color="#8b949e" className={setupScanning ? "animate-spin" : ""} />
                </button>
              )}
              <button
                type="button"
                onClick={saveSetupRoot}
                disabled={!setupRootInput}
                className="h-9 px-3 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#1f6feb", color: "#fff", opacity: setupRootInput ? 1 : 0.4, cursor: setupRootInput ? "pointer" : "not-allowed" }}
              >
                Set
              </button>
              {setupRootPath && (
                <button
                  type="button"
                  onClick={() => {
                    setSetupRootPath("");
                    setSetupRootInput("");
                    setSetupScanError("");
                    localStorage.removeItem("pbSetupRootPath");
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#2b0d0d", border: "1px solid #f8514930", color: "#f85149" }}
                  title="Clear folder"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {setupScanError && <div className="text-[12px] text-[#ef4444] mt-2">{setupScanError}</div>}
          </div>
        </div>
      )}

      {/* Add Components tab */}
      {activeTab === "components" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            {/* Root folder picker */}
            <div className="mb-5">
              <div className="text-[11px] text-[#8b949e] mb-1.5">Projects root folder</div>
              <div className="flex gap-2 items-center">
                <div
                  className="flex-1 px-3 py-2 rounded-lg text-[12px] truncate"
                  style={{ background: "#0d1117", border: "1px solid #30363d", color: pbRootInput ? "#e8ddd4" : "#6e7681" }}
                >
                  {pbRootInput || "Pick a folder..."}
                </div>
                <FolderPicker onSelect={(path) => setPbRootInput(path)} />
                {pbRootPath && (
                  <button
                    type="button"
                    onClick={() => fetch("/api/open-vscode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectPath: pbRootPath }) })}
                    className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
                    title="Open in VS Code"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.86V4.14a1.5 1.5 0 0 0-.85-1.553zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                    </svg>
                  </button>
                )}
                {pbRootPath && (
                  <button
                    type="button"
                    onClick={() => scanProjects(pbRootPath)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: "#0d1117", border: "1px solid #30363d" }}
                    title="Refresh"
                  >
                    <RefreshCw size={13} color="#8b949e" className={scanning ? "animate-spin" : ""} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveRoot}
                  disabled={!pbRootInput}
                  className="h-9 px-3 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "#1f6feb", color: "#fff", opacity: pbRootInput ? 1 : 0.4, cursor: pbRootInput ? "pointer" : "not-allowed" }}
                >
                  Set
                </button>
                {pbRootPath && (
                  <button
                    type="button"
                    onClick={() => {
                      setPbRootPath("");
                      setPbRootInput("");
                      setProjects([]);
                      setScanError("");
                      localStorage.removeItem("pbRootPath");
                    }}
                    className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: "#2b0d0d", border: "1px solid #f8514930", color: "#f85149" }}
                    title="Clear folder"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Scanning */}
            {scanning && (
              <div className="py-3">
                <div className="flex items-center justify-between text-[12px] text-[#8b949e] mb-2">
                  <span className="truncate">
                    {scanProgress ? `Scanning ${scanProgress.projectName}…` : "Starting scan…"}
                  </span>
                  {scanProgress && (
                    <span className="shrink-0 ml-3 tabular-nums">
                      {scanProgress.current}/{scanProgress.total} — {Math.round((scanProgress.current / scanProgress.total) * 100)}%
                    </span>
                  )}
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "#21262d" }}>
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: scanProgress ? `${(scanProgress.current / scanProgress.total) * 100}%` : "0%",
                      background: "#58a6ff",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {scanError && <div className="text-[12px] text-[#ef4444] py-2">{scanError}</div>}

            {/* Empty states */}
            {!scanning && !scanError && !pbRootPath && (
              <div className="text-[12px] text-[#484f58] py-2">Set a root folder to scan for projects.</div>
            )}
            {!scanning && !scanError && pbRootPath && projects.length === 0 && (
              <div className="text-[12px] text-[#484f58] py-2">No projects found in this folder.</div>
            )}
            {!scanning && !scanError && pbRootPath && projects.length > 0 && setupProjects.length === 0 && (
              <div className="rounded-lg px-4 py-3 text-[12px]" style={{ background: "#0d1f38", border: "1px solid #58a6ff30", color: "#58a6ff" }}>
                Page Builder hasn't been set up for this project yet. To get started, go to the <strong>Page Builder Setup</strong> tab.
              </div>
            )}

          </div>

          {/* Page Builder Components */}
          {!scanning && !scanError && setupProjects.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] uppercase tracking-widest text-[#3fb950]">Page Builder Components</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#0d2b1d", color: "#3fb950" }}>
                  {setupProjects.reduce((acc, p) => acc + p.components.length, 0)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {setupProjects.map((project) => (
                  <div key={project.path} className="rounded-lg overflow-hidden" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(project.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#161b22] transition-colors"
                    >
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-[13px] font-semibold text-[#e6edf3] truncate">{project.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {project.hasBuilder && (
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "#3fb950" }}>
                              <FolderOpen size={9} />
                              /builder
                            </span>
                          )}
                          {project.hasPackage && (
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "#58a6ff" }}>
                              <Package size={9} />
                              page-builder-cli
                            </span>
                          )}
                          {project.components.length > 0 && (
                            <span className="text-[10px] text-[#484f58]">{project.components.length} component{project.components.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      {project.components.length > 0 && (
                        expanded[project.path]
                          ? <ChevronDown size={13} color="#555" />
                          : <ChevronRight size={13} color="#555" />
                      )}
                    </button>

                    {expanded[project.path] && project.components.length > 0 && (
                      <div className="px-3 pb-3 pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {[...project.components].sort((a, b) => b.usageCount - a.usageCount).map((comp) => {
                            const isSelected = selectedBuilderComp?.projectPath === project.path && selectedBuilderComp?.compName === comp.name;
                            return (
                              <button
                                key={comp.name}
                                type="button"
                                onClick={() =>
                                  setSelectedBuilderComp((prev) =>
                                    prev?.projectPath === project.path && prev?.compName === comp.name
                                      ? null
                                      : { projectPath: project.path, compName: comp.name }
                                  )
                                }
                                className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md font-mono cursor-pointer transition-all"
                                style={
                                  isSelected
                                    ? { background: "#1d4a2d", color: "#3fb950", border: "1px solid #3fb950" }
                                    : !comp.isPushed
                                    ? { background: "#1a1206", color: "#d29922", border: "1px solid #d2992230" }
                                    : comp.hasDefinitions
                                    ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                                    : { background: "#1a1206", color: "#d29922", border: "1px solid #d2992230" }
                                }
                                title={!comp.isPushed ? "Not pushed yet" : "Click to see usage"}
                              >
                                {comp.name}
                                {!comp.isPushed && <AlertCircle size={9} />}
                                {comp.usageCount > 0 && (
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-px rounded-full"
                                    style={{ background: "rgba(0,0,0,0.35)", color: "inherit" }}
                                  >
                                    {comp.usageCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Usage detail panel */}
                        {selectedBuilderComp?.projectPath === project.path && (() => {
                          const comp = project.components.find((c) => c.name === selectedBuilderComp.compName);
                          if (!comp) return null;
                          return (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: "#21262d" }}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] text-[#8b949e]">Pages using</span>
                                <span className="text-[11px] font-mono font-semibold" style={{ color: "#3fb950" }}>{comp.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-px rounded-full" style={{ background: "#0d2b1d", color: "#3fb950" }}>
                                  {comp.usageCount}
                                </span>
                              </div>
                              {comp.usagePages.length === 0 ? (
                                <div className="text-[11px] text-[#484f58]">No usage data found</div>
                              ) : (
                                <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                                  {Object.values(
                                    comp.usagePages.reduce<Record<string, { url: string; count: number; isDraft: boolean }>>((acc, p) => {
                                      acc[p.url] = { url: p.url, count: (acc[p.url]?.count ?? 0) + p.count, isDraft: p.isDraft };
                                      return acc;
                                    }, {})
                                  ).sort((a, b) => b.count - a.count).map((page) => (
                                    <div
                                      key={page.url}
                                      className="flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono"
                                      style={{ background: "#0d1117" }}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span style={{ color: "#8b949e" }}>{page.url}</span>
                                        {page.isDraft && (
                                          <span className="text-[9px] font-bold px-1.5 py-px rounded-full shrink-0" style={{ background: "#2b1d06", color: "#d29922", border: "1px solid #d2992240" }}>Draft</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 ml-3 shrink-0">
                                        {page.count > 1 && (
                                          <span className="text-[10px]" style={{ color: "#58a6ff" }}>{page.count} usage</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {expanded[project.path] && project.components.length === 0 && (
                      <div className="px-3 pb-3 text-[11px] text-[#484f58]">No components in /builder yet.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Component — standalone card, persists after rescan */}
          {(() => {
            const entries = Object.values(generatedEntries);
            if (entries.length === 0) return null;
            return (
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] uppercase tracking-widest text-[#3fb950]">Generated Components</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#0d2b1d", color: "#3fb950" }}>
                    {entries.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {entries.map((entry) => {
                    const key = `${entry.projectPath}::${entry.compName}`;
                    const isOpen = generatedExpanded[key] ?? false;
                    const tabIdx = generatedFileTab[key] ?? 0;
                    const activeFile = entry.files[tabIdx];
                    return (
                      <div key={key} className="rounded-lg overflow-hidden" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setGeneratedExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                            className="flex-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#161b22] transition-colors min-w-0"
                          >
                            <div className="flex-1 min-w-0 text-left">
                              <div className="text-[13px] font-semibold text-[#e6edf3] truncate">{entry.compName}</div>
                            </div>
                            {isOpen ? <ChevronDown size={13} color="#555" /> : <ChevronRight size={13} color="#555" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteGeneratedTarget(key)}
                            className="p-2.5 mr-1 rounded-md cursor-pointer transition-opacity hover:opacity-80"
                            style={{ color: "#f85149" }}
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {isOpen && (
                          <div style={{ background: "#0d1117" }}>
                            <div className="flex border-b border-t" style={{ borderColor: "#21262d" }}>
                              {entry.files.map((file, i) => (
                                <button
                                  key={file.name}
                                  type="button"
                                  onClick={() => setGeneratedFileTab((prev) => ({ ...prev, [key]: i }))}
                                  className="px-3 py-1.5 text-[11px] font-mono cursor-pointer transition-colors"
                                  style={{
                                    color: tabIdx === i ? "#e6edf3" : "#8b949e",
                                    borderBottom: tabIdx === i ? "2px solid #3fb950" : "2px solid transparent",
                                    background: "transparent",
                                  }}
                                >
                                  {file.name}
                                </button>
                              ))}
                            </div>
                            <pre
                              className="text-[11px] font-mono leading-relaxed overflow-x-auto"
                              style={{ padding: "12px 14px", color: "#c9d1d9", margin: 0, maxHeight: "400px", overflowY: "auto" }}
                            >
                              {activeFile?.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Non-Page Builder Components */}
          {!scanning && !scanError && setupProjects.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] uppercase tracking-widest text-[#d29922]">Non-Page Builder Components</span>
                {missingDefinitions.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#1a1206", color: "#d29922" }}>
                    {missingDefinitions.reduce((acc, p) => acc + p.components.length, 0)}
                  </span>
                )}
              </div>


              {missingDefinitions.length === 0 && (
                <div className="text-[12px] text-[#484f58] py-1">All components have definitions — nothing to add.</div>
              )}

              {missingDefinitions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {missingDefinitions.map(({ project, components }) => (
                    <div key={project.path} className="rounded-lg overflow-hidden" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(`missing-${project.path}`)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#161b22] transition-colors"
                      >
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-[13px] font-semibold text-[#e6edf3] truncate">{project.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "#d29922" }}>
                              <FolderOpen size={9} />
                              /components
                            </span>
                            <span className="text-[10px] text-[#484f58]">{components.length} component{components.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        {expanded[`missing-${project.path}`]
                          ? <ChevronDown size={13} color="#555" />
                          : <ChevronRight size={13} color="#555" />
                        }
                      </button>

                      {expanded[`missing-${project.path}`] && (
                        <div className="px-3 pb-3 pt-1">
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {components.map((comp) => {
                              const projectSelected = selected[project.path] ?? [];
                              const isSelected = projectSelected.includes(comp.name);
                              const key = `${project.path}::${comp.name}`;
                              const state = generateState[key];
                              return (
                                <button
                                  key={comp.name}
                                  type="button"
                                  onClick={() => {
                                    if (state === "running") return;
                                    setSelected((prev) => {
                                      const cur = prev[project.path] ?? [];
                                      return {
                                        ...prev,
                                        [project.path]: cur.includes(comp.name)
                                          ? cur.filter((n) => n !== comp.name)
                                          : [...cur, comp.name],
                                      };
                                    });
                                  }}
                                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono cursor-pointer transition-all"
                                  style={
                                    state === "done"
                                      ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                                      : state === "running"
                                      ? { background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff60" }
                                      : isSelected
                                      ? { background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff60" }
                                      : { background: "#1a1206", color: "#d29922", border: "1px solid #d2992230" }
                                  }
                                >
                                  {state === "done" ? "✓" : state === "running" ? "…" : <AlertCircle size={9} />}
                                  {comp.name}
                                </button>
                              );
                            })}
                          </div>

                          {(() => {
                            const projectSelected = selected[project.path] ?? [];
                            const count = projectSelected.length;
                            const isAnyRunning = projectSelected.some((n) => generateState[`${project.path}::${n}`] === "running");
                            const runningName = projectSelected.find((n) => generateState[`${project.path}::${n}`] === "running");
                            const runningProgress = runningName ? (generateProgress[`${project.path}::${runningName}`] ?? 0) : 0;
                            const doneCount = projectSelected.filter((n) => generateState[`${project.path}::${n}`] === "done").length;
                            const hasError = projectSelected.some((n) => generateState[`${project.path}::${n}`] === "error");
                            return (
                              <div className="flex items-center gap-2 pt-2 border-t border-[#21262d]">
                                <span className="text-[11px] text-[#8b949e] font-mono flex-1 truncate">
                                  {count === 0
                                    ? "Select components above"
                                    : count === 1
                                    ? `/builder/${projectSelected[0]}/definitions.sourceflow.mjs`
                                    : `${count} components selected`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => !isAnyRunning && count > 0 && generateAll(project.path)}
                                  disabled={count === 0 || isAnyRunning}
                                  className="relative overflow-hidden shrink-0 px-3 py-2 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ background: "#1f6feb", color: "#fff", cursor: count > 0 ? "pointer" : "not-allowed", minWidth: "120px" }}
                                >
                                  {isAnyRunning && (
                                    <span
                                      className="absolute inset-0 transition-all duration-300"
                                      style={{ width: `${runningProgress}%`, background: "#ffffff20" }}
                                    />
                                  )}
                                  <span className="relative z-10">
                                    {isAnyRunning
                                      ? `Generating ${doneCount + 1}/${count} — ${runningProgress}%`
                                      : hasError
                                      ? "Retry Failed"
                                      : count > 1
                                      ? `Generate (${count})`
                                      : "Generate"}
                                  </span>
                                </button>
                              </div>
                            );
                          })()}

                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
