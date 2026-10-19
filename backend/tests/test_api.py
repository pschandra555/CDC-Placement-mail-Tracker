from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.models import Reminder
from app.pipeline.run import run

PROFILE = {"name": "Aarav Sharma", "regNo": "22BCE1234", "branch": "CSE", "program": "B.Tech", "batch": 2026, "cgpa": 7.6,
           "marks10th": 92, "marks12th": 88, "currentBacklogs": 0, "pastBacklogs": 0,
           "alertCategories": ["full-time", "internship", "intern-ft", "hackathon"]}


def by_prefix(ops, prefix):
    return next(o for o in ops if o["id"].startswith(prefix))


def test_pipeline_is_idempotent_and_merges_updates():
    first = run()
    assert len(first.created) == 14 and first.updated and first.ignored == 1 and not first.errors
    assert run().skipped_duplicates == 16


def test_student_flow():
    with TestClient(app) as c:
        # profile saved before the mails arrive: shortlist is applied by the pipeline
        assert c.put("/me", json=PROFILE).status_code == 200
        report = run()
        assert report.shortlisted == 1

        ops = c.get("/opportunities").json()
        nimbus = by_prefix(ops, "nimbus-labs-software")
        assert nimbus["eligibility"] == {"state": "not-eligible", "reasons": ["CGPA 7.6 is below the required 8.0"]}
        assert nimbus["application"]["status"] == "shortlisted"
        assert "22BCE" not in by_prefix(ops, "nimbus-labs-nimbus-labs-shortlist")["mail"]["body"]
        ledgerly = by_prefix(ops, "ledgerly-fintech-backend")
        assert ledgerly["status"] == "updated" and ledgerly["updateNote"] == "Deadline extended"

        # raising CGPA flips eligibility
        c.put("/me", json={**PROFILE, "cgpa": 8.2})
        assert c.get(f"/opportunities/{nimbus['id']}").json()["eligibility"]["state"] == "eligible"

        # reminders exist for an eligible drive, and are cancelled once applied
        q = by_prefix(ops, "quantix")["id"]
        with SessionLocal() as db:
            pending = db.scalars(select(Reminder).where(Reminder.opportunity_id == q, Reminder.cancelled.is_(False))).all()
            assert {r.kind for r in pending} >= {"deadline-24h"}
        assert c.put(f"/applications/{q}", json={"status": "applied", "note": "OA Friday"}).json()["status"] == "applied"
        with SessionLocal() as db:
            assert all(r.cancelled for r in db.scalars(select(Reminder).where(Reminder.opportunity_id == q)))

        assert c.post(f"/opportunities/{q}/report").status_code == 204
        assert c.get(f"/opportunities/{q}").json()["reported"] is True

        # delete everything
        assert c.delete("/me").status_code == 204
        assert c.get("/me").json()["profileComplete"] is False


def test_only_vit_accounts():
    with TestClient(app) as c:
        assert c.get("/me", headers={"X-Dev-Email": "someone@gmail.com"}).status_code == 403


def test_new_student_before_profile():
    run()
    with TestClient(app) as c:
        me = c.get("/me").json()
        assert me["name"] == "Aarav Sharma" and not me["profileComplete"]
        ops = c.get("/opportunities").json()
        nimbus = by_prefix(ops, "nimbus-labs-software")
        assert nimbus["eligibility"] == {"state": "check", "reasons": ["Save your profile to check eligibility"]}
        assert by_prefix(ops, "codechef")["eligibility"]["state"] == "open"


def test_first_visit_parallel_requests_do_not_crash():
    """A new student's first page load fires several requests at once."""
    from concurrent.futures import ThreadPoolExecutor

    with TestClient(app) as c:
        email = {"X-Dev-Email": "new.student2025@vitstudent.ac.in"}
        with ThreadPoolExecutor(8) as pool:
            codes = list(pool.map(lambda path: c.get(path, headers=email).status_code, ["/me", "/opportunities", "/notifications", "/me/alerts"] * 4))
    assert set(codes) == {200}



def test_second_year_cse_is_student_sees_junior_drives():
    run()
    with TestClient(app) as c:
        c.put("/me", json={**PROFILE, "regNo": "24BCI0181", "branch": "CSE-IS", "batch": 2028, "cgpa": 9.0})
        ops = c.get("/opportunities").json()
        assert by_prefix(ops, "lumen-robotics")["eligibility"]["state"] == "eligible"
        assert by_prefix(ops, "vit-e-cell")["eligibility"]["state"] == "eligible"
        assert by_prefix(ops, "nimbus-labs-software")["eligibility"]["reasons"] == ["Batch 2028 is not eligible (open to 2026)"]
