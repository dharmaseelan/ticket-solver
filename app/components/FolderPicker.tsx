"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  onSelect: (path: string) => void;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  folders: string[];
}

export function FolderPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function browse(dir?: string) {
    setLoading(true);
    const res = await fetch(`/api/browse${dir ? `?path=${encodeURIComponent(dir)}` : ""}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    if (!data) browse();
  }

  function handleSelect() {
    if (data?.current) {
      onSelect(data.current);
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        title="Browse folders"
        className="flex items-center justify-center w-9 h-9 rounded-md transition-colors cursor-pointer hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
        style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#888" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 rounded-lg overflow-hidden"
          style={{
            right: 0,
            width: "340px",
            background: "#141414",
            border: "1px solid #2a2a2a",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {/* Current path */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "#222" }}>
            <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-1">Current folder</div>
            <div className="text-[12px] text-[#888] font-mono truncate">{data?.current || "Loading..."}</div>
          </div>

          {/* Folder list */}
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            {loading && (
              <div className="px-4 py-3 text-[12px] text-[#8b949e]">Loading...</div>
            )}

            {!loading && data && (
              <>
                {/* Up / parent */}
                {data.parent && (
                  <button
                    type="button"
                    onClick={() => browse(data.parent!)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[12px] transition-colors hover:bg-[#1e1e1e] cursor-pointer"
                    style={{ color: "#8b949e" }}
                  >
                    <span>↑</span>
                    <span className="font-mono">..</span>
                  </button>
                )}

                {data.folders.length === 0 && (
                  <div className="px-4 py-3 text-[12px] text-[#8b949e]">No subfolders</div>
                )}

                {data.folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => browse(`${data.current}/${folder}`)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[#1e1e1e]"
                    style={{ color: "#ccc" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#58a6ff30" stroke="#58a6ff60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    {folder}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Select button */}
          <div className="px-4 py-3 border-t" style={{ borderColor: "#222" }}>
            <button
              type="button"
              onClick={handleSelect}
              className="w-full py-2 rounded-md text-[13px] font-bold cursor-pointer"
              style={{ background: "#1f6feb", color: "#ffffff" }}
            >
              Select This Folder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
