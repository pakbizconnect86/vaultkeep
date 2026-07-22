(function () {
  function guessUsername(form) {
    const inputs = Array.from(form.querySelectorAll("input"));
    let inp = inputs.find((i) => (i.type || "").toLowerCase() === "email");
    if (inp && inp.value) return inp.value;
    inp = inputs.find((i) => {
      const t = (i.type || "").toLowerCase();
      const name = ((i.name || "") + (i.id || "")).toLowerCase();
      return t === "text" && /user|email|login|phone/.test(name);
    });
    if (inp && inp.value) return inp.value;
    inp = inputs.find((i) => (i.type || "").toLowerCase() === "text" && i.value);
    return inp ? inp.value : "";
  }

  function showToast(text) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;bottom:20px;right:20px;background:#131A22;color:#E7ECF1;" +
      "padding:12px 16px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;" +
      "z-index:2147483647;border:1px solid #232D38;box-shadow:0 4px 20px rgba(0,0,0,.4);" +
      "max-width:280px;line-height:1.4;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function attach(form) {
    if (form.dataset.vkAttached) return;
    form.dataset.vkAttached = "1";
    form.addEventListener("submit", () => {
      const pwInput = form.querySelector('input[type="password"]');
      if (!pwInput || !pwInput.value) return;
      const pass = pwInput.value;
      const user = guessUsername(form);
      const domain = location.hostname;

      try {
        chrome.runtime.sendMessage({ type: "CAPTURE_LOGIN", domain, user, pass }, (resp) => {
          if (chrome.runtime.lastError || !resp) return;
          if (resp.status === "saved") showToast("Vaultkeep: password save ho gaya (" + domain + ")");
          if (resp.status === "pending") showToast("Vaultkeep: extension unlock karo is password ko save karne k liye");
        });
      } catch (e) {
        // extension context invalidated, ignore
      }
    });
  }

  function scan() {
    document.querySelectorAll("form").forEach((f) => {
      if (f.querySelector('input[type="password"]')) attach(f);
    });
  }

  scan();
  const obs = new MutationObserver(scan);
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
