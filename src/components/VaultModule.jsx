import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  vigenereEncrypt, vigenereDecrypt,
  aesEncrypt, aesDecrypt,
  generatePassword, getStrength, checkPasswordBreach,
} from "../lib/crypto";
import StrengthMeter from "./StrengthMeter";
import {
  Search, Plus, Download, Eye, EyeOff, Edit, Trash, Copy,
  Key, Shield, ShieldLock, Database, FileText, Zap, Lock,
  AlertTriangle, CheckCircle, ArrowRight, Layers,
} from "./Icons";

const CATEGORIES = ["All", "Social", "Work", "Finance", "Email", "Dev", "Other"];

export default function VaultModule({ user, masterPassword, toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [decryptedPasswords, setDecryptedPasswords] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [breachResults, setBreachResults] = useState({});

  const [form, setForm] = useState({ site: "", url: "", username: "", password: "", notes: "", category: "Other", favorite: false });
  const [genLen, setGenLen] = useState(16);
  const [genOptions, setGenOptions] = useState({ uppercase: true, lowercase: true, digits: true, symbols: true });
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.query("vault_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).get();
      setEntries(data || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [user.id, toast]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const resetForm = () => {
    setForm({ site: "", url: "", username: "", password: "", notes: "", category: "Other", favorite: false });
    setEditingEntry(null);
  };

  const saveEntry = async () => {
    if (!form.site || !form.password) return toast("Site and password required", "warn");
    setSaving(true);
    try {
      const vig = vigenereEncrypt(form.password, masterPassword.slice(0, 8) || "SECUREVAULT");
      const encPwd = await aesEncrypt(vig, masterPassword);
      const encNotes = form.notes ? await aesEncrypt(form.notes, masterPassword) : "";

      if (editingEntry) {
        await supabase.query("vault_entries").eq("id", editingEntry.id).update({
          site: form.site,
          url: form.url,
          username: form.username,
          encrypted_password: encPwd,
          encrypted_notes: encNotes,
        });
        toast("Entry updated", "success");
      } else {
        await supabase.query("vault_entries").insert({
          user_id: user.id,
          site: form.site,
          url: form.url,
          username: form.username,
          encrypted_password: encPwd,
          encrypted_notes: encNotes,
        });
        toast("Entry saved securely", "success");
      }
      resetForm();
      setShowAdd(false);
      loadEntries();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const startEdit = async (entry) => {
    try {
      const vig = await aesDecrypt(entry.encrypted_password, masterPassword);
      const plain = vigenereDecrypt(vig, masterPassword.slice(0, 8) || "SECUREVAULT");
      let notes = "";
      if (entry.encrypted_notes) {
        try { notes = await aesDecrypt(entry.encrypted_notes, masterPassword); } catch {}
      }
      setForm({
        site: entry.site,
        url: entry.url || "",
        username: entry.username || "",
        password: plain,
        notes: notes,
        category: "Other",
        favorite: false,
      });
      setEditingEntry(entry);
      setShowAdd(true);
    } catch (e) { toast("Failed to decrypt for editing", "error"); }
  };

  const decryptEntry = async (entry) => {
    if (decryptedPasswords[entry.id]) {
      setDecryptedPasswords(p => { const n = { ...p }; delete n[entry.id]; return n; });
      return;
    }
    try {
      const vig = await aesDecrypt(entry.encrypted_password, masterPassword);
      const plain = vigenereDecrypt(vig, masterPassword.slice(0, 8) || "SECUREVAULT");
      setDecryptedPasswords(p => ({ ...p, [entry.id]: plain }));
      setTimeout(() => setDecryptedPasswords(p => { const n = { ...p }; delete n[entry.id]; return n; }), 30000);
    } catch (e) { toast("Decryption failed", "error"); }
  };

  const checkBreach = async (entry) => {
    if (!decryptedPasswords[entry.id]) {
      toast("Decrypt the password first", "warn");
      return;
    }
    setBreachResults(b => ({ ...b, [entry.id]: "checking" }));
    const result = await checkPasswordBreach(decryptedPasswords[entry.id]);
    setBreachResults(b => ({ ...b, [entry.id]: result }));
    if (result.breached) {
      toast(`This password was found in ${result.count.toLocaleString()} breaches!`, "error");
    } else {
      toast("Password not found in known breaches", "success");
    }
  };

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    toast("Copied! Clears in 30s", "success");
    setTimeout(() => navigator.clipboard.writeText(""), 30000);
  };

  const deleteEntry = async (id) => {
    try {
      await supabase.query("vault_entries").eq("id", id).delete();
      toast("Entry deleted", "info");
      loadEntries();
    } catch (e) { toast(e.message, "error"); }
  };

  const exportVault = async () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "securevault-backup.json";
    a.click();
    toast("Encrypted backup downloaded", "success");
  };

  const filtered = entries.filter(e =>
    e.site.toLowerCase().includes(search.toLowerCase()) ||
    (e.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: entries.length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Entries</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ display: "flex", justifyContent: "center" }}><Lock size={24} style={{ color: "var(--accent3)" }} /></div>
          <div className="stat-label">Encrypted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ display: "flex", justifyContent: "center" }}><Layers size={24} style={{ color: "var(--accent2)" }} /></div>
          <div className="stat-label">2 Layers</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-16" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{ maxWidth: 280, flex: 1 }}>
          <span className="search-icon" style={{ display: "flex" }}><Search size={15} /></span>
          <input className="input" placeholder="Search vault…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={exportVault}><Download size={14} /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowAdd(true); }}><Plus size={14} /> Add Entry</button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="category-pills mb-16">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon" style={{ display: "flex", justifyContent: "center" }}><Key size={48} style={{ color: "var(--text4)" }} /></div>
            <div className="empty-title">No entries yet</div>
            <div className="empty-desc">Add your first password to get started</div>
            <button className="btn btn-primary mt-16" onClick={() => { resetForm(); setShowAdd(true); }}><Plus size={14} /> Add First Entry</button>
          </div>
        </div>
      )}

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(entry => (
          <div key={entry.id}>
            <div className="vault-item" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
              <div className="vault-avatar">{entry.site[0]?.toUpperCase() || "?"}</div>
              <div className="vault-info">
                <div className="vault-site">
                  {entry.site}
                  {breachResults[entry.id] && breachResults[entry.id] !== "checking" && (
                    breachResults[entry.id].breached
                      ? <span className="badge badge-red" style={{ fontSize: 9 }}>BREACH</span>
                      : <span className="badge badge-green" style={{ fontSize: 9 }}>SAFE</span>
                  )}
                </div>
                <div className="vault-user">{entry.username || "No username"}</div>
              </div>
              <div className="vault-actions">
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); decryptEntry(entry); }}>
                  {decryptedPasswords[entry.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); startEdit(entry); }}><Edit size={14} /></button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}><Trash size={14} /></button>
              </div>
            </div>
            {expanded === entry.id && (
              <div className="vault-expanded">
                {entry.url && (
                  <div className="info-row">
                    <span className="info-label">URL</span>
                    <a href={entry.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13 }}>{entry.url}</a>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">Password</span>
                  <code className={`password-display ${decryptedPasswords[entry.id] ? "password-visible" : "password-hidden"}`}>
                    {decryptedPasswords[entry.id] || "••••••••••••"}
                  </code>
                  {decryptedPasswords[entry.id] && (
                    <div className="flex gap-6">
                      <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(decryptedPasswords[entry.id])}><Copy size={13} /> Copy</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => checkBreach(entry)}>
                        {breachResults[entry.id] === "checking" ? <span className="spin" /> : <><Search size={13} /> Breach?</>}
                      </button>
                    </div>
                  )}
                </div>
                {breachResults[entry.id] && breachResults[entry.id] !== "checking" && (
                  <div className="info-row">
                    <span className="info-label">Status</span>
                    {breachResults[entry.id].breached
                      ? <span className="breach-warning"><AlertTriangle size={13} /> Found in {breachResults[entry.id].count.toLocaleString()} data breaches</span>
                      : <span className="breach-safe"><CheckCircle size={13} /> Not found in known breaches</span>
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title flex items-center gap-8">
              {editingEntry ? <><Edit size={16} /> Edit Entry</> : <><Plus size={16} /> New Vault Entry</>}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="label">Site Name *</label>
                <input className="input" placeholder="GitHub" value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">URL</label>
                <input className="input" placeholder="https://github.com" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Username / Email</label>
              <input className="input" placeholder="user@example.com" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="label">Password *</label>
              <div className="flex gap-8">
                <input className="input input-mono" type="text" placeholder="Enter or generate" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => setForm(f => ({ ...f, password: generatePassword(genLen, genOptions) }))}><Zap size={14} /> Gen</button>
              </div>
              {form.password && <StrengthMeter password={form.password} />}

              <div className="flex items-center gap-8 mt-8">
                <span className="text-muted">Length:</span>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={genLen}
                  onChange={e => setGenLen(+e.target.value)}
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                />
                <span className="text-mono">{genLen}</span>
              </div>

              <div className="flex gap-12 mt-8" style={{ flexWrap: "wrap" }}>
                {[
                  { key: "uppercase", label: "A-Z" },
                  { key: "lowercase", label: "a-z" },
                  { key: "digits", label: "0-9" },
                  { key: "symbols", label: "!@#" },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-6" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      className="toggle"
                      checked={genOptions[opt.key]}
                      onChange={() => setGenOptions(o => ({ ...o, [opt.key]: !o[opt.key] }))}
                    />
                    <span className="text-muted">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Notes</label>
              <textarea className="input" placeholder="Optional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Encryption Pipeline */}
            <div className="card card-success card-sm mb-16">
              <div className="pipeline">
                <div className="pipeline-step"><FileText size={14} /> Plaintext</div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-step"><Key size={14} /> Vigenère</div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-step"><Shield size={14} /> AES-256</div>
                <span className="pipeline-arrow">→</span>
                <div className="pipeline-step"><Database size={14} /> Database</div>
              </div>
            </div>

            <div className="flex gap-8">
              <button className="btn btn-ghost flex-1" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={saveEntry} disabled={saving}>
                {saving ? <><span className="spin" /> Encrypting…</> : editingEntry ? "Update Entry" : "Save Securely"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
