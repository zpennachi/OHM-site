import { clamp01 } from "./utils.js";

export function createSections(navItems) {
  const state = {
    activeKey: navItems[0]?.key || "mission",
    heroProgress: 0,
    scrollTarget: 0,
  };

  const root = document.getElementById("sections-root");
  if (!root) throw new Error("Missing #sections-root");

  // Build sections. IMPORTANT:
  // - data-nav="..." marks which NAV key that section belongs to
  // - sections without data-nav are "extra" sections (video/image)
  root.innerHTML = `
    <section id="section-mission" class="section section-hero" data-nav="mission">
      <div class="hero-inner">
        <div>
          <h1 class="hero-title">Ohm</h1>
        </div>
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

  function getSectionIndexFromScroll() {
    const viewportH = window.innerHeight || 1;
    const idxFloat = (window.scrollY + viewportH * 0.5) / viewportH;
    let idx = Math.floor(idxFloat);
    idx = Math.max(0, Math.min(sections.length - 1, idx));
    return idx;
  }

  function deriveActiveNavKey(centerIdx) {
    // If the centered section has a nav key, use it.
    const centered = sections[centerIdx];
    const direct = centered?.getAttribute("data-nav");
    if (direct && navKeySet.has(direct)) return direct;

    // Otherwise, walk backward to find the most recent nav section.
    for (let i = centerIdx; i >= 0; i--) {
      const k = sections[i].getAttribute("data-nav");
      if (k && navKeySet.has(k)) return k;
    }

    // Fallback
    return navItems[0]?.key || "mission";
  }

  function handleScroll() {
    const viewportH = window.innerHeight || 1;

    // scrollTarget should span ALL sections (including video/image)
    const totalScrollable = viewportH * (sections.length - 1);
    const rawT = totalScrollable > 0 ? window.scrollY / totalScrollable : 0;
    state.scrollTarget = clamp01(rawT);

    // heroProgress still just first viewport
    state.heroProgress = clamp01(window.scrollY / Math.max(viewportH, 1));

    const idx = getSectionIndexFromScroll();
    const navKey = deriveActiveNavKey(idx);
    if (navKey !== state.activeKey) state.activeKey = navKey;
  }

  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });

  function handleNavClick(key) {
    // Scroll to the section that has data-nav=key
    const idx = sections.findIndex((s) => s.getAttribute("data-nav") === key);
    if (idx >= 0) {
      const viewportH = window.innerHeight || 1;
      window.scrollTo({ top: idx * viewportH, behavior: "smooth" });
      state.activeKey = key;
    }
  }

  return {
    state,
    handleNavClick,
    dispose() {
      window.removeEventListener("scroll", handleScroll);
    },
  };
}
