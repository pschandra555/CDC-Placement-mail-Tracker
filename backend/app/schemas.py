"""API shapes. Field names are camelCase to match frontend/lib/types.ts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer
from pydantic.alias_generators import to_camel


class Out(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    @field_serializer("*", when_used="json")
    def _dates(self, v):  # naive UTC in the database → explicit Z for the browser
        return v.isoformat() + "Z" if isinstance(v, datetime) else v


class RuleOut(Out):
    min_cgpa: float | None = None
    branches: list[str] = []
    batches: list[int] = []
    max_backlogs: int | None = None
    no_past_backlogs: bool = False
    min_10th: float | None = Field(default=None, serialization_alias="min10th")
    min_12th: float | None = Field(default=None, serialization_alias="min12th")
    source_line: str = ""
    unclear: bool = False


class MailOut(Out):
    sender: str
    subject: str
    received_at: datetime
    body: str


class EligibilityOut(Out):
    state: str
    reasons: list[str] = []


class ApplicationOut(Out):
    opportunity_id: str
    status: str
    note: str | None = None
    updated_at: datetime


class OpportunityOut(Out):
    id: str
    category: str
    title: str
    organization: str
    registration_link: str
    deadline: datetime | None
    event_date: datetime | None = None
    summary: list[str]
    details: dict[str, str]
    rule: RuleOut | None
    confidence: float
    status: str
    update_note: str | None = None
    mail: MailOut
    logo_hue: int
    eligibility: EligibilityOut
    application: ApplicationOut | None = None
    reported: bool = False


class StudentOut(Out):
    name: str
    vit_email: str
    reg_no: str
    branch: str
    program: str
    batch: int
    cgpa: float
    marks_10th: float = Field(serialization_alias="marks10th")
    marks_12th: float = Field(serialization_alias="marks12th")
    current_backlogs: int
    past_backlogs: int
    alert_categories: list[str]
    profile_complete: bool


class StudentIn(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    reg_no: str = Field(default="", max_length=20)
    branch: str = Field(max_length=40)
    program: str = Field(default="B.Tech", max_length=40)
    batch: int = Field(ge=2000, le=2100)
    cgpa: float = Field(ge=0, le=10)
    marks_10th: float = Field(default=0, ge=0, le=100, alias="marks10th")
    marks_12th: float = Field(default=0, ge=0, le=100, alias="marks12th")
    current_backlogs: int = Field(default=0, ge=0, le=99)
    past_backlogs: int = Field(default=0, ge=0, le=99)
    alert_categories: list[str] = []


class ApplicationIn(BaseModel):
    status: str | None = None
    note: str | None = Field(default=None, max_length=2000)


VALID_STATUSES = {"not-applied", "applied", "shortlisted", "interview", "selected", "rejected", "skipped",
                  "not-registered", "registered", "team-formed", "submitted", "result"}
