import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
});

function unwrap(promise) {
  return promise.then((response) => response.data).catch((error) => {
    const detail = error.response?.data?.detail;
    throw new Error(typeof detail === "string" ? detail : "Request failed.");
  });
}

export const workspaceApi = {
  getBootstrap: () => unwrap(client.get("/api/bootstrap")),
  resetWorkspace: () => unwrap(client.post("/api/reset")),
  createUniversity: (payload) => unwrap(client.post("/api/universities", payload)),
  deleteUniversity: (id) => unwrap(client.delete(`/api/universities/${id}`)),
  createExam: (payload) => unwrap(client.post("/api/exams", payload)),
  deleteExam: (id) => unwrap(client.delete(`/api/exams/${id}`)),
  createOperator: (payload) => unwrap(client.post("/api/operators", payload)),
  deleteOperator: (id) => unwrap(client.delete(`/api/operators/${id}`)),
  createPaper: (payload) => unwrap(client.post("/api/papers", payload)),
  updatePaper: (id, payload) => unwrap(client.patch(`/api/papers/${id}`, payload)),
  deletePaper: (id) => unwrap(client.delete(`/api/papers/${id}`)),
  bulkUpdatePapers: (payload) => unwrap(client.post("/api/papers/bulk-update", payload)),
  bulkDeletePapers: (payload) => unwrap(client.post("/api/papers/bulk-delete", payload)),
};
