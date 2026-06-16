"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, XCircle } from "lucide-react";

export type ToastItem = {
  id: string;
  type: "success" | "error";
  title: string;
  message?: string;
};

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss after 6s (errors stay a bit longer to read)
    const delay = toast.type === "error" ? 8000 : 5000;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const isSuccess = toast.type === "success";

  return (
    <div
      className="flex gap-3 w-80 rounded-xl p-4 shadow-2xl transition-all duration-300"
      style={{
        background: "#161b22",
        border: `1px solid ${isSuccess ? "#3fb95040" : "#f8514940"}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess
          ? <CheckCircle size={15} color="#3fb950" />
          : <XCircle size={15} color="#f85149" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: isSuccess ? "#3fb950" : "#f85149" }}>
          {toast.title}
        </div>
        {toast.message && (
          <div
            className="text-[11px] font-mono mt-1 whitespace-pre-wrap break-words"
            style={{ color: "#8b949e", maxHeight: "160px", overflowY: "auto" }}
          >
            {toast.message}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="shrink-0 cursor-pointer transition-opacity hover:opacity-60"
        style={{ color: "#6e7681" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
      style={{ pointerEvents: "none" }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <Toast toast={t} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
