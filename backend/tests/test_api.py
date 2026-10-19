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
    assert len(first.created) == 11 and first.updated and first.ignored == 1 and not first.errors
    assert run().skipped_duplicates == 13


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
