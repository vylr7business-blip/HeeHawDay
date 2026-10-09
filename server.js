// HeeHawDay server for Railway. Serves the game and guide, the coin config, and wallet-based saves.
// No dependencies: Node's built-in crypto verifies Solana (ed25519) signatures.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
// Saves need persistent disk: on Railway, attach a volume (its mount path is picked up automatically).
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT, ".data");
const SAVE_DIR = path.join(DATA_DIR, "saves");
fs.mkdirSync(SAVE_DIR, { recursive: true });

const TYPES = { ".mp4": "video/mp4", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };
const ROUTES = { "/": "/index.html", "/docs": "/docs.html", "/guide": "/docs.html" };
const MAX_SAVE_BYTES = 200 * 1024;
// Set SITE_LOCKED=1 in Railway to show the "coming soon" page instead of the game (no redeploy needed to flip it).
// While locked, PREVIEW_KEY lets you in: visit /?preview=<key> once and this browser can play.
const locked = () => process.env.SITE_LOCKED === "1";
const LOCKED_ASSETS = new Set(["/coming-soon.html", "/favicon.png", "/favicon.ico", "/apple-touch-icon.png", "/banner.png", "/donkey.svg", "/trailer.mp4"]);
function hasPreview(req, url) {
  const key = process.env.PREVIEW_KEY; if (!key) return false;
  if (url.searchParams.get("preview") === key) return "set";
  return (req.headers.cookie || "").split(/;\s*/).includes(`hhd_preview=${key}`);
}
const TOKEN_DAYS = 30;

/* ---------- secret for session tokens (kept on the volume so logins survive restarts) ---------- */
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, "secret");
  try { return fs.readFileSync(f, "utf8"); } catch (e) {}
  const s = crypto.randomBytes(32).toString("hex");
  try { fs.writeFileSync(f, s, { mode: 0o600 }); } catch (e) {}
  return s;
}
const SECRET = loadSecret();

/* ---------- base58 (Solana addresses) ---------- */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(str) {
  if (typeof str !== "string" || !str.length || str.length > 100) return null;
  let n = 0n;
  for (const ch of str) { const v = B58.indexOf(ch); if (v < 0) return null; n = n * 58n + BigInt(v); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  const body = n === 0n ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  let zeros = 0; while (zeros < str.length && str[zeros] === "1") zeros++;
  return Buffer.concat([Buffer.alloc(zeros), body]);
}
const validWallet = w => { const b = b58decode(w); return !!b && b.length === 32; };

/* ---------- login: the wallet signs a short message containing a fresh nonce ---------- */
const nonces = new Map(); // wallet -> { nonce, exp }
function loginMessage(wallet, nonce) {
  return `Sign in to HeeHawDay to save your farm.\n\nWallet: ${wallet}\nNonce: ${nonce}\n\nThis only proves you own this wallet. It is free and does not send a transaction.`;
}
function verifySignature(wallet, message, sigB64) {
  try {
    const pub = b58decode(wallet);
    const key = crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: pub.toString("base64url") }, format: "jwk" });
    return crypto.verify(null, Buffer.from(message, "utf8"), key, Buffer.from(sigB64, "base64"));
  } catch (e) { return false; }
}
function makeToken(wallet) {
  const exp = Date.now() + TOKEN_DAYS * 864e5;
  const body = `${wallet}.${exp}`;
  return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}
function checkToken(token) {
  if (typeof token !== "string") return null;
  const parts = token.split("."); if (parts.length !== 3) return null;
  const [wallet, exp, mac] = parts;
  const good = crypto.createHmac("sha256", SECRET).update(`${wallet}.${exp}`).digest("base64url");
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  if (+exp < Date.now() || !validWallet(wallet)) return null;
  return wallet;
}
const saveFile = wallet => path.join(SAVE_DIR, `${wallet}.json`);
function readSave(wallet) { try { return JSON.parse(fs.readFileSync(saveFile(wallet), "utf8")); } catch (e) { return null; } }

