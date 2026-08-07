import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { fetchStudents, exportStudentsToExcel } from "../../services/adminStudentService";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/**
 * StudentRecordsScreen — real per-student data (assessment results,
 * roadmap progress, learning-streak activity, Firebase Auth email),
 * joined by services/student_records_service.py. Nothing here is
 * placeholder/demo data — a student with no completed assessment
 * simply doesn't appear, and "—" means a field genuinely doesn't
 * exist yet for that student (e.g. no roadmap generated), not a
 * loading glitch.
 */
export default function StudentRecordsScreen() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStudents();
      setStudents(data || []);
    } catch (err) {
      setError(err.message || "Couldn't load student records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    setExportError("");
    setExporting(true);
    try {
      await exportStudentsToExcel();
    } catch (err) {
      setExportError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Student Records</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            Every student's diagnostic results, skill-by-skill quiz attempts, and roadmap progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5"
            style={{ borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)", color: COLORS.textMid, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
          <motion.button
            onClick={handleExport}
            disabled={exporting}
            whileHover={{ y: -2 }}
            className="flex items-center gap-2 text-sm font-semibold"
            style={{
              padding: "10px 20px", borderRadius: 9999, background: GRADIENTS.purplePink,
              color: "#fff", border: "none", cursor: exporting ? "default" : "pointer",
              opacity: exporting ? 0.7 : 1, boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
            }}
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Export to Excel
          </motion.button>
        </div>
      </div>

      {exportError && <p className="text-xs font-medium mb-3" style={{ color: "#DC2626" }}>{exportError}</p>}

      <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading student records…</p>
        ) : error ? (
          <p className="text-sm p-6" style={{ color: "#DC2626" }}>{error}</p>
        ) : students.length === 0 ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            No students have completed an assessment yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {[
                    "Email", "Role", "Skills Assessed", "Overall Score",
                    "Roadmap Progress", "Active Days", "Assessment Date",
                  ].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: COLORS.textLight }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.uid} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: COLORS.textDark }}>{s.email}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{s.role || "—"}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{s.skillsAssessed}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMid }}>
                      {s.overallScorePercent != null ? `${s.overallScorePercent}%` : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMid }}>
                      {s.roadmapCompletionPercent != null
                        ? `${s.roadmapCompletionPercent}% (${s.roadmapMasteredCount}/${s.roadmapTotalSkills})`
                        : "Not generated yet"}
                    </td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{s.activeDays}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.textMid }}>{formatDate(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
