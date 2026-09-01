import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * Admin Student Records service (backend: routes/admin_student_routes.py).
 * Real data only — every field traces back to an actual Firestore
 * document (assessment_results / roadmaps / learning_activity) or
 * Firebase Auth itself. No client-side aggregation of fake numbers.
 */

export async function fetchStudents() {
  const { data } = await apiClient.get(ENDPOINTS.ADMIN.STUDENTS.LIST);
  return data.data;
}

/**
 * Permanently deletes one student — Firestore records AND their
 * Firebase Auth account (backend: services/user_deletion_service.py).
 * Irreversible; there's no undo and no Firebase console step needed.
 */
export async function deleteStudent(uid) {
  const { data } = await apiClient.delete(ENDPOINTS.ADMIN.STUDENTS.DELETE(uid));
  return data.data;
}

/**
 * Downloads the two-sheet Student Summary + Quiz Attempts .xlsx
 * straight from the browser — the file is built server-side
 * (services/student_records_service.py via openpyxl), this just
 * triggers the save-as.
 */
export async function exportStudentsToExcel() {
  const response = await apiClient.get(ENDPOINTS.ADMIN.STUDENTS.EXPORT, {
    responseType: "blob",
    timeout: 30000, // building the workbook touches every student's records, give it room
  });

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = "learnmatrix-student-records.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
