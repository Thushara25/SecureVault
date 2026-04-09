import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { rsaDecrypt, aesDecryptRaw } from "../lib/crypto";

export default function InboxModule({ user, toast }) {
  const [messages, setMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decrypted, setDecrypted] = useState({});
  const [profiles, setProfiles] = useState({});
  const [tab, setTab] = useState("received");

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const { data: received } = await supabase.query("secure_messages")
          .select("*").eq("recipient_id", user.id).order("created_at", { ascending: false }).get();
        setMessages(received || []);

        const { data: sent } = await supabase.query("secure_messages")
          .select("*").eq("sender_id", user.id).order("created_at", { ascending: false }).get();
        setSentMessages(sent || []);

        const { data: profs } = await supabase.query("profiles").select("id,email").get();
        const map = {};
        (profs || []).forEach(p => { map[p.id] = p.email; });
        setProfiles(map);
      } catch (e) { toast(e.message, "error"); }
      setLoading(false);
    };
    loadAll();
  }, [user.id, toast]);

  const decryptMessage = async (msg) => {
    if (decrypted[msg.id]) return;
    try {
      const aesKey = await rsaDecrypt(msg.encrypted_aes_key, user.privateKey);
      const [encrypted, iv] = msg.encrypted_content.split("::");
      const plain = await aesDecryptRaw(encrypted, aesKey, iv);
      setDecrypted(d => ({ ...d, [msg.id]: plain }));
    } catch (e) { toast("Decryption failed: " + e.message, "error"); }
  };

  const currentMessages = tab === "received" ? messages : sentMessages;

  if (loading) return (
    <div className="flex flex-col gap-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--radius)" }} />
      ))}
    </div>
  );

  return (
    <div>
      {/* Tab Toggle */}
      <div className="tab-group mb-20" style={{ maxWidth: 300 }}>
        <button className={`tab-btn ${tab === "received" ? "active" : ""}`} onClick={() => setTab("received")}>
          📥 Received ({messages.length})
        </button>
        <button className={`tab-btn ${tab === "sent" ? "active" : ""}`} onClick={() => setTab("sent")}>
          📤 Sent ({sentMessages.length})
        </button>
      </div>

      {currentMessages.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">{tab === "received" ? "📥" : "📤"}</div>
            <div className="empty-title">No {tab} messages</div>
            <div className="empty-desc">
              {tab === "received"
                ? "Encrypted messages sent to you will appear here"
                : "Messages you've sent will appear here"
              }
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {currentMessages.map(msg => (
            <div key={msg.id} className="msg-item">
              <div className="msg-meta">
                <div>
                  <div className="msg-from">
                    {tab === "received"
                      ? <>From: {profiles[msg.sender_id] || "Unknown"}</>
                      : <>To: {profiles[msg.recipient_id] || "Unknown"}</>
                    }
                  </div>
                  <div className="msg-time">{new Date(msg.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-8 items-center">
                  <span className={`msg-direction ${tab === "received" ? "msg-received" : "msg-sent"}`}>
                    {tab === "received" ? "RECEIVED" : "SENT"}
                  </span>
                  {decrypted[msg.id]
                    ? <span className="badge badge-green">✓ Decrypted</span>
                    : <span className="badge badge-red">🔒 Encrypted</span>
                  }
                  {!decrypted[msg.id] && tab === "received" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => decryptMessage(msg)}>Decrypt</button>
                  )}
                </div>
              </div>
              <div className="msg-content">
                {decrypted[msg.id] || msg.encrypted_content.slice(0, 60) + "…"}
              </div>
              {decrypted[msg.id] && (
                <button className="btn btn-ghost btn-sm mt-8" onClick={() => navigator.clipboard.writeText(decrypted[msg.id]).then(() => toast("Copied!", "success"))}>
                  Copy Text
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
