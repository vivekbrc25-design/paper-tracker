from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


STATUSES = ["Typing", "Proof Reading", "Correction", "Final Reading", "Completed"]
ROLES = ["Typist", "Proof Reader", "Corrector", "Final Reader"]
AssignmentOutcome = Literal["active", "completed", "returned"]


class UniversityBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class UniversityCreate(UniversityBase):
    pass


class UniversityRead(UniversityBase):
    id: str


class ExamBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    universityId: str
    startDate: str | None = None
    endDate: str | None = None
    receiveDate: str | None = None
    dueDate: str | None = None


class ExamCreate(ExamBase):
    pass


class ExamRead(ExamBase):
    id: str
    universityName: str


class OperatorBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str


class OperatorCreate(OperatorBase):
    pass


class OperatorRead(OperatorBase):
    id: str


class AssignmentHistoryEntry(BaseModel):
    id: str
    stage: str
    operatorId: str
    operatorName: str | None = None
    assignedAt: datetime
    endedAt: datetime | None = None
    completedAt: datetime | None = None
    returnedAt: datetime | None = None
    durationMinutes: int | None = None
    outcome: AssignmentOutcome


class PaperBase(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    code: str = Field(min_length=2, max_length=50)
    universityId: str
    examId: str
    date: str | None = None
    status: str = "Typing"
    assignedUserId: str | None = None


class PaperCreate(PaperBase):
    pass


class PaperUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    universityId: str | None = None
    examId: str | None = None
    date: str | None = None
    status: str | None = None
    assignedUserId: str | None = None


class PaperRead(PaperBase):
    id: str
    universityName: str
    examName: str
    assignmentHistory: list[AssignmentHistoryEntry] = Field(default_factory=list)


class BulkUpdateRequest(BaseModel):
    paperIds: list[str]
    status: str | None = None
    assignedUserId: str | None = None


class BulkDeleteRequest(BaseModel):
    paperIds: list[str]


class BootstrapResponse(BaseModel):
    universities: list[UniversityRead]
    exams: list[ExamRead]
    operators: list[OperatorRead]
    papers: list[PaperRead]


class ReportOverview(BaseModel):
    statusCounts: dict[str, int]
    operatorLedger: list[dict]
    timingSummary: dict[str, dict[str, float | int]]


class ImportPapersResponse(BaseModel):
    processed: int
    created: int
    updated: int


class LoginRequest(BaseModel):
    userId: str
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    user: dict[str, str]


class SessionResponse(BaseModel):
    authenticated: bool
    user: dict[str, str]
