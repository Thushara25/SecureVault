import { useEffect } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle } from "./Icons";

export default function Toast({ msg, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const config = {
    info: { Icon: Info, color: "var(--accent)" },
    success: { Icon: CheckCircle, color: "var(--accent3)" },
    error: { Icon: XCircle, color: "var(--danger)" },
    warn: { Icon: AlertTriangle, color: "var(--warning)" },
  };

  const { Icon, color } = config[type] || config.info;

  return (
    <div className="toast">
      <span className="toast-icon" style={{ color, display: "flex" }}><Icon size={16} /></span>
      <span style={{ color: "var(--text)" }}>{msg}</span>
    </div>
  );
}
