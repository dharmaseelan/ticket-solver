"use client";
import { useEffect, useRef } from "react";
import type { LogEntry } from "@/app/lib/log";

export function LogConsole({ logs }: { logs: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!logs.length) return null;

  const colors: Record<string, string> = {
    info: "#888",
    success: "#58a6ff",
    error: "#ef4444",
    warn: "#f59e0b",
  };

  return (
    <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3 mb-4 max-h-36 overflow-y-auto font-mono">
      {logs.map((l, i) => (
        <div
          key={i}
          className="text-xs leading-7 animate-fade-in"
          style={{ color: colors[l.type] || "#888" }}
        >
          <span className="text-[#6e7681] mr-2 select-none">
            {new Date(l.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          {l.msg}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

