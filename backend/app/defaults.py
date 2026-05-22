from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime


def _seed_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


DEFAULT_UNIVERSITIES = [
    {"id": "uni_north_valley", "name": "North Valley University"},
    {"id": "uni_southern_state", "name": "Southern State Institute"},
    {"id": "uni_horizon_tech", "name": "Horizon Technical University"},
    {"id": "uni_metropolitan", "name": "Metropolitan Academy"},
]


DEFAULT_EXAMS = [
    {
        "id": "e1",
        "name": "Spring 2026 Semester Exam",
        "universityId": "uni_north_valley",
        "universityName": "North Valley University",
        "startDate": "2026-01-15",
        "endDate": "2026-05-20",
        "receiveDate": "2026-01-10",
        "dueDate": "2026-05-30",
    },
    {
        "id": "e2",
        "name": "Winter 2025 Supplementary",
        "universityId": "uni_horizon_tech",
        "universityName": "Horizon Technical University",
        "startDate": "2025-11-01",
        "endDate": "2025-12-20",
        "receiveDate": "2025-10-25",
        "dueDate": "2025-12-30",
    },
    {
        "id": "e3",
        "name": "Summer 2026 Practical Exam",
        "universityId": "uni_southern_state",
        "universityName": "Southern State Institute",
        "startDate": "2026-05-01",
        "endDate": "2026-06-15",
        "receiveDate": "2026-04-20",
        "dueDate": "2026-06-25",
    },
]


DEFAULT_OPERATORS = [
    {"id": "u1", "name": "Alice Smith", "role": "Typist"},
    {"id": "u2", "name": "Bob Jones", "role": "Proof Reader"},
    {"id": "u3", "name": "Charlie Brown", "role": "Corrector"},
    {"id": "u4", "name": "Diana Prince", "role": "Final Reader"},
    {"id": "u5", "name": "Emma Watson", "role": "Typist"},
]


def _history(stage: str, operator_id: str, operator_name: str) -> list[dict]:
    return [
        {
            "id": f"hist_{stage.lower().replace(' ', '_')}_{operator_id}",
            "stage": stage,
            "operatorId": operator_id,
            "operatorName": operator_name,
            "assignedAt": _seed_timestamp(),
            "endedAt": None,
            "completedAt": None,
            "returnedAt": None,
            "durationMinutes": None,
            "outcome": "active",
        }
    ]


DEFAULT_PAPERS = [
    {
        "id": "1",
        "name": "Data Structures & Algorithms",
        "code": "CS-302",
        "universityId": "uni_north_valley",
        "universityName": "North Valley University",
        "examId": "e1",
        "examName": "Spring 2026 Semester Exam",
        "date": "2026-05-10",
        "status": "Typing",
        "assignedUserId": "u1",
        "assignmentHistory": _history("Typing", "u1", "Alice Smith"),
    },
    {
        "id": "2",
        "name": "Engineering Mathematics II",
        "code": "MAT-201",
        "universityId": "uni_north_valley",
        "universityName": "North Valley University",
        "examId": "e1",
        "examName": "Spring 2026 Semester Exam",
        "date": "2026-05-12",
        "status": "Proof Reading",
        "assignedUserId": "u2",
        "assignmentHistory": _history("Proof Reading", "u2", "Bob Jones"),
    },
    {
        "id": "3",
        "name": "Introduction to Artificial Intelligence",
        "code": "CS-410",
        "universityId": "uni_southern_state",
        "universityName": "Southern State Institute",
        "examId": "e3",
        "examName": "Summer 2026 Practical Exam",
        "date": "2026-06-02",
        "status": "Correction",
        "assignedUserId": "u3",
        "assignmentHistory": _history("Correction", "u3", "Charlie Brown"),
    },
    {
        "id": "4",
        "name": "Object Oriented Systems",
        "code": "CS-204",
        "universityId": "uni_horizon_tech",
        "universityName": "Horizon Technical University",
        "examId": "e2",
        "examName": "Winter 2025 Supplementary",
        "date": "2025-12-15",
        "status": "Final Reading",
        "assignedUserId": "u4",
        "assignmentHistory": _history("Final Reading", "u4", "Diana Prince"),
    },
    {
        "id": "5",
        "name": "Modern Operating Systems",
        "code": "CS-301",
        "universityId": "uni_metropolitan",
        "universityName": "Metropolitan Academy",
        "examId": "e1",
        "examName": "Spring 2026 Semester Exam",
        "date": "2026-05-18",
        "status": "Completed",
        "assignedUserId": None,
        "assignmentHistory": [],
    },
    {
        "id": "6",
        "name": "Discrete Structures",
        "code": "MAT-105",
        "universityId": "uni_horizon_tech",
        "universityName": "Horizon Technical University",
        "examId": "e2",
        "examName": "Winter 2025 Supplementary",
        "date": "2025-12-18",
        "status": "Typing",
        "assignedUserId": "u5",
        "assignmentHistory": _history("Typing", "u5", "Emma Watson"),
    },
    {
        "id": "7",
        "name": "Computer Organization Architecture",
        "code": "CS-208",
        "universityId": "uni_southern_state",
        "universityName": "Southern State Institute",
        "examId": "e3",
        "examName": "Summer 2026 Practical Exam",
        "date": "2026-06-05",
        "status": "Proof Reading",
        "assignedUserId": "u2",
        "assignmentHistory": _history("Proof Reading", "u2", "Bob Jones"),
    },
]


def get_default_payload() -> dict:
    return {
        "universities": deepcopy(DEFAULT_UNIVERSITIES),
        "exams": deepcopy(DEFAULT_EXAMS),
        "operators": deepcopy(DEFAULT_OPERATORS),
        "papers": deepcopy(DEFAULT_PAPERS),
    }
