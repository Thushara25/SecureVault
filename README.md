# 🔐 SecureVault

> A hybrid multi-layer encryption system for secure password management and encrypted peer-to-peer messaging.

**Zero-knowledge architecture** — the server stores only ciphertext. Encryption and decryption happen entirely in your browser.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🔑 Password Vault | Store & retrieve passwords with multi-layer encryption |
| 📤 Secure Share | Send encrypted messages to other users (RSA + AES) |
| 📥 Inbox | Decrypt received messages locally in your browser |
| ⚙️ Settings | Manage your RSA keypair and account |

---

## 🔐 Encryption Architecture

```
Layer 1 → Vigenère Cipher        (classical obfuscation)
Layer 2 → AES-256-CBC            (symmetric bulk encryption)
Layer 3 → RSA-2048 OAEP          (asymmetric key wrapping for sharing)
Layer 4 → PBKDF2-SHA256          (key derivation from master password)
```

- Master password is **never** sent to the server
- Private RSA key is **encrypted** with your master password and stored in `localStorage`
- Only your **public key** is stored on the server
- Server stores **only ciphertext** — zero knowledge

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | CSS-in-JS (inline styles) |
| Backend | Supabase (Auth + PostgreSQL) |
| Crypto | Web Crypto API (built into browser) |
| Auth | Supabase JWT |

---

## 🚀 How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or above)
- [Git](https://git-scm.com)
- A [Supabase](https://supabase.com) account (free)

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/Thushara25/SecureVault.git
cd SecureVault
```

---

### Step 2 — Install dependencies

```bash
npm install
```

---

### Step 3 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) → create a new project
2. Go to **SQL Editor** → run this SQL:

```sql
create table profiles (
  id uuid references auth.users primary key,
  email text unique not null,
  public_key text,
  encrypted_private_key text,
  created_at timestamp default now()
);
alter table profiles enable row level security;
create policy "Users can view all profiles" on profiles for select using (true);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

create table vault_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  site text not null,
  url text,
  username text,
  encrypted_password text not null,
  encrypted_notes text,
  created_at timestamp default now()
);
alter table vault_entries enable row level security;
create policy "Users manage own vault" on vault_entries for all using (auth.uid() = user_id);

create table secure_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users not null,
  recipient_id uuid references auth.users not null,
  encrypted_aes_key text not null,
  encrypted_content text not null,
  file_name text,
  file_type text,
  is_file boolean default false,
  created_at timestamp default now()
);
alter table secure_messages enable row level security;
create policy "Users see own messages" on secure_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Users send messages" on secure_messages
  for insert with check (auth.uid() = sender_id);
```

3. Go to **Authentication → Providers → Email** → disable **"Confirm email"** → Save

4. Go to **Project Settings → API** and copy your **Project URL** and **Anon public key**

---

### Step 4 — Add your Supabase keys

Open `src/SecureVault.jsx` and replace lines 58–59:

```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
```

---

### Step 5 — Start the app

```bash
npm run dev
```

Open your browser at **http://localhost:5173**

---

## 👥 Adding Teammates as Collaborators

1. Go to your repo on GitHub → **Settings → Collaborators**
2. Click **"Add people"**
3. Enter their GitHub username or email
4. They accept the invite → they can clone and push

---

## 📁 Project Structure

```
SecureVault/
├── src/
│   ├── SecureVault.jsx   ← entire app (auth, vault, share, inbox)
│   └── main.jsx          ← entry point
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 🔒 Security Notes

| Property | Implementation |
|----------|---------------|
| Zero-knowledge | Server stores only ciphertext |
| Private key | Encrypted in localStorage, never sent raw |
| Master password | Only in memory during session, never persisted |
| Clipboard | Auto-clears after 30 seconds |
| Row Level Security | Supabase RLS enforces per-user data isolation |

---

## 📄 License

MIT — free to use for educational purposes.
