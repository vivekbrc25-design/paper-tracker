import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { workspaceApi } from "../api.js";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { formatDateString, normalizeDateValue } from "../utils.js";
import { useFeedback } from "./Feedback.jsx";

const IMPORT_CONTEXT_KEY = "paperflow_last_import_context";
const PREVIEW_LIMIT = 20;
const TARGET_FIELDS = [
  { key: "course", label: "Course Name", aliases: ["coursename", "course"] },
  { key: "paperTitle", label: "Subject Name", aliases: ["subjectname", "papertitle", "title", "subject"] },
  { key: "name", label: "Paper Name", aliases: ["papername", "name"] },
  { key: "code", label: "Paper Code", aliases: ["papercode", "code"] },
  { key: "sCode", label: "SCode", aliases: ["scode", "subjectcode"] },
  { key: "paperType", label: "Paper Type", aliases: ["papertype", "type"] },
  { key: "year", label: "Annual / Semester", aliases: ["annualsemester", "semester", "year", "annual"] },
  { key: "quantity", label: "QTY", aliases: ["qty", "quantity"] },
  { key: "date", label: "Exam Date", aliases: ["examdate", "date"] },
  { key: "examTime", label: "Exam Time", aliases: ["examtime", "time"] },
  { key: "marks", label: "Marks", aliases: ["marks", "mm", "maxmarks"] },
];
const CANONICAL_HEADERS = ["courseName", "subjectName", "paperName", "paperCode", "sCode", "paperType", "annualSemester", "qty", "examDate", "examTime", "marks"];

function normalizeHeaderKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function readStoredContext() {
  try {
    const raw = localStorage.getItem(IMPORT_CONTEXT_KEY) ?? localStorage.getItem("paperflow_last_analytics_context");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function parseWorkbookFile(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const headerRegistry = new Map();
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

    if (!sheetRows.length) {
      return;
    }

    const headerKeys = sheetRows[0].map((header, index) => {
      const fallbackLabel = `Column ${index + 1}`;
      const displayLabel = String(header ?? "").trim() || fallbackLabel;
      const normalized = normalizeHeaderKey(displayLabel) || normalizeHeaderKey(fallbackLabel);

      if (!headerRegistry.has(normalized)) {
        headerRegistry.set(normalized, displayLabel);
      }

      return normalized;
    });

    sheetRows.slice(1).forEach((row, rowIndex) => {
      if (!row.some((value) => String(value ?? "").trim())) {
        return;
      }

      const values = {};
      headerKeys.forEach((headerKey, columnIndex) => {
        if (!headerKey) {
          return;
        }
        values[headerKey] = String(row[columnIndex] ?? "").trim();
      });

      rows.push({
        sheetName,
        rowNumber: rowIndex + 2,
        values,
      });
    });
  });

  if (!rows.length) {
    throw new Error("The uploaded file does not contain any paper rows.");
  }

  return {
    headers: [...headerRegistry.entries()].map(([value, label]) => ({ value, label })),
    rows,
  };
}

function getAutoMapping(headers) {
  const availableKeys = new Set(headers.map((header) => header.value));

  return TARGET_FIELDS.reduce((accumulator, field) => {
    accumulator[field.key] = field.aliases.find((alias) => availableKeys.has(alias)) ?? "";
    return accumulator;
  }, {});
}

function getRowValue(row, mapping, field) {
  const mappedKey = mapping[field.key];
  if (mappedKey && row.values[mappedKey]) {
    return row.values[mappedKey];
  }

  const aliasMatch = field.aliases.find((alias) => row.values[alias]);
  return aliasMatch ? row.values[aliasMatch] : "";
}

function buildPreviewRows(parsedFile, mapping) {
  if (!parsedFile) {
    return [];
  }

  return parsedFile.rows.map((row) => ({
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    course: getRowValue(row, mapping, TARGET_FIELDS[0]),
    paperTitle: getRowValue(row, mapping, TARGET_FIELDS[1]),
    name: getRowValue(row, mapping, TARGET_FIELDS[2]),
    code: getRowValue(row, mapping, TARGET_FIELDS[3]).toUpperCase(),
    sCode: getRowValue(row, mapping, TARGET_FIELDS[4]),
    paperType: getRowValue(row, mapping, TARGET_FIELDS[5]),
    year: getRowValue(row, mapping, TARGET_FIELDS[6]),
    quantity: getRowValue(row, mapping, TARGET_FIELDS[7]),
    date: normalizeDateValue(getRowValue(row, mapping, TARGET_FIELDS[8])),
    examTime: getRowValue(row, mapping, TARGET_FIELDS[9]),
    marks: getRowValue(row, mapping, TARGET_FIELDS[10]),
  }));
}

