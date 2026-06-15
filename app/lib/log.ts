export interface LogEntry {
  msg: string;
  type: "info" | "success" | "error" | "warn";
  ts: number;
}

export function makeLog(msg: string, type: LogEntry["type"] = "info"): LogEntry {
  return { msg, type, ts: Date.now() };
}
