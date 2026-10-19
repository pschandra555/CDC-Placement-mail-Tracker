"""Python port of frontend/lib/eligibility.ts. Reason strings must match exactly;
tests/test_eligibility.py checks the shared cases."""

from dataclasses import dataclass, field
from typing import Protocol


class StudentLike(Protocol):
    branch: str
    batch: int
    cgpa: float
    marks_10th: float
    marks_12th: float
    current_backlogs: int
    past_backlogs: int


class RuleLike(Protocol):
    min_cgpa: float | None
    branches: list
    batches: list
    max_backlogs: int | None
    no_past_backlogs: bool
    min_10th: float | None
    min_12th: float | None
    unclear: bool


@dataclass
class Result:
    state: str
    reasons: list[str] = field(default_factory=list)


def _fmt(n: float) -> str:
    """CGPA-style numbers keep one decimal ("8.0"), like the CDC mails write them."""
    return f"{n:.1f}" if abs(n * 10 - round(n * 10)) < 1e-9 else f"{n:.2f}"


def _num(n: float) -> str:
    """Plain number like JavaScript prints it: 75 -> "75", 72.5 -> "72.5"."""
    return str(int(n)) if float(n).is_integer() else repr(float(n))


def check(rule: RuleLike | None, s: StudentLike) -> Result:
    if rule is None:
        return Result("open")
    if rule.unclear:
        return Result("check", ["Criteria in the mail are unclear — read the original line"])

    reasons: list[str] = []
    if rule.min_cgpa is not None and s.cgpa < rule.min_cgpa:
        reasons.append(f"CGPA {_fmt(s.cgpa)} is below the required {_fmt(rule.min_cgpa)}")
    if rule.branches and s.branch not in rule.branches:
        reasons.append(f"Branch {s.branch} is not in {', '.join(rule.branches)}")
    if rule.batches and s.batch not in rule.batches:
        reasons.append(f"Batch {s.batch} is not eligible (open to {', '.join(str(b) for b in rule.batches)})")
    if rule.max_backlogs is not None and s.current_backlogs > rule.max_backlogs:
        if rule.max_backlogs == 0:
            plural = "s" if s.current_backlogs > 1 else ""
            reasons.append(f"{s.current_backlogs} current backlog{plural}; none allowed")
        else:
            reasons.append(f"{s.current_backlogs} current backlogs; at most {rule.max_backlogs} allowed")
    if rule.no_past_backlogs and s.past_backlogs > 0:
        reasons.append("History of backlogs is not allowed")
    if rule.min_10th is not None and s.marks_10th < rule.min_10th:
        reasons.append(f"10th marks {_num(s.marks_10th)}% are below the required {_num(rule.min_10th)}%")
    if rule.min_12th is not None and s.marks_12th < rule.min_12th:
        reasons.append(f"12th marks {_num(s.marks_12th)}% are below the required {_num(rule.min_12th)}%")

    return Result("not-eligible", reasons) if reasons else Result("eligible")
