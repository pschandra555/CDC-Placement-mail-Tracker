from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_student
from ..db import get_db
from ..matching import DONE_STATUSES, cancel_reminders, schedule_reminders
from ..models import Application, EligibilityResult, Opportunity, Student
from ..schemas import VALID_STATUSES, ApplicationIn, ApplicationOut

router = APIRouter(prefix="/applications", tags=["applications"])


@router.put("/{opp_id}", response_model=ApplicationOut, response_model_by_alias=True)
def upsert_application(opp_id: str, body: ApplicationIn, s: Student = Depends(current_student), db: Session = Depends(get_db)):
    opp = db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    if body.status is not None and body.status not in VALID_STATUSES:
        raise HTTPException(422, f"Unknown status {body.status!r}")

    app = db.get(Application, (s.id, opp_id))
    if app is None:
        app = Application(student_id=s.id, opportunity_id=opp_id,
                          status="not-registered" if opp.category in ("hackathon", "workshop") else "not-applied")
        db.add(app)
    if body.note is not None:
        app.note = body.note
    if body.status is not None:
        app.status = body.status
        if body.status in DONE_STATUSES:
            cancel_reminders(db, s.id, opp_id)  # no deadline nagging once applied
        else:
            db.flush()
            res = db.get(EligibilityResult, (s.id, opp_id))
            if res and s.profile_complete:
                schedule_reminders(db, s, opp, res.state, notify_new=False)
    db.commit()
    return app
