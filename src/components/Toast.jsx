import { useEffect } from "react";

export default function Toast({ msg, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const config = {
    info: { icon: "ℹ", color: "var(--accent)" },
    success: { icon: "✓", color: "var(--accent3)" },
    error: { icon: "✗", color: "var(--danger)" },
    warn: { icon: "⚠", color: "var(--warning)" },
  };

  const { icon, color } = config[type] || config.info;

  return (
    <div className="toast">
      <span className="toast-icon" style={{ color }}>{icon}</span>
      <span style={{ color: "var(--text)" }}>{msg}</span>
    </div>
  );
}
