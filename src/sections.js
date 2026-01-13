import { clamp01, smoothstep01 } from "./utils.js";

export function createSections(navItems) {
  const state = {
    activeKey: navItems[0]?.key || "mission",
    heroProgress: 0,
    scrollTarget: 0
  };

  function updateActiveClasses(activeKey) {
    for (const item of navItems) {
      const el = document.getElementById(item.key);
      if (!el) continue;
      el.classList.toggle("is-active", item.key === activeKey);
    }
  }

  function updateOverlayOpacity(heroProgress) {
    const eased = smoothstep01(heroProgress);
    const uiOpacity = eased;

    const topShell = document.getElementById("top-shell");
    const footer = document.getElementById("footer-nav");
    if (topShell) {
      topShell.style.opacity = String(uiOpacity);
      topShell.style.pointerEvents = uiOpacity > 0.05 ? "auto" : "none";
    }
    if (footer) {
      footer.style.opacity = String(uiOpacity);
      footer.style.pointerEvents = uiOpacity > 0.05 ? "auto" : "none";
    }
  }

  function handleScroll() {
    const viewportH = window.innerHeight || 1;
    const totalSections = navItems.length;
    const totalScrollable = viewportH * (totalSections - 1);

    const rawT = totalScrollable > 0 ? window.scrollY / totalScrollable : 0;
    state.scrollTarget = clamp01(rawT);

    state.heroProgress = clamp01(window.scrollY / Math.max(viewportH, 1));

    const indexFloat = (window.scrollY + viewportH * 0.5) / viewportH;
    let idx = Math.floor(indexFloat);
    idx = Math.max(0, Math.min(totalSections - 1, idx));

    const newKey = navItems[idx].key;
    if (state.activeKey !== newKey) state.activeKey = newKey;

    updateActiveClasses(state.activeKey);
    updateOverlayOpacity(state.heroProgress);
  }

  function handleNavClick(key) {
    const idx = navItems.findIndex((i) => i.key === key);
    if (idx >= 0) {
      const viewportH = window.innerHeight || 1;
      window.scrollTo({ top: idx * viewportH, behavior: "smooth" });
    }
    state.activeKey = key;
    updateActiveClasses(state.activeKey);
  }

  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });

  return {
    state,
    handleNavClick,
    dispose() {
      window.removeEventListener("scroll", handleScroll);
    }
  };
}
