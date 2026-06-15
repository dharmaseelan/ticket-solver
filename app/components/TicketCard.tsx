"use client";
import { Ticket } from "@/app/types";
import { Zap, Clock, AlertCircle, Building2 } from "lucide-react";

interface TicketCardProps {
  ticket: Ticket;
  onSolve?: () => void;
  isSelected?: boolean;
  isSolving?: boolean;
}

const DIFFICULTY_CONFIG = {
  quick: {
    label: "Quick Fix",
    color: "#58a6ff",
    bg: "#58a6ff12",
    border: "#58a6ff30",
    icon: Zap,
  },
  medium: {
    label: "Medium",
    color: "#f59e0b",
    bg: "#f59e0b12",
    border: "#f59e0b30",
    icon: Clock,
  },
  complex: {
    label: "Complex",
    color: "#ef4444",
    bg: "#ef444412",
    border: "#ef444430",
    icon: AlertCircle,
  },
};

export function TicketCard({ ticket, onSolve, isSelected, isSolving }: TicketCardProps) {
  const config = ticket.difficulty
    ? DIFFICULTY_CONFIG[ticket.difficulty]
    : null;

  const Icon = config?.icon;

  return (
    <div
      className="rounded-lg p-4 mb-3 transition-all duration-200 animate-fade-in"
      style={{
        background: isSelected ? "#1a1a0a" : "#141414",
        border: `1px solid ${isSelected ? "#58a6ff50" : config?.border || "#222"}`,
      }}
    >
      {/* Top row: ID + difficulty badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[#8b949e] font-mono">#{ticket.id}</span>
        {config && Icon && (
          <span
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: config.bg, color: config.color }}
          >
            <Icon size={10} />
            {config.label}
          </span>
        )}
      </div>

      {/* Subject */}
      <div className="text-[14px] font-semibold text-[#f0f0f0] leading-snug mb-1">
        {ticket.subject || "Untitled Ticket"}
      </div>

      {/* Company */}
      {ticket.company && (
        <div className="flex items-center gap-1 text-[11px] text-[#8b949e] mb-3">
          <Building2 size={10} />
          {ticket.company}
        </div>
      )}

      {/* Triage reason */}
      {ticket.reason && (
        <div className="text-[12px] text-[#666] leading-relaxed mb-2">
          {ticket.reason}
        </div>
      )}

      {/* Suggested fix hint — only for quick tickets */}
      {ticket.suggestedFix && (
        <div
          className="text-[12px] leading-relaxed rounded-md px-3 py-2 mb-3"
          style={{ background: "#58a6ff0d", color: "#58a6ff", border: "1px solid #58a6ff20" }}
        >
          💡 {ticket.suggestedFix}
        </div>
      )}

      {/* Solve button — only shown on quick tickets */}
      {ticket.difficulty === "quick" && onSolve && (
        <button
          onClick={onSolve}
          disabled={isSolving}
          className="flex items-center gap-2 text-[12px] font-bold px-3 py-2 rounded-md transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          style={{ background: "#1f6feb", color: "#ffffff" }}
        >
          {isSolving ? (
            <>
              <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Solving...
            </>
          ) : (
            <>
              <Zap size={12} />
              Solve This Ticket
            </>
          )}
        </button>
      )}
    </div>
  );
}
