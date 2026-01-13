export function mountFooterNav({
  items,
  getActiveKey,
  onItemHover,
  onItemLeave,
  onItemClick,
}) {
  const mountEl = document.getElementById("footer-nav");
  if (!mountEl) return;

  mountEl.innerHTML = `
    <div class="footer-nav-inner">
      ${items
        .map(
          (it) =>
            `<button class="footer-button" data-key="${it.key}" type="button">${it.label}</button>`
        )
        .join("")}
    </div>
  `;

  const buttons = Array.from(mountEl.querySelectorAll(".footer-button"));

  function setActive(key) {
    for (const b of buttons) {
      const isActive = b.getAttribute("data-key") === key;
      b.classList.toggle("is-active", isActive);
    }
  }

  for (const b of buttons) {
    const key = b.getAttribute("data-key");

    b.addEventListener("mouseenter", () => {
      const item = items.find((x) => x.key === key);
      if (item && typeof onItemHover === "function") onItemHover(item);
    });

    b.addEventListener("mouseleave", () => {
      if (typeof onItemLeave === "function") onItemLeave();
    });

    b.addEventListener("click", () => {
      if (typeof onItemClick === "function") onItemClick(key);
    });
  }

  let raf = 0;
  function tick() {
    const key = typeof getActiveKey === "function" ? getActiveKey() : null;
    if (key) setActive(key);
    raf = requestAnimationFrame(tick);
  }
  tick();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      mountEl.innerHTML = "";
    },
  };
}
