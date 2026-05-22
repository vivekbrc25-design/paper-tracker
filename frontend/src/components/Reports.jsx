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
import { useState } from "react";

import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { formatDateString, getDueBadge, roleBadgeClasses, statuses } from "../utils.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export function ReportsPage() {
  const { papers, exams, operators, theme } = useWorkspace();
  const [sessionId, setSessionId] = useState("all");
  const [search, setSearch] = useState("");

  const analyzedPapers = papers.filter((paper) => sessionId === "all" || paper.examId === sessionId);
  const counts = statuses.reduce((accumulator, status) => ({ ...accumulator, [status]: 0 }), {});
  analyzedPapers.forEach((paper) => {
    counts[paper.status] += 1;
  });

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

  const champions = stages.map((stage) => {
    let bestOperator = null;
    let bestCount = 0;
    operators.forEach((operator) => {
      const count = papers.filter((paper) => paper.assignedUserId === operator.id && paper.status === stage.status).length;
      if (count > bestCount) {
        bestCount = count;
        bestOperator = operator;
      }
    });
    return { ...stage, bestOperator, bestCount };
  });

  const filteredTimelinePapers = papers.filter((paper) => {
    const query = search.trim().toLowerCase();
    return !query || paper.name.toLowerCase().includes(query) || paper.code.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a] sm:flex-row">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Exam Session Performance Ledger</h3>
          <p className="text-xs text-slate-400">
            Charts mirror the current HTML workflow while the backend now stores assignment timing history for later reporting.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <select value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100">
            <option value="all">-- All Exam Sessions --</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex h-[340px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a] lg:col-span-5">
          <div className="mb-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Status Allocation</h4>
            <p className="text-xs text-slate-400">Distribution of current paper stages.</p>
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
            <p className="text-xs text-slate-400">Current workload by paper stage.</p>
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
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Operator Workload Ledger</h4>
            <p className="text-xs text-slate-400">Active vs completed assignments by operator.</p>
          </div>
          <span className="rounded bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-500">{operators.length} Operators Loaded</span>
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
              {operators.map((operator) => {
                const assigned = papers.filter((paper) => paper.assignedUserId === operator.id);
                const active = assigned.filter((paper) => paper.status !== "Completed").length;
                const completed = assigned.filter((paper) => paper.status === "Completed").length;
                const total = assigned.length;
                const rate = total ? Math.round((completed / total) * 100) : 0;
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Paper Timeline Audit</h4>
            <p className="text-xs text-slate-400">Stage progression snapshot for each paper.</p>
          </div>
          <div className="w-full sm:w-64">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search paper code/name..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100 p-2 dark:divide-slate-800/50">
          {filteredTimelinePapers.length ? (
            filteredTimelinePapers.map((paper) => {
              const exam = exams.find((item) => item.id === paper.examId);
              const badge = getDueBadge(exam);
              const operator = operators.find((item) => item.id === paper.assignedUserId);
              const activeStepIndex = statuses.indexOf(paper.status);

              return (
                <div key={paper.id} className="flex flex-col items-stretch justify-between gap-4 p-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30 lg:flex-row lg:items-center">
                  <div className="flex w-full items-center justify-between lg:w-1/4 lg:block">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-white">{paper.name}</h5>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                        Code: <span className="font-mono font-bold">{paper.code}</span> | Assigned:{" "}
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{operator?.name ?? "Unassigned"}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="flex flex-1 items-center select-none">
                    {statuses.map((step, index) => {
                      const completed = index < activeStepIndex;
                      const active = index === activeStepIndex;
                      const circleClass = completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : active
                          ? "border-brand-500 bg-brand-500/10 text-brand-500 ring-4 ring-brand-500/20"
                          : "border-slate-300 text-slate-400 dark:border-slate-700 dark:text-slate-600";
                      return (
                        <div key={step} className="relative flex flex-1 flex-col items-center text-center">
                          {index < statuses.length - 1 && (
                            <div className={`absolute left-1/2 right-[-50%] top-3.5 z-0 h-0.5 ${index < activeStepIndex ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />
                          )}
                          <div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${circleClass}`}>{completed ? "✓" : index + 1}</div>
                          <span className={`mt-1 hidden max-w-[80px] truncate text-[9px] sm:block ${active ? "font-bold text-brand-500 underline decoration-2" : "text-slate-400 dark:text-slate-600"}`}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full text-right text-[10px] text-slate-400 lg:w-28">Due {formatDateString(exam?.dueDate)}</div>
                </div>
              );
            })
          ) : (
            <p className="py-4 text-center text-xs italic text-slate-400">No matching papers logged in system context.</p>
          )}
        </div>
      </div>
    </div>
  );
}
