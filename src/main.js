import { setVhVar, isIOSUA, isMobileUA } from "./utils.js";
import { createSections } from "./sections.js";
import { mountFooterNav } from "./footerNav.js";
import { createThreeScene } from "./threeScene.js";

const NAV_ITEMS = [
  { key: "mission", label: "Home", image: "1-min.jpg" },
  { key: "contact", label: "Mission", image: "2-min.jpg" },
  { key: "donations", label: "Donate", image: "3-min.jpg" },
  { key: "shop", label: "Shop", image: "4-min.jpg" },
  { key: "events", label: "Contact", image: "5-min.jpg" },
];

const MODEL_STATES = [
  { zoom: 1.0, yShift: 0.0, rotX: 0.0, rotY: 0.0 },
  { zoom: 4.0, yShift: 2.5, rotX: 0.0, rotY: 1.0 },
  { zoom: 7.0, yShift: 2.0, rotX: 0.0, rotY: 0.0 },
  { zoom: 5.2, yShift: 1.5, rotX: -1.15, rotY: -3.0 },
  { zoom: 1.0, yShift: 0.0, rotX: 0.0, rotY: -3.0 },
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
    state.lightIntensity =
      minIntensity + (maxIntensityVal - minIntensity) * vNorm;
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

/**
 * ✅ Robust scroll progress: auto-detect the actual scrolling container.
 * Logs to console which scroller is used and the live scroll01 value.
 */
const getScroll01 = (() => {
  let scroller = null; // HTMLElement or "window"
  let didLogChoice = false;

  function isScrollableEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const cs = getComputedStyle(el);
    const oy = cs.overflowY;
    const canScroll = oy === "auto" || oy === "scroll" || oy === "overlay";
    return canScroll && el.scrollHeight > el.clientHeight + 2;
  }

  function findScroller() {
    // Prefer a real scrollable ancestor of sections-root if it exists.
    const anchor = document.getElementById("sections-root");
    let el = anchor;

    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollableEl(el)) return el;
      el = el.parentElement;
    }

    // Otherwise use window.
    return "window";
  }

  function read01(from) {
    if (from === "window") {
      const se = document.scrollingElement || document.documentElement;
      const st = window.scrollY || se.scrollTop || 0;
      const max = Math.max(1, (se.scrollHeight || 1) - (window.innerHeight || 1));
      return Math.max(0, Math.min(1, st / max));
    } else {
      const st = from.scrollTop || 0;
      const max = Math.max(1, (from.scrollHeight || 1) - (from.clientHeight || 1));
      return Math.max(0, Math.min(1, st / max));
    }
  }

  return function getScroll01() {
    if (!scroller) {
      scroller = findScroller();
      if (!didLogChoice) {
        didLogChoice = true;
        console.log(
          "[scroll] scroller picked:",
          scroller === "window"
            ? "window"
            : `${scroller.tagName.toLowerCase()}#${scroller.id || ""}.${(scroller.className || "")
                .toString()
                .replace(/\s+/g, ".")}`
        );
      }
    }

    const v = read01(scroller);
    console.log("scroll01:", v.toFixed(3));
    return v;
  };
})();

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

(function boot() {
  setVhVar();

  console.log("ios:", String(isIOSUA()));
  console.log("mobile:", String(isMobileUA()));
  console.log("url:", window.location.pathname);

  const pointer = createPointerLightControls();
  const sections = createSections(NAV_ITEMS);

  const mountEl = document.getElementById("three-root");
  if (!mountEl) {
    console.error("Missing #three-root");
    return;
  }

  const three = createThreeScene({
    mountEl,
    // ✅ Critical: Three reads actual scroll progress
    getScrollTarget: () => getScroll01(),
    getPointerState: () => pointer.state,
    modelStates: MODEL_STATES,
    debugApi: null,
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
    requestAnimationFrame(tick);
  }

  tick();
})();
