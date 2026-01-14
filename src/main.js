import { setVhVar, isIOSUA, isMobileUA } from "./utils.js";
import { createSections } from "./sections.js";
import { mountFooterNav } from "./footerNav.js";
import { createThreeScene } from "./threeScene.js";

const NAV_ITEMS = [
  { key: "mission", label: "Home", image: "1-min.jpg" },
  { key: "video", label: "Video", image: "2-min.jpg" },
  { key: "contact", label: "Mission", image: "2-min.jpg" },
  { key: "image", label: "Photo", image: "3-min.jpg" },
  { key: "donations", label: "Donate", image: "3-min.jpg" },
  { key: "shop", label: "Shop", image: "4-min.jpg" },
  { key: "events", label: "Contact", image: "5-min.jpg" },
];

// 7 states to match 7 nav items (t maps smoothly across them)
const MODEL_STATES = [
  { zoom: 1.0, yShift: 0.0, rotX: 0.0, rotY: 0.0 },    // Home
  { zoom: 2.4, yShift: 1.2, rotX: 0.0, rotY: 0.7 },    // Video
  { zoom: 4.0, yShift: 2.5, rotX: 0.0, rotY: 1.0 },    // Mission
  { zoom: 6.0, yShift: 2.2, rotX: -0.4, rotY: 0.3 },   // Photo
  { zoom: 7.0, yShift: 2.0, rotX: 0.0, rotY: 0.0 },    // Donate
  { zoom: 5.2, yShift: 1.5, rotX: -1.15, rotY: -3.0 }, // Shop
  { zoom: 1.0, yShift: 0.0, rotX: 0.0, rotY: -3.0 },   // Contact
];

function createPointerLightControls() {
  const state = {
    targetRotation: { x: 0, y: 0 },
    lightIntensity: 0.7,
    lightSpeed: 0,
  };

  let lastX = window.innerWidth / 2;
  let lastY = window.innerHeight / 2;
  let lastTime = performance.now();

  function onMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    const now = performance.now();
    const dt = Math.max((now - lastTime) / 1000, 0.001);
    const dx = x - lastX;
    const dy = y - lastY;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;

    lastX = x;
    lastY = y;
    lastTime = now;

    const nx = x / window.innerWidth - 0.5;
    const ny = y / window.innerHeight - 0.5;
    const maxAngle = Math.PI / 3;

    state.targetRotation = { x: -ny * maxAngle, y: nx * maxAngle };

    const vNorm = Math.min(speed / 1000, 1);
    const minIntensity = 0.4;
    const maxIntensityVal = 2.5;
    state.lightIntensity = minIntensity + (maxIntensityVal - minIntensity) * vNorm;
    state.lightSpeed = vNorm;
  }

  window.addEventListener("pointermove", onMove);

  return {
    state,
    dispose() {
      window.removeEventListener("pointermove", onMove);
    },
  };
}

function createDebugOverlay() {
  const params = new URLSearchParams(window.location.search);
  let enabled = params.get("debug") === "1";

  const kv = new Map();
  const errs = [];
  let el = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "debug-overlay";
    document.body.appendChild(el);
    return el;
  }

  function render() {
    if (!enabled) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      el = null;
      return;
    }

    const node = ensureEl();
    const lines = [];
    lines.push("DEBUG");
    for (const [k, v] of kv.entries()) lines.push(`${k}: ${v}`);
    if (errs.length) {
      lines.push("");
      lines.push("errors:");
      for (let i = 0; i < Math.min(errs.length, 6); i++) lines.push(`- ${errs[i]}`);
      if (errs.length > 6) lines.push(`- (+${errs.length - 6} more)`);
    }

    node.innerHTML = `<div class="debug-title">debug (press D to toggle)</div><pre style="margin:8px 0 0 0;white-space:pre-wrap;">${lines.join(
      "\n"
    )}</pre>`;
  }

  function set(key, value) {
    kv.set(key, value);
    render();
  }

  function pushErr(msg) {
    errs.unshift(msg);
    if (errs.length > 30) errs.pop();
    render();
  }

  function toggle() {
    enabled = !enabled;
    render();
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "d" || e.key === "D") toggle();
  });

  render();

  return {
    set,
    pushErr,
    toggle,
    isEnabled: () => enabled,
  };
}

