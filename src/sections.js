import { clamp01 } from "./utils.js";

export function createSections(navItems) {
  const state = {
    activeKey: navItems[0]?.key || "mission",
    heroProgress: 0,
    scrollTarget: 0,
  };

  const root = document.getElementById("sections-root");
  if (!root) throw new Error("Missing #sections-root");

  // Keep your same markup (with data-nav on sections you want tracked)
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

  const navKeySet = new Set(navItems.map((i) => i.key));
  const allSections = Array.from(root.querySelectorAll("section.section"));

  // Only sections that are part of nav keys participate in activeKey
  const tracked = allSections.filter((s) => {
    const k = s.getAttribute("data-nav");
    return k && navKeySet.has(k);
  });

  const navKeyToSection = new Map();
  for (const s of tracked) {
    const k = s.getAttribute("data-nav");
    if (k && !navKeyToSection.has(k)) navKeyToSection.set(k, s);
  }

  // --- Window scroll only: drive scrollTarget + heroProgress ---
  function handleScroll() {
    const st = window.scrollY || 0;
    const doc = document.documentElement;
    const scrollable = Math.max(1, (doc.scrollHeight || 1) - (window.innerHeight || 1));
    state.scrollTarget = clamp01(st / scrollable);

    const vh = window.innerHeight || 1;
    state.heroProgress = clamp01(st / Math.max(vh, 1));
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  // --- Active section tracking via IntersectionObserver ---
  // Choose the section most centered in the viewport:
  // rootMargin shrinks observer box so "center-ish" wins.
  const io = new IntersectionObserver(
    (entries) => {
      // Pick highest intersectionRatio among currently intersecting entries
      let best = null;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
      }
      if (!best) return;

      const key = best.target.getAttribute("data-nav");
      if (key && navKeySet.has(key) && key !== state.activeKey) {
        state.activeKey = key;
      }
    },
    {
      root: null,
      threshold: [0.15, 0.25, 0.35, 0.5, 0.65],
      rootMargin: "-35% 0px -35% 0px",
    }
  );

  for (const s of tracked) io.observe(s);

  // --- Click-to-scroll: no math, no bugs ---
  function handleNavClick(key) {
    const section = navKeyToSection.get(key);
    if (!section) return;

    // Minimal offset for your fixed header shell
    // We'll scroll into view then nudge slightly.
    section.scrollIntoView({ behavior: "smooth", block: "start" });

    // Nudge to account for header
    setTimeout(() => {
      window.scrollBy({ top: -90, left: 0, behavior: "instant" });
    }, 250);

    state.activeKey = key;
  }

  return {
    state,
    handleNavClick,
    dispose() {
      window.removeEventListener("scroll", handleScroll);
      io.disconnect();
    },
  };
}
