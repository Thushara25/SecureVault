# SecureVault — Project Report

> A Zero-Knowledge Encrypted Password Manager with Multi-Layer Cryptographic Architecture

---

## 1. Abstract

SecureVault is a client-side encrypted password manager built with React and Supabase that implements a **zero-knowledge architecture** — the server stores only ciphertext and has no ability to decrypt user data. The system uses a novel **multi-layer encryption pipeline** combining classical ciphers (Vigenère) with modern cryptographic standards (AES-256-CBC, RSA-2048 OAEP) and key derivation functions (PBKDF2-SHA256). Additionally, SecureVault provides **end-to-end encrypted peer-to-peer messaging** using a hybrid RSA + AES key-wrapping scheme. All cryptographic operations are performed client-side using the Web Crypto API, ensuring that sensitive data never leaves the user's browser in an unencrypted state.

---

## 2. Problem Statement

### Current Challenges in Password Management

1. **Password Reuse**: Users reuse passwords across services, leading to credential stuffing attacks
2. **Server-Side Attacks**: Centralized password managers that decrypt server-side create single points of failure
3. **Trust Model**: Users must trust the service provider not to access their data
4. **Key Compromise**: Loss of a single encryption key can expose all stored credentials
5. **Insecure Sharing**: Users share passwords via plaintext channels (email, SMS, chat)

### Solution

SecureVault addresses these challenges through:
- **Zero-knowledge architecture**: Server never sees plaintext
- **Multi-layer encryption**: Defense-in-depth — compromising one layer doesn't expose data
- **Client-side cryptography**: All encryption/decryption in the browser
- **Hybrid encrypted messaging**: Secure sharing without exposing passwords

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (BROWSER)                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐ │
│  │   Auth    │  │  Vault   │  │  Secure   │  │  Settings  │ │
│  │  Screen   │  │  Module  │  │   Share   │  │   Module   │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └─────┬──────┘ │
│       │              │              │              │         │
│       ▼              ▼              ▼              ▼         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              CRYPTO ENGINE (Web Crypto API)              ││
│  │   Vigenère │ AES-256-CBC │ RSA-2048 │ PBKDF2 │ SHA-256  ││
│  └──────────────────────────────────────────────────────────┘│
│       │              │              │              │         │
└───────┼──────────────┼──────────────┼──────────────┼─────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌────────────────────────────────────────────────────────┐
   │                   SUPABASE BACKEND                     │
   │   ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │
   │   │ Auth     │  │Profiles  │  │   PostgreSQL DB    │   │
   │   │ (JWT)    │  │(pub keys)│  │   (ciphertext)     │   │
   │   └──────────┘  └──────────┘  └───────────────────┘   │
   │              Row Level Security (RLS)                  │
   └────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
┌──────────────────────────────────────────────┐
│                    App.jsx                    │
│  (Routing, Auth State, Auto-Lock, Toasts)    │
├──────────┬───────────┬───────────┬───────────┤
│ AuthScr  │ VaultMod  │ ShareMod  │ Settings  │
│ Login    │ CRUD      │ Encrypt   │ Keys      │
│ Signup   │ Search    │ RSA Wrap  │ Account   │
│ RSA Gen  │ Breach    │ Send      │ Logout    │
│          │ Generate  │           │           │
├──────────┴───────────┴───────────┴───────────┤
│              Shared Components               │
│         Toast │ StrengthMeter                │
├──────────────────────────────────────────────┤
│              Libraries (lib/)                │
│      supabaseClient.js  │  crypto.js         │
└──────────────────────────────────────────────┘
```

---

## 4. Encryption Pipeline

### 4.1 Password Vault Pipeline

```
 USER INPUT                    STORAGE              USER OUTPUT
 ──────────                    ───────              ───────────

 Plaintext Password     ┌─▶ Supabase DB ─┐     Plaintext Password
       │                │   (ciphertext)  │            ▲
       ▼                │                 │            │
 ┌─────────────┐        │                 │    ┌───────────────┐
 │  Vigenère    │        │                 │    │   Vigenère     │
 │  Encrypt     │        │                 │    │   Decrypt      │
 │ (Layer 1)    │        │                 │    │  (Layer 1)     │
 └──────┬──────┘        │                 │    └───────┬───────┘
        ▼                │                 │            ▲
 ┌─────────────┐        │                 │    ┌───────────────┐
 │  AES-256    │        │                 │    │   AES-256     │
 │  CBC Encrypt│────────┘                 └───▶│   CBC Decrypt │
 │ (Layer 2)   │                               │  (Layer 2)    │
 └─────────────┘                               └───────────────┘
        ▲                                              ▲
        │                                              │
   Key derived via PBKDF2-SHA256              Key derived via PBKDF2-SHA256
   from Master Password                      from Master Password
   (100,000 iterations)                      (100,000 iterations)
