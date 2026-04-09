import { useState, useEffect, useCallback, useRef } from "react";
import { aesDecrypt } from "./lib/crypto";
import { supabase } from "./lib/supabaseClient";
import "./styles/index.css";

import Toast from "./components/Toast";
import AuthScreen from "./components/AuthScreen";
import VaultModule from "./components/VaultModule";
import ShareModule from "./components/ShareModule";
import InboxModule from "./components/InboxModule";
import SettingsModule from "./components/SettingsModule";

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("vault");
  const [toasts, setToasts] = useState([]);
  const [masterPassword, setMasterPassword] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-lock
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef(null);

  const resetLockTimer = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    if (user && masterPassword) {
      lockTimer.current = setTimeout(() => {
        setLocked(true);
        setMasterPassword("");
      }, AUTO_LOCK_MS);
    }
  }, [user, masterPassword]);

  useEffect(() => {
    resetLockTimer();
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => resetLockTimer();
    events.forEach(e => window.addEventListener(e, handler));
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, [resetLockTimer]);

  const toast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // Master password modal state
  const [showMasterPwdModal, setShowMasterPwdModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [masterPwdInput, setMasterPwdInput] = useState("");
  const [masterPwdErr, setMasterPwdErr] = useState("");

  const handleLogin = (userData) => {
    setUser(userData);
    setShowMasterPwdModal(true);
    setPendingUser(userData);
  };

  const confirmMasterPwd = async () => {
    try {
      const encKey = localStorage.getItem(`sv_priv_${pendingUser.id}`);
      const decrypted = await aesDecrypt(encKey, masterPwdInput);
      setMasterPassword(masterPwdInput);
      setUser({ ...pendingUser, privateKey: decrypted });
      setShowMasterPwdModal(false);
      setMasterPwdInput("");
      setLocked(false);
      toast("Welcome back!", "success");
    } catch {
      setMasterPwdErr("Incorrect master password");
    }
  };

  const unlockVault = async () => {
    try {
      const encKey = localStorage.getItem(`sv_priv_${user.id}`);
      const decrypted = await aesDecrypt(encKey, masterPwdInput);
      setMasterPassword(masterPwdInput);
      setUser(u => ({ ...u, privateKey: decrypted }));
      setLocked(false);
      setMasterPwdInput("");
      setMasterPwdErr("");
      toast("Vault unlocked!", "success");
    } catch {
      setMasterPwdErr("Incorrect master password");
    }
  };

  const nav = [
    { id: "vault", icon: "🔑", label: "Password Vault" },
    { id: "share", icon: "📤", label: "Secure Share" },
    { id: "inbox", icon: "📥", label: "Inbox" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];

  const pageTitles = {
    vault: { title: "PASSWORD VAULT", sub: "Multi-layer encrypted credential storage" },
    share: { title: "SECURE SHARE", sub: "Hybrid RSA + AES encrypted messaging" },
    inbox: { title: "INBOX", sub: "Encrypted message center" },
    settings: { title: "SETTINGS", sub: "Account & security configuration" },
  };

  // Lock screen
  if (locked && user) {
    return (
      <>
        <div className="lock-overlay">
          <div className="lock-card" style={{ width: "100%", maxWidth: 380, padding: 20 }}>
            <div className="lock-icon">🔒</div>
            <div className="auth-title" style={{ fontSize: 20, marginBottom: 8 }}>Vault Locked</div>
            <div className="auth-subtitle" style={{ marginBottom: 24 }}>Session timed out for security</div>
            <div className="auth-glass">
              <div className="form-group">
                <label className="label">Master Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter master password"
                  value={masterPwdInput}
                  onChange={e => { setMasterPwdInput(e.target.value); setMasterPwdErr(""); }}
                  onKeyDown={e => e.key === "Enter" && unlockVault()}
                  autoFocus
                />
              </div>
              {masterPwdErr && <div className="text-danger mb-12">⚠ {masterPwdErr}</div>}
              <button className="btn btn-primary w-full" onClick={unlockVault}>
                Unlock Vault
              </button>
            </div>
          </div>
        </div>
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onClose={() => removeToast(t.id)} />)}
        </div>
      </>
    );
  }

  // Auth / master password screens
  if (!user || !masterPassword) {
    return (
      <>
        {!showMasterPwdModal ? (
          <AuthScreen onLogin={handleLogin} />
        ) : (
          <div className="auth-bg">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="grid-overlay" />
            <div className="auth-card-wrapper">
              <div className="auth-glass">
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
                  <div className="auth-title" style={{ fontSize: 20 }}>Enter Master Password</div>
                  <div className="auth-subtitle">Decrypt your vault locally</div>
                </div>
                <div className="form-group">
                  <input
                    className="input"
                    type="password"
                    placeholder="Master password"
                    value={masterPwdInput}
                    onChange={e => { setMasterPwdInput(e.target.value); setMasterPwdErr(""); }}
                    onKeyDown={e => e.key === "Enter" && confirmMasterPwd()}
                    autoFocus
                  />
                </div>
                {masterPwdErr && <div className="text-danger mb-12">⚠ {masterPwdErr}</div>}
                <button className="btn btn-primary w-full" onClick={confirmMasterPwd}>
                  Unlock Vault →
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onClose={() => removeToast(t.id)} />)}
        </div>
      </>
    );
  }

  // Main app
  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="app">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <div className="sidebar-logo-box">🔐</div>
              <div>
                <div className="sidebar-brand-text">SECUREVAULT</div>
                <div className="sidebar-brand-sub">zero-knowledge</div>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {nav.map(item => (
              <div
                key={item.id}
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user-card">
              <div className="sidebar-user-label">Signed in</div>
              <div className="sidebar-user-email">{user.email}</div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="top-bar">
            <div className="flex items-center gap-12">
              <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
              <div>
                <div className="page-title">{pageTitles[activeTab]?.title}</div>
                <div className="page-sub">{pageTitles[activeTab]?.sub}</div>
              </div>
            </div>
            <div className="flex gap-8 items-center">
              <span className="badge badge-green badge-glow">🔒 Vault Unlocked</span>
            </div>
          </div>

          <div className="content" key={activeTab}>
            {activeTab === "vault" && <VaultModule user={user} masterPassword={masterPassword} toast={toast} />}
            {activeTab === "share" && <ShareModule user={user} toast={toast} />}
            {activeTab === "inbox" && <InboxModule user={user} toast={toast} />}
            {activeTab === "settings" && (
              <SettingsModule
                user={user}
                onLogout={() => { setUser(null); setMasterPassword(""); setLocked(false); }}
                toast={toast}
              />
            )}
          </div>
        </main>
      </div>

      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onClose={() => removeToast(t.id)} />)}
      </div>
    </>
  );
}
