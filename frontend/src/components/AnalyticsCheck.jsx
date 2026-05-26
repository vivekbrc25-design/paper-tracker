import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { formatDateString, statusBadgeClasses, statuses } from "../utils.js";
import { useFeedback } from "./Feedback.jsx";
import { workspaceApi } from "../api.js";

const ANALYTICS_CONTEXT_KEY = "paperflow_last_analytics_context";
const STATUS_PROGRESS = {
  Typing: 20,
  "Proof Reading": 45,
  Correction: 65,
  "Final Reading": 85,
  Completed: 100,
};

function SummaryCard({ title, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
        </div>
        <div className={`rounded-2xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tone}`}>{title}</div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-xs text-slate-400 dark:text-slate-500">{body}</p>
    </div>
  );
}

function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function readStoredContext() {
  try {
    const raw = localStorage.getItem(ANALYTICS_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistContext(context) {
  localStorage.setItem(ANALYTICS_CONTEXT_KEY, JSON.stringify(context));
}

function getUploadCodes(file) {
  return import("xlsx").then((XLSX) => file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });

    const skipHeaders = new Set(["PAPERCODE", "PAPER_CODE", "PAPER CODE", "CODE"]);
    const extractedCodes = [];

    rows.forEach((row) => {
      const cells = Array.isArray(row) ? row : [row];
      const firstMeaningfulCell = cells.find((cell) => String(cell ?? "").trim());
      if (!firstMeaningfulCell) {
        return;
      }

      const normalized = normalizeCode(firstMeaningfulCell);
      if (!normalized || skipHeaders.has(normalized)) {
        return;
      }

      extractedCodes.push(normalized);
    });

    return extractedCodes;
  }));
}

