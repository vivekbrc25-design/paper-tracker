import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { formatDateString, getDueBadge, roleBadgeClasses, statusBadgeClasses, statuses } from "../utils.js";
import { useFeedback } from "./Feedback.jsx";

const VERIFICATION_CONTEXT_KEY = "paperflow_last_verification_context";

function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLatestAssignedAt(paper) {
  const latestEntry = [...(paper.assignmentHistory ?? [])].sort(
    (left, right) => new Date(right.assignedAt).getTime() - new Date(left.assignedAt).getTime(),
  )[0];

  return latestEntry?.assignedAt ?? "";
}

function readStoredContext() {
  try {
    const raw = localStorage.getItem(VERIFICATION_CONTEXT_KEY) ?? localStorage.getItem("paperflow_last_analytics_context");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function VerificationBadge({ paper }) {
  const label = paper.verificationStatus || "Pending";
  const classes =
    label === "Verified"
      ? "bg-emerald-100 text-emerald-700"
      : label === "Incomplete"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function SummaryCard({ title, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function VerificationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { papers, universities, exams, operators, updatePaper, busy } = useWorkspace();
  const { showToast } = useFeedback();

  const [activeTab, setActiveTab] = useState("verify");
  const [filters, setFilters] = useState({
    universityId: "",
    examId: "all",
  });
  const [codeQuery, setCodeQuery] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    if (!universities.length || !exams.length) {
      return;
    }

    const storedContext = readStoredContext() ?? {};
    const nextUniversityId =
      storedContext.universityId && universities.some((item) => item.id === storedContext.universityId)
        ? storedContext.universityId
        : universities[0]?.id ?? "";
    const nextVisibleExams = exams.filter((exam) => exam.universityId === nextUniversityId);
    const nextExamId =
      storedContext.examId && nextVisibleExams.some((item) => item.id === storedContext.examId)
        ? storedContext.examId
        : "all";

    setFilters((current) => ({
      universityId: current.universityId || nextUniversityId,
      examId: current.examId || nextExamId,
    }));
  }, [universities, exams]);

  useEffect(() => {
    if (!filters.universityId) {
      return;
    }

    localStorage.setItem(VERIFICATION_CONTEXT_KEY, JSON.stringify(filters));
  }, [filters]);

  const visibleExams = useMemo(
    () => exams.filter((exam) => !filters.universityId || exam.universityId === filters.universityId),
    [exams, filters.universityId],
  );

  const scopedPapers = useMemo(
    () =>
      papers.filter((paper) => {
        const matchesUniversity = !filters.universityId || paper.universityId === filters.universityId;
        const matchesExam = filters.examId === "all" || paper.examId === filters.examId;
        return matchesUniversity && matchesExam;
      }),
    [papers, filters],
  );

  const normalizedQuery = normalizeCode(codeQuery);
  const matchingPapers = useMemo(
    () =>
      scopedPapers.filter((paper) => {
        if (!normalizedQuery) {
          return false;
        }
        return normalizeCode(paper.code).includes(normalizedQuery);
      }),
    [scopedPapers, normalizedQuery],
  );

  useEffect(() => {
    if (!matchingPapers.length) {
      setSelectedPaperId("");
      return;
    }

    const exactMatch = matchingPapers.find((paper) => normalizeCode(paper.code) === normalizedQuery);
    if (exactMatch) {
      setSelectedPaperId(exactMatch.id);
      return;
    }

    if (!matchingPapers.some((paper) => paper.id === selectedPaperId)) {
      setSelectedPaperId(matchingPapers[0].id);
    }
  }, [matchingPapers, normalizedQuery, selectedPaperId]);

  const selectedPaper = useMemo(
    () => scopedPapers.find((paper) => paper.id === selectedPaperId) ?? null,
    [scopedPapers, selectedPaperId],
  );

  const selectedPaperExam = useMemo(
    () => exams.find((exam) => exam.id === selectedPaper?.examId) ?? null,
    [exams, selectedPaper?.examId],
  );

  const selectedPaperOperatorLedger = useMemo(() => {
    if (!selectedPaper) {
      return [];
    }

    const operatorIds = new Set();

    if (selectedPaper.assignedUserId) {
      operatorIds.add(selectedPaper.assignedUserId);
    }

    (selectedPaper.assignmentHistory ?? []).forEach((entry) => {
      if (entry.operatorId) {
        operatorIds.add(entry.operatorId);
      }
    });

    return operators
      .filter((operator) => operatorIds.has(operator.id))
      .map((operator) => {
        const historyEntries = (selectedPaper.assignmentHistory ?? []).filter((entry) => entry.operatorId === operator.id);
        const active = historyEntries.filter((entry) => entry.outcome === "active").length;
        const completed = historyEntries.filter((entry) => entry.outcome === "completed").length;
        const returned = historyEntries.filter((entry) => entry.outcome === "returned").length;
        const total = historyEntries.length;
        const finished = completed + returned;
        const rate = finished ? Math.round((completed / finished) * 100) : 0;

        return {
          id: operator.id,
          name: operator.name,
          role: operator.role,
          active,
          completed,
          total,
          rate,
        };
      });
  }, [operators, selectedPaper]);

  useEffect(() => {
    setNoteDraft(selectedPaper?.verificationNote ?? "");
  }, [selectedPaper?.id, selectedPaper?.verificationNote]);

  const reportRows = useMemo(
    () =>
      scopedPapers
        .sort((left, right) => {
          const leftTime = new Date(left.verifiedAt || left.rejectedAt || 0).getTime();
          const rightTime = new Date(right.verifiedAt || right.rejectedAt || 0).getTime();
          return rightTime - leftTime || left.code.localeCompare(right.code);
        }),
    [scopedPapers],
  );

  const reportSummary = {
    total: scopedPapers.length,
    verified: scopedPapers.filter((paper) => paper.verificationStatus === "Verified").length,
    incomplete: scopedPapers.filter((paper) => paper.verificationStatus === "Incomplete").length,
    pending: scopedPapers.filter((paper) => !paper.verificationStatus).length,
  };

  const handleContextChange = (key, value) => {
    setFilters((current) => {
      if (key === "universityId") {
        const nextExamId = exams.some((exam) => exam.universityId === value && exam.id === current.examId) ? current.examId : "all";
        return { ...current, universityId: value, examId: nextExamId };
      }

      return { ...current, [key]: value };
    });
    setCodeQuery("");
    setSelectedPaperId("");
  };

  const handleVerification = async (mode) => {
    if (!selectedPaper) {
      showToast("Search and select a paper first", "warning");
      return;
    }

    const trimmedNote = noteDraft.trim();
    const now = new Date().toISOString();
    const payload = {
      verificationStatus: mode === "verified" ? "Verified" : "Incomplete",
      verificationNote: trimmedNote || null,
      verificationBy: user?.displayName || user?.userId || "Unknown User",
    };

    if (mode === "verified") {
      payload.status = "Completed";
      payload.verifiedAt = now;
    } else {
      payload.rejectedAt = now;
    }

    try {
      await updatePaper(selectedPaper.id, payload);
      showToast(mode === "verified" ? `Marked ${selectedPaper.code} as completed` : `Marked ${selectedPaper.code} as incomplete`, "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Hard Copy Verification Desk</h3>
            <p className="text-xs text-slate-400">
              Search by paper code, verify imported metadata against the hard copy, and record whether each paper is completed or incomplete.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => navigate("/papers/import")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 transition-colors hover:bg-slate-100">
              Open Import Studio
            </button>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
              <button type="button" onClick={() => setActiveTab("verify")} className={`rounded-lg px-4 py-2 font-semibold ${activeTab === "verify" ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                Verify Papers
              </button>
              <button type="button" onClick={() => setActiveTab("report")} className={`rounded-lg px-4 py-2 font-semibold ${activeTab === "report" ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                Verification Report
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">University</label>
            <select
              value={filters.universityId}
              onChange={(event) => handleContextChange("universityId", event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
            >
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Exam Session</label>
            <select
              value={filters.examId}
              onChange={(event) => handleContextChange("examId", event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
            >
              <option value="all">-- All Exam Sessions --</option>
              {visibleExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Context Papers</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              {scopedPapers.length}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Current Operator</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              {user?.displayName ?? "Verifier"}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "verify" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Search Paper Code</label>
                <input
                  value={codeQuery}
                  onChange={(event) => setCodeQuery(event.target.value)}
                  placeholder="Enter or scan paper code..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                {normalizedQuery ? (
                  matchingPapers.length ? (
                    matchingPapers.map((paper) => (
                      <button
                        key={paper.id}
                        type="button"
                        onClick={() => setSelectedPaperId(paper.id)}
                        className={`flex w-full items-start justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                          selectedPaperId === paper.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">{paper.code}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {paper.paperTitle || "Subject name pending import"}
                            <span className="text-slate-400"> | </span>
                            <span>{paper.sCode || "-"}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {paper.name || "Paper name pending import"}
                            <span> | </span>
                            <span>{paper.examName}</span>
                          </p>
                        </div>
                        <VerificationBadge paper={paper} />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      No paper code matched inside the selected university / exam context.
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Start by entering a paper code to load its imported details.
                  </div>
                )}
              </div>
            </div>

            {selectedPaper ? (
              <>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">Paper Stage Traversing</h5>
                      <p className="text-xs text-slate-400">Workflow timeline for the selected paper code.</p>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${getDueBadge(selectedPaperExam).className}`}>
                      {getDueBadge(selectedPaperExam).label}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Code: <span className="font-mono">{selectedPaper.code}</span> | Assigned:{" "}
                          <span className="text-slate-600">{operators.find((item) => item.id === selectedPaper.assignedUserId)?.name ?? "Unassigned"}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Exam: {formatDateString(selectedPaper.date)} | Latest assignment:{" "}
                          {getLatestAssignedAt(selectedPaper) ? formatDateString(String(getLatestAssignedAt(selectedPaper)).slice(0, 10)) : "-"}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400">Due {formatDateString(selectedPaperExam?.dueDate)}</div>
                    </div>

                    <div className="flex items-center select-none">
                      {statuses.map((step, index) => {
                        const activeStepIndex = statuses.indexOf(selectedPaper.status);
                        const completed = index < activeStepIndex;
                        const active = index === activeStepIndex;
                        const circleClass = completed
                          ? "border-slate-700 bg-slate-700 text-white"
                          : active
                            ? "border-slate-900 bg-slate-900 text-white ring-4 ring-slate-200"
                            : "border-slate-300 text-slate-400";

                        return (
                          <div key={step} className="relative flex flex-1 flex-col items-center text-center">
                            {index < statuses.length - 1 && (
                              <div className={`absolute left-1/2 right-[-50%] top-3.5 z-0 h-0.5 ${index < activeStepIndex ? "bg-slate-900" : "bg-slate-200"}`} />
                            )}
                            <div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${circleClass}`}>{completed ? "✓" : index + 1}</div>
                            <span className={`mt-1 max-w-[80px] text-[9px] ${active ? "font-bold text-slate-900 underline decoration-2" : "text-slate-400"}`}>{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">Operator Workload Ledger</h5>
                      <p className="text-xs text-slate-400">Only operators involved with this paper are shown here.</p>
                    </div>
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                      {selectedPaperOperatorLedger.length} Operators In View
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Operator</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3 text-center">Active</th>
                          <th className="px-4 py-3 text-center">Completed</th>
                          <th className="px-4 py-3 text-center">Total</th>
                          <th className="px-4 py-3 text-right">Success Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {selectedPaperOperatorLedger.length ? (
                          selectedPaperOperatorLedger.map((operator) => (
                            <tr key={operator.id}>
                              <td className="px-4 py-2.5 font-bold text-slate-800">{operator.name}</td>
                              <td className="px-4 py-2.5">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleBadgeClasses(operator.role)}`}>{operator.role}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center font-semibold text-slate-700">{operator.active}</td>
                              <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">{operator.completed}</td>
                              <td className="px-4 py-2.5 text-center font-semibold text-slate-500">{operator.total}</td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="font-mono text-[11px] font-bold">{operator.rate}%</span>
                                  <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block">
                                    <div className="h-full bg-emerald-500" style={{ width: `${operator.rate}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-xs italic text-slate-400">
                              No operator movement has been recorded for this paper yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {selectedPaper ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{selectedPaper.course || "-"}</h4>
                    <p className="text-xl font-medium text-slate-500 md:text-2xl">{selectedPaper.year || "-"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationBadge paper={selectedPaper} />
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(selectedPaper.status)}`}>
                      {selectedPaper.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleVerification("verified")}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Match Found: Mark Completed
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleVerification("incomplete")}
                    className="rounded-lg bg-amber-500 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                  >
                    Info Mismatch: Mark Incomplete
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Paper Name</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.name || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Subject Name</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.paperTitle || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">SCode</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.sCode || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Paper Code</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.code || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Paper Type</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.paperType || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Max Marks</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.marks || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">QTY</p>
                    <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPaper.quantity || "-"}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Verified At</p>
                    <p className="mt-2 text-xl font-bold leading-tight text-slate-900 md:text-2xl">{formatDateTime(selectedPaper.verifiedAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Rejected At</p>
                    <p className="mt-2 text-xl font-bold leading-tight text-slate-900 md:text-2xl">{formatDateTime(selectedPaper.rejectedAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Recorded By</p>
                    <p className="mt-2 text-xl font-bold leading-tight text-slate-900 md:text-2xl">{selectedPaper.verificationBy || "-"}</p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verification Note</label>
                  <textarea
                    rows={4}
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add mismatch details, hard copy observations, or verification remarks..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none"
                  />
                </div>

              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
                Search for a paper code to load the imported metadata for hard-copy verification.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard title="Context Papers" value={reportSummary.total} hint="Papers inside selected filter context" />
            <SummaryCard title="Verified" value={reportSummary.verified} hint="Marked as completed after hard-copy match" />
            <SummaryCard title="Incomplete" value={reportSummary.incomplete} hint="Mismatch found and note recorded" />
            <SummaryCard title="Pending" value={reportSummary.pending} hint="Still awaiting verification" />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Verification Activity Report</h4>
                <p className="text-xs text-slate-400">Filtered by the selected university and exam session context above.</p>
              </div>
              <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                {reportRows.length} activity rows
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Paper</th>
                    <th className="px-4 py-3">Verification</th>
                    <th className="px-4 py-3">Workflow</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3">Verified At</th>
                    <th className="px-4 py-3">Rejected At</th>
                    <th className="px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reportRows.map((paper) => (
                    <tr key={paper.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{paper.code}</p>
                        <p className="text-xs text-slate-500">{paper.name || "Paper name pending import"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <VerificationBadge paper={paper} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(paper.status)}`}>
                          {paper.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="max-w-[280px] whitespace-pre-wrap">{paper.verificationNote || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(paper.verifiedAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(paper.rejectedAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{paper.verificationBy || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!reportRows.length && (
              <div className="py-12 text-center text-sm text-slate-500">
                No verification activity has been recorded for the selected context yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
