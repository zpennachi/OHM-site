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

  const amb = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 1.35);
  dir.position.set(6, 10, 7.5);
  scene.add(dir);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-7, 2, -7);
  scene.add(rim);

  const slowColor = new THREE.Color(0x8fd9ff);
  const fastColor = new THREE.Color(0xffffff);
  const targetColor = new THREE.Color();

  const texLoader = new THREE.TextureLoader();
  const textureCache = new Map();

  function prepBgTexture(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
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
    const t = prepBgTexture(tex);
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
      const t = prepBgTexture(tex);

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

  // ---------------- VIDEO ----------------
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
  videoTexture.wrapS = THREE.RepeatWrapping;
  videoTexture.wrapT = THREE.RepeatWrapping;

  // This controls how “zoomed” the video appears on the inner sphere.
  // Bigger = LESS zoom (more of the video visible).
  const VIDEO_TILING = 0.75;

  // ---------------- INNER VIDEO PROJECTION SHADER ----------------
  // Projects the video onto the sphere using normals -> spherical UVs.
  // This ignores the model's UVs completely, so it cannot be "zoomed in" by bad UVs.
  const innerVideoMat = new THREE.ShaderMaterial({
    uniforms: {
      uVideo: { value: videoTexture },
      uBrightness: { value: 1.0 },
      uContrast: { value: 1.05 },
      uSaturation: { value: 1.05 },
      uTiling: { value: VIDEO_TILING },
      uSpin: { value: 0.0 }, // optional rotation of mapping
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vN;

      uniform sampler2D uVideo;
      uniform float uBrightness;
      uniform float uContrast;
      uniform float uSaturation;
      uniform float uTiling;
      uniform float uSpin;

      const float PI = 3.14159265359;

      vec3 applySaturation(vec3 c, float s) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return mix(vec3(l), c, s);
      }

      void main() {
        vec3 n = normalize(vN);

        // spherical coords
        float u = atan(n.z, n.x) / (2.0 * PI) + 0.5;
        float v = asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5;

        // optional spin around vertical axis
        float cu = u - 0.5;
        cu += uSpin;
        u = cu + 0.5;

        vec2 uv = vec2(u, v);

        // tiling controls zoom
        uv = (uv - 0.5) / uTiling + 0.5;

        // repeat wrap
        uv = fract(uv);

        vec3 col = texture2D(uVideo, uv).rgb;

        // mild grade so it doesn't blow out or wash
        col = (col - 0.5) * uContrast + 0.5;
        col *= uBrightness;
        col = applySaturation(col, uSaturation);

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });

  // ---------------- GLASS + SURFACE SHELL ----------------
  // Base physical glass (transmission/refraction-ish)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.0,
    transmission: 1.0,
    ior: 1.52,
    thickness: 1.6,
    envMapIntensity: 1.0,
    transparent: true,
    opacity: 1.0,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  glassMat.depthWrite = false;
  glassMat.side = THREE.DoubleSide;

  // Fresnel “surface” highlight so the glass is visible even without a perfect HDR environment
  const fresnelMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffffff) },
      uStrength: { value: 0.65 }, // more = more visible surface
      uPower: { value: 2.2 }, // higher = tighter rim
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vN;
      varying vec3 vV;
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uPower;

      void main() {
        float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPower);
        float a = fres * uStrength;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });

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
      let addedShells = 0;

      model.traverse((child) => {
        if (!child || !child.isMesh) return;

        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];

        let usesGlass = false;
        let usesSwirl = false;

        for (const m of mats) {
          if (!m) continue;
          const n = (m.name || "").toLowerCase();
          if (n.includes("glass")) usesGlass = true;
          if (n.includes("swirl")) usesSwirl = true;
        }

        if (usesSwirl) {
          child.material = innerVideoMat;
          child.renderOrder = 1;
          assignedSwirl++;
        }

        if (usesGlass) {
          child.material = glassMat;
          child.renderOrder = 2;
          assignedGlass++;

          child.material.transparent = true;
          child.material.opacity = 1.0;
          child.material.depthWrite = false;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;

          // Add a thin fresnel shell as a child mesh once
          if (!child.userData.__hasFresnelShell) {
            const shell = new THREE.Mesh(child.geometry, fresnelMat);
            shell.renderOrder = 3;
            shell.frustumCulled = false;
            shell.scale.setScalar(1.002); // tiny expansion to avoid z-fighting
            child.add(shell);
            child.userData.__hasFresnelShell = true;
            addedShells++;
          }
        }
      });

      log("m_glass", String(assignedGlass));
      log("m_swirl", String(assignedSwirl));
      log("shells", String(addedShells));

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