/* ---------- helpers ---------- */
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
const bearer = req => { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7) : null; };

/* ---------- API ---------- */
async function api(req, res, p, query) {
  if (p === "/api/config") return json(res, 200, { ca: (process.env.COIN_CA || "").trim(), saves: true });

  if (p === "/api/nonce" && req.method === "GET") {
    const wallet = query.get("wallet");
    if (!validWallet(wallet)) return json(res, 400, { error: "That doesn't look like a Solana wallet address." });
    const nonce = crypto.randomBytes(12).toString("hex");
    nonces.set(wallet, { nonce, exp: Date.now() + 5 * 60e3 });
    if (nonces.size > 5000) for (const [k, v] of nonces) if (v.exp < Date.now()) nonces.delete(k);
    return json(res, 200, { message: loginMessage(wallet, nonce) });
  }

  if (p === "/api/login" && req.method === "POST") {
    let body; try { body = JSON.parse(await readBody(req, 4096)); } catch (e) { return json(res, 400, { error: "Bad request." }); }
    const { wallet, signature } = body || {};
    const n = nonces.get(wallet);
    if (!validWallet(wallet) || !n || n.exp < Date.now()) return json(res, 400, { error: "Sign-in timed out. Connect again." });
    nonces.delete(wallet);
    if (!verifySignature(wallet, loginMessage(wallet, n.nonce), signature || "")) return json(res, 401, { error: "The signature didn't match this wallet." });
    return json(res, 200, { token: makeToken(wallet), save: readSave(wallet) });
  }

  if (p === "/api/save") {
    let token = bearer(req), raw = null;
    if (req.method === "POST") {
      try { raw = await readBody(req, MAX_SAVE_BYTES); } catch (e) { return json(res, 413, { error: "Save is too large." }); }
      if (!token) { try { token = JSON.parse(raw).token; } catch (e) {} } // sendBeacon can't set headers
    }
    const wallet = checkToken(token);
    if (!wallet) return json(res, 401, { error: "Reconnect your wallet to keep saving." });
    if (req.method === "GET") return json(res, 200, { save: readSave(wallet) });
    if (req.method === "POST") {
      let data; try { data = JSON.parse(raw); } catch (e) { return json(res, 400, { error: "Bad save data." }); }
      const state = data && data.state;
      if (!state || typeof state !== "object" || typeof state.lvl !== "number" || typeof state.inv !== "object") return json(res, 400, { error: "Bad save data." });
      const savedAt = Date.now(), tmp = saveFile(wallet) + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify({ ...state, savedAt }));
      fs.renameSync(tmp, saveFile(wallet));
      return json(res, 200, { ok: true, savedAt });
    }
  }
  return json(res, 404, { error: "Not found." });
}

/* ---------- server ---------- */
http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  let p; try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  const pv = locked() ? hasPreview(req, url) : true;
  if (pv === "set") res.setHeader("Set-Cookie", `hhd_preview=${process.env.PREVIEW_KEY}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`);
  if (locked() && !pv) {
    if (p === "/api/config") return json(res, 200, { ca: (process.env.COIN_CA || "").trim(), locked: true });
    if (p.startsWith("/api/")) return json(res, 403, { error: "HeeHawDay is coming soon." });
    if (!LOCKED_ASSETS.has(p)) p = "/coming-soon.html";
  }
  if (p.startsWith("/api/")) {
    try { return await api(req, res, p, url.searchParams); }
    catch (e) { console.error(e); return json(res, 500, { error: "Server error." }); }
  }
  p = ROUTES[p] || p;
  if (!path.extname(p)) p = "/index.html";
  const file = path.join(ROOT, path.normalize(p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("..") || rel.split(path.sep).some(seg => seg.startsWith(".")) || /^(server\.js|build\.py|package\.json|game\.html)$/.test(rel)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => console.log(`HeeHawDay running on port ${PORT}, saves in ${SAVE_DIR}`));
