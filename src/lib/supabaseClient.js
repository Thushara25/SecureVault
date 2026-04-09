// ── Supabase Client ──────────────────────────────────────
// Lightweight inline Supabase client using fetch directly

// ── CONFIG ── Replace with your Supabase project values ──
const SUPABASE_URL = "https://syqwkddyqfucltkxhqpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cXdrZGR5cWZ1Y2x0a3hocXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzc3MjgsImV4cCI6MjA5MTI1MzcyOH0.UP2awqIN9J-j8nmLGol0Hv4Oil2-220QSCIUnC285JI";

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

  query(table) { return new SupabaseQuery(this, table); }
}

export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export default supabase;