```

### 4.2 Secure Messaging Pipeline

```
SENDER                                              RECIPIENT

 Message ──▶ AES-256-CBC ──▶ Encrypted Msg ──────▶ AES-256-CBC ──▶ Message
             (random key)                           (same key)
                  │                                      ▲
                  ▼                                      │
          Random AES Key ──▶ RSA-2048 ──▶ Wrapped Key ──▶ RSA-2048
                             Encrypt      (stored in DB)  Decrypt
                        (recipient's                 (recipient's
                         public key)                  private key)
```

### 4.3 Key Derivation

```
Master Password ──▶ PBKDF2 ──▶ AES-256 Key
                     │
                     ├── Salt: 16 random bytes
                     ├── Iterations: 100,000
                     ├── Hash: SHA-256
                     └── Output: 256-bit key
```

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
┌──────────────────┐        ┌────────────────────┐
│   auth.users     │        │     profiles        │
│ (Supabase Auth)  │        │                     │
├──────────────────┤        ├────────────────────┤
│ id (uuid) PK     │◀───────│ id (uuid) PK, FK   │
│ email            │        │ email (unique)      │
│ encrypted_pass   │        │ public_key (text)   │
│ ...              │        │ encrypted_priv_key  │
└──────┬───────────┘        │ created_at          │
       │                    └────────────────────┘
       │
       │    ┌─────────────────────────┐
       ├───▶│     vault_entries       │
       │    ├─────────────────────────┤
       │    │ id (uuid) PK            │
       │    │ user_id (uuid) FK       │
       │    │ site (text)             │
       │    │ url (text)              │
       │    │ username (text)         │
       │    │ encrypted_password      │
       │    │ encrypted_notes         │
       │    │ created_at              │
       │    └─────────────────────────┘
       │
       │    ┌─────────────────────────┐
       ├───▶│   secure_messages       │
            ├─────────────────────────┤
            │ id (uuid) PK            │
            │ sender_id (uuid) FK     │
            │ recipient_id (uuid) FK  │
            │ encrypted_aes_key       │
            │ encrypted_content       │
            │ is_file (boolean)       │
            │ created_at              │
            └─────────────────────────┘
```

### 5.2 Row Level Security Policies

| Table | Policy | Rule |
|-------|--------|------|
| `profiles` | Select | All users can view public keys |
| `profiles` | Insert/Update | Only own profile (`auth.uid() = id`) |
| `vault_entries` | All | Only own entries (`auth.uid() = user_id`) |
| `secure_messages` | Select | Sender or recipient (`auth.uid() = sender_id OR recipient_id`) |
| `secure_messages` | Insert | Only sender (`auth.uid() = sender_id`) |

---

## 6. Implementation Details

### 6.1 Technology Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Frontend** | React 19 | Component-based UI, hooks for state management |
| **Build Tool** | Vite 8 | Fast HMR, native ESM, optimized production builds |
| **Backend** | Supabase | Auth, PostgreSQL, RLS — no custom server needed |
| **Crypto** | Web Crypto API | Browser-native, hardware-accelerated, no third-party dependency |
| **Styling** | Vanilla CSS | Full control, glassmorphism effects, CSS animations |
| **Fonts** | Inter + Space Mono | Modern sans-serif + monospace for code/data display |

### 6.2 Module Structure

| Module | File | Lines | Purpose |
|--------|------|-------|---------|
| Supabase Client | `lib/supabaseClient.js` | ~115 | REST API client, query builder |
| Crypto Engine | `lib/crypto.js` | ~155 | All cryptographic operations |
| Auth Screen | `components/AuthScreen.jsx` | ~130 | Login, signup, key generation |
| Password Vault | `components/VaultModule.jsx` | ~240 | CRUD, breach check, generator |
| Secure Share | `components/ShareModule.jsx` | ~100 | Encrypted message sending |
| Inbox | `components/InboxModule.jsx` | ~115 | Received/sent messages |
| Settings | `components/SettingsModule.jsx` | ~100 | Account, keys, architecture |
| App Shell | `App.jsx` | ~210 | Routing, auth state, auto-lock |
| Design System | `styles/index.css` | ~850 | Complete CSS design system |

### 6.3 Key Features Implementation

#### Password Breach Check
Uses the **k-anonymity model** from HaveIBeenPwned:
1. Hash password with SHA-1
2. Send only the first 5 characters of the hash to the API
3. Receive all matching suffixes
4. Compare locally — the full hash is never sent to the server

#### Auto-Lock
- Monitors `mousedown`, `keydown`, `touchstart`, `scroll` events
- Resets a 5-minute timer on any activity
- On timeout: clears the master password from memory, shows lock screen
- User must re-enter master password to unlock

