import { clamp01 } from "./utils.js";

export function createSections(navItems) {
  const state = {
    activeKey: navItems[0]?.key || "mission",
    heroProgress: 0,
    scrollTarget: 0,
  };

  const root = document.getElementById("sections-root");
  if (!root) throw new Error("Missing #sections-root");

  root.innerHTML = `
    <section id="section-mission" class="section section-hero" data-nav="mission">
      <div class="hero-inner">
        <div><h1 class="hero-title">Ohm</h1></div>
        <div class="hero-bottom">
          <p class="hero-copy">
            OHM envisions a thriving Capital Region of New York where electronic music and arts serve as a vibrant cultural cornerstone,
            uniting local creatives with global talent and inspiring future generations of artists.
          </p>
          <button id="hero-enter" class="hero-enter" type="button">Enter</button>
        </div>
      </div>
      <div id="hero-scroll-hint" class="hero-scroll-hint">Scroll</div>
    </section>

    <section id="section-video" class="section section-video">
      <div class="section-inner">
        <div class="media-frame">
          <video
            class="section-video-el"
            src="./assets/videos/swirl-loop.mp4"
            controls
            preload="metadata"
            playsinline
          ></video>
        </div>
      </div>
    </section>

    <section id="section-contact" class="section" data-nav="contact">
      <div class="section-inner">
        <h2 class="section-title">Mission</h2>
        <p class="section-body">
          OHM is dedicated to advancing electronic art &amp; music culture in Albany by providing a cutting-edge, multi-disciplinary venue that acts as a creative hub and community space for residents and visitors.
          <br /><br />
          Through fair artist compensation, innovative programming, and active community engagement, our goal is to nurture a creative environment that uplifts local talent, promotes skills-sharing, enriches the cultural landscape, and sparks a new era of creativity in the Capital Region.
        </p>
      </div>
    </section>

    <section id="section-missionImage" class="section section-image">
      <div class="image-fill" role="img" aria-label="Mission image"></div>
    </section>

    <section id="section-donations" class="section" data-nav="donations">
      <div class="section-inner">
        <h2 class="section-title">Donations</h2>
        <p class="section-body">
          The OHM Organization is a grassroots nonprofit dedicated to advancing electronic art and music culture in the NY Capital Region.
          <br /><br />
          Our mission is to nurture a creative environment that uplifts local talent, encourages skill-sharing, and enriches the cultural landscape through collaboration across all styles and art forms. We believe in building more than just events, we’re cultivating a lasting community supported by positive values, shared resources, and meaningful connections.
        </p>
        <button id="cta-donate" class="section-cta" type="button">Support OHM</button>
      </div>
    </section>

    <section id="section-shop" class="section" data-nav="shop">
      <div class="section-inner">
        <h2 class="section-title">Shop</h2>
        <p class="section-body">
          OHM is dedicated to advancing electronic art &amp; music culture in Albany by providing a cutting-edge, multi-disciplinary venue that acts as a creative hub and community space for residents and visitors.
        </p>
        <button id="cta-shop" class="section-cta" type="button">Buy Merch</button>
      </div>
    </section>

    <section id="section-events" class="section" data-nav="events">
      <div class="section-inner">
        <h2 class="section-title">Contact</h2>
        <p class="section-body">
          Reach out to connect with the team, share an idea, or learn more about how you can get involved in building a vibrant, inclusive future for electronic arts in the Capital Region.
        </p>
        <button id="cta-email" class="section-cta" type="button">Email Us</button>
      </div>
    </section>
  `;

  const sections = Array.from(root.querySelectorAll("section.section"));
  const navKeySet = new Set(navItems.map((i) => i.key));

  // Pick the real scroll container (window OR .app-main)
  function getScrollEl() {
    const main = document.querySelector(".app-main");
    if (main && main.scrollHeight > main.clientHeight + 2) return main;
    return document.scrollingElement || document.documentElement;
  }

  let scrollEl = getScrollEl();
  let sectionTops = [];
  let navKeyToIndex = new Map();

  function getScrollTop() {
    return scrollEl === document.scrollingElement || scrollEl === document.documentElement
      ? window.scrollY || 0
      : scrollEl.scrollTop || 0;
  }

  function getViewportH() {
    return scrollEl === document.scrollingElement || scrollEl === document.documentElement
      ? window.innerHeight || 1
      : scrollEl.clientHeight || 1;
  }

  function getScrollable() {
    const vh = getViewportH();
    const sh =
      scrollEl === document.scrollingElement || scrollEl === document.documentElement
        ? (document.documentElement.scrollHeight || 1)
        : (scrollEl.scrollHeight || 1);
    return Math.max(1, sh - vh);
  }

  function recomputeLayoutMaps() {
    // If scrolling is inside .app-main, offsets should be relative to that container
    const base =
      scrollEl === document.scrollingElement || scrollEl === document.documentElement
        ? 0
        : scrollEl.getBoundingClientRect().top;

    sectionTops = sections.map((s) => {
      const r = s.getBoundingClientRect();
      const pageY = r.top - base + getScrollTop();
      return pageY;
    });

    navKeyToIndex = new Map();
    for (let i = 0; i < sections.length; i++) {
      const k = sections[i].getAttribute("data-nav");
      if (k && navKeySet.has(k) && !navKeyToIndex.has(k)) navKeyToIndex.set(k, i);
    }
  }

  function deriveActiveNavKeyByCenter() {
    const centerY = getViewportH() * 0.5;

    let bestIdx = 0;
    let bestDist = Infinity;

    const containerTop =
      scrollEl === document.scrollingElement || scrollEl === document.documentElement
        ? 0
        : scrollEl.getBoundingClientRect().top;

    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      const sectionCenter = (r.top - containerTop) + r.height * 0.5;
      const d = Math.abs(sectionCenter - centerY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const direct = sections[bestIdx]?.getAttribute("data-nav");
    if (direct && navKeySet.has(direct)) return direct;

    for (let i = bestIdx; i >= 0; i--) {
      const k = sections[i].getAttribute("data-nav");
      if (k && navKeySet.has(k)) return k;
    }

    return navItems[0]?.key || "mission";
  }

  function handleScroll() {
    // Re-detect scroll container in case CSS changed
    const next = getScrollEl();
    if (next !== scrollEl) {
      detachScroll();
      scrollEl = next;
      attachScroll();
      recomputeLayoutMaps();
    }

    const st = getScrollTop();
    const scrollable = getScrollable();

    state.scrollTarget = clamp01(st / scrollable);

    const vh = getViewportH();
    state.heroProgress = clamp01(st / Math.max(vh, 1));

    const navKey = deriveActiveNavKeyByCenter();
    if (navKey !== state.activeKey) state.activeKey = navKey;
  }

  function scrollToY(y) {
    if (scrollEl === document.scrollingElement || scrollEl === document.documentElement) {
      window.scrollTo({ top: y, behavior: "smooth" });
    } else {
      scrollEl.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function handleNavClick(key) {
    if (!navKeyToIndex.has(key)) return;
    const idx = navKeyToIndex.get(key);
    const y = sectionTops[idx] ?? 0;
    scrollToY(y);
    state.activeKey = key;
  }

  function attachScroll() {
    if (scrollEl === document.scrollingElement || scrollEl === document.documentElement) {
      window.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    }
  }

  function detachScroll() {
    if (scrollEl === document.scrollingElement || scrollEl === document.documentElement) {
      window.removeEventListener("scroll", handleScroll);
    } else {
      scrollEl.removeEventListener("scroll", handleScroll);
    }
  }

  const onResize = () => {
    recomputeLayoutMaps();
    handleScroll();
  };

  recomputeLayoutMaps();
  handleScroll();

  attachScroll();
  window.addEventListener("resize", onResize);

  // layout shifts (fonts/video)
  setTimeout(onResize, 0);
  setTimeout(onResize, 250);
  setTimeout(onResize, 1000);

  return {
    state,
    handleNavClick,
    dispose() {
      detachScroll();
      window.removeEventListener("resize", onResize);
    },
  };
}
