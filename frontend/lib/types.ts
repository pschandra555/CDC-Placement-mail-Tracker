// Shapes mirror the database tables in the project spec, so the Phase 1
// FastAPI backend can return these directly.

export type Category =
  | "full-time"
  | "internship"
  | "intern-ft"
  | "hackathon"
  | "workshop"
  | "update"
  | "other";

export type EligibilityState = "eligible" | "not-eligible" | "check" | "open";

export interface EligibilityRule {
  minCgpa?: number;
  branches?: string[]; // empty / undefined = all branches
  batches?: number[];
  maxBacklogs?: number; // current backlogs allowed
  noPastBacklogs?: boolean;
  min10th?: number;
  min12th?: number;
  sourceLine?: string; // the eligibility line exactly as written in the mail
  unclear?: boolean; // AI was not confident about the criteria
}

export interface Opportunity {
  id: string;
  category: Category;
  title: string; // role or event name
  organization: string;
  registrationLink: string;
  deadline: string; // ISO
  eventDate?: string; // ISO
  summary: string[]; // 3-line summary
  details: Record<string, string>; // category-specific fields
  rule: EligibilityRule | null; // null = open to all
  confidence: number; // 0..1 from extraction
  status: "open" | "closed" | "updated";
  updateNote?: string;
  mail: { sender: string; subject: string; receivedAt: string; body: string };
  logoHue: number; // for the generated logo tile
}

export interface Student {
  name: string;
  vitEmail: string;
  regNo: string;
  branch: string;
  program: string;
  batch: number;
  cgpa: number;
  marks10th: number;
  marks12th: number;
  currentBacklogs: number;
  pastBacklogs: number;
  alertCategories: Category[];
}

export type JobStatus =
  | "not-applied"
  | "applied"
  | "shortlisted"
  | "interview"
  | "selected"
  | "rejected"
  | "skipped";

export type EventStatus = "not-registered" | "registered" | "team-formed" | "submitted" | "result" | "skipped";

export type AppStatus = JobStatus | EventStatus;

export interface Application {
  opportunityId: string;
  status: AppStatus;
  note?: string;
  updatedAt: string;
}

export interface EligibilityResult {
  state: EligibilityState;
  reasons: string[];
}
