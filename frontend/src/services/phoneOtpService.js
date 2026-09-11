import apiClient from "../api/axiosClient";

// Backend returns { success:false, error:"..." } with a 400/500 status
// for OTP failures (bad code, expired, too many attempts, Fast2SMS
// rejection) — axios throws on that status, so the friendly message
// lives on err.response.data.error, not err.message.
function friendlyError(err, fallback) {
  return new Error(err?.response?.data?.error || fallback);
}

export async function sendPhoneOtp(mobile) {
  try {
    await apiClient.post("/phone-otp/send", { mobile });
  } catch (err) {
    throw friendlyError(err, "Couldn't send the OTP. Please try again.");
  }
}

export async function verifyPhoneOtp(mobile, code) {
  try {
    await apiClient.post("/phone-otp/verify", { mobile, code });
  } catch (err) {
    throw friendlyError(err, "Couldn't verify that code.");
  }
}
