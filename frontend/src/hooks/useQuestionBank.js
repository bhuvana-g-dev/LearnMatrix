import { useState, useEffect, useCallback } from "react";
import {
  fetchQuestions,
  createQuestion,
  updateQuestion,
  setQuestionStatus,
} from "../services/adminQuestionService";

const EMPTY_FILTERS = { skill: "", role: "", difficulty: "", status: "", search: "" };

/**
 * useQuestionBank — owns everything the Question Bank screen needs:
 * the question list, filter/search state, loading/error flags, and CRUD
 * actions. Screens receive plain props/callbacks and never call
 * adminQuestionService directly.
 */
export function useQuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const refresh = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuestions(activeFilters);
      setQuestions(data || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load.
  useEffect(() => {
    refresh(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      refresh(next);
      return next;
    });
  }, [refresh]);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    refresh(EMPTY_FILTERS);
  }, [refresh]);

  const addQuestion = useCallback(async (payload) => {
    const created = await createQuestion(payload);
    await refresh();
    return created;
  }, [refresh]);

  const editQuestion = useCallback(async (questionId, payload) => {
    const updated = await updateQuestion(questionId, payload);
    await refresh();
    return updated;
  }, [refresh]);

  const deactivateQuestion = useCallback(async (questionId) => {
    await setQuestionStatus(questionId, "Inactive");
    await refresh();
  }, [refresh]);

  const reactivateQuestion = useCallback(async (questionId) => {
    await setQuestionStatus(questionId, "Active");
    await refresh();
  }, [refresh]);

  return {
    questions,
    loading,
    error,
    filters,
    updateFilter,
    clearFilters,
    refresh,
    addQuestion,
    editQuestion,
    deactivateQuestion,
    reactivateQuestion,
  };
}
