"use client";
import { useEffect, useState } from "react";
import { FileCode, Clock, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";

type ProjectEntry = {
  projectPath: string;
  changes: string[];
  filesChanged: string[];
};

type HistoryEntry = {
  ticketSubject: string;
  ticketRequest: string;
  godfatherNote?: string;
  // New format
  projects?: ProjectEntry[];
  // Old format (backwards compat)
  projectPath?: string;
  changes?: string[];
  filesChanged?: string[];
  savedAt: string;
};

function normalizeEntry(entry: HistoryEntry): ProjectEntry[] {
  if (entry.projects?.length) return entry.projects;
  return [{
    projectPath: entry.projectPath || "",
    changes: entry.changes || [],
    filesChanged: entry.filesChanged || [],
  }];
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => { setHistory(d.history); setLoading(false); });
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-8">
        <div className="text-[18px] font-bold text-white">History</div>
        <div className="text-[12px] text-[#8b949e] mt-1">All tickets you&apos;ve solved and saved.</div>
      </div>

      {loading && (
        <div className="text-[13px] text-[#8b949e]">Loading...</div>
      )}

      {!loading && history.length === 0 && (
        <div className="rounded-lg p-6 text-center" style={{ background: "#221f1b", border: "1px solid #2e2926" }}>
          <div className="text-[13px] text-[#8b949e]">No history yet. Solve a ticket and click Save to History.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {history.map((entry, i) => {
          const projects = normalizeEntry(entry);
          const multiProject = projects.length > 1;

          return (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "#221f1b", border: "1px solid #2e2926" }}>

              {/* Subject + date — clickable header */}
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-[#2a2520] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-white leading-snug truncate">{entry.ticketSubject}</div>
                  <div className="flex items-center gap-1 text-[11px] text-[#8b949e] mt-0.5">
                    <Clock size={10} />
                    {formatDate(entry.savedAt)}
                  </div>
                </div>
                {expanded[i]
                  ? <ChevronDown size={14} color="#555" className="shrink-0" />
                  : <ChevronRight size={14} color="#555" className="shrink-0" />
                }
              </button>

              {/* Collapsible content */}
              {expanded[i] && (
                <div className="px-4 pb-4 pt-1">
                  {/* Projects */}
                  {projects.map((p, pi) => (
                    <div key={pi} className={multiProject ? "mb-3" : ""}>
                      {p.projectPath && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8b949e] mb-2 font-mono">
                          <FolderOpen size={11} />
                          {multiProject && <span className="text-[#6e7681] mr-1">{pi + 1}.</span>}
                          {p.projectPath}
                        </div>
                      )}

                      {p.changes?.length > 0 && (
                        <ul className="space-y-1 mb-2">
                          {p.changes.map((c, j) => (
                            <li key={j} className="flex items-start gap-2 text-[12px] text-[#888]">
                              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "#58a6ff" }} />
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}

                      {p.filesChanged?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.filesChanged.map((f, j) => (
                            <span
                              key={j}
                              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-mono"
                              style={{ background: "#1e1b18", color: "#6e6258", border: "1px solid #2e2926" }}
                            >
                              <FileCode size={10} />
                              {f.split("/").pop()}
                            </span>
                          ))}
                        </div>
                      )}

                      {multiProject && pi < projects.length - 1 && (
                        <div className="mt-3" style={{ borderTop: "1px solid #1a1a1a" }} />
                      )}
                    </div>
                  ))}

                  {entry.godfatherNote && (
                    <div
                      className="mt-3 text-[11px] px-3 py-2 rounded-md"
                      style={{ background: "#141210", color: "#6e6258", border: "1px solid #252018" }}
                    >
                      <span style={{ color: "#58a6ff" }}>Developer Note:</span> {entry.godfatherNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
