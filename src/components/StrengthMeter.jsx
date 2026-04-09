import { getStrength } from "../lib/crypto";

export default function StrengthMeter({ password }) {
  const score = getStrength(password);
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "#f87171", "#fbbf24", "#fb923c", "#34d399", "#38bdf8"];

  return (
    <div className="strength-container">
      <div className="strength-bar">
        <div
          className="strength-fill"
          style={{ width: `${score * 20}%`, background: colors[score], color: colors[score] }}
        />
      </div>
      <div className="strength-label" style={{ color: colors[score] }}>
        {labels[score]}
      </div>
    </div>
  );
}
