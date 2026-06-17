"use client";
import { ProjectResult } from "@/app/types";
import { useState, useRef } from "react";
import { Copy, Check, ArrowLeft, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { computeDiff } from "@/app/lib/diff";
import dynamic from "next/dynamic";
const CodeBlock = dynamic(() => import("@/app/components/CodeBlock"), { ssr: false });

function getLang(filePath: string): string {
  const ext = filePath.split(".").pop() ?? "";
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "scss" || ext === "css") return "scss";
  if (ext === "json") return "json";
  if (ext === "mjs" || ext === "js" || ext === "jsx") return "javascript";
  return "javascript";
}

interface SolutionPanelProps {
  projects: ProjectResult[];
  ticketSubject: string;
  ticketRequest: string;
  godfatherNote?: string;
  onBack: () => void;
}

type SaveState = "idle" | "saved" | "error";

const FILE_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const FOLDER_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
  </svg>
);

export function SolutionPanel({ projects, ticketSubject, ticketRequest, godfatherNote, onBack }: SolutionPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [projectExpanded, setProjectExpanded] = useState<Record<number, boolean>>(
    () => Object.fromEntries(projects.map((_, i) => [i, true]))
  );
  const [selectedFile, setSelectedFile] = useState<Record<number, number>>(
    () => Object.fromEntries(projects.map((_, i) => [i, 0]))
  );
  const [treeDirOpen, setTreeDirOpen] = useState<Record<string, boolean>>({});
  const [treeWidth, setTreeWidth] = useState(200);
  const [handleHover, setHandleHover] = useState(false);
  const resizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const multiProject = projects.length > 1;

  function copyToClipboard(content: string, key: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function saveToHistory() {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketSubject,
          ticketRequest,
          godfatherNote: godfatherNote || null,
          projects: projects.map(({ projectPath, solution }) => ({
            projectPath,
            changes: solution.changes,
            filesChanged: solution.files.map((f) => f.path),
          })),
        }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function openVscode(projectPath: string) {
    await fetch("/api/open-vscode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath }),
    });
  }

  return (
    <div
      className="animate-fade-in"
      onMouseMove={(e) => {
        if (!resizing.current) return;
        const delta = e.clientX - resizeStartX.current;
        setTreeWidth(Math.max(120, Math.min(320, resizeStartW.current + delta)));
      }}
      onMouseUp={() => { resizing.current = false; setHandleHover(false); }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-[#8b949e] hover:text-[#888] transition-colors cursor-pointer"
        >
          <ArrowLeft size={12} />
          Back
        </button>
      </div>

      <div className="text-[11px] text-[#8b949e] uppercase tracking-widest mb-1">Fix for</div>
      <div className="text-[15px] font-bold text-[#f0f0f0] mb-5">{ticketSubject}</div>

      {projects.map((project, pi) => {
        const { projectPath, solution } = project;
        const projectName = projectPath.split("/").pop() || projectPath;
        const selIdx = selectedFile[pi] ?? 0;
        const selFile = solution.files?.[selIdx];

        // Build folder tree from file paths
        const dirs: Record<string, { file: typeof solution.files[0]; globalIdx: number }[]> = {};
        (solution.files ?? []).forEach((file, fi) => {
          const parts = file.path.split("/");
          const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
          if (!dirs[dir]) dirs[dir] = [];
          dirs[dir].push({ file, globalIdx: fi });
        });

        return (
          <div key={pi} className={multiProject ? "mb-6" : ""}>
            {/* Project header */}
            {multiProject && (
              <button
                type="button"
                onClick={() => setProjectExpanded((prev) => ({ ...prev, [pi]: !prev[pi] }))}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg mb-3 text-left transition-colors hover:bg-[#21262d] cursor-pointer"
                style={{ background: "#0d1117", border: "1px solid #21262d" }}
              >
                <FolderOpen size={13} style={{ color: "#58a6ff" }} />
                <span className="text-[13px] font-semibold text-white">{projectName}</span>
                <span className="text-[11px] text-[#8b949e] font-mono truncate">{projectPath}</span>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded shrink-0" style={{ background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff20" }}>
                  {pi + 1}/{projects.length}
                </span>
                {projectExpanded[pi] ? <ChevronDown size={14} color="#555" className="shrink-0" /> : <ChevronRight size={14} color="#555" className="shrink-0" />}
              </button>
            )}

            {/* CMS fix panel */}
            {(!multiProject || projectExpanded[pi]) && solution.fixType === "cms" && solution.cmsActions && (
              <div className="rounded-xl p-4 mb-3" style={{ background: "#1a0f08", border: "1px solid #f97316aa" }}>
                <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#f97316" }}>Fix required in CMS</div>
                <div className="text-[12px] text-[#888] mb-4">No code change needed — update the following in the Sourceflow CMS.</div>
                {solution.cmsActions.map((action, i) => (
                  <div key={i} className="rounded-lg p-3 mb-2 last:mb-0" style={{ background: "#0d1117", border: "1px solid #30363d" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded" style={{ background: "#f9731620", color: "#f97316", border: "1px solid #f9731640" }}>{action.component}</span>
                      <span className="text-[11px] font-mono text-[#666]">→ {action.field}</span>
                    </div>
                    <div className="text-[12px] text-[#888] mb-2">{action.issue}</div>
                    <div className="flex flex-col gap-1.5 text-[12px]">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-0.5">Current value</div>
                        <div className="font-mono text-[#ef4444] bg-[#2b0d0d] px-2 py-1 rounded">{action.currentValue}</div>
                      </div>
                      <div className="text-center text-[#8b949e]">↓</div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-0.5">Fix</div>
                        <div className="font-mono text-[#3fb950] bg-[#0d1f1a] px-2 py-1 rounded">{action.fix}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* What changed */}
            {(!multiProject || projectExpanded[pi]) && solution.changes?.length > 0 && (
              <div className="rounded-xl p-4 mb-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="text-[11px] uppercase tracking-widest mb-3 text-[#8b949e]">{solution.fixType === "cms" ? "What to update in CMS" : "What changed"}</div>
                <ul className="space-y-2">
                  {solution.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-[#ccc]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#58a6ff" }} />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Files — split panel */}
            {(!multiProject || projectExpanded[pi]) && solution.files?.length > 0 && (
              <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1px solid #30363d", height: "400px", display: "flex" }}>
                {/* Left: folder tree */}
                <div style={{ width: `${treeWidth}px`, flexShrink: 0, overflowY: "auto", overflowX: "hidden", background: "#0d1117", borderRight: "1px solid #21262d" }}>
                  {Object.entries(dirs).map(([dir, items]) => {
                    const dirKey = `${pi}-${dir}`;
                    const isDirOpen = treeDirOpen[dirKey] ?? true;
                    return (
                      <div key={dir}>
                        {dir && (
                          <button
                            type="button"
                            onClick={() => setTreeDirOpen((prev) => ({ ...prev, [dirKey]: !isDirOpen }))}
                            className="w-full flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-[#1c2128] transition-colors"
                            style={{ color: "#6e7681" }}
                          >
                            {isDirOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            {FOLDER_ICON}
                            <span className="text-[10px] font-mono truncate">{dir}</span>
                          </button>
                        )}
                        {(!dir || isDirOpen) && items.map(({ file, globalIdx }) => {
                          const isSel = globalIdx === selIdx;
                          const filename = file.path.split("/").pop() ?? file.path;
                          return (
                            <button
                              key={globalIdx}
                              type="button"
                              onClick={() => setSelectedFile((prev) => ({ ...prev, [pi]: globalIdx }))}
                              className="w-full flex items-center gap-1.5 pr-3 py-1 cursor-pointer transition-colors text-left hover:bg-[#1c2128]"
                              style={{
                                paddingLeft: dir ? "28px" : "12px",
                                background: isSel ? "#21262d" : undefined,
                                color: isSel ? "#e6edf3" : "#8b949e",
                              }}
                            >
                              {FILE_ICON}
                              <span className="text-[10px] font-mono truncate">{filename}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Resize handle */}
                <div
                  style={{ width: "2px", flexShrink: 0, cursor: "col-resize", background: handleHover ? "#2d333a" : "#21262d", transition: "background 0.15s" }}
                  onMouseEnter={() => setHandleHover(true)}
                  onMouseLeave={() => { if (!resizing.current) setHandleHover(false); }}
                  onMouseDown={(e) => {
                    resizing.current = true;
                    resizeStartX.current = e.clientX;
                    resizeStartW.current = treeWidth;
                    e.preventDefault();
                  }}
                />

                {/* Right: code / diff view */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0d1117" }}>
                  {selFile && (() => {
                    const diff = selFile.originalContent ? computeDiff(selFile.originalContent, selFile.content) : null;
                    const addedCount = diff?.filter((l) => l.type === "added").length ?? 0;
                    const removedCount = diff?.filter((l) => l.type === "removed").length ?? 0;
                    const addedLineNums = new Set<number>();
                    if (diff) {
                      let lineNum = 1;
                      for (const line of diff) {
                        if (line.type === "removed") continue;
                        if (line.type === "added") addedLineNums.add(lineNum);
                        lineNum++;
                      }
                    }
                    const copyKey = `${pi}-${selIdx}`;
                    return (
                      <>
                        {/* File bar */}
                        <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #21262d", background: "#161b22" }}>
                          <span className="text-[11px] font-mono text-[#8b949e] truncate flex-1">{selFile.path}</span>
                          {diff && (
                            <span className="flex items-center gap-1.5 text-[11px] shrink-0">
                              {addedCount > 0 && <span style={{ color: "#58a6ff" }}>+{addedCount}</span>}
                              {removedCount > 0 && <span style={{ color: "#ef4444" }}>-{removedCount}</span>}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selFile.content, copyKey)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors cursor-pointer shrink-0"
                            style={{ background: copied === copyKey ? "#58a6ff20" : "#21262d", color: copied === copyKey ? "#58a6ff" : "#666" }}
                          >
                            {copied === copyKey ? <Check size={10} /> : <Copy size={10} />}
                            {copied === copyKey ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        {/* Code */}
                        <div style={{ flex: 1, overflowY: "auto", background: "#0d1117", minWidth: 0 }}>
                          <CodeBlock code={selFile.content} language={getLang(selFile.path)} addedLines={addedLineNums.size > 0 ? addedLineNums : undefined} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Applied banner + open in vscode */}
            {(!multiProject || projectExpanded[pi]) && solution.fixType !== "cms" && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 rounded-lg px-4 py-2.5 text-[13px]" style={{ background: "#0d1f38", border: "1px solid #58a6ff30", color: "#58a6ff" }}>
                  ✓ Changes applied{multiProject ? ` to ${projectName}` : " to your project"}.
                </div>
                {projectPath && (
                  <button
                    type="button"
                    onClick={() => openVscode(projectPath)}
                    className="flex items-center gap-2 py-2.5 px-3 rounded-lg text-[12px] font-bold shrink-0 cursor-pointer"
                    style={{ background: "#21262d", color: "#ccc", border: "1px solid #30363d" }}
                    title={`Open ${projectName} in VS Code`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.86V4.14a1.5 1.5 0 0 0-.85-1.553zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                    </svg>
                    {multiProject ? projectName : "Open in VS Code"}
                  </button>
                )}
              </div>
            )}

            {multiProject && pi < projects.length - 1 && (
              <div className="my-5" style={{ borderTop: "1px solid #1a1a1a" }} />
            )}
          </div>
        );
      })}

      {/* Save to history */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={saveToHistory}
          disabled={saveState === "saved"}
          className="py-2 px-5 rounded-md text-[13px] font-semibold flex items-center gap-2 transition-opacity hover:opacity-80 active:opacity-70"
          style={{
            background: saveState === "saved" ? "#0d1f38" : "#1f6feb",
            color: saveState === "saved" ? "#58a6ff" : saveState === "error" ? "#ef4444" : "#ffffff",
            border: saveState === "saved" ? "1px solid #58a6ff40" : "none",
            cursor: saveState === "saved" ? "default" : "pointer",
          }}
        >
          {saveState === "saved" ? "✓ Saved to History" : saveState === "error" ? "Save failed" : `Save to History${multiProject ? ` (${projects.length} projects)` : ""}`}
        </button>
      </div>
    </div>
  );
}
