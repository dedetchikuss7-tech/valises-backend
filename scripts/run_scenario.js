/**
 * Valises Backend - Run Scenario (DX)
 * Node >= 18 (you have v24) => fetch available.
 *
 * Usage:
 *   node scripts/run_scenario.js --baseUrl http://localhost:3000
 */

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] ?? def;
}

const BASE_URL = arg("baseUrl", "http://localhost:3000");

async function jfetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
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
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}\n${msg}`);
  }

  return data;
}

function logTitle(t) {
  console.log("\n=== " + t + " ===");
}

async function main() {
  logTitle("Create users");
  const ts = Date.now();

  // Adjust if your /users DTO expects different fields.
  const travelerEmail = `traveler_${ts}@example.com`;
  const senderEmail = `sender_${ts}@example.com`;
  const password = "Passw0rd!";

  const traveler = await jfetch("/users", {
    method: "POST",
    body: JSON.stringify({ email: travelerEmail, password }),
  });

  const sender = await jfetch("/users", {
    method: "POST",
    body: JSON.stringify({ email: senderEmail, password }),
  });

  const travelerId = traveler.id ?? traveler.userId ?? traveler?.data?.id;
  const senderId = sender.id ?? sender.userId ?? sender?.data?.id;

  if (!travelerId || !senderId) {
    throw new Error("Could not parse created user ids from /users response.");
  }

  console.log("travelerId:", travelerId);
  console.log("senderId  :", senderId);

  logTitle("KYC: set traveler VERIFIED");
  await jfetch(`/kyc/users/${travelerId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ kycStatus: "VERIFIED" }),
  });

  const kyc = await jfetch(`/kyc/users/${travelerId}`, { method: "GET" });
  console.log("kycStatus:", kyc.kycStatus);

  logTitle("Create transaction");
  const amount = 1000;

  const tx = await jfetch("/transactions", {
    method: "POST",
    body: JSON.stringify({ senderId, travelerId, amount }),
  });

  const txId = tx.id;
  if (!txId) throw new Error("Could not parse transaction id from /transactions response.");
  console.log("transactionId:", txId);

  logTitle("Payment success (escrow credit)");
  await jfetch(`/transactions/${txId}/payment/success`, { method: "PATCH" });

  logTitle("Move status: IN_TRANSIT then DELIVERED");
  await jfetch(`/transactions/${txId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "IN_TRANSIT" }),
  });

  await jfetch(`/transactions/${txId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "DELIVERED" }),
  });

  logTitle("Open dispute");
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
  if (!disputeId) throw new Error("Could not parse dispute id from /disputes response.");
  console.log("disputeId:", disputeId);

  logTitle("Get dispute recommendation");
  const reco = await jfetch(`/disputes/${disputeId}/recommendation`, { method: "GET" });
  console.log("recommendation:", JSON.stringify(reco, null, 2));

  logTitle("Resolve dispute (SPLIT)");
  // decidedById: we use senderId here as placeholder (because your endpoint currently expects it).
  // Later when JWT/RBAC is enforced, this will be admin user id from req.user.
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

  console.log("resolution:", JSON.stringify(resolution, null, 2));

  logTitle("Get ledger entries");
  const ledger = await jfetch(`/transactions/${txId}/ledger`, { method: "GET" });
  console.log(JSON.stringify(ledger, null, 2));

  logTitle("Try release (should be idempotent + allowed because KYC VERIFIED)");
  const release = await jfetch(`/transactions/${txId}/release`, { method: "PATCH" });
  console.log("release:", JSON.stringify(release, null, 2));

  logTitle("Ledger after release attempt");
  const ledger2 = await jfetch(`/transactions/${txId}/ledger`, { method: "GET" });
  console.log(JSON.stringify(ledger2, null, 2));

  console.log("\n✅ Scenario OK");
}

main().catch((e) => {
  console.error("\n❌ Scenario FAILED\n" + (e?.stack || e?.message || String(e)));
  process.exit(1);
});