"""Step 3: keep personal data away from the AI model.

Lines that contain a registration number (shortlists) are replaced, and the
numbers are kept locally so shortlisted students' statuses can be updated."""

import re
from dataclasses import dataclass, field

REG_NO = re.compile(r"\b\d{2}[A-Z]{3}\d{4}\b")
STUDENT_EMAIL = re.compile(r"\b[\w.+-]+@vitstudent\.ac\.in\b", re.I)
PHONE = re.compile(r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)")


@dataclass
class Cleaned:
    text: str
    reg_numbers: list[str] = field(default_factory=list)


def clean(text: str) -> Cleaned:
    regs: list[str] = []
    lines = []
    hidden = 0
    for line in text.splitlines():
        found = REG_NO.findall(line)
        if found:
            regs.extend(found)
            hidden += 1
            continue
        lines.append(line)
    out = "\n".join(lines)
    if hidden:
        out = out.rstrip() + f"\n\n[{hidden} student line(s) removed for privacy]"
    out = STUDENT_EMAIL.sub("[student email]", out)
    out = PHONE.sub("[phone]", out)
    return Cleaned(out, sorted(set(regs)))
