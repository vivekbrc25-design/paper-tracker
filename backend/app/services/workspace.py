from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from app.defaults import get_default_payload
from app.schemas import (
    BulkDeleteRequest,
    BulkUpdateRequest,
    ExamCreate,
    OperatorCreate,
    PaperCreate,
    PaperUpdate,
    ReportOverview,
    UniversityCreate,
)


COLLECTIONS = {
    "universities": "universities",
    "exams": "exams",
    "operators": "operators",
    "papers": "papers",
}
STATUS_ORDER = ["Typing", "Proof Reading", "Correction", "Final Reading", "Completed"]
STATUS_INDEX = {status: index for index, status in enumerate(STATUS_ORDER)}
STATUS_TO_ROLE = {
    "Typing": "Typist",
    "Proof Reading": "Proof Reader",
    "Correction": "Corrector",
    "Final Reading": "Final Reader",
}


def utc_now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def serialize_document(document: dict | None) -> dict | None:
    if document is None:
        return None
    doc = dict(document)
    doc.pop("_id", None)
    return doc


def prepare_document(payload: dict) -> dict:
    doc = dict(payload)
    doc["_id"] = doc["id"]
    return doc


def ensure_indexes(database) -> None:
    database[COLLECTIONS["universities"]].create_index("name", unique=True)
    database[COLLECTIONS["exams"]].create_index([("universityId", 1), ("name", 1)], unique=True)
    database[COLLECTIONS["operators"]].create_index("name", unique=True)
    database[COLLECTIONS["papers"]].create_index([("examId", 1), ("code", 1)], unique=True)


def seed_defaults(database) -> None:
    ensure_indexes(database)
    if database[COLLECTIONS["universities"]].count_documents({}) > 0:
        return
    payload = get_default_payload()
    for key, collection_name in COLLECTIONS.items():
        documents = [prepare_document(item) for item in payload[key]]
        if documents:
            database[collection_name].insert_many(documents)


def reset_defaults(database) -> dict:
    payload = get_default_payload()
    for collection_name in COLLECTIONS.values():
        database[collection_name].delete_many({})
    for key, collection_name in COLLECTIONS.items():
        documents = [prepare_document(item) for item in payload[key]]
        if documents:
            database[collection_name].insert_many(documents)
    return payload


def get_bootstrap(database) -> dict:
    return {
        "universities": [serialize_document(doc) for doc in database[COLLECTIONS["universities"]].find().sort("name", 1)],
        "exams": [serialize_document(doc) for doc in database[COLLECTIONS["exams"]].find().sort("name", 1)],
        "operators": [serialize_document(doc) for doc in database[COLLECTIONS["operators"]].find().sort("name", 1)],
        "papers": [serialize_document(doc) for doc in database[COLLECTIONS["papers"]].find().sort("date", -1)],
    }


def _operator_lookup(database) -> dict[str, dict]:
    return {
        operator["id"]: serialize_document(operator)
        for operator in database[COLLECTIONS["operators"]].find()
    }


def _exam_lookup(database) -> dict[str, dict]:
    return {exam["id"]: serialize_document(exam) for exam in database[COLLECTIONS["exams"]].find()}


def _university_lookup(database) -> dict[str, dict]:
    return {
        university["id"]: serialize_document(university)
        for university in database[COLLECTIONS["universities"]].find()
    }


