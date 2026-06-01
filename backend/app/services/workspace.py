from __future__ import annotations

import csv
import re
from datetime import UTC, datetime
from io import StringIO
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from app.defaults import get_default_payload
from app.schemas import (
    BulkDeleteRequest,
    BulkUpdateRequest,
    ExamCreate,
    ImportPapersResponse,
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


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


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


def _normalize_date_value(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return value

    trimmed = value.strip()
    if not trimmed:
        return None

    iso_date_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$", trimmed)
    if iso_date_match:
        return f"{iso_date_match.group(1)}-{iso_date_match.group(2)}-{iso_date_match.group(3)}"

    display_date_match = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", trimmed)
    if display_date_match:
        return f"{display_date_match.group(3)}-{display_date_match.group(2)}-{display_date_match.group(1)}"

    slash_date_match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", trimmed)
    if slash_date_match:
        return f"{slash_date_match.group(3)}-{slash_date_match.group(2)}-{slash_date_match.group(1)}"

    return trimmed


def _normalize_exam_dates(document: dict | None) -> dict | None:
    if document is None:
        return None

    normalized = dict(document)
    for key in ("startDate", "endDate", "receiveDate", "dueDate"):
        normalized[key] = _normalize_date_value(normalized.get(key))
    return normalized


def _normalize_paper_dates(document: dict | None) -> dict | None:
    if document is None:
        return None

    normalized = dict(document)
    normalized["date"] = _normalize_date_value(normalized.get("date"))
    return normalized


def _normalize_header_key(header: str | None) -> str:
    if not header:
        return ""
    return re.sub(r"[^a-z0-9]", "", header.strip().lower())


def _format_paper_code(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip()).upper()


def _paper_code_key(value: str | None) -> str:
    return re.sub(r"\s+", "", _format_paper_code(value))


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    trimmed = value.strip()
    return trimmed or None


def _find_paper_by_exam_code(database, exam_id: str, code: str, exclude_id: str | None = None) -> dict | None:
    code_key = _paper_code_key(code)
    query = {"examId": exam_id, "codeKey": code_key}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}

    document = database[COLLECTIONS["papers"]].find_one(query)
    if document:
        return serialize_document(document)

    for paper in database[COLLECTIONS["papers"]].find({"examId": exam_id}):
        serialized = serialize_document(paper)
        if exclude_id and serialized["id"] == exclude_id:
            continue
        if _paper_code_key(serialized.get("code")) == code_key:
            return serialized
    return None


def ensure_indexes(database) -> None:
    database[COLLECTIONS["universities"]].create_index("name", unique=True)
    database[COLLECTIONS["exams"]].create_index([("universityId", 1), ("name", 1)], unique=True)
    database[COLLECTIONS["operators"]].create_index("name", unique=True)
    database[COLLECTIONS["papers"]].update_many(
        {},
        [
            {
                "$set": {
                    "code": {"$toUpper": {"$trim": {"input": {"$ifNull": ["$code", ""]}}}},
                    "codeKey": {
                        "$replaceAll": {
                            "input": {
                                "$replaceAll": {
                                    "input": {
                                        "$replaceAll": {
                                            "input": {"$toUpper": {"$trim": {"input": {"$ifNull": ["$code", ""]}}}},
                                            "find": " ",
                                            "replacement": "",
                                        }
                                    },
                                    "find": "\t",
                                    "replacement": "",
                                }
                            },
                            "find": "\n",
                            "replacement": "",
                        }
                    },
                }
            }
        ],
    )
    database[COLLECTIONS["papers"]].create_index([("examId", 1), ("code", 1)], unique=True)
    database[COLLECTIONS["papers"]].create_index([("examId", 1), ("codeKey", 1)], unique=True)


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
        "exams": [
            _normalize_exam_dates(serialize_document(doc))
            for doc in database[COLLECTIONS["exams"]].find().sort("name", 1)
        ],
        "operators": [serialize_document(doc) for doc in database[COLLECTIONS["operators"]].find().sort("name", 1)],
        "papers": [
            _normalize_paper_dates(serialize_document(doc))
            for doc in database[COLLECTIONS["papers"]].find().sort("date", -1)
        ],
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
    started_utc = _ensure_utc(started)
    finished_utc = _ensure_utc(finished_at)
    return max(0, int((finished_utc - started_utc).total_seconds() // 60))


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
        "startDate": _normalize_date_value(payload.startDate),
        "endDate": _normalize_date_value(payload.endDate),
        "receiveDate": _normalize_date_value(payload.receiveDate),
        "dueDate": _normalize_date_value(payload.dueDate),
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
        "name": payload.name.strip() if payload.name else "",
        "code": _format_paper_code(payload.code),
        "codeKey": _paper_code_key(payload.code),
        "universityId": payload.universityId,
        "universityName": university["name"],
        "examId": payload.examId,
        "examName": exam["name"],
        "date": _normalize_date_value(payload.date),
        "course": _clean_optional_text(payload.course),
        "year": _clean_optional_text(payload.year),
        "quantity": _clean_optional_text(payload.quantity),
        "paperType": _clean_optional_text(payload.paperType),
        "paperTitle": _clean_optional_text(payload.paperTitle),
        "examTime": _clean_optional_text(payload.examTime),
        "marks": _clean_optional_text(payload.marks),
        "examiner1": _clean_optional_text(payload.examiner1),
        "examiner2": _clean_optional_text(payload.examiner2),
        "verificationStatus": _clean_optional_text(payload.verificationStatus),
        "verificationNote": _clean_optional_text(payload.verificationNote),
        "verifiedAt": payload.verifiedAt,
        "rejectedAt": payload.rejectedAt,
        "verificationBy": _clean_optional_text(payload.verificationBy),
        "status": payload.status,
        "assignedUserId": payload.assignedUserId,
        "assignmentHistory": [],
    }
    document = _normalize_assignment_for_status(document, operators_by_id)
    document["assignmentHistory"] = _reconcile_history({"status": payload.status, "assignedUserId": None, "assignmentHistory": []}, document, operators_by_id)
    duplicate = _find_paper_by_exam_code(database, payload.examId, payload.code)
    if duplicate:
        raise ValueError("A paper with this code already exists under the selected exam session.")
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
        updated["code"] = _format_paper_code(updated["code"])
        updated["codeKey"] = _paper_code_key(updated["code"])
    if "name" in updated:
        updated["name"] = updated["name"].strip() if updated["name"] else ""
    updated["date"] = _normalize_date_value(updated.get("date"))
    for key in ("course", "year", "quantity", "paperType", "paperTitle", "examTime", "marks", "examiner1", "examiner2", "verificationStatus", "verificationNote", "verificationBy"):
        updated[key] = _clean_optional_text(updated.get(key))

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

    duplicate = _find_paper_by_exam_code(database, updated["examId"], updated["code"], exclude_id=paper_id)
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


def get_paper_import_sample() -> str:
    return "\n".join(
        [
            "courseName,subjectName,paperName,paperCode,paperType,annualSemester,qty,examDate,examTime,marks,examiner1,examiner2",
            "B.Sc.,Differential Calculus,Advanced Calculus,MAT-401,Theory,First Year,120,2026-06-15,9:00 AM To 12:00 PM,70,Dr A,Dr B",
            "B.Tech.,Engineering Physics,Engineering Physics,PHY-210,Theory,Second Year,80,2026-06-17,2:00 PM To 5:00 PM,100,,",
        ]
    )


def import_papers(database, university_id: str, exam_id: str, csv_content: str) -> ImportPapersResponse:
    universities_by_id = _university_lookup(database)
    exams_by_id = _exam_lookup(database)
    operators_by_id = _operator_lookup(database)

    university = universities_by_id.get(university_id)
    exam = exams_by_id.get(exam_id)
    if not university or not exam:
        raise ValueError("Please select a valid university and exam session before importing.")
    if exam["universityId"] != university_id:
        raise ValueError("The selected exam session does not belong to the selected university.")

    try:
        reader = csv.DictReader(StringIO(csv_content))
    except csv.Error as exc:
        raise ValueError("The import file could not be read as CSV.") from exc

    if not reader.fieldnames:
        raise ValueError("The import file is empty.")

    header_map = {_normalize_header_key(header): header for header in reader.fieldnames if header}
    code_key = header_map.get("papercode") or header_map.get("code")
    name_key = header_map.get("papername") or header_map.get("name")
    date_key = header_map.get("examdate") or header_map.get("date")
    course_key = header_map.get("coursename") or header_map.get("course")
    year_key = header_map.get("annualsemester") or header_map.get("semester") or header_map.get("year")
    quantity_key = header_map.get("qty") or header_map.get("quantity")
    type_key = header_map.get("papertype") or header_map.get("type")
    title_key = header_map.get("subjectname") or header_map.get("papertitle") or header_map.get("title")
    time_key = header_map.get("examtime") or header_map.get("time")
    marks_key = header_map.get("marks") or header_map.get("mm") or header_map.get("maxmarks")
    examiner1_key = header_map.get("examiner1")
    examiner2_key = header_map.get("examiner2")

    if not code_key:
        raise ValueError("The CSV must include a paperCode column.")

    processed = 0
    created = 0
    updated_count = 0

    for row_index, row in enumerate(reader, start=2):
        if not any((value or "").strip() for value in row.values()):
            continue

        code = _format_paper_code(row.get(code_key))
        name = (row.get(name_key) or "").strip() if name_key else ""
        date = _normalize_date_value((row.get(date_key) or "").strip()) if date_key else None
        course = _clean_optional_text(row.get(course_key)) if course_key else None
        year = _clean_optional_text(row.get(year_key)) if year_key else None
        quantity = _clean_optional_text(row.get(quantity_key)) if quantity_key else None
        paper_type = _clean_optional_text(row.get(type_key)) if type_key else None
        paper_title = _clean_optional_text(row.get(title_key)) if title_key else None
        exam_time = _clean_optional_text(row.get(time_key)) if time_key else None
        marks = _clean_optional_text(row.get(marks_key)) if marks_key else None
        examiner1 = _clean_optional_text(row.get(examiner1_key)) if examiner1_key else None
        examiner2 = _clean_optional_text(row.get(examiner2_key)) if examiner2_key else None

        if not code:
            raise ValueError(f"Row {row_index} is missing paperCode.")

        existing = _find_paper_by_exam_code(database, exam_id, code)
        if existing:
            updated = dict(existing)
            updated["code"] = code
            updated["codeKey"] = _paper_code_key(code)
            if name_key:
                updated["name"] = name
            if date_key:
                updated["date"] = date
            if course_key:
                updated["course"] = course
            if year_key:
                updated["year"] = year
            if quantity_key:
                updated["quantity"] = quantity
            if type_key:
                updated["paperType"] = paper_type
            if title_key:
                updated["paperTitle"] = paper_title
            if time_key:
                updated["examTime"] = exam_time
            if marks_key:
                updated["marks"] = marks
            if examiner1_key:
                updated["examiner1"] = examiner1
            if examiner2_key:
                updated["examiner2"] = examiner2
            updated["universityId"] = university_id
            updated["universityName"] = university["name"]
            updated["examId"] = exam_id
            updated["examName"] = exam["name"]
            updated = _normalize_assignment_for_status(updated, operators_by_id)
            updated["assignmentHistory"] = _reconcile_history(existing, updated, operators_by_id)
            database[COLLECTIONS["papers"]].replace_one({"id": existing["id"]}, prepare_document(updated))
            updated_count += 1
        else:
            document = {
                "id": uuid4().hex,
                "name": name,
                "code": code,
                "codeKey": _paper_code_key(code),
                "universityId": university_id,
                "universityName": university["name"],
                "examId": exam_id,
                "examName": exam["name"],
                "date": date,
                "course": course,
                "year": year,
                "quantity": quantity,
                "paperType": paper_type,
                "paperTitle": paper_title,
                "examTime": exam_time,
                "marks": marks,
                "examiner1": examiner1,
                "examiner2": examiner2,
                "verificationStatus": None,
                "verificationNote": None,
                "verifiedAt": None,
                "rejectedAt": None,
                "verificationBy": None,
                "status": "Typing",
                "assignedUserId": None,
                "assignmentHistory": [],
            }
            document = _normalize_assignment_for_status(document, operators_by_id)
            document["assignmentHistory"] = _reconcile_history(
                {"status": "Typing", "assignedUserId": None, "assignmentHistory": []},
                document,
                operators_by_id,
            )
            try:
                database[COLLECTIONS["papers"]].insert_one(prepare_document(document))
            except DuplicateKeyError as exc:
                raise ValueError(f"Row {row_index} uses a duplicate paper code.") from exc
            created += 1

        processed += 1

    if processed == 0:
        raise ValueError("The import file does not contain any paper rows.")

    return ImportPapersResponse(processed=processed, created=created, updated=updated_count)


def get_report_overview(database) -> ReportOverview:
    papers = [serialize_document(doc) for doc in database[COLLECTIONS["papers"]].find()]
    operators = [serialize_document(doc) for doc in database[COLLECTIONS["operators"]].find()]

    status_counts = {status: 0 for status in STATUS_ORDER}
    for paper in papers:
        if paper["status"] in status_counts:
            status_counts[paper["status"]] += 1

    operator_ledger = []
    for operator in operators:
        history_entries = [
            entry
            for paper in papers
            for entry in paper.get("assignmentHistory", [])
            if entry.get("operatorId") == operator["id"]
        ]
        active = len([entry for entry in history_entries if entry.get("outcome") == "active"])
        completed = len([entry for entry in history_entries if entry.get("outcome") == "completed"])
        returned = len([entry for entry in history_entries if entry.get("outcome") == "returned"])
        total = len(history_entries)
        finished = completed + returned
        rate = round((completed / finished) * 100, 2) if finished else 0.0
        operator_ledger.append(
            {
                "id": operator["id"],
                "name": operator["name"],
                "role": operator["role"],
                "activeCount": active,
                "completedCount": completed,
                "returnedCount": returned,
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
