const META_KEY = "vk_meta";
const DATA_KEY = "vk_data";
const PENDING_KEY = "vk_pending";

function getLocal(keys) { return new Promise((res) => chrome.storage.local.get(keys, res)); }
function setLocal(obj) { return new Promise((res) => chrome.storage.local.set(obj, res)); }
function getSession(keys) { return new Promise((res) => chrome.storage.session.get(keys, res)); }
function setSession(obj) { return new Promise((res) => chrome.storage.session.set(obj, res)); }
function removeSession(keys) { return new Promise((res) => chrome.storage.session.remove(keys, res)); }

let sessionKey = null;
let entries = [];
let editingId = null;

const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateSub = document.getElementById("gateSub");
const masterInput = document.getElementById("masterInput");
const masterInput2 = document.getElementById("masterInput2");
const gateBtn = document.getElementById("gateBtn");
const gateErr = document.getElementById("gateErr");
const modeToggle = document.getElementById("modeToggle");

async function hasVault() {
  const meta = (await getLocal([META_KEY]))[META_KEY];
  return !!meta;
}

function setupMode() {
  masterInput2.style.display = "block";
  gateBtn.textContent = "Create Vault";
  gateSub.textContent = "Master password banao — yehi saari passwords lock/unlock karega. Bhool na jaana, recover nahi hoga.";
  modeToggle.innerHTML = "";
}

function unlockMode() {
  masterInput2.style.display = "none";
  gateBtn.textContent = "Unlock Vault";
  gateSub.textContent = "Master password daal kar unlock karo.";
  modeToggle.innerHTML = 'Vault reset karni hai? <a id="resetLink">Sab delete karo</a>';
  const link = document.getElementById("resetLink");
  if (link) {
    link.onclick = async () => {
      if (confirm("Poori vault delete ho jayegi. Confirm?")) {
        await new Promise((res) => chrome.storage.local.clear(res));
        await new Promise((res) => chrome.storage.session.clear(res));
        location.reload();
      }
    };
  }
}

(async () => {
  if (await hasVault()) unlockMode(); else setupMode();
  // if already unlocked this browser session, skip gate
  const pw = (await getSession(["vk_pw"])).vk_pw;
  if (pw && (await hasVault())) {
    const meta = (await getLocal([META_KEY]))[META_KEY];
    try {
      sessionKey = await VK.deriveKey(pw, meta.salt);
      const dataPayload = (await getLocal([DATA_KEY]))[DATA_KEY];
      entries = dataPayload ? await VK.decryptJSON(sessionKey, dataPayload) : [];
      openApp();
    } catch (e) { /* fall through to gate */ }
  }
})();

async function handleGate() {
  gateErr.textContent = "";
  const pw = masterInput.value;
  if (!pw) { gateErr.textContent = "Password khali nahi ho sakta"; return; }

  if (!(await hasVault())) {
    const pw2 = masterInput2.value;
    if (pw.length < 6) { gateErr.textContent = "Kam se kam 6 characters rakho"; return; }
    if (pw !== pw2) { gateErr.textContent = "Passwords match nahi kar rahe"; return; }

    const salt = VK.bufToB64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await VK.deriveKey(pw, salt);
    const verifier = await VK.encryptJSON(key, { check: "vaultkeep-ok" });
    await setLocal({ [META_KEY]: { salt, verifier } });
    const emptyData = await VK.encryptJSON(key, []);
    await setLocal({ [DATA_KEY]: emptyData });
    await setSession({ vk_pw: pw });

    sessionKey = key;
    entries = [];
    openApp();
  } else {
    const meta = (await getLocal([META_KEY]))[META_KEY];
    try {
      const key = await VK.deriveKey(pw, meta.salt);
      const check = await VK.decryptJSON(key, meta.verifier);
      if (check.check !== "vaultkeep-ok") throw new Error("bad");
      sessionKey = key;
      await setSession({ vk_pw: pw });
      const dataPayload = (await getLocal([DATA_KEY]))[DATA_KEY];
      entries = dataPayload ? await VK.decryptJSON(key, dataPayload) : [];
      openApp();
    } catch (e) {
      gateErr.textContent = "Galat master password";
    }
  }
}

gateBtn.onclick = handleGate;
masterInput2.addEventListener("keydown", (e) => { if (e.key === "Enter") handleGate(); });
masterInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { if (masterInput2.style.display === "none") handleGate(); else masterInput2.focus(); }
});

document.getElementById("lockBtn").onclick = async () => {
  await removeSession(["vk_pw"]);
  location.reload();
};

async function openApp() {
  gate.style.display = "none";
  app.style.display = "block";
  await loadPending();
  renderList();
}

