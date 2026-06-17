"use client";
import { useState, useEffect } from "react";
import { FolderPicker } from "@/app/components/FolderPicker";
import { X, Package, ChevronDown, ChevronRight, RefreshCw, Database, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";
const CodeBlock = dynamic(() => import("@/app/components/CodeBlock"), { ssr: false });

type Tab = "installation" | "preview";
type PkgEntry = { name: string; version: string; installed: boolean };

export default function AIJobSearchPage() {
  const [activeTab, setActiveTab] = useState<Tab>("installation");
  const [rootInput, setRootInput] = useState("");
  const [rootPath, setRootPath] = useState("");

  const [checkedPackages, setCheckedPackages] = useState<PkgEntry[]>([]);
  const [missingPackages, setMissingPackages] = useState<PkgEntry[]>([]);
  const [isSetup, setIsSetup] = useState(false);
  const [pageFile, setPageFile] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [installState, setInstallState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState("");

  const [pkg, setPkg] = useState<{ dependencies: Record<string, string>; devDependencies: Record<string, string> } | null>(null);
  const [previewCodeOpen, setPreviewCodeOpen] = useState(true);
  const [cmsEnabled, setCmsEnabled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("aiJobSearchRootPath") || "";
    if (saved) {
      setRootPath(saved);
      setRootInput(saved);
      checkPackages(saved);
      readPkg(saved);
    }
  }, []);

  async function checkPackages(projectPath: string) {
    setChecking(true);
    setCheckedPackages([]);
    setMissingPackages([]);
    try {
      const data = await fetch("/api/ai-job-search/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      }).then((r) => r.json());
      if (!data.error) {
        setCheckedPackages(data.packages ?? []);
        setMissingPackages(data.missing ?? []);
        setIsSetup(data.isSetup ?? false);
        setPageFile(data.pageFile ?? null);
      }
    } catch { /* best-effort */ }
    setChecking(false);
  }

  async function readPkg(projectPath: string) {
    try {
      const data = await fetch("/api/page-builder/read-pkg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      }).then((r) => r.json());
      if (!data.error) setPkg(data);
    } catch { /* best-effort */ }
  }

  async function saveRoot() {
    const v = rootInput.trim().replace(/\/$/, "");
    if (!v) return;
    setRootPath(v);
    localStorage.setItem("aiJobSearchRootPath", v);
    setInstallState("idle");
    setInstallProgress(0);
    setInstallError("");
    setPkg(null);
    checkPackages(v);
    readPkg(v);
  }

  async function installPackages() {
    setInstallState("running");
    setInstallProgress(0);
    setInstallError("");

    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + 4, 90);
      setInstallProgress(progress);
    }, 400);

    try {
      const res = await fetch("/api/ai-job-search/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: rootPath, packages: missingPackages }),
      }).then((r) => r.json());

      clearInterval(timer);
      if (res.success) {
        setInstallProgress(100);
        setInstallState("done");
        setMissingPackages([]);
        setCheckedPackages((prev) => prev.map((p) => ({ ...p, installed: true })));
        readPkg(rootPath);
      } else {
        setInstallState("error");
        setInstallError(res.error ?? "Installation failed");
      }
    } catch (e) {
      clearInterval(timer);
      setInstallState("error");
      setInstallError(e instanceof Error ? e.message : "Installation failed");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-6">
        <div className="text-[18px] font-bold text-white">AI Job Search</div>
        <div className="text-[12px] text-[#8b949e] mt-1">Set up and manage AI job search.</div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Root folder picker */}
        <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
          <div className="flex gap-2 items-center">
            <div
              className="flex-1 px-3 py-2 rounded-lg text-[12px] truncate"
              style={{ background: "#0d1117", border: "1px solid #30363d", color: rootInput ? "#e8ddd4" : "#6e7681" }}
            >
              {rootInput || "Pick a folder..."}
            </div>
            <FolderPicker onSelect={(p) => setRootInput(p)} />
            {rootPath && (
              <button
                type="button"
                onClick={() => fetch("/api/open-vscode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectPath: rootPath }) })}
                className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
                title="Open in VS Code"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.86V4.14a1.5 1.5 0 0 0-.85-1.553zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                </svg>
              </button>
            )}
            {rootPath && (
              <button
                type="button"
                onClick={() => { checkPackages(rootPath); readPkg(rootPath); }}
                className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#0d1117", border: "1px solid #30363d" }}
                title="Refresh"
              >
                <RefreshCw size={13} color="#8b949e" className={checking ? "animate-spin" : ""} />
              </button>
            )}
            <button
              type="button"
              onClick={saveRoot}
              disabled={!rootInput}
              className="h-9 px-3 rounded-lg text-[12px] cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: "#1f6feb", color: "#fff", opacity: rootInput ? 1 : 0.4, cursor: rootInput ? "pointer" : "not-allowed", fontWeight: 500 }}
            >
              Set
            </button>
            {rootPath && (
              <button
                type="button"
                onClick={() => {
                  setRootPath("");
                  setRootInput("");
                  setCheckedPackages([]);
                  setMissingPackages([]);
                  setIsSetup(false);
                  setPageFile(null);
                  setInstallState("idle");
                  setPkg(null);
                  localStorage.removeItem("aiJobSearchRootPath");
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

        {/* Setup status */}
        {!checking && checkedPackages.length > 0 && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
            style={isSetup
              ? { background: "#0d2b1d", border: "1px solid #3fb95030" }
              : { background: "#161b22", border: "1px solid #30363d" }
            }
          >
            <span
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ background: isSetup ? "#3fb950" : "#d29922" }}
            />
            <span className="text-[12px] flex-1" style={{ color: isSetup ? "#3fb950" : "#8b949e" }}>
              {isSetup
                ? <>AI Job Search is set up — <span className="font-mono text-[11px]" style={{ color: "#3fb95099" }}>{pageFile}</span></>
                : "AI Job Search is not fully set up on this project."}
            </span>
          </div>
        )}

        {/* Tab bar */}
        {!checking && rootPath && (
          <div className="flex p-1 rounded-lg" style={{ background: "#161b22", border: "1px solid #30363d", width: "fit-content" }}>
            {(["installation", "preview"] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-all capitalize"
                style={activeTab === tab
                  ? { background: "#58a6ff18", color: "#58a6ff", border: "1px solid #58a6ff28" }
                  : { background: "transparent", color: "#8b949e", border: "1px solid transparent" }
                }
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Installation tab — Package Setup */}
        {!checking && checkedPackages.length > 0 && activeTab === "installation" && (
          <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            {(() => {
              const allInstalled = missingPackages.length === 0 || installState === "done";
              const color = allInstalled ? "#3fb950" : "#d29922";
              return (
                <div className="flex items-center gap-2 mb-3">
                  <Package size={13} style={{ color }} />
                  <span className="text-[11px] uppercase tracking-widest transition-colors duration-500" style={{ color }}>Package Setup</span>
                  {!allInstalled && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#1a1206", color: "#d29922" }}>
                      {missingPackages.length} missing
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="flex flex-col gap-1.5">
              {checkedPackages.map((pkg) => {
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
                {installState === "running" && (
                  <span>Installing <span style={{ color: "#e6edf3" }}>@sourceflow-uk/ai-job-search</span>…</span>
                )}
              </div>
              <button
                type="button"
                onClick={installPackages}
                disabled={installState === "running" || installState === "done" || missingPackages.length === 0}
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

        {/* Installation tab — CMS Setup */}
        {!checking && rootPath && activeTab === "installation" && (
          <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database size={13} style={{ color: (isSetup || cmsEnabled) ? "#3fb950" : "#d29922" }} />
                <span className="text-[11px] uppercase tracking-widest transition-colors duration-500" style={{ color: (isSetup || cmsEnabled) ? "#3fb950" : "#d29922" }}>CMS Setup</span>
              </div>
              <a
                href="https://www.sourceflow.co.uk/_sf/superadmin/customers"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] cursor-pointer transition-opacity hover:opacity-80"
                style={(isSetup || cmsEnabled)
                  ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                  : { background: "#d2992218", color: "#d29922", border: "1px solid #d2992228" }
                }
              >
                <span>Open Superadmin</span>
                <ExternalLink size={11} />
              </a>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { step: 1, label: "Login to Superadmin" },
                { step: 2, label: "Click Datasets" },
                { step: 3, label: "Search for the site name" },
                { step: 4, label: "Click Edit" },
                { step: 5, label: <>Enable <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "#0d1117", color: "#e6edf3", fontSize: "11px" }}>AI Job Search Enabled</span></> },
              ].map(({ step, label }) => (
                <div
                  key={step}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "#0d1117", border: "1px solid #21262d" }}
                >
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-500"
                    style={(isSetup || cmsEnabled)
                      ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                      : { background: "#d2992218", color: "#d29922", border: "1px solid #d2992228" }
                    }
                  >
                    {step}
                  </span>
                  <span className="text-[12px]" style={{ color: "#8b949e" }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setCmsEnabled((v) => !v)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all duration-300 hover:opacity-80"
                style={(isSetup || cmsEnabled)
                  ? { background: "#0d2b1d", color: "#3fb950", border: "1px solid #3fb95030" }
                  : { background: "#1a1206", color: "#d29922", border: "1px solid #d2992230" }
                }
              >
                {(isSetup || cmsEnabled) ? "✓ Enabled" : "Enable"}
              </button>
            </div>
          </div>
        )}

        {/* Preview tab — package.json */}
        {!checking && rootPath && activeTab === "preview" && (
          <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            {(() => {
              const allInstalled = missingPackages.length === 0 || installState === "done";
              const color = allInstalled ? "#3fb950" : "#d29922";
              return (
                <div className="flex items-center gap-2 mb-3">
                  <Package size={13} style={{ color }} />
                  <span className="text-[11px] uppercase tracking-widest" style={{ color }}>Package Setup</span>
                </div>
              );
            })()}

            {!pkg ? (
              <div className="text-[12px] text-[#484f58]">No package.json data — set a project folder first.</div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #30363d" }}>
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
                  const AI_PKG = "@sourceflow-uk/ai-job-search";
                  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
                  const aiDep = Object.fromEntries(Object.entries(allDeps).filter(([k]) => k === AI_PKG));
                  const snippet = JSON.stringify(
                    { ...(Object.keys(aiDep).length ? { dependencies: aiDep } : {}) },
                    null,
                    2
                  );
                  return (
                    <div style={{ background: "#0d1117" }}>
                      <CodeBlock code={snippet} language="json" highlightLines={[AI_PKG]} />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
