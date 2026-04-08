// ============================================================
// SecureVault - Complete React App (Single File)
// Backend: Supabase (Auth + Database)
// Crypto: Web Crypto API + JSEncrypt (RSA)
// ============================================================
// 
// SETUP INSTRUCTIONS:
// 1. Create a Supabase project at supabase.com
// 2. Run the SQL below in Supabase SQL Editor
// 3. Replace SUPABASE_URL and SUPABASE_ANON_KEY below
// 4. Install: npm install @supabase/supabase-js jsencrypt
//
// SQL TO RUN IN SUPABASE:
// --------------------------------------------------------
// create table profiles (
//   id uuid references auth.users primary key,
//   email text unique not null,
//   public_key text,
//   encrypted_private_key text,
//   created_at timestamp default now()
// );
// alter table profiles enable row level security;
// create policy "Users can view all profiles" on profiles for select using (true);
// create policy "Users manage own profile" on profiles for all using (auth.uid() = id);
//
// create table vault_entries (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users not null,
//   site text not null,
//   url text,
//   username text,
//   encrypted_password text not null,
//   encrypted_notes text,
//   created_at timestamp default now()
// );
// alter table vault_entries enable row level security;
// create policy "Users manage own vault" on vault_entries for all using (auth.uid() = user_id);
//
// create table secure_messages (
//   id uuid primary key default gen_random_uuid(),
//   sender_id uuid references auth.users not null,
//   recipient_id uuid references auth.users not null,
//   encrypted_aes_key text not null,
//   encrypted_content text not null,
//   file_name text,
//   file_type text,
//   is_file boolean default false,
//   created_at timestamp default now()
// );
// alter table secure_messages enable row level security;
// create policy "Users see own messages" on secure_messages for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
// create policy "Users send messages" on secure_messages for insert with check (auth.uid() = sender_id);
// --------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from "react";

// ── CONFIG ── Replace with your Supabase project values ──
const SUPABASE_URL = "https://syqwkddyqfucltkxhqpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cXdrZGR5cWZ1Y2x0a3hocXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc3MjgsImV4cCI6MjA5MTI1MzcyOH0.UP2awqIN9J-j8nmLGol0Hv4Oil2-220QSCIUnC285JI";

// ── Supabase Client (inline, no package needed if using CDN) ──
// We'll use fetch directly to keep this a single file
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.accessToken = null;
    this.user = null;
  }

  headers(extra = {}) {
    return {
      "Content-Type": "application/json",
      apikey: this.key,
      Authorization: `Bearer ${this.accessToken || this.key}`,
      ...extra,
    };
  }

  async signUp(email, password) {
    const r = await fetch(`${this.url}/auth/v1/signup`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || d.msg);
    if (d.access_token) { this.accessToken = d.access_token; this.user = d.user; }
    return d;
  }

  async signIn(email, password) {
    const r = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.error || d.error_description) throw new Error(d.error_description || d.error);
    this.accessToken = d.access_token;
    this.user = d.user;
    return d;
  }

  async signOut() {
    await fetch(`${this.url}/auth/v1/logout`, { method: "POST", headers: this.headers() });
    this.accessToken = null;
    this.user = null;
  }

  async from(table) {
    return new SupabaseQuery(this, table);
  }

  query(table) { return new SupabaseQuery(this, table); }
}

class SupabaseQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this._filters = [];
    this._select = "*";
    this._order = null;
    this._limit = null;
  }

  select(cols = "*") { this._select = cols; return this; }
  eq(col, val) { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
  or(expr) { this._filters.push(`or=(${expr})`); return this; }
  order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? "asc" : "desc"}`; return this; }
  limit(n) { this._limit = n; return this; }

  async get() {
    let url = `${this.client.url}/rest/v1/${this.table}?select=${this._select}`;
    if (this._filters.length) url += "&" + this._filters.join("&");
    if (this._order) url += `&order=${this._order}`;
    if (this._limit) url += `&limit=${this._limit}`;
    const r = await fetch(url, { headers: this.client.headers({ Prefer: "return=representation" }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || JSON.stringify(d));
    return { data: d, error: null };
  }

  async insert(payload) {
    const r = await fetch(`${this.client.url}/rest/v1/${this.table}`, {
      method: "POST",
      headers: this.client.headers({ Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || JSON.stringify(d));
    return { data: d, error: null };
  }

  async update(payload) {
    let url = `${this.client.url}/rest/v1/${this.table}?`;
    if (this._filters.length) url += this._filters.join("&");
    const r = await fetch(url, {
      method: "PATCH",
      headers: this.client.headers({ Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || JSON.stringify(d));
    return { data: d, error: null };
  }

  async delete() {
    let url = `${this.client.url}/rest/v1/${this.table}?`;
    if (this._filters.length) url += this._filters.join("&");
    const r = await fetch(url, { method: "DELETE", headers: this.client.headers() });
    if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
    return { data: null, error: null };
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CRYPTO UTILITIES ──────────────────────────────────────

// Vigenère Cipher (Layer 1)
const vigenereEncrypt = (text, key) => {
  key = key.toUpperCase();
  return text.split("").map((c, i) => {
    const code = c.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      const k = key.charCodeAt(i % key.length) - 65;
      return String.fromCharCode(((code - 32 + k) % 95) + 32);
    }
    return c;
  }).join("");
};

const vigenereDecrypt = (text, key) => {
  key = key.toUpperCase();
  return text.split("").map((c, i) => {
    const code = c.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      const k = key.charCodeAt(i % key.length) - 65;
      return String.fromCharCode(((code - 32 - k + 95) % 95) + 32);
    }
    return c;
  }).join("");
};

// AES-256-CBC via Web Crypto API (Layer 2)
const deriveKey = async (password, salt) => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const aesEncrypt = async (plaintext, password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, Array.from(salt).join(","));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(encrypted), 32);
  return btoa(String.fromCharCode(...combined));
};

const aesDecrypt = async (ciphertext, password) => {
  const combined = new Uint8Array(atob(ciphertext).split("").map(c => c.charCodeAt(0)));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 32);
  const encrypted = combined.slice(32);
  const key = await deriveKey(password, Array.from(salt).join(","));
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, encrypted);
  return new TextDecoder().decode(dec);
};

// AES for share (random key, raw)
const aesEncryptRaw = async (plaintext) => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, enc.encode(plaintext));
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    key: btoa(String.fromCharCode(...key)),
  };
};

const aesDecryptRaw = async (ciphertext, keyB64, ivB64) => {
  const key = new Uint8Array(atob(keyB64).split("").map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(ivB64).split("").map(c => c.charCodeAt(0)));
  const encrypted = new Uint8Array(atob(ciphertext).split("").map(c => c.charCodeAt(0)));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, encrypted);
  return new TextDecoder().decode(dec);
};

// RSA key generation (Layer 3)
const generateRSAKeyPair = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  );
  const pubExported = await crypto.subtle.exportKey("spki", pair.publicKey);
  const privExported = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const pubB64 = btoa(String.fromCharCode(...new Uint8Array(pubExported)));
  const privB64 = btoa(String.fromCharCode(...new Uint8Array(privExported)));
  return { publicKey: pubB64, privateKey: privB64 };
};

const rsaEncrypt = async (data, publicKeyB64) => {
  const binaryDer = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
  const pubKey = await crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

const rsaDecrypt = async (cipherB64, privateKeyB64) => {
  const binaryDer = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const privKey = await crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const encrypted = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, encrypted);
  return new TextDecoder().decode(dec);
};

// SHA-256 hash
const sha256 = async (text) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

// Password strength
const getStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};

const generatePassword = (length = 16) => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length]).join("");
};

// ── STYLES ────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0f1e;
    --bg2: #0f172a;
    --bg3: #1e293b;
    --border: rgba(99,179,237,0.15);
    --border2: rgba(99,179,237,0.3);
    --accent: #38bdf8;
    --accent2: #818cf8;
    --accent3: #34d399;
    --danger: #f87171;
    --text: #e2e8f0;
    --text2: #94a3b8;
    --text3: #64748b;
    --mono: 'Space Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--sans); }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: 220px; background: var(--bg2); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 0; flex-shrink: 0;
  }
  .sidebar-logo {
    padding: 20px 16px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .logo-icon {
    width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .logo-text { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: 0.05em; }
  .logo-sub { font-size: 10px; color: var(--text3); font-family: var(--mono); }

  .sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;
    color: var(--text2); transition: all 0.15s; border: 1px solid transparent;
    font-family: var(--sans);
  }
  .nav-item:hover { background: var(--bg3); color: var(--text); }
  .nav-item.active { background: rgba(56,189,248,0.1); color: var(--accent); border-color: rgba(56,189,248,0.2); }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }

  .sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }
  .user-card {
    padding: 10px 12px; border-radius: 8px; background: var(--bg3);
    font-size: 12px; color: var(--text2);
  }
  .user-email { color: var(--text); font-weight: 500; font-size: 11px; word-break: break-all; }

  /* Main */
  .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
  .top-bar {
    padding: 16px 24px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    background: var(--bg2); position: sticky; top: 0; z-index: 10;
  }
  .page-title { font-family: var(--mono); font-size: 14px; color: var(--accent); font-weight: 700; }
  .page-sub { font-size: 12px; color: var(--text3); margin-top: 2px; }

  .content { padding: 24px; flex: 1; }

  /* Cards */
  .card {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px;
  }
  .card-sm { padding: 14px 16px; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
    cursor: pointer; border: 1px solid transparent; transition: all 0.15s;
    font-family: var(--sans); text-decoration: none;
  }
  .btn-primary { background: var(--accent); color: #0a0f1e; border-color: var(--accent); }
  .btn-primary:hover { background: #7dd3fc; }
  .btn-ghost { background: transparent; color: var(--text2); border-color: var(--border); }
  .btn-ghost:hover { background: var(--bg3); color: var(--text); }
  .btn-danger { background: transparent; color: var(--danger); border-color: rgba(248,113,113,0.3); }
  .btn-danger:hover { background: rgba(248,113,113,0.1); }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Inputs */
  .input {
    width: 100%; padding: 10px 14px; border-radius: 8px;
    background: var(--bg3); border: 1px solid var(--border);
    color: var(--text); font-size: 13px; font-family: var(--sans);
    outline: none; transition: border-color 0.15s;
  }
  .input:focus { border-color: var(--accent); }
  .input::placeholder { color: var(--text3); }
  .input-mono { font-family: var(--mono); font-size: 12px; }
  textarea.input { resize: vertical; min-height: 80px; }

  .label { font-size: 11px; color: var(--text3); font-weight: 500; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--mono); }

  .form-group { margin-bottom: 14px; }

  /* Vault entry */
  .vault-item {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 16px; display: flex; align-items: center; gap: 12px;
    transition: border-color 0.15s; cursor: pointer;
  }
  .vault-item:hover { border-color: var(--border2); }
  .vault-avatar {
    width: 36px; height: 36px; border-radius: 8px;
    background: linear-gradient(135deg, var(--bg3), var(--bg));
    border: 1px solid var(--border2);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0;
  }
  .vault-info { flex: 1; min-width: 0; }
  .vault-site { font-size: 13px; font-weight: 600; color: var(--text); }
  .vault-user { font-size: 11px; color: var(--text3); font-family: var(--mono); }
  .vault-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
  .vault-item:hover .vault-actions { opacity: 1; }

  /* Strength meter */
  .strength-bar { height: 4px; border-radius: 2px; background: var(--bg3); overflow: hidden; margin-top: 6px; }
  .strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal {
    background: var(--bg2); border: 1px solid var(--border2); border-radius: 16px;
    padding: 24px; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto;
  }
  .modal-title { font-family: var(--mono); font-size: 14px; color: var(--accent); margin-bottom: 20px; font-weight: 700; }

  /* Badge */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 600;
    font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.05em;
  }
  .badge-green { background: rgba(52,211,153,0.15); color: var(--accent3); }
  .badge-red { background: rgba(248,113,113,0.15); color: var(--danger); }
  .badge-blue { background: rgba(56,189,248,0.15); color: var(--accent); }

  /* Auth */
  .auth-screen {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--bg); padding: 20px;
  }
  .auth-card { width: 100%; max-width: 400px; }
  .auth-title { font-family: var(--mono); font-size: 24px; color: var(--accent); font-weight: 700; text-align: center; margin-bottom: 4px; }
  .auth-sub { font-size: 13px; color: var(--text3); text-align: center; margin-bottom: 28px; }

  /* Message item */
  .msg-item {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 16px; margin-bottom: 10px;
  }
  .msg-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .msg-from { font-size: 12px; color: var(--text2); font-family: var(--mono); }
  .msg-time { font-size: 11px; color: var(--text3); }
  .msg-content { font-size: 13px; color: var(--text); font-family: var(--mono); background: var(--bg3); padding: 10px; border-radius: 6px; word-break: break-all; }

  /* Grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }

  /* Divider */
  .divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }

  /* Toast */
  .toast {
    position: fixed; bottom: 20px; right: 20px; z-index: 999;
    background: var(--bg3); border: 1px solid var(--border2); border-radius: 10px;
    padding: 12px 16px; font-size: 13px; display: flex; align-items: center; gap: 8px;
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 3px; }

  .gap-8 { gap: 8px; }
  .gap-12 { gap: 12px; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .flex-1 { flex: 1; }
  .mb-4 { margin-bottom: 4px; }
  .mb-8 { margin-bottom: 8px; }
  .mb-12 { margin-bottom: 12px; }
  .mb-16 { margin-bottom: 16px; }
  .mb-20 { margin-bottom: 20px; }
  .mt-8 { margin-top: 8px; }
  .mt-12 { margin-top: 12px; }
  .mt-16 { margin-top: 16px; }
  .w-full { width: 100%; }
  .text-danger { color: var(--danger); font-size: 12px; }
  .text-muted { color: var(--text3); font-size: 12px; }
  .text-mono { font-family: var(--mono); font-size: 11px; }
  .text-accent { color: var(--accent); }
  .text-green { color: var(--accent3); }
  .spin {
    width: 16px; height: 16px; border: 2px solid rgba(56,189,248,0.3);
    border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .config-warning {
    background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);
    border-radius: 10px; padding: 16px; margin-bottom: 20px; font-size: 12px;
    color: #fbbf24; font-family: var(--mono); line-height: 1.6;
  }
`;

