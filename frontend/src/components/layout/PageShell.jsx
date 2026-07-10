import FloatingOrbs from "../common/FloatingOrbs";
import { GRADIENTS } from "../../constants/theme";

export default function PageShell({ children }) {
  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", background: GRADIENTS.pageBg }}>
      <FloatingOrbs />
      <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
    </div>
  );
}
