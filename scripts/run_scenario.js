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
  const email = `smoke_${ts}@example.com`;

  console.log("[1/4] Register user...");
  const registered = await jfetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  console.log("[2/4] Login...");
  const login = await jfetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const accessToken = login.accessToken;
  const userId = login.user?.id || registered.id;

  if (!accessToken) {
    throw new Error("Login succeeded but accessToken is missing");
  }

  if (!userId) {
    throw new Error("Unable to determine user id after register/login");
  }

  console.log("[3/4] Read protected route with Bearer token...");
  const me = await jfetch(`/users/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log("[4/4] Read health endpoint...");
  const health = await jfetch("/health", {
    method: "GET",
  });

  writeOut({
    baseUrl: BASE_URL,
    registeredUser: registered,
    loginUser: login.user,
    protectedUserRead: me,
    health,
  });

  console.log("SCENARIO_OK");
})().catch((e) => {
  console.error("SCENARIO_FAILED");
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});
