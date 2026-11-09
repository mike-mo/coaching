"use strict";
(() => {
  const key = "icf-study-usage-opt-out-v1";
  const origin = "https://smartify.space";
  const modes = ["titles", "questions", "mixed", "conversation", "exam"];
  const production = location.origin === origin &&
    (location.pathname === "/coachprep" || location.pathname.startsWith("/coachprep/"));
  const privateSignal = () => navigator.globalPrivacyControl === true ||
    [navigator.doNotTrack, window.doNotTrack].some(value => value === "1" || value === "yes");
  const toggle = document.querySelector("#usage-opt-out");
  const status = document.querySelector("#usage-status");
  const cycles = new Map();
  const aggregates = new Map(), visits = new Set(), lastAttempts = new Map();
  const interval = 60000, maximumSeconds = 3600, maximumCount = 256, maximumExits = 64;
  let activeMode = null, lastInteraction = -Infinity, lastTick = performance.now();
  let foreground = !document.hidden && document.hasFocus();
  let optedOut = false, preferenceFailed = false, beaconLoaded = false, beaconFailed = false, deliveryFailed = false;
  if (!toggle || !status) {
    console.error("Usage preference controls are unavailable.");
    return;
  }
  function readPreference() {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && !["0", "1"].includes(saved)) throw new Error("Invalid usage preference");
      optedOut = saved === "1";
      preferenceFailed = false;
    } catch {
      optedOut = true;
      preferenceFailed = true;
      console.warn("Usage preference could not be read. Statistics are off.");
    }
  }
  readPreference();
  const allowed = () => production && !privateSignal() && !optedOut && !preferenceFailed;
  function updateStatus() {
    toggle.checked = !allowed();
    toggle.disabled = !production || privateSignal();
    const message = !production ? "Usage stats are off at this address." :
      privateSignal() ? `Study counts are off because this browser sends Do Not Track or Global Privacy Control.${beaconLoaded ? " Reload when convenient to stop page analytics started in this tab." : ""}` :
      preferenceFailed ? "Your usage preference could not be saved or read. Usage stats are off." :
      optedOut ? beaconLoaded ? "Study counts are off now. Reload when convenient to stop page analytics started in this tab." : "Usage stats are off in this browser." :
      beaconFailed || deliveryFailed ? "Some usage stats could not be sent. Studying and saved work are unaffected." :
      "Usage stats are on. You can turn them off here.";
    if (status.textContent !== message) status.textContent = message;
  }
  function loadBeacon() {
    if (!allowed() || beaconLoaded) return;
    beaconLoaded = true;
    const script = document.createElement("script");
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.setAttribute("data-cf-beacon", JSON.stringify({ token: "47f860b809424923942f8c71d6e1cb3a" }));
    script.onerror = () => {
      beaconFailed = true;
      console.warn("Page analytics could not load.");
      updateStatus();
    };
    document.head.append(script);
  }
  function deliveryFailure() {
    if (!deliveryFailed) console.warn("Study usage statistics could not be sent completely.");
    deliveryFailed = true;
    updateStatus();
  }
  function send(payload) {
    if (!allowed()) { updateStatus(); return; }
    try {
      void fetch(`${origin}/coachprep/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        redirect: "error"
      }).then(response => {
        if (response.status !== 204) throw new Error("Usage event was not accepted");
      }).catch(deliveryFailure);
    } catch { deliveryFailure(); }
  }
  function checkMode(mode) {
    if (!modes.includes(mode)) throw new Error("Unsupported study usage mode");
  }
  function pending(mode) {
    if (!aggregates.has(mode)) aggregates.set(mode, { activeMs: 0, answered: 0, hints: 0, passes: 0, exits: 0 });
    return aggregates.get(mode);
  }
  function discardActivity() {
    aggregates.clear();visits.clear();lastInteraction = -Infinity;lastTick = performance.now();
  }
  function add(mode, field, amount, maximum) {
    const data = pending(mode), next = data[field] + amount;
    if (next > maximum) deliveryFailure();
    data[field] = Math.min(next, maximum);
  }
  function account() {
    const now = performance.now();
    if (!allowed()) { discardActivity(); return; }
    if (activeMode && foreground) {
      const duration = Math.max(0, Math.min(now, lastInteraction + interval) - lastTick);
      if (duration) add(activeMode, "activeMs", duration, maximumSeconds * 1000);
    }
    lastTick = now;
  }
  function flushMode(mode) {
    account();
    const data = aggregates.get(mode), now = performance.now();
    if (!data || now - (lastAttempts.get(mode) ?? -Infinity) < interval) return;
    const activeSeconds = Math.floor(data.activeMs / 1000);
    if (!activeSeconds && !data.answered && !data.hints && !data.passes && !data.exits) return;
    const payload = { version: 2, event: "activity", mode, activeSeconds,
      answered: data.answered, hints: data.hints, passes: data.passes, exits: data.exits };
    data.activeMs -= activeSeconds * 1000;
    data.answered = data.hints = data.passes = data.exits = 0;
    lastAttempts.set(mode, now);
    send(payload);
  }
  function flushActivity() { for (const mode of modes) flushMode(mode); }
  window.USAGE = {
    setActive(mode) {
      if (mode !== null) checkMode(mode);
      account();
      if (mode === activeMode) return;
      activeMode = mode;
      lastInteraction = mode && allowed() ? performance.now() : -Infinity;
      if (mode && allowed()) visits.add(mode);
    },
    count(mode, field, amount = 1) {
      checkMode(mode);
      if (!["answered", "hints", "passes"].includes(field) ||
          !Number.isInteger(amount) || amount < 0 || amount > maximumCount ||
          field !== "answered" && !["titles", "mixed"].includes(mode)) throw new Error("Invalid study usage count");
      account();
      if (allowed()) add(mode, field, amount, maximumCount);
    },
    leave(mode) {
      checkMode(mode);account();
      if (!visits.delete(mode)) return;
      add(mode, "exits", 1, maximumExits);flushMode(mode);
    },
    resume(mode) {
      checkMode(mode);
      if (!cycles.has(mode)) cycles.set(mode, { done: false, items: new Set(), started: allowed() });
    },
    begin(mode) {
      checkMode(mode);
      cycles.set(mode, { done: false, items: new Set(), started: allowed() });
      send({ version: 1, event: "start", mode });
    },
    complete(mode) {
      checkMode(mode);
      const cycle = cycles.get(mode);
      if (!cycle || cycle.done) return;
      cycle.done = true;
      visits.delete(mode);flushMode(mode);
      if (cycle.started) send({ version: 1, event: "completion", mode });
    },
    item(mode, id, count) {
      checkMode(mode);
      if (!Number.isInteger(count) || count < 1) throw new Error("Invalid study usage cycle size");
      const cycle = cycles.get(mode);
      if (!cycle || cycle.done) return;
      cycle.items.add(id);
      if (cycle.items.size >= count) this.complete(mode);
    }
  };
  toggle.onchange = () => {
    optedOut = toggle.checked;
    try {
      localStorage.setItem(key, optedOut ? "1" : "0");
      preferenceFailed = false;
    } catch {
      optedOut = true;
      preferenceFailed = true;
      console.warn("Usage preference could not be saved. Statistics are off.");
    }
    discardActivity();
    updateStatus();
    loadBeacon();
  };
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    readPreference();
    discardActivity();
    updateStatus();
    loadBeacon();
  });
  function foregroundChanged() {
    account();foreground = !document.hidden && document.hasFocus();
    if (!foreground) flushActivity();
  }
  for (const name of ["pointerdown", "keydown", "input"]) document.addEventListener(name, event => {
    if (!event.isTrusted || !event.target?.closest?.("#study-dialog,#exam-confirm-dialog")) return;
    account();
    if (activeMode && allowed()) { lastInteraction = performance.now();visits.add(activeMode); }
  }, { capture: true, passive: true });
  document.addEventListener("visibilitychange", foregroundChanged);
  window.addEventListener("focus", foregroundChanged);
  window.addEventListener("blur", foregroundChanged);
  window.addEventListener("pagehide", () => { account();foreground = false;flushActivity(); });
  window.addEventListener("pageshow", foregroundChanged);
  setInterval(flushActivity, interval);
  updateStatus();
  loadBeacon();
})();
