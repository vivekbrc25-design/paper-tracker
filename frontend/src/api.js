import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
});

export function setAuthToken(token) {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("paperflow_auth_token", token);
    return;
  }
  delete client.defaults.headers.common.Authorization;
  localStorage.removeItem("paperflow_auth_token");
}

const storedToken = localStorage.getItem("paperflow_auth_token");
if (storedToken) {
  setAuthToken(storedToken);
}

function formatValidationDetail(detail) {
  if (!Array.isArray(detail) || detail.length === 0) {
    return "";
  }

  return detail
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      const location = Array.isArray(entry?.loc) ? entry.loc.join(" > ") : "";
      const message = typeof entry?.msg === "string" ? entry.msg : "";

      if (location && message) {
        return `${location}: ${message}`;
      }

      return message || JSON.stringify(entry);
    })
    .filter(Boolean)
    .join("; ");
}

function getErrorMessage(error) {
  const responseData = error.response?.data;
  const detail = responseData?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  const validationMessage = formatValidationDetail(detail);
  if (validationMessage) {
    return validationMessage;
  }

  if (typeof responseData?.message === "string" && responseData.message.trim()) {
    return responseData.message.trim();
  }

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.trim();
  }

  if (typeof error.message === "string" && error.message.trim() && !error.message.includes("status code")) {
    return error.message.trim();
  }

  if (error.response?.status) {
    return `Request failed (${error.response.status}).`;
  }

  return "Request failed.";
}

function unwrap(promise) {
  return promise.then((response) => response.data).catch((error) => {
    throw new Error(getErrorMessage(error));
  });
}

export const workspaceApi = {
  login: (payload) => unwrap(client.post("/api/auth/login", payload)),
  getSession: () => unwrap(client.get("/api/auth/session")),
  getBootstrap: () => unwrap(client.get("/api/bootstrap")),
  resetWorkspace: () => unwrap(client.post("/api/reset")),
  createUniversity: (payload) => unwrap(client.post("/api/universities", payload)),
  deleteUniversity: (id) => unwrap(client.delete(`/api/universities/${id}`)),
  createExam: (payload) => unwrap(client.post("/api/exams", payload)),
  deleteExam: (id) => unwrap(client.delete(`/api/exams/${id}`)),
  createOperator: (payload) => unwrap(client.post("/api/operators", payload)),
  deleteOperator: (id) => unwrap(client.delete(`/api/operators/${id}`)),
  createPaper: (payload) => unwrap(client.post("/api/papers", payload)),
  downloadPaperImportSample: () => client.get("/api/papers/import-sample", { responseType: "blob" }),
  importPapers: (file, payload) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("universityId", payload.universityId);
    formData.append("examId", payload.examId);
    return unwrap(client.post("/api/papers/import", formData));
  },
  updatePaper: (id, payload) => unwrap(client.patch(`/api/papers/${id}`, payload)),
  deletePaper: (id) => unwrap(client.delete(`/api/papers/${id}`)),
  bulkUpdatePapers: (payload) => unwrap(client.post("/api/papers/bulk-update", payload)),
  bulkDeletePapers: (payload) => unwrap(client.post("/api/papers/bulk-delete", payload)),
};
