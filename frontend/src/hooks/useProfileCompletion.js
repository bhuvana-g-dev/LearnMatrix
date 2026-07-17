import { useState, useEffect, useCallback } from "react";
import { getUserProfileDoc } from "../services/userProfileService";

/**
 * useProfileCompletion — checks Firestore for users/{uid} and reports
 * whether the person has filled in college/department/year/mobile/pic
 * yet. Used by App.jsx to force the CompleteProfileScreen right after
 * email verification, on every login, until profileComplete is true.
 */
export function useProfileCompletion(user) {
  const [status, setStatus] = useState("loading"); // loading | incomplete | complete

  const check = useCallback(async () => {
    if (!user) return;
    setStatus("loading");
    try {
      const data = await getUserProfileDoc(user.uid);
      setStatus(data?.profileComplete ? "complete" : "incomplete");
    } catch {
      // If Firestore isn't reachable, don't block the whole app —
      // treat as incomplete so the person can try filling it in again.
      setStatus("incomplete");
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    check();
  }, [user, check]);

  return { status, recheck: check };
}
