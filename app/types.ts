export interface Ticket {
  id: string;
  subject: string;
  body: string;
  company: string;
  stage?: string;
  createdAt?: string;
  // Added by triage
  difficulty?: "quick" | "medium" | "complex";
  reason?: string;
  suggestedFix?: string;
}

export interface FilePatch {
  path: string;
  content: string;
  isFullFile: boolean;
  originalContent?: string;
}

export interface CmsAction {
  component: string;
  field: string;
  currentValue: string;
  issue: string;
  fix: string;
}

export interface Solution {
  changes: string[];
  files: FilePatch[];
  fixType?: "code" | "cms";
  cmsActions?: CmsAction[];
}

export interface ProjectResult {
  projectPath: string;
  solution: Solution;
}

export type Phase =
  | "idle"
  | "loading-tickets"
  | "tickets-loaded"
  | "analyzing"
  | "analyzed"
  | "solving"
  | "solved"
  | "error";
