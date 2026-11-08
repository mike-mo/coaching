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
  function send(event, mode) {
    if (!allowed()) { updateStatus(); return; }
    void fetch(`${origin}/coachprep/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, event, mode }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      redirect: "error"
    }).then(response => {
      if (response.status !== 204) throw new Error("Usage event was not accepted");
    }).catch(() => {
      if (!deliveryFailed) console.warn("Study usage statistics could not be sent.");
      deliveryFailed = true;
      updateStatus();
    });
  }
  function checkMode(mode) {
    if (!modes.includes(mode)) throw new Error("Unsupported study usage mode");
  }
  window.USAGE = {
    resume(mode) {
      checkMode(mode);
      if (!cycles.has(mode)) cycles.set(mode, { done: false, items: new Set(), started: allowed() });
    },
    begin(mode) {
      checkMode(mode);
      cycles.set(mode, { done: false, items: new Set(), started: allowed() });
      send("start", mode);
    },
    complete(mode) {
      checkMode(mode);
      const cycle = cycles.get(mode);
      if (!cycle || cycle.done) return;
      cycle.done = true;
      if (cycle.started) send("completion", mode);
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
    updateStatus();
    loadBeacon();
  };
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    readPreference();
    updateStatus();
    loadBeacon();
  });
  updateStatus();
  loadBeacon();
})();