export function AnalyticsCheckPage() {
  const { universities, exams, papers, operators, loading } = useWorkspace();
  const { showToast } = useFeedback();
  const location = useLocation();
  const uploadInputRef = useRef(null);
  const incomingContext = location.state?.analyticsContext;

  const [selectedUniversityId, setSelectedUniversityId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [uploadedCodes, setUploadedCodes] = useState([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [downloadingSample, setDownloadingSample] = useState(false);

  useEffect(() => {
    if (!universities.length || !exams.length) {
      return;
    }

    const storedContext = incomingContext ?? readStoredContext() ?? {};
    const nextUniversityId =
      storedContext.universityId && universities.some((item) => item.id === storedContext.universityId)
        ? storedContext.universityId
        : universities[0]?.id ?? "";

    const availableExams = exams.filter((exam) => exam.universityId === nextUniversityId);
    const nextExamId =
      storedContext.examId && availableExams.some((item) => item.id === storedContext.examId)
        ? storedContext.examId
        : availableExams[0]?.id ?? "";

    setSelectedUniversityId((current) => current || nextUniversityId);
    setSelectedExamId((current) => current || nextExamId);
  }, [incomingContext, universities, exams]);

  useEffect(() => {
    if (!selectedUniversityId || !selectedExamId) {
      return;
    }
    persistContext({ universityId: selectedUniversityId, examId: selectedExamId });
  }, [selectedUniversityId, selectedExamId]);

  const visibleExams = useMemo(
    () => exams.filter((exam) => exam.universityId === selectedUniversityId),
    [exams, selectedUniversityId],
  );

  const selectedUniversity = universities.find((university) => university.id === selectedUniversityId);
  const selectedExam = exams.find((exam) => exam.id === selectedExamId);

  const contextPapers = useMemo(
    () => papers.filter((paper) => paper.universityId === selectedUniversityId && paper.examId === selectedExamId),
    [papers, selectedUniversityId, selectedExamId],
  );

  const comparison = useMemo(() => {
    const papersByCode = new Map(contextPapers.map((paper) => [normalizeCode(paper.code), paper]));
    const uploadFrequency = new Map();
    uploadedCodes.forEach((code) => {
      uploadFrequency.set(code, (uploadFrequency.get(code) ?? 0) + 1);
    });

    const duplicateUploadCodes = [...uploadFrequency.entries()]
      .filter(([, count]) => count > 1)
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));

    const uniqueUploadedCodes = [...new Set(uploadedCodes)];
    const matchedCodes = [];
    const uploadedOnlyCodes = [];

    uniqueUploadedCodes.forEach((code) => {
      if (papersByCode.has(code)) {
        matchedCodes.push(code);
      } else {
        uploadedOnlyCodes.push(code);
      }
    });

    const matchedPapers = matchedCodes
      .map((code) => {
        const paper = papersByCode.get(code);
        const operator = operators.find((item) => item.id === paper.assignedUserId);
        return {
          ...paper,
          progress: STATUS_PROGRESS[paper.status] ?? 0,
          operatorName: operator?.name ?? "Unassigned",
        };
      })
      .sort((left, right) => (STATUS_PROGRESS[right.status] ?? 0) - (STATUS_PROGRESS[left.status] ?? 0) || left.code.localeCompare(right.code));

    const systemOnlyPapers = contextPapers
      .filter((paper) => !uploadFrequency.has(normalizeCode(paper.code)))
      .sort((left, right) => left.code.localeCompare(right.code));

    const statusBuckets = statuses.map((status) => ({
      status,
      count: matchedPapers.filter((paper) => paper.status === status).length,
    }));

    const completedMatches = matchedPapers.filter((paper) => paper.status === "Completed").length;
    const coverageRate = uniqueUploadedCodes.length ? Math.round((matchedPapers.length / uniqueUploadedCodes.length) * 100) : 0;
    const completionRate = matchedPapers.length ? Math.round((completedMatches / matchedPapers.length) * 100) : 0;

    return {
      uniqueUploadedCodes,
      matchedPapers,
      uploadedOnlyCodes: uploadedOnlyCodes.sort((left, right) => left.localeCompare(right)),
      systemOnlyPapers,
      duplicateUploadCodes,
      statusBuckets,
      coverageRate,
      completionRate,
      completedMatches,
    };
  }, [contextPapers, operators, uploadedCodes]);

  const handleUniversityChange = (value) => {
    const nextVisibleExams = exams.filter((exam) => exam.universityId === value);
    setSelectedUniversityId(value);
    setSelectedExamId(nextVisibleExams[0]?.id ?? "");
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setParsing(true);
    try {
      const codes = await getUploadCodes(file);
      if (!codes.length) {
        showToast("No paper codes were found in the uploaded file", "warning");
        setUploadedCodes([]);
        setUploadedFileName("");
        return;
      }

      setUploadedCodes(codes);
      setUploadedFileName(file.name);
      showToast(`Analysed ${codes.length} paper code rows from ${file.name}`, "success");
    } catch (error) {
      setUploadedCodes([]);
      setUploadedFileName("");
      showToast("Unable to read the uploaded Excel file. Please use xlsx, xls, or csv format.", "error");
    } finally {
      setParsing(false);
    }
  };

  const handleDownloadSample = async () => {
    setDownloadingSample(true);
    try {
      const workbook = await import("xlsx");
      const response = await workspaceApi.downloadPaperImportSample();
      const sampleText = await response.data.text();
      const workbookData = workbook.read(sampleText, { type: "string" });
      const firstSheet = workbookData.Sheets[workbookData.SheetNames[0]];
      const exportWorkbook = workbook.utils.book_new();
      workbook.utils.book_append_sheet(exportWorkbook, firstSheet, "Paper Codes");

      const output = workbook.write(exportWorkbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([output], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "analytic-check-sample.xlsx";
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      showToast("Downloaded analytic check sample workbook", "success");
    } catch {
      showToast("Unable to download the analytic sample right now", "error");
    } finally {
      setDownloadingSample(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a] dark:text-slate-300">
        Loading analytics context...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.95))] p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sky-200">Run Analytic Check</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">Workbook vs system comparison for one exam context</h1>
              <p className="mt-2 text-sm text-slate-200">
                Upload an Excel sheet containing paper codes and compare it against the papers already stored in Paper Tracker for the selected university and exam session.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/papers" className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15">
                Back to Papers
              </Link>
              <button
                type="button"
                onClick={handleDownloadSample}
                disabled={downloadingSample}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloadingSample ? "Preparing Sample..." : "Download Sample"}
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={parsing || !selectedUniversityId || !selectedExamId}
                className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {parsing ? "Reading Workbook..." : "Upload Excel Sheet"}
              </button>
              <input ref={uploadInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadFile} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 p-6 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.9fr)]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">University</label>
            <select
              value={selectedUniversityId}
              onChange={(event) => handleUniversityChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Exam Session</label>
            <select
              value={selectedExamId}
              onChange={(event) => setSelectedExamId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            >
              {visibleExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Active Context</p>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{selectedUniversity?.name ?? "No university selected"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedExam?.name ?? "No exam session selected"}</p>
            {uploadedFileName && <p className="mt-3 text-xs font-medium text-sky-600 dark:text-sky-400">File: {uploadedFileName}</p>}
          </div>
        </div>
      </div>

      {uploadedCodes.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SummaryCard title="Uploaded Codes" value={comparison.uniqueUploadedCodes.length} hint={`${uploadedCodes.length} total rows read`} tone="bg-sky-500/10 text-sky-600 dark:text-sky-300" />
            <SummaryCard title="Matched" value={comparison.matchedPapers.length} hint={`${comparison.coverageRate}% coverage from uploaded file`} tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" />
            <SummaryCard title="Completed" value={comparison.completedMatches} hint={`${comparison.completionRate}% of matched papers done`} tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" />
            <SummaryCard title="Upload Only" value={comparison.uploadedOnlyCodes.length} hint="Present in file, absent in system" tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
            <SummaryCard title="System Only" value={comparison.systemOnlyPapers.length} hint="Possible new entries in tracker" tone="bg-rose-500/10 text-rose-700 dark:text-rose-300" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Matched Papers and Workflow Progress</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">These codes exist in both the uploaded workbook and the current system data.</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
                  {comparison.matchedPapers.length} Matches
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Paper</th>
                      <th className="px-5 py-3">Progress</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Operator</th>
                      <th className="px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800/50">
                    {comparison.matchedPapers.length ? (
                      comparison.matchedPapers.map((paper) => (
                        <tr key={paper.id}>
                          <td className="px-5 py-3">
                            <span className="block font-bold text-slate-900 dark:text-white">{paper.code}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">{paper.name || "Paper name pending import"}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className="h-full rounded-full bg-sky-500" style={{ width: `${paper.progress}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{paper.progress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(paper.status)}`}>{paper.status}</span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{paper.operatorName}</td>
                          <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateString(paper.date)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-5 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                          None of the uploaded codes matched the selected exam context.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Status Spread in Matched Papers</h2>
                <div className="mt-4 space-y-3">
                  {comparison.statusBuckets.map((bucket) => {
                    const bucketRate = comparison.matchedPapers.length ? Math.round((bucket.count / comparison.matchedPapers.length) * 100) : 0;
                    return (
                      <div key={bucket.status}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">{bucket.status}</span>
                          <span className="text-slate-400 dark:text-slate-500">{bucket.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${bucketRate}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quality Flags</h2>
                <div className="mt-4 space-y-4 text-xs">
                  <div className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <span className="block font-bold">{comparison.uploadedOnlyCodes.length} upload-only codes</span>
                    <span className="mt-1 block">These appear in the workbook but are not yet in the system for this exam.</span>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                    <span className="block font-bold">{comparison.systemOnlyPapers.length} system-only papers</span>
                    <span className="mt-1 block">These are in Paper Tracker but absent from the uploaded workbook, which can indicate new entries or workbook gaps.</span>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    <span className="block font-bold">{comparison.duplicateUploadCodes.length} duplicated upload codes</span>
                    <span className="mt-1 block">Repeated codes inside the uploaded workbook are grouped below for easy review.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Uploaded Codes Missing in System</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Present in the uploaded file but not found in the selected system context.</p>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-5">
                {comparison.uploadedOnlyCodes.length ? (
                  <div className="flex flex-wrap gap-2">
                    {comparison.uploadedOnlyCodes.map((code) => (
                      <span key={code} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Nothing missing from system" body="Every uploaded code is already represented in the selected university and exam context." />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">System Entries Missing in Upload</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Useful as a “new entry” list for papers that exist in Paper Tracker but not in the workbook.</p>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-5">
                {comparison.systemOnlyPapers.length ? (
                  <div className="space-y-3">
                    {comparison.systemOnlyPapers.map((paper) => (
                      <div key={paper.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{paper.code}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{paper.name || "Paper name pending import"}</p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClasses(paper.status)}`}>{paper.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No extra system entries" body="There are no system papers outside the uploaded list for this selected context." />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Duplicate Codes Found in Upload</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Advanced validation to catch repeated codes inside the uploaded workbook.</p>
            </div>
            <div className="p-5">
              {comparison.duplicateUploadCodes.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {comparison.duplicateUploadCodes.map((item) => (
                    <div key={item.code} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.code}</p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Repeated {item.count} times in the uploaded file</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No duplicates detected" body="Each uploaded paper code appears only once in the workbook." />
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="Upload an Excel sheet to begin the comparison"
          body="Choose the university and exam session, then upload a workbook containing paper codes. We will compare those codes against the current system data and show matches, workflow progress, upload-only rows, and new system-only entries."
        />
      )}
    </div>
  );
}
