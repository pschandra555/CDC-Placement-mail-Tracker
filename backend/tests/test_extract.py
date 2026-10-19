from datetime import datetime

from app.pipeline.clean import clean
from app.pipeline.extract import extract_rules, parse_dt
from app.pipeline.fetch import load_sample_mails
from app.pipeline.validate import validate

MAILS = {m.message_id: m for m in load_sample_mails()}


def ex(mid):
    m = MAILS[mid]
    return extract_rules(m.subject, clean(m.body).text)


def test_full_time_fields_and_rule():
    e = ex("sample-nimbus")
    assert (e.category, e.organization, e.title) == ("full-time", "Nimbus Labs", "Software Development Engineer")
    assert e.details["CTC"] == "₹24 LPA"
    assert e.registration_link == "https://example.com/register/nimbus"
    assert e.eligibility.min_cgpa == 8.0 and e.eligibility.max_backlogs == 0 and e.eligibility.batches == [2026]
    assert e.eligibility.branches == ["CSE", "CSE-AI", "CSE-DS", "CSE-IoT", "IT"]


def test_categories():
    expected = {
        "sample-quantix": "internship", "sample-orbitra": "intern-ft", "sample-hackverse": "hackathon",
        "sample-ledgerly-ppt": "workshop", "sample-nimbus-shortlist": "update", "sample-codesprint": "hackathon",
        "sample-voltgrid": "full-time", "sample-promo": "other",
    }
    assert {k: ex(k).category for k in expected} == expected


def test_marks_backlog_history_and_open_to_all():
    o = ex("sample-orbitra").eligibility
    assert (o.min_10th, o.min_12th, o.min_cgpa) == (75, 75, 7.0)
    assert ex("sample-ledgerly").eligibility.no_past_backlogs
    assert ex("sample-hackverse").eligibility is None
    assert ex("sample-voltgrid").eligibility.branches == ["ECE", "EEE", "MECH"]


def test_vague_criteria_are_flagged():
    assert ex("sample-helix").eligibility.unclear


def test_update_mail_detected():
    e = ex("sample-ledgerly-ext")
    assert e.is_update and e.organization == "Ledgerly Fintech" and e.deadline


def test_reg_numbers_removed_before_ai():
    c = clean(MAILS["sample-nimbus-shortlist"].body)
    assert c.reg_numbers == ["22BCE0456", "22BCE1234", "22BIT0789"]
    assert "22BCE1234" not in c.text and "Aarav" not in c.text


def test_dates_are_ist():
    assert parse_dt("21 Oct 2026, 11:59 PM") == datetime(2026, 10, 21, 18, 29)


def test_validation_flags_bad_values():
    e = ex("sample-nimbus")
    e.eligibility.min_cgpa = 80
    e.registration_link = "not a link"
    e, problems = validate(e, MAILS["sample-nimbus"].received_at, 0.7)
    assert e.eligibility.unclear and e.registration_link == "" and len(problems) == 2
