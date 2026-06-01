/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { workspaceApi } from "../api.js";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { formatDateString, normalizeDateValue, roleBadgeClasses, statusBadgeClasses, statuses, statusRoleMap } from "../utils.js";
import { useFeedback } from "./Feedback.jsx";

const ITEMS_PER_PAGE = 50;
const ANALYTICS_CONTEXT_KEY = "paperflow_last_analytics_context";

function OperatorBadge({ operator }) {
  if (!operator) {
    return <span className="text-[11px] italic text-slate-400 dark:text-slate-600">Unassigned</span>;
  }
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-slate-800 dark:text-slate-200">{operator.name}</span>
      <span className={`mt-0.5 inline-block self-start rounded px-1 text-[9px] font-semibold uppercase tracking-wider ${roleBadgeClasses(operator.role)}`}>
        {operator.role}
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(status)}`}>
      {status}
    </span>
  );
}

function StatCard({ title, value, tone }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        <h3 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{value}</h3>
      </div>
      <div className={`rounded-lg p-2 ${tone}`}>
        <div className="h-5 w-5 rounded-full bg-current opacity-90" />
      </div>
    </div>
  );
}

function PaperEditModal({ paper, open, onClose, exams, universities, operators, onSave }) {
  const [draft, setDraft] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    if (!paper) {
      setDraft(null);
      setRoleFilter("all");
      return;
    }

    const expectedRole = statusRoleMap[paper.status];
    const assignedOperator = operators.find((operator) => operator.id === paper.assignedUserId);
    const invalidAssignedOperator =
      paper.status === "Completed" ||
      (assignedOperator && expectedRole && assignedOperator.role !== expectedRole);

    setDraft({
      ...paper,
      date: normalizeDateValue(paper.date),
      assignedUserId: invalidAssignedOperator ? null : paper.assignedUserId,
    });
    setRoleFilter(expectedRole ?? "all");
  }, [paper, operators]);

  if (!open || !draft) {
    return null;
  }

  const groupedExams = universities.map((university) => ({
    university,
    exams: exams.filter((exam) => exam.universityId === university.id),
  }));
  const filteredOperators = operators.filter((operator) => roleFilter === "all" || operator.role === roleFilter);

  const syncDraftForStatus = (nextStatus) => {
    const expectedRole = statusRoleMap[nextStatus] ?? "all";
    setRoleFilter(expectedRole);
    setDraft((current) => {
      const assignedOperator = operators.find((operator) => operator.id === current.assignedUserId);
      const shouldClearAssignment =
        nextStatus === "Completed" ||
        (assignedOperator && statusRoleMap[nextStatus] && assignedOperator.role !== statusRoleMap[nextStatus]);

      return {
        ...current,
        status: nextStatus,
        assignedUserId: shouldClearAssignment ? null : current.assignedUserId,
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">Modify Paper Details</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          className="space-y-4 p-4"
            onSubmit={(event) => {
            event.preventDefault();
            onSave(draft.id, {
              name: draft.name?.trim() || "",
              code: draft.code,
              universityId: draft.universityId,
              examId: draft.examId,
              date: draft.date,
              status: draft.status,
              assignedUserId: draft.assignedUserId || null,
            });
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">University</label>
            <select
              value={draft.universityId}
              onChange={(event) => {
                const nextUniversityId = event.target.value;
                const nextExamId = exams.find((exam) => exam.universityId === nextUniversityId)?.id ?? draft.examId;
                setDraft((current) => ({ ...current, universityId: nextUniversityId, examId: nextExamId }));
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Exam Session</label>
            <select
              value={draft.examId}
              onChange={(event) => setDraft((current) => ({ ...current, examId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              {groupedExams.map(({ university, exams: examItems }) => (
                <optgroup key={university.id} label={university.name}>
                  {examItems.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Paper Name</label>
              <input
                value={draft.name ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Paper Code</label>
              <input
                value={draft.code}
                onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Exam Date</label>
              <input
                type="date"
                value={normalizeDateValue(draft.date)}
                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Current Status</label>
              <select
                value={draft.status}
                onChange={(event) => syncDraftForStatus(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800/80">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Assignee Role Filter</label>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                <option value="all">-- All Roles --</option>
                <option value="Typist">Typist</option>
                <option value="Proof Reader">Proof Reader</option>
                <option value="Corrector">Corrector</option>
                <option value="Final Reader">Final Reader</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Assign Operator</label>
              <select
                value={draft.assignedUserId ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, assignedUserId: event.target.value || null }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                <option value="">-- Unassigned --</option>
                {filteredOperators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name} ({operator.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/80">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PapersPage() {
  const {
    papers,
    universities,
    exams,
    operators,
    createPaper,
    updatePaper,
    deletePaper,
    bulkUpdatePapers,
    bulkDeletePapers,
    busy,
    error,
  } = useWorkspace();
  const { showToast, confirm } = useFeedback();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    universityId: "all",
    examId: "all",
    operatorId: "all",
    stage: "all",
    assignmentState: "all",
    search: "",
    date: "",
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [createForm, setCreateForm] = useState({ code: "", date: "" });
  const [bulkStatus, setBulkStatus] = useState("keep");
  const [bulkRoleFilter, setBulkRoleFilter] = useState("all");
  const [bulkUserSelector, setBulkUserSelector] = useState("keep");
  const [editingPaper, setEditingPaper] = useState(null);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => papers.some((paper) => paper.id === id)));
  }, [papers]);

  useEffect(() => {
    if (!selectedIds.length || bulkStatus !== "keep") {
      return;
    }

    const selectedPapers = papers.filter((paper) => selectedIds.includes(paper.id));
    const selectedStatuses = [...new Set(selectedPapers.map((paper) => paper.status))];
    if (selectedStatuses.length !== 1) {
      setBulkRoleFilter("all");
      if (bulkUserSelector !== "keep") {
        setBulkUserSelector("keep");
      }
      return;
    }

    const expectedRole = statusRoleMap[selectedStatuses[0]] ?? "all";
    setBulkRoleFilter(expectedRole);
    const selectedOperator = operators.find((operator) => operator.id === bulkUserSelector);
    if (selectedOperator && expectedRole !== "all" && selectedOperator.role !== expectedRole) {
      setBulkUserSelector("keep");
    }
  }, [selectedIds, papers, bulkStatus, bulkUserSelector, operators]);

  useEffect(() => {
    if (filters.universityId === "all" || filters.examId === "all") {
      return;
    }

    localStorage.setItem(
      ANALYTICS_CONTEXT_KEY,
      JSON.stringify({
        universityId: filters.universityId,
        examId: filters.examId,
      }),
    );
  }, [filters.universityId, filters.examId]);

  const visibleExams = exams.filter((exam) => filters.universityId === "all" || exam.universityId === filters.universityId);
  const filteredOperators = operators.filter((operator) => bulkRoleFilter === "all" || operator.role === bulkRoleFilter);
  const filteredPapers = papers.filter((paper) => {
    const matchesUniversity = filters.universityId === "all" || paper.universityId === filters.universityId;
    const matchesExam = filters.examId === "all" || paper.examId === filters.examId;
    const matchesStage = filters.stage === "all" || paper.status === filters.stage;
    const matchesDate = !filters.date || normalizeDateValue(paper.date) === normalizeDateValue(filters.date);
    const matchesOperator = filters.operatorId === "all" || paper.assignedUserId === filters.operatorId;
    const hasAssignmentHistory = (paper.assignmentHistory ?? []).length > 0;
    const matchesAssignmentState =
      filters.assignmentState === "all" ||
      (filters.assignmentState === "currentlyUnassigned" && !paper.assignedUserId) ||
      (filters.assignmentState === "neverAssigned" && !hasAssignmentHistory);
    const query = filters.search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (paper.name ?? "").toLowerCase().includes(query) ||
      paper.code.toLowerCase().includes(query) ||
      (paper.course ?? "").toLowerCase().includes(query) ||
      (paper.year ?? "").toLowerCase().includes(query) ||
      (paper.paperType ?? "").toLowerCase().includes(query) ||
      (paper.paperTitle ?? "").toLowerCase().includes(query) ||
      paper.universityName.toLowerCase().includes(query);
    return matchesUniversity && matchesExam && matchesStage && matchesDate && matchesOperator && matchesAssignmentState && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPapers.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredPapers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const allVisibleSelected = paginatedItems.length > 0 && paginatedItems.every((paper) => selectedIds.includes(paper.id));
  const selectedPapers = papers.filter((paper) => selectedIds.includes(paper.id));
  const selectedStatuses = [...new Set(selectedPapers.map((paper) => paper.status))];
  const fixedSelectedRole = bulkStatus === "keep" && selectedStatuses.length === 1 ? statusRoleMap[selectedStatuses[0]] ?? "all" : null;

  const stats = {
    total: filteredPapers.length,
    typing: filteredPapers.filter((paper) => paper.status === "Typing").length,
    review: filteredPapers.filter((paper) => ["Proof Reading", "Correction", "Final Reading"].includes(paper.status)).length,
    completed: filteredPapers.filter((paper) => paper.status === "Completed").length,
  };

  const onFilterChange = (key, value) => {
    setPage(1);
    setFilters((current) => {
      if (key === "universityId") {
        return { ...current, universityId: value, examId: "all" };
      }
      return { ...current, [key]: value };
    });
  };

  const handleCreatePaper = async (event) => {
    event.preventDefault();
    const universityId = filters.universityId !== "all" ? filters.universityId : universities[0]?.id;
    const resolvedExams = exams.filter((exam) => exam.universityId === universityId);
    const examId =
      filters.examId !== "all" && resolvedExams.some((exam) => exam.id === filters.examId) ? filters.examId : resolvedExams[0]?.id;

    if (!universityId || !examId) {
      showToast("Configure at least one university and associated exam session first", "warning");
      return;
    }

    try {
      await createPaper({
        name: "",
        code: createForm.code.trim().toUpperCase(),
        date: createForm.date || null,
        universityId,
        examId,
        status: "Typing",
        assignedUserId: null,
      });
      showToast(`Successfully registered "${createForm.code.trim().toUpperCase()}" to the tracking flow`, "success");
      setCreateForm((current) => ({ ...current, code: "" }));
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    }
  };

  const getSelectedImportContext = () => {
    if (filters.universityId === "all" || filters.examId === "all") {
      showToast("Select a university and exam session before importing papers", "warning");
      return null;
    }
    return {
      universityId: filters.universityId,
      examId: filters.examId,
    };
  };

  const handleDownloadSample = async () => {
    try {
      const response = await workspaceApi.downloadPaperImportSample();
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "paper-import-sample.csv";
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      showToast("Unable to download the import sample right now", "error");
    }
  };

  const handleOpenAnalytics = () => {
    const analyticsContext = getSelectedImportContext();
    if (!analyticsContext) {
      showToast("Select a university and exam session before running the analytic check", "warning");
      return;
    }

    localStorage.setItem(ANALYTICS_CONTEXT_KEY, JSON.stringify(analyticsContext));
    navigate("/papers/analytic-check", { state: { analyticsContext } });
  };

  const handleOpenImportStudio = () => {
    const importContext = getSelectedImportContext();
    if (!importContext) {
      return;
    }

    localStorage.setItem("paperflow_last_import_context", JSON.stringify(importContext));
    navigate("/papers/import");
  };

  const handleDeletePaper = async (paper) => {
    const accepted = await confirm(`Are you sure you want to delete "${paper.name || paper.code}" from tracking records?`);
    if (!accepted) {
      return;
    }
    try {
      await deletePaper(paper.id);
      showToast("Paper record deleted successfully", "info");
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    }
  };

  const handleBulkUpdate = async () => {
    if (!selectedIds.length) {
      return;
    }
    const payload = { paperIds: selectedIds };
    if (bulkStatus !== "keep") {
      payload.status = bulkStatus;
    }
    if (bulkUserSelector !== "keep") {
      payload.assignedUserId = bulkUserSelector === "unassign" ? null : bulkUserSelector;
    }
    try {
      await bulkUpdatePapers(payload);
      setSelectedIds([]);
      setBulkStatus("keep");
      setBulkUserSelector("keep");
      showToast("Selected papers have been updated and assigned successfully", "success");
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    }
  };

  const handleBulkStatusChange = (nextStatus) => {
    setBulkStatus(nextStatus);
    if (nextStatus === "keep") {
      return;
    }

    const expectedRole = statusRoleMap[nextStatus];
    if (expectedRole) {
      setBulkRoleFilter(expectedRole);
      const selectedOperator = operators.find((operator) => operator.id === bulkUserSelector);
      if (!selectedOperator || selectedOperator.role !== expectedRole) {
        setBulkUserSelector("unassign");
      }
      return;
    }

    if (nextStatus === "Completed") {
      setBulkUserSelector("unassign");
    }
  };

  const handleBulkDelete = async () => {
    const accepted = await confirm(`Confirm removing ${selectedIds.length} selected paper flows from system?`);
    if (!accepted) {
      return;
    }
    try {
      await bulkDeletePapers({ paperIds: selectedIds });
      setSelectedIds([]);
      showToast("Selected workspace rows deleted successfully", "success");
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    }
  };

  const handleSaveEdit = async (paperId, payload) => {
    try {
      await updatePaper(paperId, payload);
      setEditingPaper(null);
      showToast(`Saved changes for "${payload.name || payload.code}" successfully`, "success");
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Required</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Working Context</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Select University</label>
                  <select value={filters.universityId} onChange={(event) => onFilterChange("universityId", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                    <option value="all">-- All Universities --</option>
                    {universities.map((university) => (
                      <option key={university.id} value={university.id}>
                        {university.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Select Exam Session</label>
                  <select value={filters.examId} onChange={(event) => onFilterChange("examId", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                    <option value="all">-- All Active Exams --</option>
                    {visibleExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Optional</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Refine Results</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Filter Operator</label>
                  <select value={filters.operatorId} onChange={(event) => onFilterChange("operatorId", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                    <option value="all">-- All Operators --</option>
                    {operators.map((operator) => (
                      <option key={operator.id} value={operator.id}>
                        {operator.name} ({operator.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Filter Stage</label>
                  <select value={filters.stage} onChange={(event) => onFilterChange("stage", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                    <option value="all">-- All Stages --</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Exam Date</label>
                    <button type="button" onClick={() => onFilterChange("date", "")} className="text-[10px] font-semibold text-slate-700 hover:underline">
                      Clear
                    </button>
                  </div>
                  <input type="date" value={filters.date} onChange={(event) => onFilterChange("date", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Keyword Search</label>
                  <input value={filters.search} onChange={(event) => onFilterChange("search", event.target.value)} placeholder="Search Code, Name..." className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
                </div>
              </div>

              <div className="mt-3">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Assignment State</span>
                <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="assignment-state" checked={filters.assignmentState === "all"} onChange={() => onFilterChange("assignmentState", "all")} />
                    <span>All Papers</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="assignment-state" checked={filters.assignmentState === "currentlyUnassigned"} onChange={() => onFilterChange("assignmentState", "currentlyUnassigned")} />
                    <span>Currently Unassigned</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="assignment-state" checked={filters.assignmentState === "neverAssigned"} onChange={() => onFilterChange("assignmentState", "neverAssigned")} />
                    <span>Never Assigned At Any Stage</span>
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Papers" value={stats.total} tone="bg-slate-100 text-slate-800" />
        <StatCard title="Typing Status" value={stats.typing} tone="bg-slate-100 text-slate-800" />
        <StatCard title="In Evaluation" value={stats.review} tone="bg-slate-100 text-slate-800" />
        <StatCard title="Published" value={stats.completed} tone="bg-slate-100 text-slate-800" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="rounded-xl bg-slate-50/50 p-4 dark:bg-slate-900/30">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-slate-900" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">Register New Paper Flow</h3>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={handleOpenAnalytics} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 transition-colors hover:bg-slate-100">
                Run Analytic Check
              </button>
              <button type="button" onClick={() => navigate("/papers/verification")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 transition-colors hover:bg-slate-100">
                Hard Copy Verify
              </button>
              <button type="button" onClick={handleDownloadSample} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                Download Sample
              </button>
              <button type="button" onClick={handleOpenImportStudio} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800">
                Import Papers
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Future assignment timing starts automatically when an operator is assigned</span>
            </div>
          </div>
          <form onSubmit={handleCreatePaper} className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Paper Code *</label>
              <input required value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="e.g. MAT-401" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Exam Date</label>
                <input type="date" value={createForm.date} onChange={(event) => setCreateForm((current) => ({ ...current, date: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
              </div>
            </div>
            <button type="submit" disabled={busy} className="h-8 w-28 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
              Add Paper
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">Tracking Results</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Choose the exam context first, then narrow the list only if needed.</p>
          </div>
          <div className="self-start rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white sm:self-auto">
            {filteredPapers.length} matching papers
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
            <div className="text-xs font-semibold text-slate-900">{selectedIds.length} selected</div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Move to Status</span>
                <select value={bulkStatus} onChange={(event) => handleBulkStatusChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                  <option value="keep">-- Keep Status --</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Role</span>
                <select value={bulkRoleFilter} onChange={(event) => setBulkRoleFilter(event.target.value)} disabled={Boolean(fixedSelectedRole)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                  <option value="all">-- All Roles --</option>
                  <option value="Typist">Typist</option>
                  <option value="Proof Reader">Proof Reader</option>
                  <option value="Corrector">Corrector</option>
                  <option value="Final Reader">Final Reader</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Operator</span>
                <select value={bulkUserSelector} onChange={(event) => setBulkUserSelector(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
                  <option value="keep">-- Keep Assigned --</option>
                  {!(bulkStatus === "keep" && selectedStatuses.length > 1) && <option value="unassign">-- Unassign Operator --</option>}
                  {filteredOperators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name} ({operator.role})
                    </option>
                  ))}
                </select>
              </div>
              {bulkStatus === "keep" && selectedStatuses.length > 1 && (
                <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Select a common status first before assigning one operator to mixed-stage papers.
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBulkUpdate} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800">
                  Apply
                </button>
                <button type="button" onClick={handleBulkDelete} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40">
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((current) => [...new Set([...current, ...paginatedItems.map((paper) => paper.id)])]);
                      } else {
                        setSelectedIds((current) => current.filter((id) => !paginatedItems.some((paper) => paper.id === id)));
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3">Paper</th>
                <th className="px-4 py-3">Course Name</th>
                <th className="px-4 py-3">Annual / Semester</th>
                <th className="px-4 py-3">Type / Subject</th>
                <th className="px-4 py-3">University / Exam</th>
                <th className="px-4 py-3">Exam Date</th>
                <th className="px-4 py-3">Qty / Time / Marks</th>
                <th className="px-4 py-3">Examiners</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800/50">
              {paginatedItems.map((paper) => {
                const operator = operators.find((item) => item.id === paper.assignedUserId);
                const exam = exams.find((item) => item.id === paper.examId);
                const selected = selectedIds.includes(paper.id);
                const tooltip = exam ? `S: ${formatDateString(exam.startDate)} | E: ${formatDateString(exam.endDate)}\nRecv: ${formatDateString(exam.receiveDate)} | Due: ${formatDateString(exam.dueDate)}` : "No exam bounds set";
                const paperCaption = paper.name?.trim() ? paper.name : "Paper name pending import";

                return (
                  <tr key={paper.id} className={`group transition-colors hover:bg-slate-50/70 ${selected ? "bg-slate-100/80" : ""}`}>
                    <td className="px-4 py-2.5 text-center">
                      <input type="checkbox" checked={selected} onChange={() => setSelectedIds((current) => current.includes(paper.id) ? current.filter((id) => id !== paper.id) : [...current, paper.id])} />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                      <button type="button" onClick={() => setEditingPaper(paper)} className="block text-left text-sm font-semibold hover:text-slate-600">
                        {paper.code}
                      </button>
                      <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">{paperCaption}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <span className="block max-w-[200px] truncate" title={paper.course || "-"}>
                        {paper.course || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <span className="block max-w-[150px] truncate" title={paper.year || "-"}>
                        {paper.year || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <span className="block max-w-[180px] truncate font-semibold" title={paper.paperType || "-"}>
                        {paper.paperType || "-"}
                      </span>
                      <span className="block max-w-[220px] truncate text-[10px] text-slate-400" title={paper.paperTitle || "-"}>
                        {paper.paperTitle || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="block max-w-[170px] truncate font-semibold" title={paper.universityName}>
                        {paper.universityName}
                      </span>
                      <span className="block max-w-[170px] truncate text-[10px] text-slate-400 underline decoration-dotted dark:text-slate-500" title={tooltip}>
                        {paper.examName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{formatDateString(paper.date)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <span className="block whitespace-nowrap">Qty: {paper.quantity || "-"}</span>
                      <span className="block whitespace-nowrap">{paper.examTime || "-"}</span>
                      <span className="block text-[10px] text-slate-400">Marks: {paper.marks || "-"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <span className="block max-w-[220px] truncate" title={paper.examiner1 || "-"}>
                        {paper.examiner1 || "-"}
                      </span>
                      <span className="block max-w-[220px] truncate text-[10px] text-slate-400" title={paper.examiner2 || "-"}>
                        {paper.examiner2 || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <OperatorBadge operator={operator} />
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      <StatusBadge status={paper.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button type="button" onClick={() => setEditingPaper(paper)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeletePaper(paper)} className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!filteredPapers.length && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No papers match selected criteria</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-400">Try switching filters, clearing keywords, or register a new university exam paper flow using the registration form above.</p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/80 dark:bg-slate-900/20">
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredPapers.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * ITEMS_PER_PAGE, filteredPapers.length)}</span> of{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredPapers.length}</span> papers
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-500 transition-colors disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
              Prev
            </button>
            <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Page {currentPage} of {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-500 transition-colors disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
              Next
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">{error}</div>}

      <PaperEditModal paper={editingPaper} open={Boolean(editingPaper)} onClose={() => setEditingPaper(null)} exams={exams} universities={universities} operators={operators} onSave={handleSaveEdit} />
    </div>
  );
}
