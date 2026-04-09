import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Download, Copy, LogOut, ShieldLock } from "./Icons";

export default function SettingsModule({ user, onLogout, toast }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.query("profiles").select("*").eq("id", user.id).get()
      .then(({ data }) => setProfile(data?.[0]));
  }, [user.id]);

  const downloadPrivKey = async () => {
    const encKey = localStorage.getItem(`sv_priv_${user.id}`);
    if (!encKey) return toast("No private key in localStorage", "error");
    const blob = new Blob([encKey], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "securevault-private-key.enc";
    a.click();
    toast("Encrypted private key downloaded", "success");
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Account */}
      <div className="card mb-16">
        <div className="label mb-8">Account</div>
        <div className="info-row">
          <span className="info-label">Email</span>
          <span className="info-value" style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{user.email}</span>
        </div>
        <div className="info-row">
          <span className="info-label">User ID</span>
          <span className="info-value" style={{ fontSize: 11, color: "var(--text4)", fontFamily: "var(--mono)" }}>{user.id}</span>
        </div>
      </div>

      {/* Public Key */}
      {profile?.public_key && (
        <div className="card mb-16">
          <div className="label mb-8">RSA-2048 Public Key</div>
          <div className="key-display">{profile.public_key}</div>
          <button
            className="btn btn-ghost btn-sm mt-8"
            onClick={() => navigator.clipboard.writeText(profile.public_key).then(() => toast("Public key copied", "success"))}
          >
            <Copy size={13} /> Copy Public Key
          </button>
        </div>
      )}

      {/* Security */}
      <div className="card mb-16">
        <div className="label mb-8">Security</div>
        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={downloadPrivKey}><Download size={13} /> Backup Private Key</button>
        </div>
        <div className="text-muted mt-8" style={{ lineHeight: 1.6 }}>
          Your private key is stored encrypted in this browser's localStorage. Back it up to restore access from other devices.
        </div>
      </div>

      {/* Encryption Architecture */}
      <div className="card card-success mb-16">
        <div className="label mb-12">Encryption Architecture</div>
        <div className="arch-layers">
          <div className="arch-layer">
            <div className="arch-number">1</div>
            <div>
              <div className="arch-name">Vigenère Cipher</div>
              <div className="arch-desc">Classical obfuscation layer</div>
            </div>
          </div>
          <div className="arch-layer">
            <div className="arch-number">2</div>
            <div>
              <div className="arch-name">AES-256-CBC</div>
              <div className="arch-desc">Symmetric bulk encryption</div>
            </div>
          </div>
          <div className="arch-layer">
            <div className="arch-number">3</div>
            <div>
              <div className="arch-name">RSA-2048 OAEP</div>
              <div className="arch-desc">Asymmetric key wrapping</div>
            </div>
          </div>
          <div className="arch-layer">
            <div className="arch-number">4</div>
            <div>
              <div className="arch-name">PBKDF2-SHA256</div>
              <div className="arch-desc">Key derivation — 100k iterations</div>
            </div>
          </div>
        </div>
        <div className="text-muted mt-12" style={{ fontFamily: "var(--mono)", lineHeight: 1.7 }}>
          Zero-knowledge: server stores only ciphertext.{"\n"}
          Private key never leaves your device unencrypted.
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card card-danger">
        <div className="label mb-8" style={{ color: "var(--danger)" }}>Danger Zone</div>
        <button className="btn btn-danger" onClick={async () => { await supabase.signOut(); onLogout(); }}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
}
