import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * Admin Question Bank service. Screens/hooks never call apiClient or
 * ENDPOINTS directly — everything about "how" a question is fetched/saved
 * lives here, same convention as roleService.js / skillService.js.
 */

export async function fetchQuestions(filters = {}) {
  const params = {};
  if (filters.skill) params.skill = filters.skill;
  if (filters.difficulty) params.difficulty = filters.difficulty;
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;

  const { data } = await apiClient.get(ENDPOINTS.ADMIN.QUESTIONS.LIST, { params });
  return data.data; // unwrap the { success, message, data } envelope
}

export async function createQuestion(payload) {
  const { data } = await apiClient.post(ENDPOINTS.ADMIN.QUESTIONS.CREATE, payload);
  return data.data;
}

export async function updateQuestion(questionId, payload) {
  const { data } = await apiClient.put(ENDPOINTS.ADMIN.QUESTIONS.UPDATE(questionId), payload);
  return data.data;
}

export async function setQuestionStatus(questionId, status) {
  const { data } = await apiClient.patch(ENDPOINTS.ADMIN.QUESTIONS.SET_STATUS(questionId), {
    Status: status,
  });
  return data.data;
}

export async function extractQuestionsFromPdf(file) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await apiClient.post(ENDPOINTS.ADMIN.QUESTIONS.EXTRACT_PDF, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data; // array of candidate question rows, not yet saved
}
