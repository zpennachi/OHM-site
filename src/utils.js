export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function smoothstep01(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}

export function asset(path) {
  if (path.startsWith("./")) return path;
  return `./${path.replace(/^\/+/, "")}`;
}

export function isIOSUA() {
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document)
  );
}

export function isMobileUA() {
  const ua = navigator.userAgent || "";
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    ("ontouchstart" in window && ua.includes("Mobile"))
  );
}

export function setVhVar() {
  const setVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--app-vh", `${vh}px`);
  };
  setVh();
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", setVh);
  return () => {
    window.removeEventListener("resize", setVh);
    window.removeEventListener("orientationchange", setVh);
  };
}