#### Multi-Layer Encryption
1. **Vigenère Cipher**: Classical substitution cipher using master password as key — provides obfuscation
2. **AES-256-CBC**: Industry-standard symmetric encryption with key derived from master password via PBKDF2
3. **RSA-2048 OAEP**: Asymmetric encryption used for secure key exchange in messaging

---

## 7. Security Analysis

### 7.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Server Compromise** | Zero-knowledge — server has only ciphertext |
| **Man-in-the-Middle** | HTTPS enforced; all crypto client-side |
| **Brute Force (Master Pwd)** | PBKDF2 with 100k iterations slows attempts |
| **Clipboard Leakage** | Auto-clears clipboard after 30 seconds |
| **Session Hijacking** | Auto-lock after 5 min; JWT auth tokens |
| **Cross-User Access** | Supabase RLS enforces per-user isolation |
| **Key Recovery** | Encrypted private key backup available |
| **Password Reuse** | Breach check against HaveIBeenPwned database |

### 7.2 Strengths

- **Defense in depth**: Multiple encryption layers mean compromising one layer alone is insufficient
- **Client-side crypto**: No server-side decryption capability
- **Standard algorithms**: AES-256, RSA-2048, PBKDF2 are NIST-approved
- **Hardware acceleration**: Web Crypto API uses OS-level crypto implementations

### 7.3 Limitations & Known Constraints

- **Browser dependency**: Private key stored in `localStorage` — cleared if browser data is wiped
- **Vigenère layer**: Provides obfuscation, not cryptographic security (AES-256 is the primary layer)
- **No key recovery**: If master password is lost, data cannot be recovered
- **Single device**: Private key must be manually backed up for multi-device access

---

## 8. User Interface

### Design System
- **Style**: Glassmorphism with backdrop blur effects
- **Colors**: Deep navy (#0a0f1e) base with cyan (#38bdf8) and indigo (#818cf8) accents
- **Typography**: Inter (body) + Space Mono (code/data)
- **Animations**: Floating orbs on auth, glow effects on hover, skeleton loading, pipeline animations
- **Responsive**: Mobile-first with collapsible sidebar at 768px breakpoint

### Screens
1. **Auth Screen** — Animated background with floating gradient orbs, glassmorphic login card, encryption pipeline preview
2. **Password Vault** — Stats dashboard, category filters, search, expandable entries with breach indicators
3. **Secure Share** — Encryption pipeline visualization, recipient search with key status
4. **Inbox** — Received/Sent tabs, decrypt-on-demand with status badges
5. **Settings** — Account info, RSA key display, architecture layers visualization, danger zone
6. **Lock Screen** — Auto-lock overlay with master password re-entry

---

## 9. Future Scope

1. **TOTP / 2FA Support** — Store and generate TOTP codes for 2FA-enabled sites
2. **Browser Extension** — Auto-fill passwords on websites
3. **Multi-Device Sync** — Encrypted key sharing across devices via QR code
4. **File Encryption** — Encrypt and share files with the same hybrid encryption
5. **Password Health Dashboard** — Aggregate strength analysis, duplicate detection, age tracking
6. **Group Sharing** — Share vault entries with teams using group RSA keys
7. **Audit Log** — Track access events and decryption attempts
8. **WebAuthn / Passkeys** — Biometric authentication as master password alternative

---

## 10. Conclusion

SecureVault demonstrates that a **zero-knowledge password manager** can be built entirely as a web application using standard browser APIs. By combining **multi-layer encryption** (Vigenère + AES-256-CBC + RSA-2048 OAEP) with **client-side cryptography** via the Web Crypto API, the system ensures that the server never has access to plaintext user data.

The modular React architecture makes the codebase maintainable and extensible, while the glassmorphic UI provides a premium user experience. The inclusion of features like **password breach checking**, **auto-lock**, and **encrypted peer-to-peer messaging** go beyond basic password management to provide a comprehensive security toolkit.

The project serves as both a **practical security tool** and an **educational demonstration** of modern cryptographic principles applied in a web application context.

---

## 11. References

1. **NIST SP 800-132** — Recommendation for Password-Based Key Derivation (PBKDF2)
2. **NIST FIPS 197** — Advanced Encryption Standard (AES)
3. **RFC 8017** — PKCS #1: RSA Cryptography Specifications v2.2 (OAEP)
4. **Web Crypto API** — W3C Specification: https://www.w3.org/TR/WebCryptoAPI/
5. **HaveIBeenPwned API** — Troy Hunt: https://haveibeenpwned.com/API/v3
6. **Supabase Documentation** — https://supabase.com/docs
7. **React Documentation** — https://react.dev
8. **Vigenère Cipher** — Friedrich Kasiski, 1863 (Cryptanalysis)

---

*Report prepared for SecureVault v2.0 | April 2026*
