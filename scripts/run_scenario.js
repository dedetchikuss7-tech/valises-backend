/* scripts/run_scenario.js */
const fs = require("fs");
const path = require("path");

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] ?? def;
}

const BASE_URL = arg("baseUrl", "http://localhost:3000");
const OUT_FILE = path.join(process.cwd(), ".tmp_scenario.json");

async function jfetch(pathname, options = {}) {
  const url = `${BASE_URL}${pathname}`;
  const res = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${pathname}\n${msg}`);
  }
  return data;
}

function writeOut(obj) {
  fs.writeFileSync(OUT_FILE, JSON.stringify(obj, null, 2), "utf8");
}

(async () => {
  const ts = Date.now();
  const password = "Passw0rd!";

  const travelerEmail = `traveler_${ts}@example.com`;
  const senderEmail = `sender_${ts}@example.com`;

  // 1) create users
  const traveler = await jfetch("/users", {
    method: "POST",
    body: JSON.stringify({ email: travelerEmail, password }),
  });
  const sender = await jfetch("/users", {
    method: "POST",
    body: JSON.stringify({ email: senderEmail, password }),
  });

  const travelerId = traveler.id;
  const senderId = sender.id;

  // 2) KYC traveler -> VERIFIED
  await jfetch(`/kyc/users/${travelerId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ kycStatus: "VERIFIED" }),
  });

  // 3) create tx
  const tx = await jfetch("/transactions", {
    method: "POST",
    body: JSON.stringify({ senderId, travelerId, amount: 1000 }),
  });
  const txId = tx.id;

  // 4) payment success + lifecycle
  await jfetch(`/transactions/${txId}/payment/success`, { method: "PATCH" });
  await jfetch(`/transactions/${txId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "IN_TRANSIT" }),
  });
  await jfetch(`/transactions/${txId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "DELIVERED" }),
  });

  // 5) open dispute
  const dispute = await jfetch("/disputes", {
    method: "POST",
    body: JSON.stringify({
      transactionId: txId,
      openedById: senderId,
      reason: "Package damaged",
      reasonCode: "DAMAGED",
    }),
  });
  const disputeId = dispute.id;

  // 6) recommendation
  const reco = await jfetch(`/disputes/${disputeId}/recommendation`, { method: "GET" });

  // 7) resolve (split 50/50)
  const resolution = await jfetch(`/disputes/${disputeId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({
      decidedById: senderId,
      outcome: "SPLIT",
      evidenceLevel: "BASIC",
      refundAmount: 500,
      releaseAmount: 500,
      notes: "Auto scenario split 50/50",
    }),
  });

  // 8) ledger
  const ledger = await jfetch(`/transactions/${txId}/ledger`, { method: "GET" });

  writeOut({
    baseUrl: BASE_URL,
    travelerEmail,
    senderEmail,
    travelerId,
    senderId,
    transactionId: txId,
    disputeId,
    recommendation: reco,
    resolution,
    ledger,
  });

  console.log("SCENARIO_OK");
})().catch((e) => {
  console.error("SCENARIO_FAILED");
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});