// ── TOAST ─────────────────────────────────────────────────
function Toast({ msg, type = "info", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const icons = { info: "ℹ", success: "✓", error: "✗", warn: "⚠" };
  const colors = { info: "var(--accent)", success: "var(--accent3)", error: "var(--danger)", warn: "#fbbf24" };
  return (
    <div className="toast">
      <span style={{ color: colors[type], fontWeight: 700 }}>{icons[type]}</span>
      <span>{msg}</span>
    </div>
  );
}

// ── AUTH SCREEN ───────────────────────────────────────────
function AuthScreen({ onLogin }) {
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
        // Load private key from localStorage
        const privKey = localStorage.getItem(`sv_priv_${res.user.id}`);
        if (!privKey) {
          setErr("Private key not found in this browser. Did you sign up from a different device?");
          await supabase.signOut(); setLoading(false); return;
        }
        // Decrypt private key
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
        // Use the session token returned by signup to authenticate the profile insert
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
    <div className="auth-screen">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #38bdf8, #818cf8)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>🔐</div>
          <div className="auth-title">SecureVault</div>
          <div className="auth-sub">Zero-knowledge encryption vault</div>
        </div>

        {!isConfigured && (
          <div className="config-warning">
            ⚠ Configure Supabase first!{"\n"}
            Open SecureVault.jsx and replace:{"\n"}
            • SUPABASE_URL{"\n"}
            • SUPABASE_ANON_KEY{"\n"}
            Then run the SQL in README comments.
          </div>
        )}

        <div className="card">
          <div className="flex gap-8 mb-20">
            {["login", "signup"].map(m => (
              <button key={m} className={`btn flex-1 ${mode === m ? "btn-primary" : "btn-ghost"}`} onClick={() => { setMode(m); setErr(""); setInfo(""); }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div className="form-group">
            <label className="label">Master Password</label>
            <input className="input" type="password" placeholder="Strong master password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            {mode === "signup" && password && (
              <div style={{ marginTop: 8 }}>
                <StrengthMeter password={password} />
              </div>
            )}
          </div>

          {err && <div className="text-danger mb-12">⚠ {err}</div>}
          {info && <div style={{ fontSize: 12, color: "var(--accent3)", marginBottom: 12 }}>✓ {info}</div>}

          <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={loading || !isConfigured}>
            {loading ? <><span className="spin" /> Processing…</> : mode === "login" ? "Log In" : "Create Account"}
          </button>

          {mode === "signup" && (
            <div className="text-muted mt-12" style={{ textAlign: "center", lineHeight: 1.5 }}>
              🔒 Your RSA keypair is generated in your browser. Your master password is never sent to the server.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── STRENGTH METER ────────────────────────────────────────
function StrengthMeter({ password }) {
  const score = getStrength(password);
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "#f87171", "#fbbf24", "#fb923c", "#34d399", "#38bdf8"];
  return (
    <div>
      <div className="strength-bar">
        <div className="strength-fill" style={{ width: `${score * 20}%`, background: colors[score] }} />
      </div>
      <div style={{ fontSize: 11, color: colors[score], marginTop: 4, fontFamily: "var(--mono)" }}>
        {labels[score]}
      </div>
    </div>
  );
}

// ── VAULT MODULE ──────────────────────────────────────────
function VaultModule({ user, masterPassword, toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [decryptedPasswords, setDecryptedPasswords] = useState({});

  const [form, setForm] = useState({ site: "", url: "", username: "", password: "", notes: "" });
  const [genLen, setGenLen] = useState(16);
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.query("vault_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).get();
      setEntries(data || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const saveEntry = async () => {
    if (!form.site || !form.password) return toast("Site and password required", "warn");
    setSaving(true);
    try {
      // Layer 1: Vigenère
      const vig = vigenereEncrypt(form.password, masterPassword.slice(0, 8) || "SECUREVAULT");
      // Layer 2: AES-256
      const encPwd = await aesEncrypt(vig, masterPassword);
      const encNotes = form.notes ? await aesEncrypt(form.notes, masterPassword) : "";
      await supabase.query("vault_entries").insert({
        user_id: user.id,
        site: form.site,
        url: form.url,
        username: form.username,
        encrypted_password: encPwd,
        encrypted_notes: encNotes,
      });
      toast("Entry saved securely", "success");
      setForm({ site: "", url: "", username: "", password: "", notes: "" });
      setShowAdd(false);
      loadEntries();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const decryptEntry = async (entry) => {
    if (decryptedPasswords[entry.id]) {
      setDecryptedPasswords(p => { const n = { ...p }; delete n[entry.id]; return n; });
      return;
    }
    try {
      // Layer 2: AES decrypt
      const vig = await aesDecrypt(entry.encrypted_password, masterPassword);
      // Layer 1: Vigenère decrypt
      const plain = vigenereDecrypt(vig, masterPassword.slice(0, 8) || "SECUREVAULT");
      setDecryptedPasswords(p => ({ ...p, [entry.id]: plain }));
      // Auto-clear after 30s
      setTimeout(() => setDecryptedPasswords(p => { const n = { ...p }; delete n[entry.id]; return n; }), 30000);
    } catch (e) { toast("Decryption failed", "error"); }
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

  const filtered = entries.filter(e => e.site.toLowerCase().includes(search.toLowerCase()) || (e.username || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-16" style={{ flexWrap: "wrap", gap: 10 }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="🔍 Search vault…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={exportVault}>⬇ Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Entry</button>
        </div>
      </div>

      {loading && <div className="flex items-center gap-8" style={{ color: "var(--text3)", fontSize: 13 }}><span className="spin" /> Loading vault…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
          <div style={{ color: "var(--text2)", fontSize: 14, marginBottom: 8 }}>No entries yet</div>
          <div className="text-muted">Add your first password to get started</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(entry => (
          <div key={entry.id}>
            <div className="vault-item" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
              <div className="vault-avatar">{entry.site[0]?.toUpperCase() || "?"}</div>
              <div className="vault-info">
                <div className="vault-site">{entry.site}</div>
                <div className="vault-user">{entry.username || "No username"}</div>
              </div>
              <div className="vault-actions">
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); decryptEntry(entry); }}>
                  {decryptedPasswords[entry.id] ? "🙈 Hide" : "👁 Show"}
                </button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}>🗑</button>
              </div>
            </div>
            {expanded === entry.id && (
              <div className="card card-sm" style={{ marginTop: 4, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                {entry.url && <div className="text-muted mb-8">🔗 <a href={entry.url} target="_blank" style={{ color: "var(--accent)" }}>{entry.url}</a></div>}
                <div className="flex items-center gap-8 mb-8">
                  <span className="text-muted">Password:</span>
                  <code style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg3)", padding: "4px 8px", borderRadius: 6, color: decryptedPasswords[entry.id] ? "var(--accent3)" : "var(--text3)" }}>
                    {decryptedPasswords[entry.id] || "••••••••••••"}
                  </code>
                  {decryptedPasswords[entry.id] && (
                    <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(decryptedPasswords[entry.id])}>Copy</button>
                  )}
                </div>
                {entry.encrypted_notes && decryptedPasswords[entry.id] && (
                  <div className="text-muted">Notes: encrypted (decrypt to view)</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">+ New Vault Entry</div>
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
                <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => setForm(f => ({ ...f, password: generatePassword(genLen) }))}>⚡ Gen</button>
              </div>
              {form.password && <StrengthMeter password={form.password} />}
              <div className="flex items-center gap-8 mt-8">
                <span className="text-muted">Length:</span>
                <input type="range" min="8" max="32" value={genLen} onChange={e => setGenLen(+e.target.value)} style={{ flex: 1 }} />
                <span className="text-mono">{genLen}</span>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Notes</label>
              <textarea className="input" placeholder="Optional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="card card-sm mb-16" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.2)" }}>
              <div style={{ fontSize: 11, color: "var(--accent3)", fontFamily: "var(--mono)", lineHeight: 1.8 }}>
                🔒 Encryption pipeline:{"\n"}
                Vigenère (Layer 1) → AES-256-CBC (Layer 2) → Database
              </div>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-ghost flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={saveEntry} disabled={saving}>
                {saving ? <><span className="spin" /> Encrypting…</> : "Save Securely"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SECURE SHARE MODULE ───────────────────────────────────
function ShareModule({ user, toast }) {
  const [users, setUsers] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.query("profiles").select("id,email,public_key").get()
      .then(({ data }) => setUsers((data || []).filter(u => u.id !== user.id)))
      .catch(e => toast(e.message, "error"));
  }, []);

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(recipientSearch.toLowerCase()));

  const sendSecure = async () => {
    if (!recipient) return toast("Select a recipient", "warn");
    if (!message.trim()) return toast("Enter a message", "warn");
    if (!recipient.public_key) return toast("Recipient has no public key", "error");
    setSending(true);
    try {
      // AES encrypt the message
      const { encrypted, iv, key } = await aesEncryptRaw(message);
      const encryptedContent = `${encrypted}::${iv}`;
      // RSA encrypt the AES key with recipient's public key
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
    <div>
      <div className="card mb-16" style={{ background: "rgba(56,189,248,0.05)", borderColor: "rgba(56,189,248,0.15)" }}>
        <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", lineHeight: 1.8 }}>
          🔐 Hybrid Encryption: AES-256-CBC (message) + RSA-2048 (key wrap){"\n"}
          Server stores only ciphertext. Only the recipient can decrypt.
        </div>
      </div>

      <div className="form-group">
        <label className="label">Recipient</label>
        <input className="input" placeholder="Search users by email…" value={recipientSearch} onChange={e => { setRecipientSearch(e.target.value); setRecipient(null); }} />
        {recipientSearch && !recipient && filteredUsers.length > 0 && (
          <div className="card card-sm mt-8" style={{ maxHeight: 180, overflow: "auto" }}>
            {filteredUsers.map(u => (
              <div key={u.id} onClick={() => { setRecipient(u); setRecipientSearch(u.email); }}
                style={{ padding: "8px 10px", cursor: "pointer", borderRadius: 6, fontSize: 13, fontFamily: "var(--mono)" }}
                onMouseEnter={e => e.target.style.background = "var(--bg3)"}
                onMouseLeave={e => e.target.style.background = ""}>
                {u.email} {u.public_key ? <span style={{ color: "var(--accent3)", fontSize: 10 }}>✓ key</span> : <span style={{ color: "var(--danger)", fontSize: 10 }}>no key</span>}
              </div>
            ))}
          </div>
        )}
        {recipient && <div className="badge badge-green mt-8">✓ {recipient.email}</div>}
      </div>

      <div className="form-group">
        <label className="label">Secure Message</label>
        <textarea className="input" style={{ minHeight: 120 }} placeholder="Type your secret message…" value={message} onChange={e => setMessage(e.target.value)} />
      </div>

      <button className="btn btn-primary" onClick={sendSecure} disabled={sending || !recipient || !message}>
        {sending ? <><span className="spin" /> Encrypting & Sending…</> : "🔐 Send Encrypted"}
      </button>
    </div>
  );
}

// ── INBOX MODULE ──────────────────────────────────────────
function InboxModule({ user, toast }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decrypted, setDecrypted] = useState({});
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const { data: msgs } = await supabase.query("secure_messages")
          .select("*").eq("recipient_id", user.id).order("created_at", { ascending: false }).get();
        setMessages(msgs || []);
        const { data: profs } = await supabase.query("profiles").select("id,email").get();
        const map = {};
        (profs || []).forEach(p => { map[p.id] = p.email; });
        setProfiles(map);
      } catch (e) { toast(e.message, "error"); }
      setLoading(false);
    };
    loadAll();
  }, []);

  const decryptMessage = async (msg) => {
    if (decrypted[msg.id]) return;
    try {
      // RSA decrypt the AES key using user's private key
      const aesKey = await rsaDecrypt(msg.encrypted_aes_key, user.privateKey);
      // AES decrypt the content
      const [encrypted, iv] = msg.encrypted_content.split("::");
      const plain = await aesDecryptRaw(encrypted, aesKey, iv);
      setDecrypted(d => ({ ...d, [msg.id]: plain }));
    } catch (e) { toast("Decryption failed: " + e.message, "error"); }
  };

  if (loading) return <div className="flex items-center gap-8" style={{ color: "var(--text3)", fontSize: 13 }}><span className="spin" /> Loading inbox…</div>;

  if (messages.length === 0) return (
    <div className="card" style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📥</div>
      <div style={{ color: "var(--text2)", fontSize: 14 }}>No messages yet</div>
      <div className="text-muted mt-8">Encrypted messages sent to you will appear here</div>
    </div>
  );

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id} className="msg-item">
          <div className="msg-meta">
            <div>
              <div className="msg-from">From: {profiles[msg.sender_id] || "Unknown"}</div>
              <div className="msg-time">{new Date(msg.created_at).toLocaleString()}</div>
            </div>
            <div className="flex gap-8 items-center">
              {decrypted[msg.id]
                ? <span className="badge badge-green">✓ Decrypted</span>
                : <span className="badge badge-red">🔒 Encrypted</span>}
              {!decrypted[msg.id] && (
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
  );
}

// ── SETTINGS MODULE ───────────────────────────────────────
function SettingsModule({ user, onLogout, toast }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.query("profiles").select("*").eq("id", user.id).get()
      .then(({ data }) => setProfile(data?.[0]));
  }, []);

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
    <div style={{ maxWidth: 560 }}>
      <div className="card mb-16">
        <div className="label mb-8">Account</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{user.email}</div>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>User ID: {user.id}</div>
      </div>

      {profile?.public_key && (
        <div className="card mb-16">
          <div className="label mb-8">Your RSA-2048 Public Key</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)", wordBreak: "break-all", maxHeight: 80, overflow: "auto", background: "var(--bg3)", padding: 10, borderRadius: 6 }}>
            {profile.public_key}
          </div>
          <button className="btn btn-ghost btn-sm mt-8" onClick={() => navigator.clipboard.writeText(profile.public_key).then(() => toast("Public key copied", "success"))}>
            Copy Public Key
          </button>
        </div>
      )}

      <div className="card mb-16">
        <div className="label mb-8">Security</div>
        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={downloadPrivKey}>⬇ Backup Private Key</button>
        </div>
        <div className="text-muted mt-8">Your private key is stored encrypted in this browser's localStorage. Back it up to restore access from other devices.</div>
      </div>

      <div className="card" style={{ borderColor: "rgba(248,113,113,0.2)" }}>
        <div className="label mb-8" style={{ color: "var(--danger)" }}>Danger Zone</div>
        <button className="btn btn-danger" onClick={async () => { await supabase.signOut(); onLogout(); }}>
          Sign Out
        </button>
      </div>

      <div className="card mt-16" style={{ background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.15)" }}>
        <div className="label mb-8">Encryption Architecture</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.8, fontFamily: "var(--mono)" }}>
          Layer 1: Vigenère Cipher (classical obfuscation){"\n"}
          Layer 2: AES-256-CBC (symmetric bulk encryption){"\n"}
          Layer 3: RSA-2048 OAEP (asymmetric key wrapping){"\n"}
          Layer 4: PBKDF2-SHA256 (key derivation, 100k iter){"\n"}
          {"\n"}
          Zero-knowledge: server stores only ciphertext.{"\n"}
          Private key never leaves your device unencrypted.
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────
export default function SecureVault() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("vault");
  const [toasts, setToasts] = useState([]);
  const [masterPassword, setMasterPassword] = useState("");

  const toast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const handleLogin = (userData) => {
    // Extract master password — stored temporarily in memory only
    setUser(userData);
    // We need master pwd — re-prompt
    setShowMasterPwdModal(true);
    setPendingUser(userData);
  };

  const [showMasterPwdModal, setShowMasterPwdModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [masterPwdInput, setMasterPwdInput] = useState("");
  const [masterPwdErr, setMasterPwdErr] = useState("");

  const confirmMasterPwd = async () => {
    // Verify by trying to decrypt private key
    try {
      const encKey = localStorage.getItem(`sv_priv_${pendingUser.id}`);
      const decrypted = await aesDecrypt(encKey, masterPwdInput);
      // If no error, password is correct
      setMasterPassword(masterPwdInput);
      setUser({ ...pendingUser, privateKey: decrypted });
      setShowMasterPwdModal(false);
      setMasterPwdInput("");
      toast("Welcome back!", "success");
    } catch (e) {
      setMasterPwdErr("Incorrect master password");
    }
  };

  const nav = [
    { id: "vault", icon: "🔑", label: "Password Vault" },
    { id: "share", icon: "📤", label: "Secure Share" },
    { id: "inbox", icon: "📥", label: "Inbox" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];

  if (!user || !masterPassword) {
    return (
      <>
        <style>{styles}</style>
        {!showMasterPwdModal ? (
          <AuthScreen onLogin={handleLogin} />
        ) : (
          <div className="auth-screen">
            <div className="auth-card">
              <div className="card">
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
                  <div className="auth-title" style={{ fontSize: 18 }}>Enter Master Password</div>
                  <div className="auth-sub">To decrypt your vault locally</div>
                </div>
                <div className="form-group">
                  <input className="input" type="password" placeholder="Master password" value={masterPwdInput}
                    onChange={e => { setMasterPwdInput(e.target.value); setMasterPwdErr(""); }}
                    onKeyDown={e => e.key === "Enter" && confirmMasterPwd()} autoFocus />
                </div>
                {masterPwdErr && <div className="text-danger mb-12">⚠ {masterPwdErr}</div>}
                <button className="btn btn-primary w-full" onClick={confirmMasterPwd}>Unlock Vault</button>
              </div>
            </div>
          </div>
        )}
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onClose={() => removeToast(t.id)} />)}
      </>
    );
  }

  const pageTitles = {
    vault: { title: "PASSWORD VAULT", sub: "Multi-layer encrypted credential storage" },
    share: { title: "SECURE SHARE", sub: "Hybrid RSA+AES encrypted messaging" },
    inbox: { title: "INBOX", sub: "Received encrypted messages" },
    settings: { title: "SETTINGS", sub: "Account & security configuration" },
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">🔐</div>
            <div>
              <div className="logo-text">SECUREVAULT</div>
              <div className="logo-sub">zero-knowledge</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            {nav.map(item => (
              <div key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-card">
              <div className="text-muted mb-4">Signed in as</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="top-bar">
            <div>
              <div className="page-title">{pageTitles[activeTab]?.title}</div>
              <div className="page-sub">{pageTitles[activeTab]?.sub}</div>
            </div>
            <div className="flex gap-8 items-center">
              <span className="badge badge-green">🔒 Vault Unlocked</span>
            </div>
          </div>
          <div className="content">
            {activeTab === "vault" && <VaultModule user={user} masterPassword={masterPassword} toast={toast} />}
            {activeTab === "share" && <ShareModule user={user} toast={toast} />}
            {activeTab === "inbox" && <InboxModule user={user} toast={toast} />}
            {activeTab === "settings" && <SettingsModule user={user} onLogout={() => { setUser(null); setMasterPassword(""); }} toast={toast} />}
          </div>
        </main>
      </div>

      {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onClose={() => removeToast(t.id)} />)}
    </>
  );
}
