import { clamp01 } from "./utils.js";

export function createSections(navItems) {
  const state = {
    activeKey: navItems[0]?.key || "mission",
    heroProgress: 0,
    scrollTarget: 0,
  };

  const root = document.getElementById("sections-root");
  if (!root) throw new Error("Missing #sections-root");

  // IMPORTANT:
  // - video section gets data-nav="video"
  // - image section gets data-nav="image"
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
    </section>

    <section id="section-video" class="section section-video" data-nav="video">
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

    <section id="section-missionImage" class="section section-image" data-nav="image">
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

  // --------- real scroller detection (simple + reliable) ----------
  const main = document.querySelector(".app-main");

  function mainIsScrollable() {
    if (!main) return false;
    const cs = window.getComputedStyle(main);
    const oy = cs.overflowY;
    const canScroll = oy === "auto" || oy === "scroll" || oy === "overlay";
    return canScroll && main.scrollHeight > main.clientHeight + 2;
  }

  function getScroller() {
    // If app-main is truly scrollable, use it.
    if (mainIsScrollable()) return main;
    // Otherwise the page is scrolling normally.
    return null; // null = window
  }

  function getScrollTop(scroller) {
    return scroller ? scroller.scrollTop || 0 : window.scrollY || 0;
  }

  function getViewportH(scroller) {
    return scroller ? scroller.clientHeight || 1 : window.innerHeight || 1;
  }

  function getScrollable(scroller) {
    if (scroller) {
      return Math.max(1, (scroller.scrollHeight || 1) - (scroller.clientHeight || 1));
    }
    const doc = document.documentElement;
    return Math.max(1, (doc.scrollHeight || 1) - (window.innerHeight || 1));
  }

  // map nav key -> first section with that data-nav
  let navKeyToSection = new Map();
  function recomputeMaps() {
    navKeyToSection = new Map();
    for (const s of sections) {
      const k = s.getAttribute("data-nav");
      if (k && navKeySet.has(k) && !navKeyToSection.has(k)) navKeyToSection.set(k, s);
    }
  }

  function deriveActiveNavKeyByCenter(scroller) {
    const centerY = getViewportH(scroller) * 0.5;
    const containerTop = scroller ? scroller.getBoundingClientRect().top : 0;

    let bestIdx = 0;
    let bestDist = Infinity;

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

    // fallback upward
    for (let i = bestIdx; i >= 0; i--) {
      const k = sections[i].getAttribute("data-nav");
      if (k && navKeySet.has(k)) return k;
    }

    return navItems[0]?.key || "mission";
  }

  function updateState() {
    const scroller = getScroller();
    const st = getScrollTop(scroller);
    const scrollable = getScrollable(scroller);
    const vh = getViewportH(scroller);

    state.scrollTarget = clamp01(st / scrollable);
    state.heroProgress = clamp01(st / Math.max(vh, 1));

    const navKey = deriveActiveNavKeyByCenter(scroller);
    if (navKey !== state.activeKey) state.activeKey = navKey;
  }

  function hardScrollToSection(sectionEl) {
    if (!sectionEl) return;

    const scroller = getScroller();

    if (scroller) {
      // scrolling inside app-main
      const y = sectionEl.offsetTop || 0;
      scroller.scrollTo({ top: y, behavior: "smooth" });
    } else {
      // window scroll
      const y = Math.max(
        0,
        Math.round(sectionEl.getBoundingClientRect().top + (window.scrollY || 0) - 90)
      );
      window.scrollTo({ top: y, behavior: "smooth" });
      document.documentElement.scrollTop = y;
      document.body.scrollTop = y;
    }
  }

  function handleNavClick(key) {
    const section = navKeyToSection.get(key);
    if (!section) return;
    hardScrollToSection(section);
    state.activeKey = key;
  }

  recomputeMaps();
  updateState();

  // update continuously so it always tracks the correct scroller
  let raf = 0;
  function tick() {
    updateState();
    raf = requestAnimationFrame(tick);
  }
  tick();

  const onResize = () => {
    recomputeMaps();
    updateState();
  };
  window.addEventListener("resize", onResize);

  // layout shifts (fonts/video)
  setTimeout(onResize, 0);
  setTimeout(onResize, 250);
  setTimeout(onResize, 1000);

  return {
    state,
    handleNavClick,
    getScrollTarget: () => state.scrollTarget,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    },
  };
}
