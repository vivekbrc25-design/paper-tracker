import { useState } from "react";

import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useFeedback } from "./Feedback.jsx";
import { formatDateString, roles } from "../utils.js";

export function ConfigPage() {
  const { universities, exams, operators, createUniversity, deleteUniversity, createExam, deleteExam, createOperator, deleteOperator } =
    useWorkspace();
  const { confirm, showToast } = useFeedback();

  const [universityName, setUniversityName] = useState("");
  const [operatorForm, setOperatorForm] = useState({ name: "", role: "Typist" });
  const [examForm, setExamForm] = useState({
    universityId: "",
    name: "",
    startDate: "",
    endDate: "",
    receiveDate: "",
    dueDate: "",
  });

  const handleDeleteUniversity = async (university) => {
    const accepted = await confirm(`Remove "${university.name}" from the university master?`);
    if (!accepted) {
      return;
    }
    await deleteUniversity(university.id);
    showToast("University entity removed successfully", "info");
  };

  const handleDeleteExam = async (exam) => {
    const accepted = await confirm(`Remove "${exam.name}" from exam sessions?`);
    if (!accepted) {
      return;
    }
    await deleteExam(exam.id);
    showToast("Exam session removed successfully", "info");
  };

  const handleDeleteOperator = async (operator) => {
    const accepted = await confirm(`Confirm removing "${operator.name}"? Active tasks assigned to this operator will become unassigned.`);
    if (!accepted) {
      return;
    }
    await deleteOperator(operator.id);
    showToast(`Removed operator "${operator.name}" and cleared related assignments`, "info");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex h-fit flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Universities</h3>
              <p className="text-xs text-slate-400">Add or remove recognized academic entities.</p>
            </div>
            <span className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">{universities.length} Active</span>
          </div>

          <form
            className="mb-4 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              await createUniversity({ name: universityName.trim() });
              showToast(`"${universityName.trim()}" added as a recognized university flow`, "success");
              setUniversityName("");
            }}
          >
            <input
              required
              value={universityName}
              onChange={(event) => setUniversityName(event.target.value)}
              placeholder="New University..."
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
            />
            <button type="submit" className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-slate-800">
              Add
            </button>
          </form>
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/40">
            {universities.map((university) => (
              <li key={university.id} className="flex items-center justify-between px-2 py-1.5 text-xs">
                <span className="max-w-[200px] truncate font-medium text-slate-700 dark:text-slate-200">{university.name}</span>
                <button type="button" onClick={() => handleDeleteUniversity(university)} className="rounded p-1 text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex h-fit flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Exam Sessions</h3>
              <p className="text-xs text-slate-400">Define university-linked active semester schedules.</p>
            </div>
            <span className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">{exams.length} Active</span>
          </div>

          <form
            className="mb-4 space-y-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/60 dark:bg-slate-900/30"
            onSubmit={async (event) => {
              event.preventDefault();
              await createExam(examForm);
              showToast(`"${examForm.name}" is now registered`, "success");
              setExamForm({ universityId: "", name: "", startDate: "", endDate: "", receiveDate: "", dueDate: "" });
            }}
          >
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Link to University *</label>
              <select
                required
                value={examForm.universityId}
                onChange={(event) => setExamForm((current) => ({ ...current, universityId: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                <option value="">-- Select University --</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Session Name *</label>
              <input
                required
                value={examForm.name}
                onChange={(event) => setExamForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={examForm.startDate} onChange={(event) => setExamForm((current) => ({ ...current, startDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
              <input type="date" value={examForm.endDate} onChange={(event) => setExamForm((current) => ({ ...current, endDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={examForm.receiveDate} onChange={(event) => setExamForm((current) => ({ ...current, receiveDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
              <input type="date" value={examForm.dueDate} onChange={(event) => setExamForm((current) => ({ ...current, dueDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100" />
            </div>
            <button type="submit" className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800">
              Add Exam Session
            </button>
          </form>
        </div>

        <div className="max-h-[220px] overflow-y-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/40">
            {exams.map((exam) => (
              <li key={exam.id} className="px-2 py-2 text-xs">
                <div className="flex items-start justify-between">
                  <div className="overflow-hidden pr-2">
                    <span className="block truncate font-bold text-slate-800 dark:text-slate-200">{exam.name}</span>
                    <span className="mb-1 inline-block max-w-[170px] truncate text-[10px] font-semibold text-slate-600">{exam.universityName}</span>
                    <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[9px] font-mono text-slate-400 dark:text-slate-500 sm:grid-cols-2">
                      <span>Start: {formatDateString(exam.startDate)}</span>
                      <span>End: {formatDateString(exam.endDate)}</span>
                      <span>Recv: {formatDateString(exam.receiveDate)}</span>
                      <span>Due: {formatDateString(exam.dueDate)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDeleteExam(exam)} className="shrink-0 rounded p-1 text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex h-fit flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#0f172a]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Workspace Operators</h3>
              <p className="text-xs text-slate-400">Register operators and link them to flow roles.</p>
            </div>
            <span className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">{operators.length} Active</span>
          </div>

          <form
            className="mb-4 space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              await createOperator(operatorForm);
              showToast(`Registered "${operatorForm.name}" as active ${operatorForm.role}`, "success");
              setOperatorForm({ name: "", role: "Typist" });
            }}
          >
            <div className="flex gap-2">
              <input
                required
                value={operatorForm.name}
                onChange={(event) => setOperatorForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Operator Name..."
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              />
              <select
                value={operatorForm.role}
                onChange={(event) => setOperatorForm((current) => ({ ...current, role: event.target.value }))}
                className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-100"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button type="submit" className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-slate-800">
                Register
              </button>
            </div>
          </form>
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/40">
            {operators.map((operator) => (
              <li key={operator.id} className="flex items-center justify-between px-2 py-1.5 text-xs">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{operator.name}</span>
                  <span className="font-mono text-[9px] uppercase text-slate-400">{operator.role}</span>
                </div>
                <button type="button" onClick={() => handleDeleteOperator(operator)} className="rounded p-1 text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