def _minutes_between(started_at: str | datetime, finished_at: datetime) -> int:
    if isinstance(started_at, str):
        started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    else:
        started = started_at
    return max(0, int((finished_at - started).total_seconds() // 60))


def _create_active_assignment(stage: str, operator_id: str, operator_name: str | None) -> dict:
    return {
        "id": f"hist_{uuid4().hex[:12]}",
        "stage": stage,
        "operatorId": operator_id,
        "operatorName": operator_name,
        "assignedAt": utc_now(),
        "endedAt": None,
        "completedAt": None,
        "returnedAt": None,
        "durationMinutes": None,
        "outcome": "active",
    }


def _normalize_assignment_for_status(updated: dict, operators_by_id: dict[str, dict]) -> dict:
    normalized = dict(updated)
    status = normalized.get("status")
    assigned_user_id = normalized.get("assignedUserId")

    if status == "Completed":
        normalized["assignedUserId"] = None
        return normalized

    if not assigned_user_id:
        return normalized

    operator = operators_by_id.get(assigned_user_id)
    if not operator:
        raise ValueError("The selected operator does not exist.")

    expected_role = STATUS_TO_ROLE.get(status)
    if expected_role and operator.get("role") != expected_role:
        raise ValueError(f"{status} papers must be assigned to a {expected_role}.")

    return normalized


def _close_active_assignment(history: list[dict], next_status: str, next_operator_id: str | None) -> list[dict]:
    active_entry = next((entry for entry in reversed(history) if entry.get("outcome") == "active"), None)
    if not active_entry:
        return history

    if active_entry.get("stage") == next_status and active_entry.get("operatorId") == next_operator_id:
        return history

    finished_at = utc_now()
    previous_stage_index = STATUS_INDEX.get(active_entry.get("stage"), -1)
    next_stage_index = STATUS_INDEX.get(next_status, previous_stage_index)
    completed = next_stage_index > previous_stage_index or next_status == "Completed"

    active_entry["outcome"] = "completed" if completed else "returned"
    active_entry["endedAt"] = finished_at
    active_entry["durationMinutes"] = _minutes_between(active_entry["assignedAt"], finished_at)
    if completed:
        active_entry["completedAt"] = finished_at
        active_entry["returnedAt"] = None
    else:
        active_entry["returnedAt"] = finished_at
        active_entry["completedAt"] = None
    return history


def _reconcile_history(existing: dict, updated: dict, operators_by_id: dict[str, dict]) -> list[dict]:
    history = [dict(item) for item in existing.get("assignmentHistory", [])]
    next_status = updated.get("status", existing["status"])
    next_operator_id = updated.get("assignedUserId", existing.get("assignedUserId"))

    history = _close_active_assignment(history, next_status, next_operator_id)

    if next_operator_id and next_status != "Completed":
        operator_name = operators_by_id.get(next_operator_id, {}).get("name")
        active_entry = next((entry for entry in reversed(history) if entry.get("outcome") == "active"), None)
        if not active_entry or active_entry.get("stage") != next_status or active_entry.get("operatorId") != next_operator_id:
            history.append(_create_active_assignment(next_status, next_operator_id, operator_name))

    return history


def create_university(database, payload: UniversityCreate) -> dict:
    document = {"id": f"uni_{uuid4().hex[:8]}", "name": payload.name.strip()}
    try:
        database[COLLECTIONS["universities"]].insert_one(prepare_document(document))
    except DuplicateKeyError as exc:
        raise ValueError("This university already exists.") from exc
    return document


def delete_university(database, university_id: str) -> None:
    linked = database[COLLECTIONS["papers"]].count_documents({"universityId": university_id})
    if linked:
        raise ValueError("Cannot remove a university that still has linked papers.")
    database[COLLECTIONS["exams"]].delete_many({"universityId": university_id})
    database[COLLECTIONS["universities"]].delete_one({"id": university_id})


def create_exam(database, payload: ExamCreate) -> dict:
    university = serialize_document(database[COLLECTIONS["universities"]].find_one({"id": payload.universityId}))
    if not university:
        raise ValueError("Please select a valid university.")
    document = {
        "id": f"e_{uuid4().hex[:8]}",
        "name": payload.name.strip(),
        "universityId": payload.universityId,
        "universityName": university["name"],
        "startDate": payload.startDate,
        "endDate": payload.endDate,
        "receiveDate": payload.receiveDate,
        "dueDate": payload.dueDate,
    }
    try:
        database[COLLECTIONS["exams"]].insert_one(prepare_document(document))
    except DuplicateKeyError as exc:
        raise ValueError("This exam session already exists under the selected university.") from exc
    return document


def delete_exam(database, exam_id: str) -> None:
    linked = database[COLLECTIONS["papers"]].count_documents({"examId": exam_id})
    if linked:
        raise ValueError("Cannot remove an exam session that still has linked papers.")
    database[COLLECTIONS["exams"]].delete_one({"id": exam_id})


def create_operator(database, payload: OperatorCreate) -> dict:
    document = {
        "id": f"u_{uuid4().hex[:8]}",
        "name": payload.name.strip(),
        "role": payload.role,
    }
    try:
        database[COLLECTIONS["operators"]].insert_one(prepare_document(document))
    except DuplicateKeyError as exc:
        raise ValueError("An operator with this name already exists.") from exc
    return document


def delete_operator(database, operator_id: str) -> None:
    papers = [serialize_document(doc) for doc in database[COLLECTIONS["papers"]].find({"assignedUserId": operator_id})]
    if papers:
        operators_by_id = _operator_lookup(database)
        for paper in papers:
            updated = dict(paper)
            updated["assignedUserId"] = None
            updated["assignmentHistory"] = _reconcile_history(paper, updated, operators_by_id)
            database[COLLECTIONS["papers"]].replace_one({"id": paper["id"]}, prepare_document(updated))
    database[COLLECTIONS["operators"]].delete_one({"id": operator_id})


def create_paper(database, payload: PaperCreate) -> dict:
    universities_by_id = _university_lookup(database)
    exams_by_id = _exam_lookup(database)
    operators_by_id = _operator_lookup(database)

    university = universities_by_id.get(payload.universityId)
    exam = exams_by_id.get(payload.examId)
    if not university or not exam:
        raise ValueError("Please configure a valid university and exam session first.")
    if exam["universityId"] != payload.universityId:
        raise ValueError("The selected exam session does not belong to the selected university.")

    document = {
        "id": uuid4().hex,
        "name": payload.name.strip(),
        "code": payload.code.strip().upper(),
        "universityId": payload.universityId,
        "universityName": university["name"],
        "examId": payload.examId,
        "examName": exam["name"],
        "date": payload.date,
        "status": payload.status,
        "assignedUserId": payload.assignedUserId,
        "assignmentHistory": [],
    }
    document = _normalize_assignment_for_status(document, operators_by_id)
    document["assignmentHistory"] = _reconcile_history({"status": payload.status, "assignedUserId": None, "assignmentHistory": []}, document, operators_by_id)
    try:
        database[COLLECTIONS["papers"]].insert_one(prepare_document(document))
    except DuplicateKeyError as exc:
        raise ValueError("A paper with this code already exists under the selected exam session.") from exc
    return document


def update_paper(database, paper_id: str, payload: PaperUpdate) -> dict:
    existing = serialize_document(database[COLLECTIONS["papers"]].find_one({"id": paper_id}))
    if not existing:
        raise ValueError("Paper not found.")

    universities_by_id = _university_lookup(database)
    exams_by_id = _exam_lookup(database)
    operators_by_id = _operator_lookup(database)

    updated = dict(existing)
    for key, value in payload.model_dump(exclude_unset=True).items():
        updated[key] = value

    if "code" in updated and updated["code"]:
        updated["code"] = updated["code"].strip().upper()
    if "name" in updated and updated["name"]:
        updated["name"] = updated["name"].strip()

    university = universities_by_id.get(updated["universityId"])
    exam = exams_by_id.get(updated["examId"])
    if not university or not exam:
        raise ValueError("Please select a valid university and exam session.")
    if exam["universityId"] != updated["universityId"]:
        raise ValueError("The selected exam session does not belong to the selected university.")

    updated["universityName"] = university["name"]
    updated["examName"] = exam["name"]
    updated = _normalize_assignment_for_status(updated, operators_by_id)
    updated["assignmentHistory"] = _reconcile_history(existing, updated, operators_by_id)

    duplicate = database[COLLECTIONS["papers"]].find_one(
        {"examId": updated["examId"], "code": updated["code"], "id": {"$ne": paper_id}}
    )
    if duplicate:
        raise ValueError("A paper with this code already exists under the selected exam session.")

    database[COLLECTIONS["papers"]].replace_one({"id": paper_id}, prepare_document(updated))
    return updated


def delete_paper(database, paper_id: str) -> None:
    database[COLLECTIONS["papers"]].delete_one({"id": paper_id})


def bulk_update_papers(database, payload: BulkUpdateRequest) -> list[dict]:
    operators_by_id = _operator_lookup(database)
    updated_documents: list[dict] = []
    papers = [serialize_document(doc) for doc in database[COLLECTIONS["papers"]].find({"id": {"$in": payload.paperIds}})]
    status_provided = "status" in payload.model_fields_set
    assignment_provided = "assignedUserId" in payload.model_fields_set
    for paper in papers:
        updated = dict(paper)
        if status_provided:
            updated["status"] = payload.status
        if assignment_provided:
            updated["assignedUserId"] = payload.assignedUserId
        updated = _normalize_assignment_for_status(updated, operators_by_id)
        updated["assignmentHistory"] = _reconcile_history(paper, updated, operators_by_id)
        database[COLLECTIONS["papers"]].replace_one({"id": paper["id"]}, prepare_document(updated))
        updated_documents.append(updated)
    return updated_documents


def bulk_delete_papers(database, payload: BulkDeleteRequest) -> None:
    database[COLLECTIONS["papers"]].delete_many({"id": {"$in": payload.paperIds}})


def get_report_overview(database) -> ReportOverview:
    papers = [serialize_document(doc) for doc in database[COLLECTIONS["papers"]].find()]
    operators = [serialize_document(doc) for doc in database[COLLECTIONS["operators"]].find()]

    status_counts = {status: 0 for status in STATUS_ORDER}
    for paper in papers:
        if paper["status"] in status_counts:
            status_counts[paper["status"]] += 1

    operator_ledger = []
    for operator in operators:
        assigned = [paper for paper in papers if paper.get("assignedUserId") == operator["id"]]
        total = len(assigned)
        completed = len([paper for paper in assigned if paper["status"] == "Completed"])
        active = len([paper for paper in assigned if paper["status"] != "Completed"])
        rate = round((completed / total) * 100, 2) if total else 0.0
        operator_ledger.append(
            {
                "id": operator["id"],
                "name": operator["name"],
                "role": operator["role"],
                "activeCount": active,
                "completedCount": completed,
                "totalCount": total,
                "completionRate": rate,
            }
        )

    timing_summary: dict[str, dict[str, float | int]] = {}
    for paper in papers:
        for entry in paper.get("assignmentHistory", []):
            stage = entry["stage"]
            bucket = timing_summary.setdefault(stage, {"completedCount": 0, "returnedCount": 0, "averageMinutes": 0.0, "totalMinutes": 0})
            duration = entry.get("durationMinutes") or 0
            if entry.get("outcome") == "completed":
                bucket["completedCount"] += 1
                bucket["totalMinutes"] += duration
            elif entry.get("outcome") == "returned":
                bucket["returnedCount"] += 1
                bucket["totalMinutes"] += duration
    for bucket in timing_summary.values():
        finished_count = bucket["completedCount"] + bucket["returnedCount"]
        bucket["averageMinutes"] = round(bucket["totalMinutes"] / finished_count, 2) if finished_count else 0.0

    return ReportOverview(statusCounts=status_counts, operatorLedger=operator_ledger, timingSummary=timing_summary)
