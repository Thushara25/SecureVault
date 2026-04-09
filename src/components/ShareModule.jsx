import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { aesEncryptRaw, rsaEncrypt } from "../lib/crypto";

export default function ShareModule({ user, toast }) {
  const [users, setUsers] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.query("profiles").select("id,email,public_key").get()
      .then(({ data }) => setUsers((data || []).filter(u => u.id !== user.id)))
      .catch(e => toast(e.message, "error"));
  }, [user.id, toast]);

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(recipientSearch.toLowerCase()));

  const sendSecure = async () => {
    if (!recipient) return toast("Select a recipient", "warn");
    if (!message.trim()) return toast("Enter a message", "warn");
    if (!recipient.public_key) return toast("Recipient has no public key", "error");
    setSending(true);
    try {
      const { encrypted, iv, key } = await aesEncryptRaw(message);
      const encryptedContent = `${encrypted}::${iv}`;
      const encryptedAesKey = await rsaEncrypt(key, recipient.public_key);
      await supabase.query("secure_messages").insert({
        sender_id: user.id,
        recipient_id: recipient.id,
        encrypted_aes_key: encryptedAesKey,
        encrypted_content: encryptedContent,
        is_file: false,
      });
      toast("Message sent securely!", "success");
      setMessage(""); setRecipient(null); setRecipientSearch("");
    } catch (e) { toast(e.message, "error"); }
    setSending(false);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Encryption Info */}
      <div className="card card-accent mb-20">
        <div className="pipeline">
          <div className="pipeline-step"><span className="pipeline-icon">📝</span> Message</div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step"><span className="pipeline-icon">🛡</span> AES-256</div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step"><span className="pipeline-icon">🔐</span> RSA Wrap</div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step"><span className="pipeline-icon">📤</span> Send</div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text4)", fontFamily: "var(--mono)", textAlign: "center", marginTop: 8 }}>
          Only the recipient can decrypt with their private RSA key
        </div>
      </div>

      {/* Recipient */}
      <div className="form-group">
        <label className="label">Recipient</label>
        <div className="search-bar">
          <span className="search-icon">👤</span>
          <input
            className="input"
            placeholder="Search users by email…"
            value={recipientSearch}
            onChange={e => { setRecipientSearch(e.target.value); setRecipient(null); }}
            style={{ paddingLeft: 40 }}
          />
        </div>
        {recipientSearch && !recipient && filteredUsers.length > 0 && (
          <div className="card card-sm mt-8" style={{ maxHeight: 200, overflow: "auto" }}>
            {filteredUsers.map(u => (
              <div
                key={u.id}
                onClick={() => { setRecipient(u); setRecipientSearch(u.email); }}
                className="flex items-center justify-between"
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  fontFamily: "var(--mono)",
                  transition: "background var(--transition-fast)",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}
              >
                <span>{u.email}</span>
                {u.public_key
                  ? <span className="badge badge-green">✓ key</span>
                  : <span className="badge badge-red">no key</span>
                }
              </div>
            ))}
          </div>
        )}
        {recipient && (
          <div className="mt-8 flex items-center gap-8">
            <span className="badge badge-green badge-glow">✓ {recipient.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setRecipient(null); setRecipientSearch(""); }}>Change</button>
          </div>
        )}
      </div>

      {/* Message */}
      <div className="form-group">
        <label className="label">Secure Message</label>
        <textarea
          className="input"
          style={{ minHeight: 140 }}
          placeholder="Type your secret message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        {message && (
          <div className="text-muted mt-4" style={{ textAlign: "right" }}>
            {message.length} characters
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={sendSecure} disabled={sending || !recipient || !message}>
        {sending ? <><span className="spin" /> Encrypting & Sending…</> : "🔐 Send Encrypted Message"}
      </button>
    </div>
  );
}
