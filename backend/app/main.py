from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongo import get_database
from app.schemas import (
    BootstrapResponse,
    BulkDeleteRequest,
    BulkUpdateRequest,
    ExamCreate,
    ExamRead,
    OperatorCreate,
    OperatorRead,
    PaperCreate,
    PaperRead,
    PaperUpdate,
    ReportOverview,
    UniversityCreate,
    UniversityRead,
)
from app.services.workspace import (
    create_exam,
    create_operator,
    create_paper,
    create_university,
    delete_exam,
    delete_operator,
    delete_paper,
    delete_university,
    get_bootstrap,
    get_report_overview,
    reset_defaults,
    seed_defaults,
    update_paper,
    bulk_delete_papers,
    bulk_update_papers,
)


app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    try:
        seed_defaults(get_database())
    except Exception as exc:  # pragma: no cover - startup should not block UI build
        print(f"Warning: unable to seed MongoDB on startup: {exc}")


@app.get("/api/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.get("/api/bootstrap", response_model=BootstrapResponse)
def bootstrap() -> BootstrapResponse:
    return BootstrapResponse(**get_bootstrap(get_database()))


@app.post("/api/reset", response_model=BootstrapResponse)
def reset_data() -> BootstrapResponse:
    return BootstrapResponse(**reset_defaults(get_database()))


@app.post("/api/universities", response_model=UniversityRead)
def add_university(payload: UniversityCreate) -> UniversityRead:
    try:
        return UniversityRead(**create_university(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/universities/{university_id}")
def remove_university(university_id: str) -> dict:
    try:
        delete_university(get_database(), university_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "University removed successfully."}


@app.post("/api/exams", response_model=ExamRead)
def add_exam(payload: ExamCreate) -> ExamRead:
    try:
        return ExamRead(**create_exam(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/exams/{exam_id}")
def remove_exam(exam_id: str) -> dict:
    try:
        delete_exam(get_database(), exam_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "Exam session removed successfully."}


@app.post("/api/operators", response_model=OperatorRead)
def add_operator(payload: OperatorCreate) -> OperatorRead:
    try:
        return OperatorRead(**create_operator(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/operators/{operator_id}")
def remove_operator(operator_id: str) -> dict:
    delete_operator(get_database(), operator_id)
    return {"message": "Operator removed successfully."}


@app.post("/api/papers", response_model=PaperRead)
def add_paper(payload: PaperCreate) -> PaperRead:
    try:
        return PaperRead(**create_paper(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/papers/{paper_id}", response_model=PaperRead)
def edit_paper(paper_id: str, payload: PaperUpdate) -> PaperRead:
    try:
        return PaperRead(**update_paper(get_database(), paper_id, payload))
    except ValueError as exc:
        status_code = 404 if str(exc) == "Paper not found." else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@app.delete("/api/papers/{paper_id}")
def remove_paper(paper_id: str) -> dict:
    delete_paper(get_database(), paper_id)
    return {"message": "Paper removed successfully."}


@app.post("/api/papers/bulk-update")
def update_papers_bulk(payload: BulkUpdateRequest) -> dict:
    updated = bulk_update_papers(get_database(), payload)
    return {"updated": updated}


@app.post("/api/papers/bulk-delete")
def delete_papers_bulk(payload: BulkDeleteRequest) -> dict:
    bulk_delete_papers(get_database(), payload)
    return {"message": "Selected papers removed successfully."}


@app.get("/api/reports/overview", response_model=ReportOverview)
def reports_overview() -> ReportOverview:
    return get_report_overview(get_database())
