const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 3000;
const UPSTREAM = "https://FRUX-JWT";
const DELAY = 800;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============ HEALTH ============ */
app.get("/api/health", (req, res) => {
  res.json({ name: "NEXORA", status: "online", version: "1.0.0" });
});

/* ============ ROOT (index.html) ============ */
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
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      results.push({ token, ok: false, error: "invalid format" });
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
  res.json({ ok: true, count: results.length, results });
});

/* ============ BULK GUEST ============ */
app.post("/api/guest/bulk", async (req, res) => {
  const { accounts } = req.body || {};
  if (!Array.isArray(accounts) || !accounts.length)
    return res.status(400).json({ ok: false, error: "accounts required" });

  const out = [];
  for (let i = 0; i < accounts.length; i++) {
    const { uid, password } = accounts[i];
    if (!uid || !password) {
      out.push({ uid, ok: false, error: "missing fields" });
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
  res.json({ ok: true, count: out.length, results: out });
});

/* ============ UNBAN ============ */
app.post("/api/unban", async (req, res) => {
  const { uid, region, reason } = req.body || {};
  if (!uid) return res.status(400).json({ ok: false, error: "uid required" });

  await sleep(1200);
  res.json({
    ok: true,
    message: "Unban request submitted",
    uid,
    region: region || "IN",
    reason: reason || "false-positive",
    ticket: "NX-" + Date.now().toString(36).toUpperCase(),
  });
});

/* ============ 404 with logging ============ */
app.use((req, res) => {
  console.log(`❌ 404 → ${req.method} ${req.originalUrl}`);
  res.status(404).json({ ok: false, error: "not found", path: req.originalUrl, method: req.method });
});

app.listen(PORT, () => {
  console.log(`🔥 NEXORA running → http://localhost:${PORT}`);
  console.log(`📁 Serving static from: ${path.join(__dirname, "public")}`);
});
