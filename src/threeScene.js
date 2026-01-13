import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { asset, isIOSUA, isMobileUA, smoothstep01 } from "./utils.js";
import {
  swirlVertexShader,
  swirlFragmentShader,
  swirlFragmentShaderIOS,
  bgVertexShader,
  bgFragmentShader
} from "./shaders.js";

function ensureRecoverOverlay() {
  let el = document.querySelector(".webgl-recover");
  if (el) return el;

  el = document.createElement("div");
  el.className = "webgl-recover";
  el.innerHTML = `
    <div class="panel">
      <h3 class="title">Rendering Paused</h3>
      <p class="body">
        Your browser temporarily stopped the WebGL renderer. Tap reload to continue.
      </p>
      <button class="btn" type="button">Reload</button>
    </div>
  `;

  const btn = el.querySelector("button");
  if (btn) btn.addEventListener("click", () => window.location.reload());

  document.body.appendChild(el);
  return el;
}

export function createThreeScene({
  mountEl,
  getScrollTarget,
  getPointerState,
  modelStates,
  debugApi
}) {
  const isIOS = isIOSUA();
  const isMobile = isMobileUA();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: false
  });

  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.className = "three-canvas";
  mountEl.appendChild(renderer.domElement);

  const gl = renderer.getContext();
  if (!gl) {
    if (debugApi) debugApi.set("webgl", "no-context");
    return {
      startCrossfadeTo() {},
      dispose() {}
    };
  }

  const recoverOverlay = ensureRecoverOverlay();

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

    if (debugApi) debugApi.set("renderer", `${rw}x${rh} (css ${w}x${h})`);
  }

  updateRendererSize();

  const amb = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);

  const slowColor = new THREE.Color(0x8fd9ff);
  const fastColor = new THREE.Color(0xffffff);
  const targetColor = new THREE.Color();

  const texLoader = new THREE.TextureLoader();
  const textureCache = {};
  const planeGeom = new THREE.PlaneGeometry(10, 10);
  let bgMesh = null;

  function prepEnvTex(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
  }

  if (debugApi) debugApi.set("bg", "loading 1-min.jpg");

  texLoader.load(
    asset("assets/images/1-min.jpg"),
    (baseTex) => {
      prepEnvTex(baseTex);
      scene.environment = baseTex;
      textureCache["1-min.jpg"] = baseTex;

      if (isMobile) {
        const bgMaterial = new THREE.MeshBasicMaterial({
          map: baseTex,
          color: new THREE.Color(0.18, 0.18, 0.18),
          depthWrite: false
        });
        bgMesh = new THREE.Mesh(planeGeom, bgMaterial);
        bgMesh.position.set(0, 0, -3);
        scene.add(bgMesh);
      } else {
        const bgMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uTexCurrent: { value: baseTex },
            uTexNext: { value: baseTex },
            uMix: { value: 0 },
            uTime: { value: 0 }
          },
          vertexShader: bgVertexShader,
          fragmentShader: bgFragmentShader,
          transparent: false,
          depthWrite: false
        });
        bgMesh = new THREE.Mesh(planeGeom, bgMaterial);
        bgMesh.position.set(0, 0, -3);
        scene.add(bgMesh);
      }

      if (debugApi) debugApi.set("bg", "ready 1-min.jpg");
    },
    undefined,
    (err) => {
      if (debugApi) debugApi.set("bg", "error 1-min.jpg");
      if (debugApi) debugApi.pushErr(`Texture failed: 1-min.jpg`);
      console.warn("Texture load failed:", asset("assets/images/1-min.jpg"), err);
    }
  );

  const swirlFS = isMobile ? swirlFragmentShaderIOS : swirlFragmentShader;
  let swirlMat = null;
  let model = null;
  let baseScale = 1;
  const basePosition = new THREE.Vector3();
  let bottomShift = 0;
  let scrollProgress = 0;

  if (debugApi) debugApi.set("glb", "loading ohm4.glb");

  const loader = new GLTFLoader();
  loader.load(
    asset("assets/models/ohm4.glb"),
    (gltf) => {
      model = gltf.scene;

      const glassMat = isIOS
        ? new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.25,
            metalness: 0.0,
            transparent: true,
            opacity: 0.35
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.0,
            transmission: 1.0,
            ior: 1.5,
            thickness: 1.0,
            envMapIntensity: 1.6,
            transparent: true,
            opacity: 1.0
          });

      swirlMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 3 },
          uBrightness: { value: 2 },
          uOpacity: { value: 0.5 },
          uDepth: { value: isIOS ? 0.7 : 1.0 },
          uDistortion: { value: isIOS ? 16.0 : 25.0 },
          uSpeed: { value: 1 },
          uCameraPos: { value: camera.position.clone() }
        },
        vertexShader: swirlVertexShader,
        fragmentShader: swirlFS,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        blending: THREE.NormalBlending,
        side: THREE.FrontSide
      });

      model.traverse((child) => {
        if (!child || !child.isMesh) return;

        const mat = child.material;

        if (Array.isArray(mat)) {
          child.material = mat.map((m) => {
            if (!m) return m;
            const name = (m.name || "").toLowerCase();
            if (name.includes("glass")) return glassMat;
            if (name.includes("swirl") && swirlMat) {
              child.renderOrder = 2;
              swirlMat.depthTest = false;
              return swirlMat;
            }
            return m;
          });
        } else if (mat) {
          const name = (mat.name || "").toLowerCase();
          if (name.includes("glass")) {
            child.material = glassMat;
            child.renderOrder = 1;
          }
          if (name.includes("swirl") && swirlMat) {
            child.material = swirlMat;
            child.renderOrder = 2;
            swirlMat.depthTest = false;
          }
        }
      });

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

      if (debugApi) debugApi.set("glb", "ready ohm4.glb");
    },
    undefined,
    (err) => {
      if (debugApi) debugApi.set("glb", "error ohm4.glb");
      if (debugApi) debugApi.pushErr(`GLB failed: ohm4.glb`);
      console.warn("GLB load failed:", asset("assets/models/ohm4.glb"), err);
    }
  );

  let isFading = false;
  let fadeProgress = 0;
  const fadeDuration = 0.2;

  function startCrossfadeTo(fileName) {
    if (!bgMesh) return;
    if (debugApi) debugApi.set("bg", `target ${fileName}`);

    const applyTex = (tex) => {
      prepEnvTex(tex);
      scene.environment = tex;

      const mat = bgMesh.material;
      if (mat instanceof THREE.ShaderMaterial) {
        mat.uniforms.uTexNext.value = tex;
        fadeProgress = 0;
        isFading = true;
      } else if (mat instanceof THREE.MeshBasicMaterial) {
        mat.map = tex;
        mat.needsUpdate = true;
        isFading = false;
      }

      if (debugApi) debugApi.set("bg", `ready ${fileName}`);
    };

    if (textureCache[fileName]) {
      applyTex(textureCache[fileName]);
    } else {
      texLoader.load(
        asset(`assets/images/${fileName}`),
        (tex) => {
          textureCache[fileName] = tex;
          applyTex(tex);
        },
        undefined,
        (err) => {
          if (debugApi) debugApi.pushErr(`Texture failed: ${fileName}`);
          console.warn("Texture load failed:", asset(`assets/images/${fileName}`), err);
        }
      );
    }
  }

  let frameId = 0;
  let lastTime = null;
  let contextLost = false;

  function showRecoverUI(show) {
    recoverOverlay.style.display = show ? "flex" : "none";
  }

  function onContextLost(e) {
    e.preventDefault();
    contextLost = true;
    showRecoverUI(true);
    if (debugApi) debugApi.set("webgl", "context-lost");
  }

  function onContextRestored() {
    contextLost = false;
    showRecoverUI(false);
    if (debugApi) debugApi.set("webgl", "restored (reload recommended)");
  }

  renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

  function animate() {
    frameId = requestAnimationFrame(animate);
    if (contextLost) return;

    const now = performance.now() * 0.001;
    if (lastTime == null) lastTime = now;
    const dt = now - lastTime;
    lastTime = now;

    if (swirlMat) {
      swirlMat.uniforms.uTime.value = now;
      swirlMat.uniforms.uCameraPos.value.copy(camera.position);
    }

    if (bgMesh) {
      const mat = bgMesh.material;
      if (mat instanceof THREE.ShaderMaterial) {
        mat.uniforms.uTime.value = now;
        if (isFading) {
          fadeProgress = Math.min(1, fadeProgress + dt / fadeDuration);
          mat.uniforms.uMix.value = fadeProgress;
          if (fadeProgress >= 1) {
            mat.uniforms.uTexCurrent.value = mat.uniforms.uTexNext.value;
            mat.uniforms.uMix.value = 0.0;
            isFading = false;
          }
        }
      }
    }

    const p = getPointerState();
    const targetIntensity = p.lightIntensity;
    const liLerp = 0.1;
    amb.intensity += (targetIntensity - amb.intensity) * liLerp;
    dir.intensity += (targetIntensity - dir.intensity) * liLerp;

    const speedT = THREE.MathUtils.clamp(p.lightSpeed, 0, 1);
    targetColor.lerpColors(slowColor, fastColor, speedT);
    amb.color.lerp(targetColor, 0.15);
    dir.color.lerp(targetColor, 0.15);

    if (model) {
      const target = getScrollTarget();
      const smoothing = 0.12;
      scrollProgress = scrollProgress + (target - scrollProgress) * smoothing;

      const t = smoothstep01(scrollProgress);

      const states = modelStates;
      const lastIndex = states.length - 1;
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

      const rotLerp = 0.08;
      const pointerStrength = 0.4;
      const targetRotX = baseRotX + p.targetRotation.x * pointerStrength;
      const targetRotY = baseRotY + p.targetRotation.y * pointerStrength;

      model.rotation.x += (targetRotX - model.rotation.x) * rotLerp;
      model.rotation.y += (targetRotY - model.rotation.y) * rotLerp;
    }

    renderer.render(scene, camera);
  }

  animate();

  function onResize() {
    updateRendererSize();
  }

  window.addEventListener("resize", onResize);

  return {
    startCrossfadeTo,
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);

      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      if (mountEl.contains(renderer.domElement)) mountEl.removeChild(renderer.domElement);
      renderer.dispose();
    }
  };
}
