import { GraduationCap, Award, Star } from "lucide-react";
import { COLORS } from "../../../constants/theme";

/**
 * CertificateTemplate — the actual certificate graphic (not a summary
 * card), matching LearnMatrix's navy/gold certificate design. Every
 * field is real:
 *   studentName    -> the student's live profile name (never stored on
 *                      the certificate record itself, see
 *                      services/certificateService.js)
 *   courseName      -> certificate.courseName (the career path they started)
 *   completedOn     -> certificate.completedOn ("YYYY-MM-DD", set by the
 *                      backend the moment their roadmap is fully mastered)
 *   certificateId   -> certificate.certificateId (e.g. "LMX-2026-05018")
 *
 * Only meant to be rendered for a certificate with status "completed" —
 * a certificate still in_progress has no completion date to show, so
 * CertificatesGridCard.jsx doesn't offer this view until then.
 */
export default function CertificateTemplate({ studentName, courseName, completedOn, certificateId }) {
  return (
    <div
      className="relative w-full aspect-[3/2] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${COLORS.lavender} 0%, #FFFDF7 60%, ${COLORS.lavender} 100%)`,
        border: `2px solid ${COLORS.purple}`,
        borderRadius: 12,
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {/* inner gold hairline frame */}
      <div
        className="absolute inset-3 pointer-events-none"
        style={{ border: `1px solid ${COLORS.purple}`, borderRadius: 8 }}
      />

      {/* corner ribbon accents */}
      <div
        className="absolute -top-10 -left-10 w-28 h-28 rotate-45"
        style={{ background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.sky})`, opacity: 0.9 }}
      />
      <div
        className="absolute -bottom-10 -right-10 w-28 h-28 rotate-45"
        style={{ background: `linear-gradient(135deg, ${COLORS.sky}, ${COLORS.purple})`, opacity: 0.9 }}
      />

      <div className="relative h-full flex flex-col px-10 py-6 sm:px-14 sm:py-8">
        {/* header row */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                style={{ border: `2px solid ${COLORS.purple}`, borderRadius: 6 }}
              >
                <GraduationCap size={18} color={COLORS.purple} />
              </div>
              <p className="text-sm font-bold tracking-wide" style={{ color: COLORS.sky }}>
                LEARN<span style={{ color: COLORS.purple }}>MATRIX</span>
              </p>
            </div>
            <p className="text-[9px] tracking-[0.15em] mt-0.5 font-sans" style={{ color: COLORS.textLight }}>
              LEARN SMART. GROW FASTER.
            </p>
          </div>

          <p className="text-[10px] font-sans" style={{ color: COLORS.textMid }}>
            Certificate ID: <span className="font-semibold">{certificateId}</span>
          </p>
        </div>

        {/* title block */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 -mt-2">
          <GraduationCap size={22} color={COLORS.purple} />
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-wide"
            style={{ color: COLORS.sky }}
          >
            CERTIFICATE
          </h1>
          <p className="text-sm sm:text-base tracking-[0.3em] font-semibold" style={{ color: COLORS.purple }}>
            OF COMPLETION
          </p>

          <p className="text-xs mt-2 font-sans" style={{ color: COLORS.textMid }}>
            This is to certify that
          </p>

          <p
            className="text-xl sm:text-2xl font-bold mt-1 pb-1 px-6"
            style={{ color: COLORS.sky, borderBottom: `1px solid ${COLORS.purple}` }}
          >
            {studentName}
          </p>

          <p className="text-xs mt-3 font-sans" style={{ color: COLORS.textMid }}>
            has successfully completed the course
          </p>
          <p className="text-base sm:text-lg font-bold" style={{ color: COLORS.purple }}>
            {courseName} Roadmap
          </p>
          <p className="text-[11px] font-sans" style={{ color: COLORS.textMid }}>
            offered by LearnMatrix AI Learning Assistant.
          </p>
          <p className="text-xs font-sans mt-1" style={{ color: COLORS.textMid }}>
            Completed on: <span className="font-semibold" style={{ color: COLORS.purple }}>{completedOn}</span>
          </p>
        </div>

        {/* footer tagline pill */}
        <div className="flex justify-center">
          <div
            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-sans font-semibold"
            style={{ border: `1px solid ${COLORS.purple}`, borderRadius: 999, color: COLORS.sky }}
          >
            <Star size={11} color={COLORS.purple} /> Learn Smart. Grow Faster. <Star size={11} color={COLORS.purple} />
          </div>
        </div>
      </div>

      {/* medal badge */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-8 flex flex-col items-center">
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${COLORS.pink}, ${COLORS.purple} 70%)`,
            border: `2px solid ${COLORS.sky}`,
          }}
        >
          <Award size={30} color={COLORS.sky} />
        </div>
        <p
          className="text-[7px] font-bold tracking-wide mt-1 text-center leading-tight font-sans"
          style={{ color: COLORS.sky }}
        >
          LEARN
          <br />
          ACHIEVE
          <br />
          GROW
        </p>
      </div>
    </div>
  );
}
