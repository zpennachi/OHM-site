export function mountFooterNav({ items, getActiveKey, onItemHover, onItemLeave, onItemClick }) {
  const root = document.getElementById("footer-nav");
  if (!root) return { dispose() {} };

  root.innerHTML = "";
  const btns = new Map();

  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "footer-button";
    btn.textContent = item.label;

    btn.addEventListener("mouseenter", () => {
      btn.classList.add("is-hover");
      onItemHover(item);
    });

    btn.addEventListener("mouseleave", () => {
      btn.classList.remove("is-hover");
      onItemLeave();
    });

    btn.addEventListener("click", () => onItemClick(item.key));

    root.appendChild(btn);
    btns.set(item.key, btn);
  });

  let raf = 0;
  const tick = () => {
    const activeKey = getActiveKey();
    for (const [key, btn] of btns.entries()) {
      btn.classList.toggle("is-active", key === activeKey);
    }
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      root.innerHTML = "";
      btns.clear();
    }
  };
}
