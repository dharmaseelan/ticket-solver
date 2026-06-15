"use client";
import { ProjectResult } from "@/app/types";
import { useState } from "react";
import { Copy, Check, FileCode, ArrowLeft, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { computeDiff } from "@/app/lib/diff";

interface SolutionPanelProps {
  projects: ProjectResult[];
  ticketSubject: string;
  ticketRequest: string;
  godfatherNote?: string;
  onBack: () => void;
}

type SaveState = "idle" | "saved" | "error";

export function SolutionPanel({ projects, ticketSubject, ticketRequest, godfatherNote, onBack }: SolutionPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [projectExpanded, setProjectExpanded] = useState<Record<number, boolean>>(
    () => Object.fromEntries(projects.map((_, i) => [i, true]))
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const multiProject = projects.length > 1;

  function copyToClipboard(content: string, key: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
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
    <div className="animate-fade-in">
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

      {/* Per-project sections */}
      {projects.map((project, pi) => {
        const { projectPath, solution } = project;
        const projectName = projectPath.split("/").pop() || projectPath;

        return (
          <div key={pi} className={multiProject ? "mb-6" : ""}>
            {/* Project header — only shown for multi-project */}
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
                <span
                  className="ml-auto text-[11px] px-2 py-0.5 rounded shrink-0"
                  style={{ background: "#0d1f38", color: "#58a6ff", border: "1px solid #58a6ff20" }}
                >
                  {pi + 1}/{projects.length}
                </span>
                {projectExpanded[pi]
                  ? <ChevronDown size={14} color="#555" className="shrink-0" />
                  : <ChevronRight size={14} color="#555" className="shrink-0" />
                }
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

            {/* Files */}
            {(!multiProject || projectExpanded[pi]) && solution.files?.map((file, fi) => {
              const key = `${pi}-${fi}`;
              const diff = file.originalContent
                ? computeDiff(file.originalContent, file.content)
                : null;

              const addedCount = diff?.filter((l) => l.type === "added").length ?? 0;
              const removedCount = diff?.filter((l) => l.type === "removed").length ?? 0;
              const isOpen = expanded[key] ?? false;

              return (
                <div
                  key={key}
                  className="mb-3 rounded-xl overflow-hidden animate-fade-in"
                  style={{ border: "1px solid #30363d" }}
                >
                  {/* File header */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(key)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#21262d] cursor-pointer"
                    style={{ background: "#161b22" }}
                  >
                    <div className="flex items-center gap-2 text-[12px] font-mono truncate">
                      <FileCode size={12} className="shrink-0" style={{ color: "#58a6ff" }} />
                      <span className="text-white font-semibold">{file.path.split("/").pop()}</span>
                      <span className="text-[#8b949e] truncate">{file.path}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {diff && (
                        <span className="flex items-center gap-1.5 text-[11px]">
                          {addedCount > 0 && <span style={{ color: "#58a6ff" }}>+{addedCount}</span>}
                          {removedCount > 0 && <span style={{ color: "#ef4444" }}>-{removedCount}</span>}
                        </span>
                      )}
                      <span
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(file.content, key); }}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors cursor-pointer"
                        style={{
                          background: copied === key ? "#58a6ff20" : "#21262d",
                          color: copied === key ? "#58a6ff" : "#666",
                        }}
                      >
                        {copied === key ? <Check size={10} /> : <Copy size={10} />}
                        {copied === key ? "Copied!" : "Copy"}
                      </span>
                      {isOpen
                        ? <ChevronDown size={14} color="#555" />
                        : <ChevronRight size={14} color="#555" />
                      }
                    </div>
                  </button>

                  {/* Diff / code view */}
                  {isOpen && (
                    <div
                      className="overflow-x-auto overflow-y-auto font-mono text-[12px] leading-relaxed"
                      style={{ background: "#0d1117", maxHeight: 480 }}
                    >
                      {diff ? (
                        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                          <tbody>
                            {diff.map((line, li) => {
                              const isAdded = line.type === "added";
                              const isRemoved = line.type === "removed";
                              return (
                                <tr
                                  key={li}
                                  style={{
                                    background: isAdded ? "#0d1f38" : isRemoved ? "#2b0d0d" : "transparent",
                                  }}
                                >
                                  <td
                                    style={{
                                      width: 16,
                                      padding: "0 8px",
                                      userSelect: "none",
                                      color: isAdded ? "#58a6ff" : isRemoved ? "#ef4444" : "#333",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {isAdded ? "+" : isRemoved ? "−" : " "}
                                  </td>
                                  <td
                                    style={{
                                      padding: "1px 12px 1px 4px",
                                      color: isAdded ? "#f5cdb0" : isRemoved ? "#f0a8a8" : "#666",
                                      whiteSpace: "pre",
                                    }}
                                  >
                                    {line.content}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <pre className="m-0 p-4" style={{ color: "#f5cdb0" }}>
                          {file.content}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Applied banner + open in vscode per project — hidden for CMS-only fixes */}
            {(!multiProject || projectExpanded[pi]) && solution.fixType !== "cms" && (
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex-1 rounded-lg px-4 py-2.5 text-[13px]"
                  style={{ background: "#0d1f38", border: "1px solid #58a6ff30", color: "#58a6ff" }}
                >
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

            {/* Divider between projects */}
            {multiProject && pi < projects.length - 1 && (
              <div className="my-5" style={{ borderTop: "1px solid #1a1a1a" }} />
            )}
          </div>
        );
      })}

      {/* Save to history — once for all projects */}
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
          {saveState === "saved"
            ? "✓ Saved to History"
            : saveState === "error"
            ? "Save failed"
            : `Save to History${multiProject ? ` (${projects.length} projects)` : ""}`}
        </button>
      </div>
    </div>
  );
}