function setupButtons(handleNavClick) {
  const heroEnter = document.getElementById("hero-enter");
  if (heroEnter) heroEnter.addEventListener("click", () => handleNavClick("contact"));

  const donate = document.getElementById("cta-donate");
  if (donate) {
    donate.addEventListener("click", () => {
      window.location.href =
        "https://www.gofundme.com/f/build-a-long-lasting-infrastructure-for-the-electronic-arts?lang=en_US";
    });
  }

  const shop = document.getElementById("cta-shop");
  if (shop) {
    shop.addEventListener("click", () => {
      window.location.href = "https://www.shopify.com/";
    });
  }

  const email = document.getElementById("cta-email");
  if (email) {
    email.addEventListener("click", () => {
      window.location.href = "mailto:ohmalbany@gmail.com?subject=Hello!";
    });
  }
}

// Guaranteed scrollTarget (independent of sections state)
function makeScrollTargetGetter() {
  const main = document.querySelector(".app-main");

  const mainIsScrollable = () => {
    if (!main) return false;
    const cs = window.getComputedStyle(main);
    const oy = cs.overflowY;
    const canScroll = oy === "auto" || oy === "scroll" || oy === "overlay";
    return canScroll && main.scrollHeight > main.clientHeight + 2;
  };

  return () => {
    if (mainIsScrollable()) {
      const st = main.scrollTop || 0;
      const scrollable = Math.max(1, (main.scrollHeight || 1) - (main.clientHeight || 1));
      return Math.max(0, Math.min(1, st / scrollable));
    } else {
      const st = window.scrollY || 0;
      const doc = document.documentElement;
      const scrollable = Math.max(1, (doc.scrollHeight || 1) - (window.innerHeight || 1));
      return Math.max(0, Math.min(1, st / scrollable));
    }
  };
}

(function boot() {
  setVhVar();

  const debug = createDebugOverlay();
  debug.set("ios", String(isIOSUA()));
  debug.set("mobile", String(isMobileUA()));
  debug.set("url", window.location.pathname);

  const pointer = createPointerLightControls();
  const sections = createSections(NAV_ITEMS);

  const mountEl = document.getElementById("three-root");
  if (!mountEl) {
    debug.pushErr("Missing #three-root");
    return;
  }

  const getScrollTarget = makeScrollTargetGetter();

  const three = createThreeScene({
    mountEl,
    getScrollTarget, // <- IMPORTANT: Three uses guaranteed scrollTarget now
    getPointerState: () => pointer.state,
    modelStates: MODEL_STATES,
    debugApi: debug,
  });

  setupButtons(sections.handleNavClick);

  const getActiveItem = () =>
    NAV_ITEMS.find((i) => i.key === sections.state.activeKey) || NAV_ITEMS[0];

  three.startCrossfadeTo(getActiveItem().image);

  mountFooterNav({
    items: NAV_ITEMS,
    getActiveKey: () => sections.state.activeKey,
    onItemHover: (item) => three.startCrossfadeTo(item.image),
    onItemLeave: () => three.startCrossfadeTo(getActiveItem().image),
    onItemClick: (key) => sections.handleNavClick(key),
  });

  let lastActive = sections.state.activeKey;

  function tick() {
    const active = sections.state.activeKey;
    if (active !== lastActive) {
      lastActive = active;
      three.startCrossfadeTo(getActiveItem().image);
    }

    // optional debug
    if (debug.isEnabled()) {
      debug.set("t", getScrollTarget().toFixed(3));
      debug.set("active", String(active));
    }

    requestAnimationFrame(tick);
  }

  tick();
})();
