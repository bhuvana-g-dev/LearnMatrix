import { useState, useEffect, useCallback } from "react";
import { getUserProfileDoc } from "../services/userProfileService";

export function useProfileCompletion(user) {
  const [status, setStatus] = useState("loading"); // loading | incomplete | complete

  const check = useCallback(async () => {
    if (!user) return;
    setStatus("loading");
    try {
      const data = await getUserProfileDoc(user.uid);
      setStatus(data?.profileComplete ? "complete" : "incomplete");
    } catch {
      setStatus("incomplete");
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    check();
  }, [user, check]);

  return { status, recheck: check };
}
