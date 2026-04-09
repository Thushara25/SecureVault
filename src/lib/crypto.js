// ── CRYPTO UTILITIES ──────────────────────────────────────
// Multi-layer encryption: Vigenère → AES-256-CBC → RSA-2048 OAEP
// Key derivation: PBKDF2-SHA256 (100k iterations)

// ── Vigenère Cipher (Layer 1 — classical obfuscation) ─────
export const vigenereEncrypt = (text, key) => {
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

export const vigenereDecrypt = (text, key) => {
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

// ── AES-256-CBC via Web Crypto API (Layer 2) ──────────────
export const deriveKey = async (password, salt) => {
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

export const aesEncrypt = async (plaintext, password) => {
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

export const aesDecrypt = async (ciphertext, password) => {
  const combined = new Uint8Array(atob(ciphertext).split("").map(c => c.charCodeAt(0)));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 32);
  const encrypted = combined.slice(32);
  const key = await deriveKey(password, Array.from(salt).join(","));
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, encrypted);
  return new TextDecoder().decode(dec);
};

// ── AES for sharing (random key, raw) ─────────────────────
export const aesEncryptRaw = async (plaintext) => {
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

export const aesDecryptRaw = async (ciphertext, keyB64, ivB64) => {
  const key = new Uint8Array(atob(keyB64).split("").map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(ivB64).split("").map(c => c.charCodeAt(0)));
  const encrypted = new Uint8Array(atob(ciphertext).split("").map(c => c.charCodeAt(0)));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, encrypted);
  return new TextDecoder().decode(dec);
};

// ── RSA-2048 OAEP (Layer 3 — asymmetric key wrapping) ─────
export const generateRSAKeyPair = async () => {
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

export const rsaEncrypt = async (data, publicKeyB64) => {
  const binaryDer = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
  const pubKey = await crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

export const rsaDecrypt = async (cipherB64, privateKeyB64) => {
  const binaryDer = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const privKey = await crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const encrypted = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, encrypted);
  return new TextDecoder().decode(dec);
};

// ── SHA-256 hash ──────────────────────────────────────────
export const sha256 = async (text) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

// ── Password Utilities ────────────────────────────────────
export const getStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};

export const generatePassword = (length = 16, options = {}) => {
  const {
    uppercase = true,
    lowercase = true,
    digits = true,
    symbols = true,
  } = options;
  let chars = "";
  if (lowercase) chars += "abcdefghijklmnopqrstuvwxyz";
  if (uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (digits) chars += "0123456789";
  if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
  if (!chars) chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length]).join("");
};

// ── Password Breach Check (k-anonymity via HIBP API) ──────
export const checkPasswordBreach = async (password) => {
  try {
    const hash = await sha256(password);
    const prefix = hash.slice(0, 5).toUpperCase();
    const suffix = hash.slice(5).toUpperCase();
    // Use SHA-1 for HIBP (they require it)
    const sha1Buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const sha1 = Array.from(new Uint8Array(sha1Buf)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const sha1Prefix = sha1.slice(0, 5);
    const sha1Suffix = sha1.slice(5);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${sha1Prefix}`);
    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix.trim() === sha1Suffix) {
        return { breached: true, count: parseInt(count.trim(), 10) };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    return { breached: false, count: 0, error: true };
  }
};
