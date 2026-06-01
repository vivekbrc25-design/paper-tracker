import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";

import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { formatDateString, getDueBadge, normalizeDateValue, roleBadgeClasses, statuses } from "../utils.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function toDateOnly(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 10);
}

function matchesOperator(paper, operatorId) {
  if (operatorId === "all") {
    return true;
  }

  if (paper.assignedUserId === operatorId) {
    return true;
  }

  return (paper.assignmentHistory ?? []).some((entry) => entry.operatorId === operatorId);
}

function matchesAssignedDate(paper, assignedDate) {
  if (!assignedDate) {
    return true;
  }

  return (paper.assignmentHistory ?? []).some((entry) => toDateOnly(entry.assignedAt) === assignedDate);
}

function getLatestAssignedAt(paper) {
  const latestEntry = [...(paper.assignmentHistory ?? [])].sort(
    (left, right) => new Date(right.assignedAt).getTime() - new Date(left.assignedAt).getTime(),
  )[0];

  return latestEntry?.assignedAt ?? "";
}

function getStatusIndex(status) {
  const index = statuses.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function ReportsPage() {
  const { papers, universities, exams, operators, theme } = useWorkspace();
  const [filters, setFilters] = useState({
    universityId: "all",
    sessionId: "all",
    operatorId: "all",
    stage: "all",
    examDate: "",
    assignedDate: "",
    search: "",
  });
  const [timelineSort, setTimelineSort] = useState("assignedDateDesc");
  const [timelinePageSize, setTimelinePageSize] = useState(50);
  const [timelinePage, setTimelinePage] = useState(1);

  const query = filters.search.trim().toLowerCase();

  useEffect(() => {
    setTimelinePage(1);
  }, [filters, timelineSort, timelinePageSize]);

  const visibleExams = useMemo(
    () => exams.filter((exam) => filters.universityId === "all" || exam.universityId === filters.universityId),
    [exams, filters.universityId],
  );

  const analyzedPapers = useMemo(
    () =>
      papers.filter((paper) => {
        const matchesUniversity = filters.universityId === "all" || paper.universityId === filters.universityId;
        const matchesSession = filters.sessionId === "all" || paper.examId === filters.sessionId;
        const matchesStage = filters.stage === "all" || paper.status === filters.stage;
        const matchesExamDate = !filters.examDate || normalizeDateValue(paper.date) === normalizeDateValue(filters.examDate);
        const matchesAssigned = matchesAssignedDate(paper, filters.assignedDate);
        const matchesSelectedOperator = matchesOperator(paper, filters.operatorId);
        const matchesSearch =
          !query ||
          (paper.name ?? "").toLowerCase().includes(query) ||
          paper.code.toLowerCase().includes(query) ||
          paper.universityName.toLowerCase().includes(query) ||
          paper.examName.toLowerCase().includes(query);

        return matchesUniversity && matchesSession && matchesStage && matchesExamDate && matchesAssigned && matchesSelectedOperator && matchesSearch;
      }),
    [papers, filters, query],
  );

  const counts = useMemo(() => {
    const initialCounts = statuses.reduce((accumulator, status) => ({ ...accumulator, [status]: 0 }), {});
    analyzedPapers.forEach((paper) => {
      initialCounts[paper.status] += 1;
    });
    return initialCounts;
  }, [analyzedPapers]);

  const textColor = theme === "dark" ? "#f8fafc" : "#334155";
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const chartLabels = Object.keys(counts);
  const chartValues = Object.values(counts);
  const colors = [
    "rgba(59, 130, 246, 0.8)",
    "rgba(245, 158, 11, 0.8)",
    "rgba(239, 68, 68, 0.8)",
    "rgba(168, 85, 247, 0.8)",
    "rgba(16, 185, 129, 0.8)",
  ];

  const stages = [
    { status: "Typing", title: "Typing Hero", dot: "bg-blue-500" },
    { status: "Proof Reading", title: "Proof Champion", dot: "bg-amber-500" },
    { status: "Correction", title: "Master Editor", dot: "bg-rose-500" },
    { status: "Final Reading", title: "Perfect Auditor", dot: "bg-purple-500" },
    { status: "Completed", title: "Efficiency Legend", dot: "bg-emerald-500" },
  ];

  const getHistoryEntries = (operatorId) =>
    analyzedPapers.flatMap((paper) => (paper.assignmentHistory ?? []).filter((entry) => entry.operatorId === operatorId));

  const champions = stages.map((stage) => {
    let bestOperator = null;
    let bestCount = 0;

    operators.forEach((operator) => {
      const historyEntries = getHistoryEntries(operator.id);
      const count =
        stage.status === "Completed"
          ? historyEntries.filter((entry) => entry.outcome === "completed").length
          : historyEntries.filter((entry) => entry.stage === stage.status && entry.outcome === "completed").length;

      if (count > bestCount) {
        bestCount = count;
        bestOperator = operator;
      }
    });

    return { ...stage, bestOperator, bestCount };
  });

  const involvedOperatorIds = useMemo(() => {
    const ids = new Set();

    analyzedPapers.forEach((paper) => {
      if (paper.assignedUserId) {
        ids.add(paper.assignedUserId);
      }

      (paper.assignmentHistory ?? []).forEach((entry) => {
        if (entry.operatorId) {
          ids.add(entry.operatorId);
        }
      });
    });

    return ids;
  }, [analyzedPapers]);

  const visibleOperators = useMemo(
    () =>
      operators.filter(
        (operator) =>
          involvedOperatorIds.has(operator.id) &&
          (filters.operatorId === "all" || operator.id === filters.operatorId),
      ),
    [operators, involvedOperatorIds, filters.operatorId],
  );

  const sortedTimelinePapers = useMemo(() => {
    const sorted = [...analyzedPapers];

    sorted.sort((left, right) => {
      if (timelineSort === "examDateDesc") {
        return new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime() || left.code.localeCompare(right.code);
      }

      if (timelineSort === "stageAsc") {
        return getStatusIndex(left.status) - getStatusIndex(right.status) || left.code.localeCompare(right.code);
      }

      if (timelineSort === "codeAsc") {
        return left.code.localeCompare(right.code);
      }

      const leftAssigned = getLatestAssignedAt(left);
      const rightAssigned = getLatestAssignedAt(right);
      return new Date(rightAssigned || 0).getTime() - new Date(leftAssigned || 0).getTime() || left.code.localeCompare(right.code);
    });

    return sorted;
  }, [analyzedPapers, timelineSort]);

  const timelineTotalPages = Math.max(1, Math.ceil(sortedTimelinePapers.length / timelinePageSize));
  const currentTimelinePage = Math.min(timelinePage, timelineTotalPages);
  const paginatedTimelinePapers = sortedTimelinePapers.slice(
    (currentTimelinePage - 1) * timelinePageSize,
    currentTimelinePage * timelinePageSize,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Exam Session Performance Ledger</h3>
            <p className="text-xs text-slate-400">
              Refine reports by exam session, operator, stage, exam date, assigned date, and search to isolate exactly the workflow slice you want to inspect.
            </p>
          </div>
          <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
            {analyzedPapers.length} Papers In Report
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">University</label>
            <select
              value={filters.universityId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  universityId: event.target.value,
                  sessionId: "all",
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              <option value="all">-- All Universities --</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Exam Session</label>
            <select
              value={filters.sessionId}
              onChange={(event) => setFilters((current) => ({ ...current, sessionId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
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
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Operator</label>
            <select
              value={filters.operatorId}
              onChange={(event) => setFilters((current) => ({ ...current, operatorId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              <option value="all">-- All Operators --</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name} ({operator.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Stage</label>
            <select
              value={filters.stage}
              onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              <option value="all">-- All Stages --</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Exam Date</label>
            <input
              type="date"
              value={filters.examDate}
              onChange={(event) => setFilters((current) => ({ ...current, examDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Assigned Date</label>
            <input
              type="date"
              value={filters.assignedDate}
              onChange={(event) => setFilters((current) => ({ ...current, assignedDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Search</label>
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    universityId: "all",
                    sessionId: "all",
                    operatorId: "all",
                    stage: "all",
                    examDate: "",
                    assignedDate: "",
                    search: "",
                  })
                }
                className="text-[10px] font-semibold text-slate-700 hover:underline"
              >
                Reset
              </button>
            </div>
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Code, paper, university..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex h-[340px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a] lg:col-span-5">
          <div className="mb-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Status Allocation</h4>
            <p className="text-xs text-slate-400">Distribution of current paper stages inside the active report filters.</p>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <Doughnut
              data={{
                labels: chartLabels,
                datasets: [{ data: chartValues, backgroundColor: colors, borderColor: theme === "dark" ? "#0f172a" : "#ffffff", borderWidth: 2 }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: textColor, boxWidth: 10, padding: 10, font: { size: 10, weight: "600" } },
                  },
                },
                cutout: "60%",
              }}
            />
          </div>
        </div>

        <div className="flex h-[340px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a] lg:col-span-7">
          <div className="mb-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Stage Saturation</h4>
            <p className="text-xs text-slate-400">Current workload by paper stage inside the filtered report scope.</p>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <Bar
              data={{
                labels: chartLabels,
                datasets: [{ label: "Active Papers", data: chartValues, backgroundColor: colors, borderRadius: 6, borderWidth: 0 }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: textColor, font: { size: 9, weight: "500" } } },
                  y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, precision: 0, font: { size: 9 } } },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {champions.map((champion) => (
          <div key={champion.status} className="flex h-[120px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${champion.dot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{champion.status}</span>
            </div>
            {champion.bestOperator && champion.bestCount > 0 ? (
              <>
                <div className="mt-2 flex-1">
                  <h5 className="truncate text-xs font-bold text-slate-800 dark:text-white">{champion.bestOperator.name}</h5>
                  <p className="mt-0.5 text-[9px] font-semibold text-slate-400 dark:text-slate-500">{champion.title}</p>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${roleBadgeClasses(champion.bestOperator.role)}`}>{champion.bestOperator.role}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{champion.bestCount}</span>
                </div>
              </>
            ) : (
              <div className="mt-4 text-center text-[10px] text-slate-400">No leader yet</div>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Paper Timeline Audit</h4>
            <p className="text-xs text-slate-400">Timeline audit reflects the same filters shown above.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:w-44">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sort By</label>
              <select
                value={timelineSort}
                onChange={(event) => setTimelineSort(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                <option value="assignedDateDesc">Latest Assigned Date</option>
                <option value="examDateDesc">Latest Exam Date</option>
                <option value="stageAsc">Stage</option>
                <option value="codeAsc">Paper Code</option>
              </select>
            </div>
            <div className="w-full sm:w-28">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Rows</label>
              <select
                value={timelinePageSize}
                onChange={(event) => setTimelinePageSize(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                {[10, 20, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {sortedTimelinePapers.length} matching papers
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100 p-2 dark:divide-slate-800/50">
          {paginatedTimelinePapers.length ? (
            paginatedTimelinePapers.map((paper) => {
              const exam = exams.find((item) => item.id === paper.examId);
              const badge = getDueBadge(exam);
              const operator = operators.find((item) => item.id === paper.assignedUserId);
              const activeStepIndex = statuses.indexOf(paper.status);
              const latestAssignedDate = getLatestAssignedAt(paper);

              return (
                <div key={paper.id} className="flex flex-col items-stretch justify-between gap-4 p-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30 lg:flex-row lg:items-center">
                  <div className="flex w-full items-center justify-between lg:w-1/4 lg:block">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-white">{paper.name || paper.code}</h5>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                        Code: <span className="font-mono font-bold">{paper.code}</span> | Assigned:{" "}
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{operator?.name ?? "Unassigned"}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Exam: {formatDateString(paper.date)} | Latest assignment: {latestAssignedDate ? formatDateString(toDateOnly(latestAssignedDate)) : "-"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="flex flex-1 items-center select-none">
                    {statuses.map((step, index) => {
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
                          <span className={`mt-1 hidden max-w-[80px] truncate text-[9px] sm:block ${active ? "font-bold text-slate-900 underline decoration-2" : "text-slate-400"}`}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full text-right text-[10px] text-slate-400 lg:w-28">Due {formatDateString(exam?.dueDate)}</div>
                </div>
              );
            })
          ) : (
            <p className="py-4 text-center text-xs italic text-slate-400">No papers match the selected report filters.</p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/80 dark:bg-slate-900/20">
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{sortedTimelinePapers.length ? (currentTimelinePage - 1) * timelinePageSize + 1 : 0}</span> to{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentTimelinePage * timelinePageSize, sortedTimelinePapers.length)}</span> of{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{sortedTimelinePapers.length}</span> audit rows
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentTimelinePage === 1}
              onClick={() => setTimelinePage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-500 transition-colors disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Prev
            </button>
            <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Page {currentTimelinePage} of {timelineTotalPages}</span>
            <button
              type="button"
              disabled={currentTimelinePage === timelineTotalPages}
              onClick={() => setTimelinePage((current) => Math.min(timelineTotalPages, current + 1))}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-500 transition-colors disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Operator Workload Ledger</h4>
            <p className="text-xs text-slate-400">Assignment counts recalculate from the active report filters.</p>
          </div>
          <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{visibleOperators.length} Operators In View</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-center">Completed</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-right">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/50">
              {visibleOperators.map((operator) => {
                const historyEntries = getHistoryEntries(operator.id);
                const active = historyEntries.filter((entry) => entry.outcome === "active").length;
                const completed = historyEntries.filter((entry) => entry.outcome === "completed").length;
                const returned = historyEntries.filter((entry) => entry.outcome === "returned").length;
                const total = historyEntries.length;
                const finished = completed + returned;
                const rate = finished ? Math.round((completed / finished) * 100) : 0;

                return (
                  <tr key={operator.id}>
                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-white">{operator.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleBadgeClasses(operator.role)}`}>{operator.role}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">{active}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">{completed}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-slate-500">{total}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-[11px] font-bold">{rate}%</span>
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 sm:block">
                          <div className="h-full bg-emerald-500" style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
