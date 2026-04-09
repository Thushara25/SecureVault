<div align="center">

# 🔐 SecureVault

### Zero-Knowledge Encrypted Password Manager

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A hybrid multi-layer encryption system for secure password management and encrypted peer-to-peer messaging. The server stores only ciphertext — encryption and decryption happen entirely in your browser.**

</div>

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🔑 **Password Vault** | Store & retrieve passwords with multi-layer encryption (Vigenère → AES-256 → Database) |
| ✏️ **Edit Entries** | Full CRUD — add, edit, and delete vault entries |
| 🔍 **Breach Check** | Check passwords against HaveIBeenPwned using k-anonymity (SHA-1 prefix) |
| ⚡ **Smart Generator** | Generate passwords with customizable length, character sets (A-Z, a-z, 0-9, symbols) |
| 📤 **Secure Share** | Send encrypted messages to other users using hybrid RSA + AES encryption |
| 📥 **Inbox** | Decrypt received messages locally; view sent and received messages |
| 🔒 **Auto-Lock** | Vault auto-locks after 5 minutes of inactivity for security |
| 📱 **Mobile Responsive** | Collapsible sidebar with hamburger menu for mobile devices |
| 🏷️ **Categories** | Filter vault entries by category (Social, Work, Finance, etc.) |

---

## 🔐 Encryption Architecture

```
┌──────────────────────────────────────────────────────┐
│                   ENCRYPTION PIPELINE                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📝 Plaintext                                        │
│    │                                                 │
│    ▼                                                 │
│  Layer 1 → Vigenère Cipher (classical obfuscation)   │
│    │                                                 │
│    ▼                                                 │
│  Layer 2 → AES-256-CBC (symmetric bulk encryption)   │
│    │         Key derived via PBKDF2-SHA256            │
│    │         100,000 iterations                      │
│    ▼                                                 │
│  💾 Stored in Database (ciphertext only)             │
│                                                      │
├──────────────────────────────────────────────────────┤
│              SECURE SHARING PIPELINE                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📝 Message                                          │
│    │                                                 │
│    ▼                                                 │
│  AES-256-CBC → Encrypt message (random key)          │
│    │                                                 │
│    ▼                                                 │
│  RSA-2048 OAEP → Wrap AES key with recipient's      │
│                   public key                         │
│    │                                                 │
│    ▼                                                 │
│  📤 Send encrypted payload                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Zero-Knowledge Guarantees

| Property | Implementation |
|----------|----------------|
| **Zero-knowledge** | Server stores only ciphertext — cannot read your data |
| **Private key** | Encrypted with master password, stored in `localStorage` |
| **Master password** | Only in memory during session, never sent to server |
| **Clipboard** | Auto-clears after 30 seconds |
| **Auto-lock** | Vault locks after 5 min inactivity |
| **Row Level Security** | Supabase RLS enforces per-user data isolation |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Vanilla CSS (glassmorphism, animations, responsive) |
| Backend | Supabase (Auth + PostgreSQL + RLS) |
| Crypto | Web Crypto API (AES-256-CBC, RSA-2048 OAEP, PBKDF2-SHA256) |
| Breach API | HaveIBeenPwned (k-anonymity SHA-1 prefix model) |
| Fonts | Inter + Space Mono (Google Fonts) |

---

## 📁 Project Structure

```
SecureVault/
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js   ← Supabase client, query builder, config
│   │   └── crypto.js           ← Vigenère, AES, RSA, PBKDF2, breach check
│   ├── components/
│   │   ├── AuthScreen.jsx      ← Login/Signup with animated background
│   │   ├── VaultModule.jsx     ← Password vault (CRUD, breach, generator)
│   │   ├── ShareModule.jsx     ← Encrypted message sending
│   │   ├── InboxModule.jsx     ← Received/Sent messages
│   │   ├── SettingsModule.jsx  ← Account, keys, architecture info
│   │   ├── Toast.jsx           ← Toast notifications
│   │   └── StrengthMeter.jsx   ← Password strength indicator
│   ├── styles/
│   │   └── index.css           ← Complete design system
│   ├── App.jsx                 ← Main shell (sidebar, routing, auto-lock)
│   └── main.jsx                ← React entry point
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── REPORT.md                   ← Full project report & documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- [Supabase](https://supabase.com) account (free tier)

### 1. Clone & Install

```bash
git clone https://github.com/Thushara25/SecureVault.git
cd SecureVault
npm install
```

### 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run this SQL in **SQL Editor**:

```sql
-- Profiles table
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

-- Vault entries table
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

-- Secure messages table
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
4. Go to **Project Settings → API** → copy **Project URL** and **Anon public key**

### 3. Add Your Keys

Open `src/lib/supabaseClient.js` and replace:

```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
```

### 4. Run

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🔒 How It Works

1. **Sign Up** → RSA-2048 keypair generated in browser → public key stored on server, private key encrypted with your master password & stored in `localStorage`
2. **Add Password** → Plaintext → Vigenère cipher → AES-256-CBC encryption → stored as ciphertext in database
3. **View Password** → Ciphertext fetched → AES-256-CBC decryption → Vigenère decryption → displayed briefly, then auto-cleared
4. **Share Message** → Message encrypted with random AES key → AES key wrapped with recipient's RSA public key → sent to database
5. **Receive Message** → RSA decrypt the AES key using your private key → AES decrypt the message → displayed locally

---

## 📄 License

MIT — free to use for educational purposes.
