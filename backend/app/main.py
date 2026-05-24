from __future__ import annotations

import logging
import secrets

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.db.mongo import get_database
from app.schemas import (
    BootstrapResponse,
    BulkDeleteRequest,
    BulkUpdateRequest,
    ExamCreate,
    ExamRead,
    ImportPapersResponse,
    LoginRequest,
    LoginResponse,
    OperatorCreate,
    OperatorRead,
    PaperCreate,
    PaperRead,
    PaperUpdate,
    ReportOverview,
    SessionResponse,
    UniversityCreate,
    UniversityRead,
)
from app.services.workspace import (
    bulk_delete_papers,
    bulk_update_papers,
    create_exam,
    create_operator,
    create_paper,
    create_university,
    delete_exam,
    delete_operator,
    delete_paper,
    delete_university,
    get_bootstrap,
    get_paper_import_sample,
    get_report_overview,
    import_papers,
    reset_defaults,
    seed_defaults,
    update_paper,
)


logger = logging.getLogger(__name__)
app = FastAPI(title=settings.app_name)
security = HTTPBearer(auto_error=False)
app.state.active_tokens = {}
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


def build_user(user_id: str, display_name: str, role: str) -> dict[str, str]:
    return {
        "userId": user_id,
        "displayName": display_name,
        "role": role,
    }


def get_configured_users() -> dict[str, dict[str, dict[str, str] | str]]:
    users = {
        settings.admin_user_id: {
            "password": settings.admin_password,
            "profile": build_user(settings.admin_user_id, "Paper Tracker Admin", "admin"),
        }
    }

    if settings.manager_user_id and settings.manager_password:
        users[settings.manager_user_id] = {
            "password": settings.manager_password,
            "profile": build_user(settings.manager_user_id, settings.manager_display_name, "manager"),
        }

    return users


def get_current_user(allowed_roles: set[str] | None = None):
    def dependency(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict[str, str]:
        if credentials is None:
            raise HTTPException(status_code=401, detail="Authentication required.")

        token = credentials.credentials
        user = app.state.active_tokens.get(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session.")
        if allowed_roles and user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have access to this action.")
        return user

    return dependency


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled server error for %s %s", request.method, request.url.path)
    detail = str(exc).strip() or exc.__class__.__name__
    return JSONResponse(status_code=500, content={"detail": detail, "errorType": exc.__class__.__name__})


@app.get("/api/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    users = get_configured_users()
    account = users.get(payload.userId)
    if not account or payload.password != account["password"]:
        raise HTTPException(status_code=401, detail="Invalid user ID or password.")

    token = secrets.token_urlsafe(32)
    app.state.active_tokens[token] = account["profile"]
    return LoginResponse(
        accessToken=token,
        user=account["profile"],
    )


@app.get("/api/auth/session", response_model=SessionResponse)
def session(current_user: dict[str, str] = Depends(get_current_user())) -> SessionResponse:
    return SessionResponse(authenticated=True, user=current_user)


@app.get("/api/bootstrap", response_model=BootstrapResponse)
def bootstrap(_: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> BootstrapResponse:
    return BootstrapResponse(**get_bootstrap(get_database()))


@app.post("/api/reset", response_model=BootstrapResponse)
def reset_data(_: dict[str, str] = Depends(get_current_user({"admin"}))) -> BootstrapResponse:
    return BootstrapResponse(**reset_defaults(get_database()))


@app.post("/api/universities", response_model=UniversityRead)
def add_university(payload: UniversityCreate, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> UniversityRead:
    try:
        return UniversityRead(**create_university(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/universities/{university_id}")
def remove_university(university_id: str, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> dict:
    try:
        delete_university(get_database(), university_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "University removed successfully."}


@app.post("/api/exams", response_model=ExamRead)
def add_exam(payload: ExamCreate, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> ExamRead:
    try:
        return ExamRead(**create_exam(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/exams/{exam_id}")
def remove_exam(exam_id: str, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> dict:
    try:
        delete_exam(get_database(), exam_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "Exam session removed successfully."}


@app.post("/api/operators", response_model=OperatorRead)
def add_operator(payload: OperatorCreate, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> OperatorRead:
    try:
        return OperatorRead(**create_operator(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/operators/{operator_id}")
def remove_operator(operator_id: str, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> dict:
    delete_operator(get_database(), operator_id)
    return {"message": "Operator removed successfully."}


@app.post("/api/papers", response_model=PaperRead)
def add_paper(payload: PaperCreate, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> PaperRead:
    try:
        return PaperRead(**create_paper(get_database(), payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/papers/import-sample")
def download_paper_import_sample(_: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> Response:
    return Response(
        content=get_paper_import_sample(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="paper-import-sample.csv"'},
    )


@app.post("/api/papers/import", response_model=ImportPapersResponse)
async def import_paper_rows(
    universityId: str = Form(...),
    examId: str = Form(...),
    file: UploadFile = File(...),
    _: dict[str, str] = Depends(get_current_user({"admin", "manager"})),
) -> ImportPapersResponse:
    try:
        content = (await file.read()).decode("utf-8-sig")
        return import_papers(get_database(), universityId, examId, content)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Please upload a UTF-8 CSV file.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/papers/{paper_id}", response_model=PaperRead)
def edit_paper(paper_id: str, payload: PaperUpdate, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> PaperRead:
    try:
        return PaperRead(**update_paper(get_database(), paper_id, payload))
    except ValueError as exc:
        status_code = 404 if str(exc) == "Paper not found." else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@app.delete("/api/papers/{paper_id}")
def remove_paper(paper_id: str, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> dict:
    delete_paper(get_database(), paper_id)
    return {"message": "Paper removed successfully."}


@app.post("/api/papers/bulk-update")
def update_papers_bulk(payload: BulkUpdateRequest, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> dict:
    try:
        updated = bulk_update_papers(get_database(), payload)
        return {"updated": updated}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/papers/bulk-delete")
def delete_papers_bulk(payload: BulkDeleteRequest, _: dict[str, str] = Depends(get_current_user({"admin", "manager"}))) -> dict:
    bulk_delete_papers(get_database(), payload)
    return {"message": "Selected papers removed successfully."}


@app.get("/api/reports/overview", response_model=ReportOverview)
def reports_overview(_: dict[str, str] = Depends(get_current_user({"admin"}))) -> ReportOverview:
    return get_report_overview(get_database())
