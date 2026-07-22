importScripts("crypto.js");

const META_KEY = "vk_meta";
const DATA_KEY = "vk_data";
const PENDING_KEY = "vk_pending";

function getLocal(keys) {
  return new Promise((res) => chrome.storage.local.get(keys, res));
}
function setLocal(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}
function getSession(keys) {
  return new Promise((res) => chrome.storage.session.get(keys, res));
}

async function getSessionPassword() {
  const r = await getSession(["vk_pw"]);
  return r.vk_pw || null;
}

async function loadVault() {
  const pw = await getSessionPassword();
  if (!pw) return null; // locked
  const meta = (await getLocal([META_KEY]))[META_KEY];
  if (!meta) return null;
  const key = await VK.deriveKey(pw, meta.salt);
  const dataPayload = (await getLocal([DATA_KEY]))[DATA_KEY];
  const entries = dataPayload ? await VK.decryptJSON(key, dataPayload) : [];
  return { key, entries };
}

async function saveVault(key, entries) {
  const payload = await VK.encryptJSON(key, entries);
  await setLocal({ [DATA_KEY]: payload });
}

async function refreshBadge() {
  const pending = (await getLocal([PENDING_KEY]))[PENDING_KEY] || [];
  if (pending.length > 0) {
    chrome.action.setBadgeText({ text: String(pending.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#D9B36C" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  if (msg.type === "CAPTURE_LOGIN") {
    const { domain, user, pass } = msg;
    const vault = await loadVault();

    if (!vault) {
      // Vault is locked — queue this login to be confirmed when unlocked
      const pending = (await getLocal([PENDING_KEY]))[PENDING_KEY] || [];
      const dup = pending.find((p) => p.domain === domain && p.user === user);
      if (!dup) {
        pending.push({ id: crypto.randomUUID(), domain, user, pass, ts: Date.now() });
        await setLocal({ [PENDING_KEY]: pending });
        await refreshBadge();
      }
      return { status: "pending" };
    }

    const existing = vault.entries.find((e) => e.site === domain && e.user === user);
    if (existing) {
      if (existing.pass === pass) return { status: "unchanged" };
      existing.pass = pass;
    } else {
      vault.entries.push({ id: crypto.randomUUID(), site: domain, user, pass, note: "" });
    }
    await saveVault(vault.key, vault.entries);
    return { status: "saved" };
  }

  if (msg.type === "CHECK_UNLOCKED") {
    const pw = await getSessionPassword();
    return { unlocked: !!pw };
  }
}
