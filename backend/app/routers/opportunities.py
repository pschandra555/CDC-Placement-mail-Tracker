from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import eligibility
from ..auth import current_student
from ..db import get_db
from ..models import Application, EligibilityResult, Opportunity, Report, Student, utcnow
from ..schemas import OpportunityOut

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def _out(o: Opportunity, s: Student, res: EligibilityResult | None, app: Application | None, reported: bool) -> OpportunityOut:
    # Stored result is the source of truth; compute on the fly if matching hasn't run for this student yet.
    if not s.profile_complete and o.rule is not None:
        el = {"state": "check", "reasons": ["Save your profile to check eligibility"]}
    else:
        el = {"state": res.state, "reasons": res.reasons} if res else eligibility.check(o.rule, s).__dict__
    return OpportunityOut.model_validate(
        {
            **{k: getattr(o, k) for k in ("id", "category", "title", "organization", "registration_link", "deadline", "event_date",
                                          "summary", "details", "confidence", "status", "update_note", "logo_hue")},
            "rule": o.rule,
            "mail": {"sender": o.mail.sender, "subject": o.mail.subject, "received_at": o.mail.received_at, "body": o.mail.clean_text},
            "eligibility": el,
            "application": app,
            "reported": reported,
        }
    )


def _load(db: Session, s: Student, ids: list[str] | None = None, include_closed: bool = False) -> list[OpportunityOut]:
    q = select(Opportunity).options(selectinload(Opportunity.rule), selectinload(Opportunity.mail))
    if ids is not None:
        q = q.where(Opportunity.id.in_(ids))
    elif not include_closed:
        q = q.where((Opportunity.deadline.is_(None)) | (Opportunity.deadline > utcnow()))
    opps = db.scalars(q.order_by(Opportunity.deadline)).all()
    res = {r.opportunity_id: r for r in db.scalars(select(EligibilityResult).where(EligibilityResult.student_id == s.id))}
    apps = {a.opportunity_id: a for a in db.scalars(select(Application).where(Application.student_id == s.id))}
    reps = set(db.scalars(select(Report.opportunity_id).where(Report.student_id == s.id)))
    return [_out(o, s, res.get(o.id), apps.get(o.id), o.id in reps) for o in opps]


@router.get("", response_model=list[OpportunityOut], response_model_by_alias=True)
def list_opportunities(include_closed: bool = False, s: Student = Depends(current_student), db: Session = Depends(get_db)):
    return _load(db, s, include_closed=include_closed)


@router.get("/{opp_id}", response_model=OpportunityOut, response_model_by_alias=True)
def get_opportunity(opp_id: str, s: Student = Depends(current_student), db: Session = Depends(get_db)):
    found = _load(db, s, ids=[opp_id])
    if not found:
        raise HTTPException(404, "Opportunity not found")
    return found[0]


@router.post("/{opp_id}/report", status_code=204)
def report_wrong_criteria(opp_id: str, s: Student = Depends(current_student), db: Session = Depends(get_db)):
    if not db.get(Opportunity, opp_id):
        raise HTTPException(404, "Opportunity not found")
    if not db.get(Report, (s.id, opp_id)):
        db.add(Report(student_id=s.id, opportunity_id=opp_id))
        db.commit()
