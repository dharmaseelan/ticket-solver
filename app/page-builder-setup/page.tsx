"use client";

import { useState, useEffect, useRef } from "react";
import { LayoutTemplate, Puzzle, RefreshCw, ChevronDown, ChevronRight, Package, FolderOpen, AlertCircle, X, Trash2, Code2, Layers, FileCode, Box, Zap, KeyRound } from "lucide-react";
import { FolderPicker } from "@/app/components/FolderPicker";
import dynamic from "next/dynamic";
const CodeBlock = dynamic(() => import("@/app/components/CodeBlock"), { ssr: false });

type Tab = "setup" | "components";
type SetupTab = "installation" | "preview";

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
  const [setupTab, setSetupTab] = useState<SetupTab>("installation");
  const [componentsTab, setComponentsTab] = useState<"installation" | "preview">("installation");

  // Page Builder Setup tab state (independent)
  const [setupRootInput, setSetupRootInput] = useState("");
  const [setupRootPath, setSetupRootPath] = useState("");
  const [setupPkg, setSetupPkg] = useState<{ scripts: Record<string, string>; dependencies: Record<string, string>; devDependencies: Record<string, string> } | null>(null);
  const [setupScanning, setSetupScanning] = useState(false);
  const [setupScanError, setSetupScanError] = useState("");
  const [setupMissingPackages, setSetupMissingPackages] = useState<{ name: string; version: string }[]>([]);
  const [setupCheckedPackages, setSetupCheckedPackages] = useState<{ name: string; version: string; installed: boolean }[]>([]);
  const [installState, setInstallState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState("");
  const [installingPkg, setInstallingPkg] = useState("");
  const [setupFiles, setSetupFiles] = useState<{ key: string; label: string; group: string; exists: boolean; content: string }[]>([]);
  const [fileExpandedMap, setFileExpandedMap] = useState<Record<string, boolean>>({});
  const [filePreviewTab, setFilePreviewTab] = useState<Record<string, number>>({});
  const [scaffoldState, setScaffoldState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [scaffoldProgress, setScaffoldProgress] = useState(0);
  const [scaffoldError, setScaffoldError] = useState("");
  const [scaffoldingFile, setScaffoldingFile] = useState("");
  const [fileGroupOpen, setFileGroupOpen] = useState<Record<string, boolean>>({ hooks: false, ui: false, pages: false, builder: false });
  const [previewCodeOpen, setPreviewCodeOpen] = useState(true);
  const [mergeFoundAt, setMergeFoundAt] = useState("");
  const [mergeContent, setMergeContent] = useState("");
  const [treePreviewFile, setTreePreviewFile] = useState<Record<string, string>>({});
  const [treeDirOpen, setTreeDirOpen] = useState<Record<string, boolean>>({});
  const [builderTreeWidth, setBuilderTreeWidth] = useState(196);
  const [builderHandleHover, setBuilderHandleHover] = useState(false);
  const builderResizing = useRef(false);
  const builderResizeStartX = useRef(0);
  const builderResizeStartW = useRef(0);

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
  const [generatedTreeFile, setGeneratedTreeFile] = useState<Record<string, string>>({});
  const [selectedBuilderComp, setSelectedBuilderComp] = useState<{ projectPath: string; compName: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pbRootPath") || "";
    setPbRootPath(saved);
    setPbRootInput(saved);
    if (saved) scanProjects(saved);

    const savedSetup = localStorage.getItem("pbSetupRootPath") || "";
    setSetupRootPath(savedSetup);
    setSetupRootInput(savedSetup);
    if (savedSetup) { checkPackages(savedSetup); readPkg(savedSetup); checkFiles(savedSetup); }

    try {
      const savedEntries = localStorage.getItem("pbGeneratedEntries");
      if (savedEntries) setGeneratedEntries(JSON.parse(savedEntries));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!builderResizing.current) return;
      const delta = e.clientX - builderResizeStartX.current;
      const newW = Math.max(120, Math.min(300, builderResizeStartW.current + delta));
      setBuilderTreeWidth(newW);
    }
    function onMouseUp() { builderResizing.current = false; setBuilderHandleHover(false); }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
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

  async function checkPackages(projectPath: string) {
    try {
      const data = await fetch("/api/page-builder/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      }).then((r) => r.json());
      if (!data.error) {
        setSetupCheckedPackages(data.packages ?? []);
        setSetupMissingPackages(data.missing ?? []);
      }
    } catch { /* best-effort */ }
  }

  async function checkFiles(projectPath: string) {
    try {
      const data = await fetch("/api/page-builder/check-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      }).then((r) => r.json());
      if (!data.error) setSetupFiles(data.files ?? []);
    } catch { /* best-effort */ }
  }

  async function readPkg(projectPath: string) {
    try {
      const data = await fetch("/api/page-builder/read-pkg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      }).then((r) => r.json());
      if (!data.error) setSetupPkg(data);
    } catch { /* best-effort */ }
  }

  async function saveSetupRoot() {
    const v = setupRootInput.trim().replace(/\/$/, "");
    setSetupRootPath(v);
    localStorage.setItem("pbSetupRootPath", v);
    setSetupScanning(true);
    setSetupScanError("");
    setSetupMissingPackages([]);
    setSetupCheckedPackages([]);
    setSetupFiles([]);
    setInstallState("idle");
    setInstallProgress(0);
    setInstallError("");
    setScaffoldState("idle");
    setScaffoldProgress(0);
    setScaffoldError("");
    setMergeFoundAt("");
    setMergeContent("");
    try {
      await Promise.all([checkPackages(v), readPkg(v), checkFiles(v)]);
    } catch {
      setSetupScanError("Failed to check project");
    }
    setSetupScanning(false);
  }

  async function installPackages() {
    setInstallState("running");
    setInstallProgress(0);
    setInstallError("");
    setInstallingPkg(setupMissingPackages[0]?.name ?? "");

    let progress = 0;
    const pkgs = setupMissingPackages;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 5 + 1, 88);
      setInstallProgress(Math.round(progress));
      const idx = Math.min(Math.floor((progress / 88) * pkgs.length), pkgs.length - 1);
      setInstallingPkg(pkgs[idx]?.name ?? "");
    }, 400);

    const res = await fetch("/api/page-builder/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: setupRootPath, packages: setupMissingPackages }),
    }).then((r) => r.json());

    clearInterval(ticker);

    if (res.success) {
      setInstallProgress(100);
      setInstallState("done");
      setInstallingPkg("");
      await readPkg(setupRootPath);
    } else {
      setInstallProgress(0);
      setInstallState("error");
      setInstallError(res.error ?? "Install failed");
    }
  }

  async function scaffoldFiles() {
    const missing = setupFiles.filter((f) => !f.exists).map((f) => f.key);
    if (!missing.length) return;
    setScaffoldState("running");
    setScaffoldProgress(0);
    setScaffoldError("");

    const MERGE_KEY = "pages/page-builder-setup/index.js";
    const templateFiles = missing.filter((k) => k !== MERGE_KEY);
    const needsMerge = missing.includes(MERGE_KEY);

    let progress = 0;
    const ticker = setInterval(() => {
      progress = Math.min(progress + Math.random() * 6 + 1, needsMerge ? 60 : 88);
      setScaffoldProgress(Math.round(progress));
    }, 300);

    if (templateFiles.length) {
      setScaffoldingFile("Installing files…");
      const res = await fetch("/api/page-builder/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: setupRootPath, files: templateFiles }),
      }).then((r) => r.json());

      if (!res.success) {
        clearInterval(ticker);
        setScaffoldProgress(0);
        setScaffoldState("error");
        setScaffoldingFile("");
        const failed = (res.results ?? []).filter((r: { success: boolean }) => !r.success).map((r: { key: string; error?: string }) => r.error ?? r.key).join(", ");
        setScaffoldError(failed || "Scaffold failed");
        return;
      }
    }

    if (needsMerge) {
      setScaffoldingFile("Generating page-builder-setup/index.js…");
      const mergeRes = await fetch("/api/page-builder/merge-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: setupRootPath }),
      }).then((r) => r.json());

      clearInterval(ticker);

      if (mergeRes.success) {
        setMergeFoundAt(mergeRes.foundAt ?? "");
        setMergeContent(mergeRes.content ?? "");
        setScaffoldProgress(100);
        setScaffoldState("done");
        setScaffoldingFile("");
        await checkFiles(setupRootPath);
      } else {
        setScaffoldProgress(0);
        setScaffoldState("error");
        setScaffoldingFile("");
        setScaffoldError(mergeRes.error ?? "Page merge failed");
      }
    } else {
      clearInterval(ticker);
      setScaffoldProgress(100);
      setScaffoldState("done");
      setScaffoldingFile("");
      await checkFiles(setupRootPath);
    }
  }

  async function quickInstall() {
    if (setupMissingPackages.length > 0 && installState !== "done") {
      await installPackages();
    }
    const missingFiles = setupFiles.filter((f) => !f.exists);
    if (missingFiles.length > 0 && scaffoldState !== "done") {
      await scaffoldFiles();
    }
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
                style={{ background: "#1f6feb", color: "#fff", opacity: setupRootInput ? 1 : 0.4, cursor: setupRootInput ? "pointer" : "not-allowed", fontWeight: 500 }}
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
                    setSetupMissingPackages([]);
                    setSetupCheckedPackages([]);
                    setSetupPkg(null);
                    setSetupFiles([]);
                    setInstallState("idle");
                    setInstallProgress(0);
                    setInstallError("");
                    setInstallingPkg("");
                    setScaffoldState("idle");
                    setScaffoldProgress(0);
                    setScaffoldError("");
                    setScaffoldingFile("");
                    setMergeFoundAt("");
                    setMergeContent("");
                    setFileGroupOpen({ hooks: false, ui: false, pages: false, builder: false });
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
            {setupScanning && (
              <div className="flex items-center gap-2 text-[12px] text-[#8b949e] mt-3">
                <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: "#58a6ff" }} />
                Checking project...
              </div>
            )}
            {setupScanError && <div className="text-[12px] text-[#ef4444] mt-2">{setupScanError}</div>}
            {!setupScanning && !setupScanError && setupRootPath && setupMissingPackages.length === 0 && setupCheckedPackages.length > 0 && (
              <div className="flex items-center gap-2 text-[12px] mt-3" style={{ color: "#3fb950" }}>
                <Package size={13} />
                All page builder packages are installed.
              </div>
            )}
          </div>

          {/* Sub-tab buttons */}
          {!setupScanning && !setupScanError && setupRootPath && (
            <div className="flex items-center justify-between">
              <div className="flex p-1 rounded-lg" style={{ background: "#161b22", border: "1px solid #30363d", width: "fit-content" }}>
                {(["installation", "preview"] as SetupTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSetupTab(tab)}
                    className="px-4 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-all capitalize"
                    style={setupTab === tab
                      ? { background: "#58a6ff18", color: "#58a6ff", border: "1px solid #58a6ff28" }
                      : { background: "transparent", color: "#8b949e", border: "1px solid transparent" }
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {setupTab === "installation" && (() => {
                const isRunning = installState === "running" || scaffoldState === "running";
                const dataLoaded = setupCheckedPackages.length > 0 && setupFiles.length > 0;
                const allDone = dataLoaded && (setupMissingPackages.length === 0 || installState === "done") && (setupFiles.every((f) => f.exists) || scaffoldState === "done");
                return (
                  <button
                    type="button"
                    onClick={quickInstall}
                    disabled={isRunning || allDone}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-normal cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: allDone ? "#0d2b1d" : "#58a6ff18",
                      color: allDone ? "#3fb950" : "#58a6ff",
                      border: allDone ? "1px solid #3fb95030" : "1px solid #58a6ff28",
                    }}
                  >
                    <Zap size={12} />
                    {isRunning ? "Installing…" : allDone ? "✓ Done" : "Quick Install"}
                  </button>
                );
              })()}
            </div>
          )}

          {/* Installation tab */}
          {!setupScanning && setupCheckedPackages.length > 0 && setupTab === "installation" && (
            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              {(() => {
                const allInstalled = setupMissingPackages.length === 0 || installState === "done";
                const color = allInstalled ? "#3fb950" : "#d29922";
                return (
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={13} style={{ color }} />
                    <span className="text-[11px] uppercase tracking-widest transition-colors duration-500" style={{ color }}>Package Setup</span>
                    {!allInstalled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#1a1206", color: "#d29922" }}>
                        {setupMissingPackages.length} missing
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="flex flex-col gap-1.5">
                {setupCheckedPackages.map((pkg) => {
                  const isInstalled = pkg.installed || installState === "done";
                  return (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between px-2 py-2 rounded-lg"
                      style={{ background: "#0d1117", border: "1px solid #21262d" }}
                    >
                      <span className="text-[12px] font-mono" style={{ color: "#e6edf3" }}>{pkg.name}</span>
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md transition-all duration-500"
                        style={isInstalled
                          ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                          : { background: "#1a1206", color: "#d29922", border: "1px solid #d2992230" }
                        }
                      >
                        {pkg.version}
                      </span>
                    </div>
                  );
                })}
              </div>
              {installError && (
                <div className="mt-3 text-[11px] font-mono text-[#f85149] whitespace-pre-wrap break-words">{installError}</div>
              )}
              <div className="flex items-center justify-between mt-4">
                <div className="text-[9px] font-mono truncate mr-3" style={{ color: "#8b949e", minHeight: "1.25rem" }}>
                  {installState === "running" && installingPkg && (
                    <span>Installing <span style={{ color: "#e6edf3" }}>{installingPkg}</span>…</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={installPackages}
                  disabled={installState === "running" || installState === "done" || setupMissingPackages.length === 0}
                  className="relative overflow-hidden px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: installState === "done" ? "#0d2b1d" : installState === "error" ? "#2b0d0d" : "#1f6feb",
                    color: installState === "done" ? "#3fb950" : installState === "error" ? "#f85149" : "#fff",
                    width: "100px",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {installState === "running" && (
                    <span
                      className="absolute inset-0 transition-all duration-300"
                      style={{ width: `${installProgress}%`, background: "#ffffff20" }}
                    />
                  )}
                  <span className="relative z-10">
                    {installState === "running"
                      ? `Installing ${installProgress}%`
                      : installState === "done"
                      ? "✓ Installed"
                      : installState === "error"
                      ? "Retry"
                      : "Install"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* File Setup section */}
          {!setupScanning && setupFiles.length > 0 && setupTab === "installation" && (
            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              {(() => {
                const allExist = setupFiles.every((f) => f.exists) || scaffoldState === "done";
                const color = allExist ? "#3fb950" : "#d29922";
                const missingCount = setupFiles.filter((f) => !f.exists).length;
                return (
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-[11px] uppercase tracking-widest transition-colors duration-500" style={{ color }}>File Setup</span>
                    {!allExist && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#1a1206", color: "#d29922" }}>
                        {missingCount} missing
                      </span>
                    )}
                  </div>
                );
              })()}

              {(["env", "hooks", "ui", "pages", "builder"] as const).map((group) => {
                const groupFiles = setupFiles.filter((f) => f.group === group);
                if (!groupFiles.length) return null;
                const isOpen = fileGroupOpen[group] ?? false;
                const groupMissing = groupFiles.filter((f) => !f.exists && scaffoldState !== "done").length;
                return (
                  <div key={group} className="mb-2 last:mb-0 rounded-lg overflow-hidden" style={{ border: "1px solid #21262d" }}>
                    <button
                      type="button"
                      onClick={() => setFileGroupOpen((prev) => ({ ...prev, [group]: !prev[group] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#161b22] transition-colors"
                      style={{ background: "#0d1117" }}
                    >
                      <span className="flex-1 text-left text-[12px] font-mono" style={{ color: "#8b949e" }}>{group}/</span>
                      {groupMissing > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#1a1206", color: "#d29922" }}>
                          {groupMissing} missing
                        </span>
                      )}
                      {isOpen ? <ChevronDown size={12} color="#555" /> : <ChevronRight size={12} color="#555" />}
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 p-2" style={{ background: "#0d1117", borderTop: "1px solid #21262d" }}>
                        {groupFiles.map((f, fi) => {
                          const isOk = f.exists || scaffoldState === "done";
                          return (
                            <div
                              key={f.key}
                              className="flex items-center justify-between px-2 py-1.5"
                              style={{ borderBottom: fi < groupFiles.length - 1 ? "1px solid #21262d" : "none" }}
                            >
                              <span className="text-[11px] font-mono" style={{ color: "#e6edf3" }}>{f.label}</span>
                              <span
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md transition-all duration-500"
                                style={isOk
                                  ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                                  : { background: "#1a1206", color: "#d29922", border: "1px solid #d2992230" }
                                }
                              >
                                {isOk ? "exists" : "missing"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {scaffoldError && (
                <div className="mt-3 text-[11px] font-mono text-[#f85149] whitespace-pre-wrap break-words">{scaffoldError}</div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="text-[9px] font-mono truncate mr-3" style={{ color: "#8b949e", minHeight: "1.25rem" }}>
                  {scaffoldState === "running" && scaffoldingFile && (
                    <span>Installing <span style={{ color: "#e6edf3" }}>{scaffoldingFile}</span></span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={scaffoldFiles}
                  disabled={scaffoldState === "running" || scaffoldState === "done" || setupFiles.every((f) => f.exists)}
                  className="relative overflow-hidden px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: scaffoldState === "done" ? "#0d2b1d" : scaffoldState === "error" ? "#2b0d0d" : "#1f6feb",
                    color: scaffoldState === "done" ? "#3fb950" : scaffoldState === "error" ? "#f85149" : "#fff",
                    width: "100px",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {scaffoldState === "running" && (
                    <span
                      className="absolute inset-0 transition-all duration-300"
                      style={{ width: `${scaffoldProgress}%`, background: "#ffffff20" }}
                    />
                  )}
                  <span className="relative z-10">
                    {scaffoldState === "running"
                      ? `Installing ${scaffoldProgress}%`
                      : scaffoldState === "done"
                      ? "✓ Installed"
                      : scaffoldState === "error"
                      ? "Retry"
                      : "Install"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Preview tab */}
          {!setupScanning && setupRootPath && setupTab === "preview" && (
            <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              {/* Section header */}
              {(() => {
                const allInstalled = setupMissingPackages.length === 0 || installState === "done";
                const color = allInstalled ? "#3fb950" : "#d29922";
                return (
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={13} style={{ color }} />
                    <span className="text-[11px] uppercase tracking-widest" style={{ color }}>Package Setup</span>
                  </div>
                );
              })()}

              {!setupPkg ? (
                <div className="text-[12px] text-[#484f58]">No package.json data — set a project folder first.</div>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #30363d" }}>
                  {/* File header */}
                  <button
                    type="button"
                    onClick={() => setPreviewCodeOpen((v) => !v)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ borderBottom: previewCodeOpen ? "1px solid #30363d" : "none", background: "#0d1117" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="flex-1 text-left text-[12px] font-mono text-[#8b949e]">package.json</span>
                    {previewCodeOpen ? <ChevronDown size={13} color="#555" /> : <ChevronRight size={13} color="#555" />}
                  </button>
                {previewCodeOpen && (() => {
                  const PB_SCRIPTS = ["sfprepare", "postbuild"];
                  const PB_PKGS = [
                    "@sourceflow-uk/page-builder-cli",
                    "@sourceflow-uk/eslint-plugin-page-builder-cli",
                    "@sourceflow-uk/sourceflow-content",
                    "@sourceflow-uk/sourceflow-sdk",
                    "aos",
                  ];
                  const allDeps = { ...setupPkg.dependencies, ...setupPkg.devDependencies };
                  const pbDeps = Object.fromEntries(Object.entries(allDeps).filter(([k]) => PB_PKGS.includes(k)));
                  const snippet = JSON.stringify(
                    {
                      scripts: setupPkg.scripts,
                      ...(Object.keys(pbDeps).length ? { dependencies: pbDeps } : {}),
                    },
                    null,
                    2
                  );
                  const highlightKeys = [
                    ...Object.keys(setupPkg.scripts).filter((k) => PB_SCRIPTS.includes(k) || setupPkg.scripts[k].includes("sfprepare")),
                    ...Object.keys(pbDeps),
                  ];
                  return (
                    <div style={{ background: "#0d1117" }}>
                      <CodeBlock code={snippet} language="json" highlightLines={highlightKeys} />
                    </div>
                  );
                })()}
                </div>
              )}

            </div>
          )}

          {/* File Setup preview — separate card */}
          {!setupScanning && setupRootPath && setupTab === "preview" && setupFiles.length > 0 && (() => {
            const existingFiles = setupFiles.filter((f) => f.exists || scaffoldState === "done");
            if (existingFiles.length === 0) return null;

            // Group: "hooks" + "ui" + "pages" each as one entry with all files as tabs
            const groups: { key: string; label: string; files: typeof existingFiles }[] = [];
            const envFiles = existingFiles.filter((f) => f.group === "env");
            if (envFiles.length) groups.push({ key: "env", label: "env", files: envFiles });
            const hooksFiles = existingFiles.filter((f) => f.group === "hooks");
            if (hooksFiles.length) groups.push({ key: "hooks", label: "hooks", files: hooksFiles });
            const uiFiles = existingFiles.filter((f) => f.group === "ui");
            if (uiFiles.length) groups.push({ key: "ui", label: "ui", files: uiFiles });
            const pagesFiles = existingFiles
              .filter((f) => f.group === "pages")
              .map((f) => f.key === "pages/page-builder-setup/index.js" && mergeContent ? { ...f, content: mergeContent } : f);
            if (pagesFiles.length) groups.push({ key: "pages", label: "pages", files: pagesFiles });
            const builderFiles = existingFiles.filter((f) => f.group === "builder");
            if (builderFiles.length) groups.push({ key: "builder", label: "builder", files: builderFiles });

            return (
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="flex items-center gap-2 mb-3">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-[11px] uppercase tracking-widest" style={{ color: "#3fb950" }}>File Setup</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#0d2b1d", color: "#3fb950" }}>
                    {existingFiles.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {groups.map((group) => {
                    const isOpen = fileExpandedMap[group.key] ?? false;
                    const tabIdx = filePreviewTab[group.key] ?? 0;
                    const activeFile = group.files[tabIdx];
                    return (
                      <div key={group.key} className="rounded-lg overflow-hidden" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                        <button
                          type="button"
                          onClick={() => setFileExpandedMap((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                          className="w-full flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[#161b22] transition-colors"
                        >
                          {group.key === "env"
                            ? <KeyRound size={13} color="#8b949e" style={{ flexShrink: 0 }} />
                            : group.key === "hooks"
                            ? <Code2 size={13} color="#8b949e" style={{ flexShrink: 0 }} />
                            : group.key === "ui"
                            ? <Layers size={13} color="#8b949e" style={{ flexShrink: 0 }} />
                            : group.key === "pages"
                            ? <FileCode size={13} color="#8b949e" style={{ flexShrink: 0 }} />
                            : <Box size={13} color="#8b949e" style={{ flexShrink: 0 }} />
                          }
                          <span className="flex-1 text-left text-[12px] font-mono text-[#8b949e]">{group.label}</span>
                          {isOpen ? <ChevronDown size={13} color="#555" /> : <ChevronRight size={13} color="#555" />}
                        </button>
                        {isOpen && (() => {
                          const prefix = `${group.key}/`;
                          const rootFilesList: typeof group.files = [];
                          const subDirs: Record<string, typeof group.files> = {};
                          for (const f of group.files) {
                            const rel = f.key.slice(prefix.length);
                            const parts = rel.split("/");
                            if (parts.length === 1) {
                              rootFilesList.push(f);
                            } else {
                              const dir = parts[0];
                              if (!subDirs[dir]) subDirs[dir] = [];
                              subDirs[dir].push(f);
                            }
                          }
                          const selFile = group.files.find((f) => f.key === (treePreviewFile[group.key] ?? "")) ?? group.files[0];
                          const selLang = selFile?.key.endsWith(".scss") ? "scss" : selFile?.key.endsWith(".ts") || selFile?.key.endsWith(".tsx") ? "typescript" : "javascript";
                          const fileIcon = (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          );
                          const folderIcon = (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                              <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                            </svg>
                          );
                          return (
                            <div style={{ display: "flex", borderTop: "1px solid #21262d", height: "320px", userSelect: builderResizing.current ? "none" : "auto" }}>
                              <div style={{ width: `${builderTreeWidth}px`, flexShrink: 0, overflowY: "auto", overflowX: "hidden" }}>
                                <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ color: "#6e7681" }}>
                                  {folderIcon}
                                  <span className="text-[10px] font-mono">{group.key}</span>
                                </div>
                                {rootFilesList.map((f) => {
                                  const filename = f.key.startsWith(prefix) ? f.key.slice(prefix.length) : f.key;
                                  const isSel = selFile?.key === f.key;
                                  return (
                                    <button
                                      key={f.key}
                                      type="button"
                                      onClick={() => setTreePreviewFile((prev) => ({ ...prev, [group.key]: f.key }))}
                                      className="w-full flex items-center gap-1.5 pl-5 pr-3 py-1 cursor-pointer transition-colors text-left hover:bg-[#1c2128]"
                                      style={{ background: isSel ? "#21262d" : undefined, color: isSel ? "#e6edf3" : "#8b949e" }}
                                    >
                                      {fileIcon}
                                      <span className="text-[10px] font-mono truncate">{filename}</span>
                                    </button>
                                  );
                                })}
                                {Object.entries(subDirs).map(([dir, files]) => {
                                  const isDirOpen = treeDirOpen[`${group.key}-${dir}`] ?? true;
                                  return (
                                    <div key={dir}>
                                      <button
                                        type="button"
                                        onClick={() => setTreeDirOpen((prev) => ({ ...prev, [`${group.key}-${dir}`]: !isDirOpen }))}
                                        className="w-full flex items-center gap-1.5 pl-5 pr-3 py-1 cursor-pointer transition-colors hover:bg-[#1c2128] hover:text-[#c9d1d9]"
                                        style={{ color: "#8b949e" }}
                                      >
                                        {isDirOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                        {folderIcon}
                                        <span className="text-[10px] font-mono">{dir}</span>
                                      </button>
                                      {isDirOpen && files.map((f) => {
                                        const filename = f.key.slice(`${prefix}${dir}/`.length);
                                        const isSel = selFile?.key === f.key;
                                        return (
                                          <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => setTreePreviewFile((prev) => ({ ...prev, [group.key]: f.key }))}
                                            className="w-full flex items-center gap-1.5 pl-11 pr-3 py-1 cursor-pointer transition-colors text-left hover:bg-[#1c2128]"
                                            style={{ background: isSel ? "#21262d" : undefined, color: isSel ? "#e6edf3" : "#8b949e" }}
                                          >
                                            {fileIcon}
                                            <span className="text-[10px] font-mono truncate">{filename}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                              <div
                                style={{ width: "2px", flexShrink: 0, cursor: "col-resize", background: builderHandleHover ? "#2d333a" : "#21262d", transition: "background 0.15s" }}
                                onMouseEnter={() => setBuilderHandleHover(true)}
                                onMouseLeave={() => { if (!builderResizing.current) setBuilderHandleHover(false); }}
                                onMouseDown={(e) => {
                                  builderResizing.current = true;
                                  builderResizeStartX.current = e.clientX;
                                  builderResizeStartW.current = builderTreeWidth;
                                  e.preventDefault();
                                }}
                              />
                              <div style={{ flex: 1, overflowY: "auto", background: "#0d1117", minWidth: 0 }}>
                                {selFile ? (
                                  <CodeBlock code={selFile.content ?? ""} language={selLang} />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-[12px]" style={{ color: "#484f58" }}>Select a file</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Add Components tab */}
      {activeTab === "components" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            {/* Root folder picker */}
            <div>
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
                  style={{ background: "#1f6feb", color: "#fff", opacity: pbRootInput ? 1 : 0.4, cursor: pbRootInput ? "pointer" : "not-allowed", fontWeight: 500 }}
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
              <div className="text-[12px] text-[#484f58]" style={{ paddingTop: "10px", paddingBottom: 0 }}>Set a root folder to scan for projects.</div>
            )}
            {!scanning && !scanError && pbRootPath && projects.length === 0 && (
              <div className="text-[12px] text-[#484f58]" style={{ paddingTop: "10px", paddingBottom: 0 }}>No projects found in this folder.</div>
            )}
            {!scanning && !scanError && pbRootPath && projects.length > 0 && setupProjects.length === 0 && (
              <div className="rounded-lg px-4 py-3 text-[12px]" style={{ background: "#0d1f38", border: "1px solid #58a6ff30", color: "#58a6ff" }}>
                Page Builder hasn't been set up for this project yet. To get started, go to the <strong>Page Builder Setup</strong> tab.
              </div>
            )}

          </div>

          {/* Sub-tab buttons */}
          {pbRootPath && <div className="flex p-1 rounded-lg" style={{ background: "#161b22", border: "1px solid #30363d", width: "fit-content" }}>
            {(["installation", "preview"] as ("installation" | "preview")[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setComponentsTab(tab)}
                className="px-4 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-all capitalize"
                style={componentsTab === tab
                  ? { background: "#58a6ff18", color: "#58a6ff", border: "1px solid #58a6ff28" }
                  : { background: "transparent", color: "#8b949e", border: "1px solid transparent" }
                }
              >
                {tab}
              </button>
            ))}
          </div>}

          {pbRootPath && componentsTab === "installation" && <>
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
                                  style={{ background: "#1f6feb", color: "#fff", cursor: count > 0 ? "pointer" : "not-allowed", minWidth: "120px", fontWeight: 500 }}
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
          </>}

          {pbRootPath && componentsTab === "preview" && <>
          {/* Generated Component — standalone card, persists after rescan */}
          {(() => {
            const entries = Object.values(generatedEntries);
            return (
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] uppercase tracking-widest text-[#3fb950]">Generated Components</span>
                  {entries.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#0d2b1d", color: "#3fb950" }}>{entries.length}</span>}
                </div>
                {entries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Layers size={24} style={{ color: "#30363d" }} />
                    <div className="text-center">
                      <div className="text-[13px] font-semibold mb-1" style={{ color: "#484f58" }}>No generated components yet</div>
                      <div className="text-[11px]" style={{ color: "#3d444d" }}>Head to the Installation tab, select components, and click Generate.</div>
                    </div>
                  </div>
                ) : (
                <div className="flex flex-col gap-2">
                  {entries.map((entry) => {
                    const key = `${entry.projectPath}::${entry.compName}`;
                    const isOpen = generatedExpanded[key] ?? false;
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

                        {isOpen && (() => {
                          const selFile = entry.files.find((f) => f.name === (generatedTreeFile[key] ?? "")) ?? entry.files[0];
                          const selLang = selFile?.name.endsWith(".scss") ? "scss" : selFile?.name.endsWith(".ts") || selFile?.name.endsWith(".tsx") ? "typescript" : "javascript";
                          const fileIcon = (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          );
                          const folderIcon = (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                              <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                            </svg>
                          );
                          return (
                            <div style={{ display: "flex", borderTop: "1px solid #21262d", height: "320px", userSelect: builderResizing.current ? "none" : "auto" }}>
                              <div style={{ width: `${builderTreeWidth}px`, flexShrink: 0, overflowY: "auto", overflowX: "hidden" }}>
                                <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ color: "#6e7681" }}>
                                  {folderIcon}
                                  <span className="text-[10px] font-mono">{entry.compName}</span>
                                </div>
                                {entry.files.map((f) => {
                                  const isSel = selFile?.name === f.name;
                                  return (
                                    <button
                                      key={f.name}
                                      type="button"
                                      onClick={() => setGeneratedTreeFile((prev) => ({ ...prev, [key]: f.name }))}
                                      className="w-full flex items-center gap-1.5 pl-5 pr-3 py-1 cursor-pointer transition-colors text-left hover:bg-[#1c2128]"
                                      style={{ background: isSel ? "#21262d" : undefined, color: isSel ? "#e6edf3" : "#8b949e" }}
                                    >
                                      {fileIcon}
                                      <span className="text-[10px] font-mono truncate">{f.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div
                                style={{ width: "2px", flexShrink: 0, cursor: "col-resize", background: builderHandleHover ? "#2d333a" : "#21262d", transition: "background 0.15s" }}
                                onMouseEnter={() => setBuilderHandleHover(true)}
                                onMouseLeave={() => { if (!builderResizing.current) setBuilderHandleHover(false); }}
                                onMouseDown={(e) => {
                                  builderResizing.current = true;
                                  builderResizeStartX.current = e.clientX;
                                  builderResizeStartW.current = builderTreeWidth;
                                  e.preventDefault();
                                }}
                              />
                              <div style={{ flex: 1, overflowY: "auto", background: "#0d1117", minWidth: 0 }}>
                                {selFile ? (
                                  <CodeBlock code={selFile.content ?? ""} language={selLang} />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-[12px]" style={{ color: "#484f58" }}>Select a file</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}
          </>}
        </div>
      )}
    </div>
  );
}
