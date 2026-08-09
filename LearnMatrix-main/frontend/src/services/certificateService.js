import { CERTIFICATES } from "../constants/certificates";

export async function getCertificates() {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.CERTIFICATES.LIST);
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve(CERTIFICATES);
}

export async function verifyCertificate(certificateId) {
  // ---- FUTURE (Flask) ----
  // const { data } = await apiClient.get(ENDPOINTS.CERTIFICATES.VERIFY(certificateId));
  // return data;

  // ---- CURRENT (dummy/local) ----
  return Promise.resolve({ certificateId, verified: true, checkedAt: new Date().toISOString() });
}
