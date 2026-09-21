const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// ⚙️ CHANGE THIS to real URL when you have it
const UPSTREAM = "https://FRUX-JWT";

// 🔥 Set to true for DEMO, false for REAL
const DEMO_MODE = true;

const DELAY = 600;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============ DEMO GENERATOR ============ */
function demoGuestResponse(uid) {
  const jwt = crypto.randomBytes(48).toString("base64url");
  return {
    token: "eyJ" + jwt.slice(0, 80),
    uid,
    nickname: "Player_" + uid.slice(-4),
    region: "IN",
    guest_password: "ZxTGAR_" + crypto.randomBytes(6).toString("hex"),
    expires_in: 3600,
    issued_at: new Date().toISOString(),
    mode: "DEMO",
  };
}

function demoAccessResponse(token) {
  const jwt = crypto.randomBytes(48).toString("base64url");
  return {
    token: "eyJ" + jwt.slice(0, 80),
    uid: "7" + Math.floor(Math.random() * 1e9),
    nickname: "Access_" + token.slice(0, 6),
    region: "IN",
    expires_in: 3600,
    mode: "DEMO",
  };
}

/* ============ HEALTH ============ */
app.get("/api/health", (req, res) => {
  res.json({
    name: "NEXORA",
    status: "online",
    version: "1.0.0",
    mode: DEMO_MODE ? "DEMO" : "REAL",
    upstream: UPSTREAM,
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ============ BULK ACCESS ============ */
app.post("/api/access/bulk", async (req, res) => {
  const { tokens } = req.body || {};
  if (!Array.isArray(tokens) || !tokens.length)
    return res.status(400).json({ ok: false, error: "tokens required" });

  const results = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = String(tokens[i]).trim();

    if (DEMO_MODE) {
      await sleep(DELAY);
      results.push({ token, ok: true, data: demoAccessResponse(token) });
      continue;
    }

    try {
      const r = await axios.get(`${UPSTREAM}/FRUXACCESS?token=${token}`, { timeout: 15000 });
      results.push({ token, ok: true, data: r.data });
    } catch (e) {
      results.push({ token, ok: false, error: e.response?.data || e.message });
    }
    await sleep(DELAY);
  }

  res.json({ ok: true, mode: DEMO_MODE ? "DEMO" : "REAL", count: results.length, results });
});

/* ============ BULK GUEST ============ */
app.post("/api/guest/bulk", async (req, res) => {
  const { accounts } = req.body || {};
  if (!Array.isArray(accounts) || !accounts.length)
    return res.status(400).json({ ok: false, error: "accounts required" });

  const out = [];

  for (let i = 0; i < accounts.length; i++) {
    const { uid, password } = accounts[i];

    if (!uid) {
      out.push({ uid, ok: false, error: "uid missing" });
      continue;
    }

    if (DEMO_MODE) {
      await sleep(DELAY);
      // 20% random failure to mimic real world
      if (Math.random() < 0.15) {
        out.push({ uid, ok: false, error: "invalid guest password (demo)" });
      } else {
        out.push({ uid, ok: true, data: demoGuestResponse(uid) });
      }
      continue;
    }

    try {
      const r = await axios.get(`${UPSTREAM}/FRUXGUEST?uid=${uid}&password=${password}`, { timeout: 15000 });
      out.push({ uid, ok: true, data: r.data });
    } catch (e) {
      out.push({ uid, ok: false, error: e.response?.data || e.message });
    }
    await sleep(DELAY);
  }

  res.json({ ok: true, mode: DEMO_MODE ? "DEMO" : "REAL", count: out.length, results: out });
});

/* ============ UNBAN ============ */
app.post("/api/unban", async (req, res) => {
  const { uid, region, reason } = req.body || {};
  if (!uid) return res.status(400).json({ ok: false, error: "uid required" });

  await sleep(1200);

  res.json({
    ok: true,
    message: DEMO_MODE ? "Unban request submitted (DEMO)" : "Unban request submitted",
    uid,
    region: region || "IN",
    reason: reason || "false-positive",
    ticket: "NX-" + Date.now().toString(36).toUpperCase(),
    mode: DEMO_MODE ? "DEMO" : "REAL",
  });
});

/* ============ 404 ============ */
app.use((req, res) => {
  console.log(`❌ 404 → ${req.method} ${req.originalUrl}`);
  res.status(404).json({ ok: false, error: "not found", path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`🔥 NEXORA running → http://localhost:${PORT}`);
  console.log(`📡 Mode: ${DEMO_MODE ? "DEMO (fake data)" : "REAL (" + UPSTREAM + ")"}`);
  console.log(`📁 Static: ${path.join(__dirname, "public")}`);
});
