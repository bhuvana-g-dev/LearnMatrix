import { Award, Sparkles } from "lucide-react";
import SectionCard from "../SectionCard";
import CertificateStatsCards from "./CertificateStatsCards";
import CertificateFilters from "./CertificateFilters";
import CertificateCard from "./CertificateCard";
import CertificateSkeleton from "./CertificateSkeleton";
import CertificatePreviewModal from "./CertificatePreviewModal";
import { useCertificates } from "../../../hooks/useCertificates";
import { GRADIENTS, COLORS } from "../../../constants/theme";

/**
 * Certificates — premium, Coursera-style certificate wall. Sits inside
 * the My Profile page as its own SectionCard, matching every other
 * section's glass/gradient/animation language. All data comes from
 * useCertificates() (backed by certificateService.js, mock today).
 */
export default function CertificatesSection() {
  const {
    certificates,
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
  } = useCertificates();

  const handleDownload = (cert) => {
    // ---- FUTURE (Flask) ---- window.open(cert.downloadUrl, "_blank")
    alert(`Downloading PDF for: ${cert.courseName}`);
  };

  const handleShareLinkedIn = (cert) => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cert.verificationUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async (cert) => {
    try {
      await navigator.clipboard.writeText(cert.verificationUrl);
      alert("Verification link copied to clipboard!");
    } catch {
      alert(cert.verificationUrl);
    }
  };

  const handleVerify = async (cert) => {
    const result = await verify(cert);
    alert(result.verified ? "Certificate verified ✅" : "Verification pending.");
  };

  return (
    <SectionCard icon={Award} title="Certificates" subtitle="Earned on LearnMatrix" delay={0.28}>
      {loading ? (
        <CertificateSkeleton />
      ) : (
        <>
          <CertificateStatsCards stats={stats} />
          <CertificateFilters
            search={search}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            sortBy={sortBy}
            onSortBy={setSortBy}
          />

          {certificates.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {certificates.map((cert, i) => (
                <CertificateCard
                  key={cert.id}
                  certificate={cert}
                  delay={i * 0.05}
                  onView={openPreview}
                  onDownload={handleDownload}
                  onShareLinkedIn={handleShareLinkedIn}
                  onCopyLink={handleCopyLink}
                  onVerify={handleVerify}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: GRADIENTS.purpleSky }}
              >
                <Sparkles size={18} color="#fff" />
              </div>
              <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>No certificates match your filters</p>
              <p className="text-xs mt-1" style={{ color: COLORS.textMid }}>
                Try a different search term or switch back to "All".
              </p>
            </div>
          )}
        </>
      )}

      <CertificatePreviewModal
        certificate={previewCert}
        onClose={closePreview}
        onDownload={handleDownload}
        onShareLinkedIn={handleShareLinkedIn}
        onCopyLink={handleCopyLink}
      />
    </SectionCard>
  );
}
