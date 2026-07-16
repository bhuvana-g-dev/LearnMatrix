import { useState, useEffect, useMemo, useCallback } from "react";
import { getCertificates, verifyCertificate } from "../services/certificateService";

/**
 * useCertificates — owns all state for the Certificates section: loading,
 * the raw list (from certificateService.js, mock today), search/filter/sort
 * controls, the derived visible list, and the full-screen preview modal.
 */
export function useCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All | Verified | Pending | Completed
  const [sortBy, setSortBy] = useState("Latest"); // Latest | Oldest | Highest Score
  const [previewCert, setPreviewCert] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getCertificates();
      if (!mounted) return;
      setCertificates(data);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleCertificates = useMemo(() => {
    let list = [...certificates];

    if (statusFilter !== "All") {
      list = list.filter((c) => c.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.courseName.toLowerCase().includes(q) ||
          c.careerPath.toLowerCase().includes(q) ||
          c.certificateId.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "Highest Score") return b.score - a.score;
      const dateA = new Date(a.issueDate).getTime();
      const dateB = new Date(b.issueDate).getTime();
      return sortBy === "Oldest" ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [certificates, search, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const total = certificates.length;
    const verified = certificates.filter((c) => c.status === "Verified").length;
    const latest = [...certificates].sort(
      (a, b) => new Date(b.issueDate) - new Date(a.issueDate)
    )[0];
    return {
      total,
      verified,
      coursesCompleted: total,
      latestTitle: latest?.courseName ?? "—",
      latestDate: latest?.issueDate ?? null,
    };
  }, [certificates]);

  const openPreview = useCallback((cert) => setPreviewCert(cert), []);
  const closePreview = useCallback(() => setPreviewCert(null), []);

  const verify = useCallback(async (cert) => {
    const result = await verifyCertificate(cert.certificateId);
    setCertificates((prev) =>
      prev.map((c) =>
        c.id === cert.id ? { ...c, status: result.verified ? "Verified" : c.status } : c
      )
    );
    return result;
  }, []);

  return {
    certificates: visibleCertificates,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    stats,
    previewCert,
    openPreview,
    closePreview,
    verify,
  };
}
