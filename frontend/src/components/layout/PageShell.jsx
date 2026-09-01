import FloatingOrbs from "../common/FloatingOrbs";
import { GRADIENTS } from "../../constants/theme";

export default function PageShell({ children }) {
  return (
    // overflowX only (not overflow: hidden on both axes) — FloatingOrbs
    // already self-clips via its own inset:0/overflow:hidden div below,
    // so this only needs to guard against a horizontal scrollbar from
    // the orbs' negative top/left offsets. `overflow: hidden` on both
    // axes here previously made this div register as a scroll
    // container for CSS purposes, which broke AdminDashboardLayout's
    // `position: sticky` sidebar — a long pending-review/resource list
    // pushed the sidebar up and away instead of it staying pinned to
    // the viewport while the content column scrolled.
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflowX: "hidden", background: GRADIENTS.pageBg }}>
      <FloatingOrbs />
      <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
    </div>
  );
}
