const VK = {};
VK.enc = new TextEncoder();
VK.dec = new TextDecoder();

VK.bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
VK.b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

VK.deriveKey = async function (password, saltB64) {
  const salt = VK.b64ToBuf(saltB64);
  const keyMat = await crypto.subtle.importKey(
    "raw", VK.enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

VK.encryptJSON = async function (key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = VK.enc.encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: VK.bufToB64(iv), data: VK.bufToB64(cipher) };
};

VK.decryptJSON = async function (key, payload) {
  const iv = VK.b64ToBuf(payload.iv);
  const cipher = VK.b64ToBuf(payload.data);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(VK.dec.decode(plain));
};

if (typeof self !== "undefined") self.VK = VK;
