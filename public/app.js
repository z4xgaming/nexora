const $ = (id) => document.getElementById(id);

let ACCESS_RESULTS = [];
let ACCOUNTS = JSON.parse(localStorage.getItem("nexora_accounts") || "[]");

/* ============ TABS ============ */
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    t.classList.add("active");
    $(t.dataset.tab).classList.add("active");
    if (t.dataset.tab === "account") renderAccounts();
  });
});

/* ============ LOG ============ */
function log(el, text, cls = "info") {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}
function clearLog(el) { el.innerHTML = ""; }

/* ============ COUNTERS ============ */
function countLines(s) { return s.split("\n").map(x => x.trim()).filter(Boolean).length; }
$("accessTokens").addEventListener("input", (e) => {
  $("accessCount").textContent = countLines(e.target.value) + " tokens";
});
$("guestList").addEventListener("input", (e) => {
  $("guestCount").textContent = countLines(e.target.value) + " accounts";
});

/* ============ ACCESS ============ */
$("runAccess").addEventListener("click", async () => {
  const tokens = $("accessTokens").value.trim().split("\n").map(t => t.trim()).filter(Boolean);
  if (!tokens.length) return alert("Pehle tokens paste karo!");

  const btn = $("runAccess");
  btn.disabled = true;
  clearLog($("accessLog"));
  ACCESS_RESULTS = [];
  log($("accessLog"), `▶ Starting queue for ${tokens.length} tokens...`, "info");

  const res = await fetch("/api/access/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens })
  });
  const data = await res.json();

  if (!data.ok) {
    log($("accessLog"), `✖ ${data.error}`, "err");
    btn.disabled = false;
    return;
  }

  data.results.forEach((r, i) => {
    if (r.ok) {
      ACCESS_RESULTS.push(r);
      log($("accessLog"), `[${i + 1}] ✔ ${r.token.slice(0, 16)}... → OK`, "ok");
    } else {
      log($("accessLog"), `[${i + 1}] ✖ ${r.token.slice(0, 16)}... → ${JSON.stringify(r.error).slice(0, 80)}`, "err");
    }
  });

  log($("accessLog"), `■ Done. ${ACCESS_RESULTS.length}/${tokens.length} successful.`, "info");
  btn.disabled = false;
});

$("clearAccess").addEventListener("click", () => {
  $("accessTokens").value = "";
  $("accessCount").textContent = "0 tokens";
  clearLog($("accessLog"));
});

/* ============ GUEST ============ */
$("runGuest").addEventListener("click", async () => {
  const lines = $("guestList").value.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return alert("Pehle uid:password list paste karo!");

  const accounts = [];
  for (const line of lines) {
    const [uid, password] = line.split(":").map(s => s.trim());
    if (uid && password) accounts.push({ uid, password });
  }
  if (!accounts.length) return alert("Format: uid:password");

  const btn = $("runGuest");
  btn.disabled = true;
  clearLog($("guestLog"));
  log($("guestLog"), `▶ Extracting ${accounts.length} accounts...`, "info");

  const res = await fetch("/api/guest/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accounts })
  });
  const data = await res.json();

  if (!data.ok) {
    log($("guestLog"), `✖ ${data.error}`, "err");
    btn.disabled = false;
    return;
  }

  data.results.forEach((r, i) => {
    if (r.ok) {
      const d = JSON.stringify(r.data);
      log($("guestLog"), `[${i + 1}] ✔ ${r.uid} → ${d.slice(0, 120)}...`, "ok");
      saveAccount(r.uid, r.data);
    } else {
      log($("guestLog"), `[${i + 1}] ✖ ${r.uid} → ${JSON.stringify(r.error).slice(0, 80)}`, "err");
    }
  });

  log($("guestLog"), `■ Done.`, "info");
  btn.disabled = false;
  renderAccounts();
});

$("clearGuest").addEventListener("click", () => {
  $("guestList").value = "";
  $("guestCount").textContent = "0 accounts";
  clearLog($("guestLog"));
});

$("loadFromAccess").addEventListener("click", () => {
  if (!ACCESS_RESULTS.length) return alert("Pehle Access tab me process karo.");
  const lines = ACCESS_RESULTS.map((r) => {
    const uid = r.data?.uid || "UNKNOWN_UID";
    const pwd = r.data?.password || "";
    return `${uid}:${pwd}`;
  });
  $("guestList").value = lines.join("\n");
  $("guestCount").textContent = lines.length + " accounts";
});

/* ============ ACCOUNTS ============ */
function saveAccount(uid, data) {
  if (ACCOUNTS.find(a => a.uid === uid)) return;
  ACCOUNTS.push({ uid, data, added: Date.now() });
  localStorage.setItem("nexora_accounts", JSON.stringify(ACCOUNTS));
}

function renderAccounts() {
  const box = $("accountsList");
  $("accCount").textContent = ACCOUNTS.length + " accounts";

  if (!ACCOUNTS.length) {
    box.innerHTML = '<p class="empty">No accounts yet. Extract guests first.</p>';
    return;
  }

  box.innerHTML = ACCOUNTS.map((a, i) => `
    <div class="acc-card">
      <div class="acc-info">
        <b>UID:</b> ${a.uid}<br/>
        <span>${JSON.stringify(a.data).slice(0, 100)}...</span>
      </div>
      <div class="acc-actions">
        <button class="mini-btn copy" data-copy="${i}">Copy</button>
        <button class="mini-btn unban" data-unban="${i}">Unban</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-copy]").forEach(b => {
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(JSON.stringify(ACCOUNTS[+b.dataset.copy], null, 2));
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = "Copy"), 1200);
    });
  });

  box.querySelectorAll("[data-unban]").forEach(b => {
    b.addEventListener("click", () => unbanAccount(+b.dataset.unban, b));
  });
}

async function unbanAccount(index, btn) {
  const acc = ACCOUNTS[index];
  if (!acc) return;
  if (!confirm(`UID ${acc.uid} ko unban karna hai?`)) return;

  const orig = btn.textContent;
  btn.textContent = "Sending...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/unban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: acc.uid, region: "IN" })
    });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = "✔ Unbanned";
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
    } else {
      alert("Unban failed: " + (data.error || "unknown"));
      btn.textContent = orig;
      btn.disabled = false;
    }
  } catch (e) {
    alert("Error: " + e.message);
    btn.textContent = orig;
    btn.disabled = false;
  }
}

$("refreshAccounts").addEventListener("click", renderAccounts);

$("clearAccounts").addEventListener("click", () => {
  if (!confirm("Saare accounts delete?")) return;
  ACCOUNTS = [];
  localStorage.removeItem("nexora_accounts");
  renderAccounts();
});

$("exportAccounts").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(ACCOUNTS, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexora_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ============ INIT ============ */
renderAccounts();