/* ---------- pending captures ---------- */
async function loadPending() {
  const pending = (await getLocal([PENDING_KEY]))[PENDING_KEY] || [];
  const box = document.getElementById("pendingBox");
  const list = document.getElementById("pendingList");
  if (pending.length === 0) { box.style.display = "none"; return; }
  box.style.display = "block";
  list.innerHTML = "";
  pending.forEach((p) => {
    const row = document.createElement("div");
    row.className = "pend-item";
    row.innerHTML = `<span>${escapeHTML(p.domain)} — ${escapeHTML(p.user || "no user")}</span>
      <span><button data-accept="${p.id}">Save</button><button class="discard" data-discard="${p.id}">✕</button></span>`;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-accept]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.accept;
      const all = (await getLocal([PENDING_KEY]))[PENDING_KEY] || [];
      const p = all.find((x) => x.id === id);
      if (p) {
        const existing = entries.find((e) => e.site === p.domain && e.user === p.user);
        if (existing) existing.pass = p.pass;
        else entries.push({ id: crypto.randomUUID(), site: p.domain, user: p.user, pass: p.pass, note: "" });
        await persist();
      }
      await removePending(id);
      renderList();
    };
  });
  list.querySelectorAll("[data-discard]").forEach((btn) => {
    btn.onclick = () => removePending(btn.dataset.discard);
  });
}

async function removePending(id) {
  const all = (await getLocal([PENDING_KEY]))[PENDING_KEY] || [];
  const filtered = all.filter((x) => x.id !== id);
  await setLocal({ [PENDING_KEY]: filtered });
  chrome.action.setBadgeText({ text: filtered.length ? String(filtered.length) : "" });
  loadPending();
}

/* ---------- auto-save ---------- */
let saveTimeout;
async function persist() {
  const payload = await VK.encryptJSON(sessionKey, entries);
  await setLocal({ [DATA_KEY]: payload });
  const tag = document.getElementById("savedTag");
  tag.classList.add("show");
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => tag.classList.remove("show"), 1200);
}

/* ---------- render ---------- */
const listEl = document.getElementById("list");
document.getElementById("searchInput").addEventListener("input", renderList);

function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function renderList() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = entries.filter((e) => e.site.toLowerCase().includes(q) || (e.user || "").toLowerCase().includes(q));
  listEl.innerHTML = "";
  if (entries.length === 0) { listEl.innerHTML = `<div class="empty">Koi entry nahi. '+' se add karo, ya kisi site pe login karo.</div>`; return; }
  if (filtered.length === 0) { listEl.innerHTML = `<div class="empty">Kuch nahi mila.</div>`; return; }

  filtered.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div class="entry-top">
        <div class="entry-site">${escapeHTML(entry.site)}</div>
        <div class="entry-actions">
          <button data-edit="${entry.id}">✎</button>
          <button data-del="${entry.id}">✕</button>
        </div>
      </div>
      <div class="entry-row"><span class="val">${escapeHTML(entry.user)}</span><button data-copy="${entry.id}" data-field="user">Copy</button></div>
      <div class="entry-row"><span class="val" id="pw-${entry.id}">••••••••</span><button data-toggle="${entry.id}">Show</button><button data-copy="${entry.id}" data-field="pass">Copy</button></div>
    `;
    listEl.appendChild(div);
  });
}

listEl.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;
  const toggleId = e.target.dataset.toggle;
  const copyId = e.target.dataset.copy;

  if (editId) openModal(editId);
  if (delId) {
    if (confirm("Delete karni hai?")) {
      entries = entries.filter((x) => x.id !== delId);
      await persist();
      renderList();
    }
  }
  if (toggleId) {
    const span = document.getElementById("pw-" + toggleId);
    const entry = entries.find((x) => x.id === toggleId);
    if (span.textContent === "••••••••") { span.textContent = entry.pass; e.target.textContent = "Hide"; }
    else { span.textContent = "••••••••"; e.target.textContent = "Show"; }
  }
  if (copyId) {
    const entry = entries.find((x) => x.id === copyId);
    const field = e.target.dataset.field;
    const val = field === "user" ? entry.user : entry.pass;
    try {
      await navigator.clipboard.writeText(val);
      const orig = e.target.textContent;
      e.target.textContent = "Copied";
      setTimeout(() => (e.target.textContent = orig), 900);
    } catch (err) {}
  }
});

/* ---------- modal ---------- */
const overlay = document.getElementById("overlay");
const fSite = document.getElementById("fSite");
const fUser = document.getElementById("fUser");
const fPass = document.getElementById("fPass");
const modalTitle = document.getElementById("modalTitle");

document.getElementById("openAdd").onclick = () => openModal(null);
document.getElementById("cancelBtn").onclick = closeModal;

function openModal(id) {
  editingId = id;
  if (id) {
    const entry = entries.find((x) => x.id === id);
    modalTitle.textContent = "Edit entry";
    fSite.value = entry.site; fUser.value = entry.user; fPass.value = entry.pass;
  } else {
    modalTitle.textContent = "Add entry";
    fSite.value = ""; fUser.value = ""; fPass.value = "";
  }
  overlay.classList.add("show");
}
function closeModal() { overlay.classList.remove("show"); editingId = null; }
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

document.getElementById("genBtn").onclick = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let pw = "";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 16; i++) pw += chars[arr[i] % chars.length];
  fPass.value = pw;
};

document.getElementById("saveBtn").onclick = async () => {
  const site = fSite.value.trim();
  const user = fUser.value.trim();
  const pass = fPass.value;
  if (!site || !pass) { alert("Site aur password to bharo"); return; }

  if (editingId) {
    const entry = entries.find((x) => x.id === editingId);
    entry.site = site; entry.user = user; entry.pass = pass;
  } else {
    entries.push({ id: crypto.randomUUID(), site, user, pass, note: "" });
  }
  await persist();
  renderList();
  closeModal();
};
