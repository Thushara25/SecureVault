import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { generateRSAKeyPair, aesEncrypt, aesDecrypt } from "../lib/crypto";
import StrengthMeter from "./StrengthMeter";

const SUPABASE_URL = "https://syqwkddyqfucltkxhqpx.supabase.co";

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const isConfigured = SUPABASE_URL !== "https://YOUR_PROJECT.supabase.co";

  const handleSubmit = async () => {
    if (!email || !password) return setErr("Email and password required");
    if (password.length < 6) return setErr("Password must be at least 6 characters");
    setLoading(true); setErr(""); setInfo("");
    try {
      if (mode === "login") {
        const res = await supabase.signIn(email, password);
        const privKey = localStorage.getItem(`sv_priv_${res.user.id}`);
        if (!privKey) {
          setErr("Private key not found in this browser. Did you sign up from a different device?");
          await supabase.signOut(); setLoading(false); return;
        }
        const decryptedPriv = await aesDecrypt(privKey, password);
        onLogin({ ...res.user, privateKey: decryptedPriv });
      } else {
        setInfo("Generating RSA-2048 keypair…");
        const { publicKey, privateKey } = await generateRSAKeyPair();
        const encryptedPriv = await aesEncrypt(privateKey, password);
        const res = await supabase.signUp(email, password);
        const userId = res.user?.id || res.id;
        if (!userId) throw new Error("Signup failed - no user ID returned");
        localStorage.setItem(`sv_priv_${userId}`, encryptedPriv);
        if (res.access_token) supabase.accessToken = res.access_token;
        await new Promise(r => setTimeout(r, 800));
        try {
          await supabase.query("profiles").insert({ id: userId, email, public_key: publicKey, encrypted_private_key: encryptedPriv });
        } catch (profileErr) {
          console.warn("Profile insert:", profileErr.message);
        }
        supabase.accessToken = null;
        setInfo("Account created! You can now log in.");
        setMode("login");
      }
    } catch (e) {
      setErr(e.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      {/* Animated Background */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="grid-overlay" />

      <div className="auth-card-wrapper">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔐</div>
          <div className="auth-title">SecureVault</div>
          <div className="auth-subtitle">Zero-knowledge encrypted vault</div>
        </div>

        {!isConfigured && (
          <div className="config-warning">
            ⚠ Configure Supabase first!{"\n"}
            Open SecureVault.jsx → replace SUPABASE_URL & SUPABASE_ANON_KEY{"\n"}
            Then run the SQL in README.
          </div>
        )}

        <div className="auth-glass">
          <div className="tab-group mb-24">
            {["login", "signup"].map(m => (
              <button
                key={m}
                className={`tab-btn ${mode === m ? "active" : ""}`}
                onClick={() => { setMode(m); setErr(""); setInfo(""); }}
              >
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="form-group">
            <label className="label">Master Password</label>
            <input
              className="input"
              type="password"
              placeholder="Strong master password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            {mode === "signup" && password && (
              <div style={{ marginTop: 8 }}>
                <StrengthMeter password={password} />
              </div>
            )}
          </div>

          {err && <div className="text-danger mb-12">⚠ {err}</div>}
          {info && <div style={{ fontSize: 12, color: "var(--accent3)", marginBottom: 12 }}>✓ {info}</div>}

          <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={loading || !isConfigured}>
            {loading ? <><span className="spin" /> Processing…</> : mode === "login" ? "Log In →" : "Create Account"}
          </button>

          {mode === "signup" && (
            <div className="text-muted mt-16" style={{ textAlign: "center", lineHeight: 1.6 }}>
              🔒 RSA keypair generated locally. Master password never leaves your device.
            </div>
          )}

          {mode === "login" && (
            <div className="mt-16" style={{ textAlign: "center" }}>
              <div className="pipeline">
                <div className="pipeline-step"><span className="pipeline-icon">🔑</span> Vigenère</div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-step"><span className="pipeline-icon">🛡</span> AES-256</div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-step"><span className="pipeline-icon">🔐</span> RSA-2048</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
