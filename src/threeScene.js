import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { asset } from "./utils.js";

export function createThreeScene({
  mountEl,
  getScrollTarget,
  getPointerState,
  modelStates,
  debugApi,
}) {
  const dbg = debugApi || null;
  const log = (k, v) => {
    if (dbg && typeof dbg.set === "function") dbg.set(k, v);
  };
  const err = (m) => {
    if (dbg && typeof dbg.pushErr === "function") dbg.pushErr(m);
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    45,
    (window.innerWidth || 1) / (window.innerHeight || 1),
    0.1,
    1000
  );
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: false,
  });

  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  renderer.domElement.className = "three-canvas";
  mountEl.appendChild(renderer.domElement);

  const MAX_RENDER_PIXELS = 1000 * 1000;

  function updateRendererSize() {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    const area = w * h;
    let scale = 1;
    if (area > MAX_RENDER_PIXELS) scale = Math.sqrt(MAX_RENDER_PIXELS / area);

    const rw = Math.max(1, Math.round(w * scale));
    const rh = Math.max(1, Math.round(h * scale));

    renderer.setSize(rw, rh, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    log("r", `${rw}x${rh}`);
  }

  updateRendererSize();

  const amb = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 1.15);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);

  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, 2, -6);
  scene.add(rim);

  const slowColor = new THREE.Color(0x8fd9ff);
  const fastColor = new THREE.Color(0xffffff);
  const targetColor = new THREE.Color();

  const texLoader = new THREE.TextureLoader();
  const textureCache = new Map();

  function prepEnvTexture(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  function loadTextureFile(fileName, cb) {
    if (textureCache.has(fileName)) {
      cb(textureCache.get(fileName));
      return;
    }
    const url = asset(`images/${fileName}`);
    log("tex", url);
    texLoader.load(
      url,
      (tex) => {
        textureCache.set(fileName, tex);
        cb(tex);
      },
      undefined,
      () => err(`Texture failed: ${fileName}`)
    );
  }

  const planeGeom = new THREE.PlaneGeometry(10, 10);

  const bgMatA = new THREE.MeshBasicMaterial({
    map: null,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });

  const bgMatB = new THREE.MeshBasicMaterial({
    map: null,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const bgMeshA = new THREE.Mesh(planeGeom, bgMatA);
  const bgMeshB = new THREE.Mesh(planeGeom, bgMatB);

  bgMeshA.position.set(0, 0, -3);
  bgMeshB.position.set(0, 0, -3);

  bgMeshA.renderOrder = -10;
  bgMeshB.renderOrder = -9;

  scene.add(bgMeshA);
  scene.add(bgMeshB);

  let fadeFromA = true;
  let isFading = false;
  let fadeT = 0;
  const fadeDuration = 0.22;

  function setInitialBg(tex) {
    const t = prepEnvTexture(tex);
    scene.environment = t;

    bgMatA.map = t;
    bgMatB.map = t;
    bgMatA.needsUpdate = true;
    bgMatB.needsUpdate = true;

    bgMatA.opacity = 1;
    bgMatB.opacity = 0;

    fadeFromA = true;
    isFading = false;
    fadeT = 0;
  }

  function startCrossfadeTo(fileName) {
    loadTextureFile(fileName, (tex) => {
      const t = prepEnvTexture(tex);
      scene.environment = t;

      const fromMat = fadeFromA ? bgMatA : bgMatB;
      const toMat = fadeFromA ? bgMatB : bgMatA;

      toMat.map = t;
      toMat.needsUpdate = true;
      toMat.opacity = 0;

      isFading = true;
      fadeT = 0;
    });
  }

  loadTextureFile("1-min.jpg", setInitialBg);

  const videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  videoEl.preload = "auto";
  videoEl.crossOrigin = "anonymous";
  videoEl.src = asset("videos/swirl-loop.mp4");

  log("vid", videoEl.src);

  const tryPlay = () => {
    const p = videoEl.play();
    if (p && typeof p.then === "function") p.catch(() => {});
  };

  tryPlay();

  const resumeOnGesture = () => {
    tryPlay();
    window.removeEventListener("pointerdown", resumeOnGesture);
    window.removeEventListener("touchstart", resumeOnGesture);
    window.removeEventListener("click", resumeOnGesture);
  };

  window.addEventListener("pointerdown", resumeOnGesture, { once: true });
  window.addEventListener("touchstart", resumeOnGesture, { once: true });
  window.addEventListener("click", resumeOnGesture, { once: true });

  const videoTexture = new THREE.VideoTexture(videoEl);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.generateMipmaps = false;

  videoTexture.mapping = THREE.EquirectangularReflectionMapping;
  videoTexture.wrapS = THREE.ClampToEdgeWrapping;
  videoTexture.wrapT = THREE.ClampToEdgeWrapping;

  const swirlVideoMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.0,
    transmission: 0.0,
    envMap: videoTexture,
    envMapIntensity: 2.2,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 1.0,
  });

  swirlVideoMat.depthWrite = true;
  swirlVideoMat.depthTest = true;

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.0,
    transmission: 1.0,
    ior: 1.52,
    thickness: 1.25,
    envMapIntensity: 2.6,
    transparent: true,
    opacity: 0.55,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    attenuationColor: new THREE.Color(0xffffff),
    attenuationDistance: 0.0,
  });

  glassMat.depthWrite = false;

  let model = null;
  let baseScale = 1;
  const basePosition = new THREE.Vector3();
  let bottomShift = 0;
  let scrollProgress = 0;

  const loader = new GLTFLoader();
  const glbUrl = asset("models/ohm4.glb");
  log("glb", glbUrl);

  loader.load(
    glbUrl,
    (gltf) => {
      model = gltf.scene;

      let assignedGlass = 0;
      let assignedSwirl = 0;

      model.traverse((child) => {
        if (!child || !child.isMesh) return;

        const mats = Array.isArray(child.material) ? child.material : [child.material];

        let usesGlass = false;
        let usesSwirl = false;

        for (const m of mats) {
          if (!m) continue;
          const n = (m.name || "").toLowerCase();
          if (n.includes("glass")) usesGlass = true;
          if (n.includes("swirl")) usesSwirl = true;
        }

        if (usesSwirl) {
          child.material = swirlVideoMat;
          child.renderOrder = 1;
          assignedSwirl++;
        }

        if (usesGlass) {
          child.material = glassMat;
          child.renderOrder = 2;
          assignedGlass++;
        }

        if (usesGlass) {
          child.material.transparent = true;
          child.material.opacity = glassMat.opacity;
          child.material.depthWrite = false;
        }
      });

      log("m_glass", String(assignedGlass));
      log("m_swirl", String(assignedSwirl));

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      model.position.sub(center);

      const maxSide = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2 / maxSide;

      model.scale.setScalar(scale);
      baseScale = scale;
      basePosition.copy(model.position);

      bottomShift = (size.y / 2) * scale;

      scene.add(model);
    },
    undefined,
    () => err("GLB failed: ohm4.glb")
  );

  let frameId = 0;
  let lastTime = null;

  function animate() {
    frameId = requestAnimationFrame(animate);

    const now = performance.now() * 0.001;
    if (lastTime == null) lastTime = now;
    const dt = now - lastTime;
    lastTime = now;

    if (isFading) {
      fadeT = Math.min(1, fadeT + dt / fadeDuration);

      const fromMat = fadeFromA ? bgMatA : bgMatB;
      const toMat = fadeFromA ? bgMatB : bgMatA;

      toMat.opacity = fadeT;
      fromMat.opacity = 1 - fadeT;

      if (fadeT >= 1) {
        fadeFromA = !fadeFromA;
        isFading = false;
        fadeT = 0;
        toMat.opacity = 1;
        fromMat.opacity = 0;
      }
    }

    const ps =
      (typeof getPointerState === "function" ? getPointerState() : null) || {
        targetRotation: { x: 0, y: 0 },
        lightIntensity: 0.7,
        lightSpeed: 0,
      };

    const targetIntensity = ps.lightIntensity ?? 0.7;
    const liLerp = 0.1;

    amb.intensity += (targetIntensity - amb.intensity) * liLerp;
    dir.intensity += (targetIntensity - dir.intensity) * liLerp;
    rim.intensity += (targetIntensity - rim.intensity) * 0.08;

    const speedT = THREE.MathUtils.clamp(ps.lightSpeed ?? 0, 0, 1);
    targetColor.lerpColors(slowColor, fastColor, speedT);

    amb.color.lerp(targetColor, 0.15);
    dir.color.lerp(targetColor, 0.15);
    rim.color.lerp(targetColor, 0.15);

    if (model) {
      const target = typeof getScrollTarget === "function" ? getScrollTarget() : 0;
      const smoothing = 0.12;

      const tRaw = scrollProgress + (target - scrollProgress) * smoothing;
      scrollProgress = tRaw;

      const t = tRaw * tRaw * (3 - 2 * tRaw);

      const states = Array.isArray(modelStates) && modelStates.length ? modelStates : [];
      const lastIndex = Math.max(0, states.length - 1);

      if (lastIndex > 0) {
        const scaled = t * lastIndex;
        const idx0 = Math.floor(scaled);
        const idx1 = Math.min(lastIndex, idx0 + 1);
        const f = THREE.MathUtils.clamp(scaled - idx0, 0, 1);

        const s0 = states[idx0];
        const s1 = states[idx1];

        const zoom = THREE.MathUtils.lerp(s0.zoom, s1.zoom, f);
        const yShiftFactor = THREE.MathUtils.lerp(s0.yShift, s1.yShift, f);
        const baseRotX = THREE.MathUtils.lerp(s0.rotX, s1.rotX, f);
        const baseRotY = THREE.MathUtils.lerp(s0.rotY, s1.rotY, f);

        model.scale.setScalar(baseScale * zoom);

        const shiftY = bottomShift * yShiftFactor;
        model.position.x = basePosition.x;
        model.position.z = basePosition.z;
        model.position.y = basePosition.y + shiftY;

        const pr = ps.targetRotation || { x: 0, y: 0 };
        const pointerX = pr.x || 0;
        const pointerY = pr.y || 0;

        const rotLerp = 0.08;
        const pointerStrength = 0.4;

        const targetRotX = baseRotX + pointerX * pointerStrength;
        const targetRotY = baseRotY + pointerStrength * pointerY;

        model.rotation.x += (targetRotX - model.rotation.x) * rotLerp;
        model.rotation.y += (targetRotY - model.rotation.y) * rotLerp;
      }
    }

    renderer.render(scene, camera);
  }

  animate();

  function onResize() {
    updateRendererSize();
  }

  window.addEventListener("resize", onResize);

  function destroy() {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", onResize);

    try {
      videoTexture.dispose();
    } catch (_) {}

    try {
      videoEl.pause();
      videoEl.src = "";
      videoEl.load();
    } catch (_) {}

    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }

    renderer.dispose();
  }

  return { startCrossfadeTo, destroy };
}