function buildCanonicalCsv(rows) {
  const lines = [CANONICAL_HEADERS.join(",")];

  rows.forEach((row) => {
    lines.push(
      [
        row.course,
        row.paperTitle,
        row.name,
        row.code,
        row.sCode,
        row.paperType,
        row.year,
        row.quantity,
        row.date,
        row.examTime,
        row.marks,
      ]
        .map((value) => escapeCsvValue(value))
        .join(","),
    );
  });

  return lines.join("\n");
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

export function PaperImportPage() {
  const navigate = useNavigate();
  const { universities, exams, importPapers, busy } = useWorkspace();
  const { showToast } = useFeedback();
  const [filters, setFilters] = useState({
    universityId: "",
    examId: "",
  });
  const [selectedFileName, setSelectedFileName] = useState("");
  const [parsedFile, setParsedFile] = useState(null);
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    if (!universities.length || !exams.length) {
      return;
    }

    const storedContext = readStoredContext() ?? {};
    const nextUniversityId =
      storedContext.universityId && universities.some((item) => item.id === storedContext.universityId)
        ? storedContext.universityId
        : universities[0]?.id ?? "";
    const visibleForUniversity = exams.filter((exam) => exam.universityId === nextUniversityId);
    const nextExamId =
      storedContext.examId && visibleForUniversity.some((item) => item.id === storedContext.examId)
        ? storedContext.examId
        : visibleForUniversity[0]?.id ?? "";

    setFilters((current) => ({
      universityId: current.universityId || nextUniversityId,
      examId: current.examId || nextExamId,
    }));
  }, [universities, exams]);

  useEffect(() => {
    if (!filters.universityId || !filters.examId) {
      return;
    }

    localStorage.setItem(IMPORT_CONTEXT_KEY, JSON.stringify(filters));
  }, [filters]);

  const visibleExams = useMemo(
    () => exams.filter((exam) => !filters.universityId || exam.universityId === filters.universityId),
    [exams, filters.universityId],
  );

  const previewRows = useMemo(() => buildPreviewRows(parsedFile, mapping), [parsedFile, mapping]);
  const previewStats = useMemo(
    () => ({
      total: previewRows.length,
      ready: previewRows.filter((row) => row.code).length,
      missingCode: previewRows.filter((row) => !row.code).length,
      withDate: previewRows.filter((row) => row.date).length,
    }),
    [previewRows],
  );

  const handleContextChange = (key, value) => {
    setFilters((current) => {
      if (key === "universityId") {
        const nextExamId = exams.find((exam) => exam.universityId === value)?.id ?? "";
        return { universityId: value, examId: nextExamId };
      }

      return { ...current, [key]: value };
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const nextParsedFile = await parseWorkbookFile(file);
      setSelectedFileName(file.name);
      setParsedFile(nextParsedFile);
      setMapping(getAutoMapping(nextParsedFile.headers));
      showToast(`Loaded ${file.name} for mapping review`, "success");
    } catch (error) {
      showToast(error.message, "error");
    }
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
    } catch {
      showToast("Unable to download the import sample right now", "error");
    }
  };

  const handleConfirmImport = async () => {
    if (!filters.universityId || !filters.examId) {
      showToast("Select the university and exam session before confirming import", "warning");
      return;
    }

    if (!previewRows.length) {
      showToast("Upload a file and map its columns first", "warning");
      return;
    }

    if (previewStats.missingCode > 0) {
      showToast("Please map Paper Code correctly before import. Some rows are still missing it.", "warning");
      return;
    }

    try {
      const csvContent = buildCanonicalCsv(previewRows);
      const uploadFile = new File([csvContent], "mapped-paper-import.csv", { type: "text/csv;charset=utf-8" });
      const summary = await importPapers(uploadFile, filters);
      showToast(`Import complete: ${summary.created} created, ${summary.updated} updated`, "success");
      navigate("/papers");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Paper Import Studio</h3>
            <p className="text-xs text-slate-400">
              Upload any Excel or CSV layout, map its columns to our paper schema, review the analyzed rows, then confirm the import.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate("/papers")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 transition-colors hover:bg-slate-100">
              Back To Paper Entry
            </button>
            <button type="button" onClick={handleDownloadSample} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 transition-colors hover:bg-slate-100">
              Download Sample
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
              {visibleExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
              <input type="file" accept=".csv,text/csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              Upload File
            </label>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {selectedFileName ? `Loaded file: ${selectedFileName}` : "No file loaded yet. Choose a workbook or CSV to begin mapping."}
        </div>
      </div>

      {parsedFile ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h4 className="text-sm font-bold text-slate-900">Column Mapping</h4>
              <p className="text-xs text-slate-400">
                Match workbook columns to our schema. Auto-mapping is prefilled, and you can change any field before confirming the import.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{field.label}</label>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="">-- Leave Unmapped --</option>
                    {parsedFile.headers.map((header) => (
                      <option key={header.value} value={header.value}>
                        {header.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard title="Parsed Rows" value={previewStats.total} hint="Rows read from workbook after sheet merge" />
            <SummaryCard title="Ready Rows" value={previewStats.ready} hint="Rows with mapped paper code available" />
            <SummaryCard title="Missing Code" value={previewStats.missingCode} hint="These must be fixed before import" />
            <SummaryCard title="Rows With Date" value={previewStats.withDate} hint="Exam date normalized from mapped source column" />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Analyzed Preview</h4>
                <p className="text-xs text-slate-400">
                  Review the mapped data below. Existing paper codes inside the selected exam session will update instead of duplicating.
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !previewRows.length}
                onClick={handleConfirmImport}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                Confirm & Import
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Paper Code</th>
                    <th className="px-4 py-3">SCode</th>
                    <th className="px-4 py-3">Paper Name</th>
                    <th className="px-4 py-3">Course Name</th>
                    <th className="px-4 py-3">Subject Name</th>
                    <th className="px-4 py-3">Paper Type</th>
                    <th className="px-4 py-3">Annual / Semester</th>
                    <th className="px-4 py-3">QTY</th>
                    <th className="px-4 py-3">Exam Date</th>
                    <th className="px-4 py-3">Exam Time</th>
                    <th className="px-4 py-3">Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {previewRows.slice(0, PREVIEW_LIMIT).map((row) => (
                    <tr key={`${row.sheetName}-${row.rowNumber}-${row.code || "blank"}`}>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{row.sheetName}</span>
                        <span className="block">Row {row.rowNumber}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.code || "Missing code"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.sCode || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.name || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.course || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.paperTitle || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.paperType || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.year || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.quantity || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatDateString(row.date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.examTime || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.marks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewRows.length > PREVIEW_LIMIT && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-400">
                Showing first {PREVIEW_LIMIT} rows out of {previewRows.length}. The full analyzed set will be imported on confirmation.
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
