from types import SimpleNamespace as NS

from app.eligibility import check

STUDENT = NS(branch="CSE", batch=2026, cgpa=7.6, marks_10th=92, marks_12th=88, current_backlogs=0, past_backlogs=0)


def rule(**kw):
    base = dict(min_cgpa=None, branches=[], batches=[], max_backlogs=None, no_past_backlogs=False, min_10th=None, min_12th=None, unclear=False)
    return NS(**{**base, **kw})


def test_open_when_no_rule():
    assert check(None, STUDENT).state == "open"


def test_unclear_needs_manual_check():
    assert check(rule(unclear=True), STUDENT).state == "check"


def test_cgpa_reason_matches_frontend_wording():
    r = check(rule(min_cgpa=8), STUDENT)
    assert r.state == "not-eligible"
    assert r.reasons == ["CGPA 7.6 is below the required 8.0"]


def test_every_failing_reason_is_listed():
    s = NS(**{**STUDENT.__dict__, "current_backlogs": 2, "past_backlogs": 1, "marks_12th": 72.5})
    r = check(rule(min_cgpa=8.25, branches=["ECE", "EEE"], batches=[2027], max_backlogs=0, no_past_backlogs=True, min_12th=80), s)
    assert r.reasons == [
        "CGPA 7.6 is below the required 8.25",
        "Branch CSE is not in ECE, EEE",
        "Batch 2026 is not eligible (open to 2027)",
        "2 current backlogs; none allowed",
        "History of backlogs is not allowed",
        "12th marks 72.5% are below the required 80%",
    ]


def test_eligible_when_all_pass():
    assert check(rule(min_cgpa=7.5, branches=["CSE", "IT"], batches=[2026], max_backlogs=0, min_10th=75), STUDENT).state == "eligible"
