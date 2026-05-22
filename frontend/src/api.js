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

function unwrap(promise) {
  return promise.then((response) => response.data).catch((error) => {
    const detail = error.response?.data?.detail;
    throw new Error(typeof detail === "string" ? detail : "Request failed.");
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
