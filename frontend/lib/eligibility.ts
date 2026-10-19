import type { EligibilityResult, Opportunity, Student } from "./types";

// CGPA-style numbers keep one decimal ("8.0"), like the CDC mails write them.
const fmt = (n: number) => (Math.abs(n * 10 - Math.round(n * 10)) < 1e-9 ? n.toFixed(1) : n.toFixed(2));

/**
 * Plain, deterministic eligibility check. The AI only extracts the rule;
 * this code decides, and lists every failing reason.
 */
export function checkEligibility(opp: Opportunity, s: Student): EligibilityResult {
  const r = opp.rule;
  if (!r) return { state: "open", reasons: [] };
  if (r.unclear) return { state: "check", reasons: ["Criteria in the mail are unclear — read the original line"] };

  const reasons: string[] = [];
  if (r.minCgpa != null && s.cgpa < r.minCgpa)
    reasons.push(`CGPA ${fmt(s.cgpa)} is below the required ${fmt(r.minCgpa)}`);
  if (r.branches?.length && !r.branches.includes(s.branch))
    reasons.push(`Branch ${s.branch} is not in ${r.branches.join(", ")}`);
  if (r.batches?.length && !r.batches.includes(s.batch))
    reasons.push(`Batch ${s.batch} is not eligible (open to ${r.batches.join(", ")})`);
  if (r.maxBacklogs != null && s.currentBacklogs > r.maxBacklogs)
    reasons.push(
      r.maxBacklogs === 0
        ? `${s.currentBacklogs} current backlog${s.currentBacklogs > 1 ? "s" : ""}; none allowed`
        : `${s.currentBacklogs} current backlogs; at most ${r.maxBacklogs} allowed`,
    );
  if (r.noPastBacklogs && s.pastBacklogs > 0) reasons.push(`History of backlogs is not allowed`);
  if (r.min10th != null && s.marks10th < r.min10th)
    reasons.push(`10th marks ${s.marks10th}% are below the required ${r.min10th}%`);
  if (r.min12th != null && s.marks12th < r.min12th)
    reasons.push(`12th marks ${s.marks12th}% are below the required ${r.min12th}%`);

  return reasons.length ? { state: "not-eligible", reasons } : { state: "eligible", reasons: [] };
}

/** VIT reg numbers look like 22BCE1234: 2-digit year + branch code. */
const BRANCH_CODES: Record<string, string> = {
  BCE: "CSE",
  BAI: "CSE-AI",
  BDS: "CSE-DS",
  BCT: "CSE-IoT",
  BCI: "CSE-IS",
  BKT: "CSE-BC",
  BRS: "CSE-BS",
  BIT: "IT",
  BEC: "ECE",
  BEE: "EEE",
  BEI: "EIE",
  BME: "MECH",
  BCL: "CIVIL",
  BCH: "CHEM",
  BBT: "BIOTECH",
  MIS: "MTech-IS",
};

export function parseRegNo(regNo: string): { batch?: number; branch?: string } {
  const m = regNo.trim().toUpperCase().match(/^(\d{2})([A-Z]{3})\d{3,5}$/);
  if (!m) return {};
  const startYear = 2000 + Number(m[1]);
  const isMtech = m[2].startsWith("M");
  return { batch: startYear + (isMtech ? 2 : 4), branch: BRANCH_CODES[m[2]] };
}

export const ALL_BRANCHES = Object.values(BRANCH_CODES);
