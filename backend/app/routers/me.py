from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..auth import current_student
from ..db import get_db
from ..matching import match_student
from ..pipeline.run import apply_past_shortlists
from ..models import Application, EligibilityResult, Notification, Reminder, Report, Student, utcnow
from ..schemas import StudentIn, StudentOut

router = APIRouter(prefix="/me", tags=["profile"])


@router.get("", response_model=StudentOut, response_model_by_alias=True)
def get_me(s: Student = Depends(current_student)):
    return s


@router.put("", response_model=StudentOut, response_model_by_alias=True)
def update_me(body: StudentIn, s: Student = Depends(current_student), db: Session = Depends(get_db)):
    s = db.merge(s)
    if body.cgpa != s.cgpa:
        s.cgpa_updated_at = utcnow()
    for k, v in body.model_dump().items():
        setattr(s, k, v.upper() if k == "reg_no" else v)
    s.profile_complete = True
    db.flush()
    match_student(db, s)  # eligibility and reminders follow the new profile
    db.flush()
    apply_past_shortlists(db, s)
    db.commit()
    return s


@router.delete("", status_code=204)
def delete_me(s: Student = Depends(current_student), db: Session = Depends(get_db)):
    """One button deletes the profile, statuses, reminders, notifications and reports."""
    for model in (Reminder, Notification, Application, EligibilityResult, Report):
        db.execute(delete(model).where(model.student_id == s.id))
    db.execute(delete(Student).where(Student.id == s.id))
    db.commit()
