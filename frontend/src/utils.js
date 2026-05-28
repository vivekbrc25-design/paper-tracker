export const statuses = ["Typing", "Proof Reading", "Correction", "Final Reading", "Completed"];
export const roles = ["Typist", "Proof Reader", "Corrector", "Final Reader"];
export const statusRoleMap = {
  Typing: "Typist",
  "Proof Reading": "Proof Reader",
  Correction: "Corrector",
  "Final Reading": "Final Reader",
};

export function normalizeDateValue(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    return "";
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return "";
  }

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }

  const displayDateMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (displayDateMatch) {
    return `${displayDateMatch[3]}-${displayDateMatch[2]}-${displayDateMatch[1]}`;
  }

  const slashDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDateMatch) {
    return `${slashDateMatch[3]}-${slashDateMatch[2]}-${slashDateMatch[1]}`;
  }

  return trimmed;
}

export function formatDateString(dateStr) {
  const normalizedDate = normalizeDateValue(dateStr);
  if (!normalizedDate) {
    return "-";
  }

  const parts = normalizedDate.split("-");
  if (parts.length !== 3) {
    return normalizedDate;
  }
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function statusBadgeClasses(status) {
  switch (status) {
    case "Typing":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 ring-blue-600/10";
    case "Proof Reading":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 ring-amber-600/10";
    case "Correction":
      return "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 ring-rose-600/10";
    case "Final Reading":
      return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 ring-purple-600/10";
    case "Completed":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 ring-emerald-600/10";
    default:
      return "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-slate-500/10";
  }
}

export function roleBadgeClasses(role) {
  if (role === "Proof Reader") {
    return "text-amber-500 bg-amber-500/10";
  }
  if (role === "Corrector") {
    return "text-rose-500 bg-rose-500/10";
  }
  if (role === "Final Reader") {
    return "text-purple-500 bg-purple-500/10";
  }
  return "text-blue-500 bg-blue-500/10";
}

export function getDueBadge(exam) {
  if (!exam?.dueDate) {
    return {
      label: "Unbounded",
      className: "bg-slate-500/10 text-slate-500",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(exam.dueDate);
  const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return {
      label: `Overdue (${Math.abs(diff)}d)`,
      className: "bg-red-500/15 text-red-500 ring-1 ring-red-500/30",
    };
  }
  if (diff <= 7) {
    return {
      label: `Due in ${diff}d`,
      className: "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30",
    };
  }
  return {
    label: "On Track",
    className: "bg-blue-500/10 text-blue-500",
  };
}
